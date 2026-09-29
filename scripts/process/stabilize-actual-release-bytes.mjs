#!/usr/bin/env node
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {
  maxIsoTimestamp,
  sha256,
  stabilizeJsonBytes
} from '../lib/actual-byte-stability.mjs';

const BASE_REF=process.env.ACTUAL_BASE_REF;
if(!BASE_REF)throw new Error('ACTUAL_BASE_REF is required for byte stabilization');

const OUTPUT='data/current/actual-byte-reproducibility-audit.json';
const PATHS={
  catalog:'data/current/entities.json',
  inventory:'data/current/administrative-inventory.json',
  ro_geojson:'public/geo/current/ro-administrative.geojson',
  md_geojson:'public/geo/current/md-administrative.geojson',
  public_index:'public/data/actual-entities.json',
  ro_overview:'public/geo/actual/ro-overview.geojson',
  ro_local:'public/geo/actual/ro-local.geojson',
  ro_detail:'public/geo/actual/ro-detail.geojson',
  md_overview:'public/geo/actual/md-overview.geojson',
  md_local:'public/geo/actual/md-local.geojson',
  md_detail:'public/geo/actual/md-detail.geojson',
  ro_gate:'data/current/ro-release-gate.json',
  md_gate:'data/current/md-release-gate.json',
  ro_official:'data/sources/ro-siruta-current.json',
  md_official:'data/sources/cuatm-current.json',
  md_individual_review:'data/sources/md-cuatm-individual-review.json',
  md_semantic_bridge:'data/current/md-cuatm-semantic-bridge.json',
  topology_audit:'data/current/actual-topology-audit.json',
  regression_audit:'data/current/actual-regression-audit.json',
  structural_completeness_audit:'data/current/actual-structural-completeness-audit.json',
  official_identity_audit:'data/current/actual-official-identity-audit.json',
  settlement_policy:'data/sources/actual-settlement-policy.json'
};

const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const [osm,siruta,cuatm]=await Promise.all([
  readJson('data/sources/osm-current.json'),
  readJson('data/sources/ro-siruta-current.json'),
  readJson('data/sources/cuatm-current.json')
]);
const osmTimes=[
  osm.snapshot_at,
  ...Object.values(osm.countries||{}).map(entry=>entry?.snapshot_at)
];
const stableTimestamp=maxIsoTimestamp([
  ...osmTimes,
  siruta.fetched_at,
  cuatm.fetched_at
]);

const NON_ADMIN_METADATA_COMPONENTS=new Set(['catalog','ro_geojson','md_geojson']);
const POST_STABILIZATION_OUTPUTS=new Set([
  OUTPUT,
  'data/current/actual-release-manifest.json',
  'data/current/actual-release-gate.json',
  'data/current/actual-candidate-diff.json',
  'data/current/actual-release-candidate.json'
]);
const explicitPaths=new Set(Object.values(PATHS));
const currentJsonPaths=(await readdir('data/current',{withFileTypes:true}))
  .filter(entry=>entry.isFile()&&entry.name.endsWith('.json'))
  .map(entry=>'data/current/'+entry.name)
  .filter(path=>!explicitPaths.has(path)&&!POST_STABILIZATION_OUTPUTS.has(path))
  .sort();
const stabilizationEntries=[
  ...Object.entries(PATHS),
  ...currentJsonPaths.map(path=>['aux:'+path.slice('data/current/'.length,-'.json'.length),path])
];

const results=[];
for(const [key,path] of stabilizationEntries){
  const currentBytes=await readFile(path);
  let baseBytes;
  try{
    baseBytes=execFileSync('git',['show',BASE_REF+':'+path],{maxBuffer:256*1024*1024});
  }catch(error){
    throw new Error(`Cannot read base component ${path} from ${BASE_REF}: ${error.message}`);
  }
  const beforeSha=sha256(currentBytes);
  const baseSha=sha256(baseBytes);
  const ignoreNonAdministrativeMetadata=NON_ADMIN_METADATA_COMPONENTS.has(key);
  const stabilized=stabilizeJsonBytes({baseBytes,currentBytes,stableTimestamp,ignoreNonAdministrativeMetadata});
  const afterSha=sha256(stabilized.bytes);
  if(!currentBytes.equals(stabilized.bytes))await writeFile(path,stabilized.bytes);
  const replay=stabilizeJsonBytes({baseBytes,currentBytes:stabilized.bytes,stableTimestamp,ignoreNonAdministrativeMetadata});
  const replaySha=sha256(replay.bytes);
  if(replaySha!==afterSha)throw new Error(`Byte stabilization is not idempotent for ${path}`);
  results.push({
    key,
    path,
    action:stabilized.action,
    semantic_equal_to_base:stabilized.semantic_equal_to_base,
    non_administrative_metadata_ignored:ignoreNonAdministrativeMetadata,
    base_sha256:baseSha,
    after_sha256:afterSha,
    changed_before_stabilization:beforeSha!==baseSha,
    matches_base_after_stabilization:afterSha===baseSha,
    idempotent:true
  });
}

const nonBase=results.filter(x=>!x.matches_base_after_stabilization);
const report={
  schema_version:2,
  mode:'ACTUAL_BYTE_REPRODUCIBILITY',
  base_ref:BASE_REF,
  stable_source_timestamp:stableTimestamp,
  status:'PASS',
  stabilized_file_count:results.length,
  release_component_count:Object.keys(PATHS).length,
  auxiliary_data_current_json_count:currentJsonPaths.length,
  restored_or_already_base_count:results.length-nonBase.length,
  substantive_or_source_changed_file_count:nonBase.length,
  components:results,
  policy:'Before candidate manifest construction, every explicit release component plus every base-tracked JSON artifact under data/current that can be swept into the candidate tree is restored to exact base bytes when it differs only by controlled artifact-runtime metadata or object-key ordering. Substantive changes are canonicalized with the stable source timestamp. Raw pre-stabilization hashes are deliberately excluded because they encode runtime-clock noise. For catalog and master GeoJSON only, Wikipedia/Wikidata fields are additionally treated as non-administrative metadata. Stabilization is idempotent and fails closed if a candidate-staged base JSON cannot be read from the immutable base.'
};

await mkdir('data/current',{recursive:true});
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  status:report.status,
  stable_source_timestamp:stableTimestamp,
  stabilized_file_count:report.stabilized_file_count,
  release_component_count:report.release_component_count,
  auxiliary_data_current_json_count:report.auxiliary_data_current_json_count,
  restored_or_already_base_count:report.restored_or_already_base_count,
  substantive_or_source_changed_file_count:report.substantive_or_source_changed_file_count,
  changed_before_stabilization:results.filter(x=>x.changed_before_stabilization).map(x=>x.key),
  non_base_after_stabilization:nonBase.map(x=>x.key)
},null,2));
