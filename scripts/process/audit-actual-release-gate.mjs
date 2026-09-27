#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const MANIFEST='data/current/actual-release-manifest.json';
const OUTPUT='data/current/actual-release-gate.json';
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
const manifestBuf=await readFile(MANIFEST);
const manifest=JSON.parse(manifestBuf.toString('utf8'));
const paths=Object.fromEntries(Object.entries(manifest.components||{}).map(([key,value])=>[key,value?.path]).filter(([,path])=>path));
const buffers={};
for(const [key,path] of Object.entries(paths))buffers[key]=await readFile(path);
const json=key=>JSON.parse(buffers[key].toString('utf8'));
const catalog=json('catalog');
const inventory=json('inventory');
const roGeo=json('ro_geojson');
const mdGeo=json('md_geojson');
const roGate=json('ro_gate');
const mdGate=json('md_gate');
const siruta=json('ro_official');
const cuatm=json('md_official');
const jurisdictions=['RO','MD'];
const entities=Array.isArray(catalog.entities)?catalog.entities:[];
const entityCounts=Object.fromEntries(jurisdictions.map(j=>[j,entities.filter(e=>e.jurisdiction===j).length]));
const featureCounts={
 RO:Array.isArray(roGeo.features)?roGeo.features.length:0,
 MD:Array.isArray(mdGeo.features)?mdGeo.features.length:0
};
const currentHashes=Object.fromEntries(Object.entries(buffers).map(([key,buf])=>[key,sha256(buf)]));
const fingerprintPayload={
 mode:'ACTUAL',
 jurisdictions,
 components:Object.fromEntries(Object.keys(manifest.components||{}).map(key=>[key,currentHashes[key]??null]))
};
const fingerprint=sha256(Buffer.from(JSON.stringify(fingerprintPayload),'utf8'));
const expectedSnapshotId='actual-'+fingerprint.slice(0,16);
const failures=[],checks=[];
const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};

check('manifest_mode_is_actual',manifest.mode==='ACTUAL',{mode:manifest.mode});
check('manifest_jurisdictions_are_exactly_ro_md',
 Array.isArray(manifest.jurisdictions)&&manifest.jurisdictions.length===2&&manifest.jurisdictions[0]==='RO'&&manifest.jurisdictions[1]==='MD',
 {jurisdictions:manifest.jurisdictions});
check('jurisdiction_release_gates_pass',roGate.status==='PASS'&&mdGate.status==='PASS',{RO:roGate.status,MD:mdGate.status});
check('manifest_records_passing_jurisdiction_gates',
 manifest.jurisdiction_gates?.RO?.status==='PASS'&&manifest.jurisdiction_gates?.MD?.status==='PASS',
 {RO:manifest.jurisdiction_gates?.RO?.status,MD:manifest.jurisdiction_gates?.MD?.status});

const componentDrift=[];
for(const [key,entry] of Object.entries(manifest.components||{})){
 const actual=currentHashes[key]??null;
 if(actual!==entry?.sha256)componentDrift.push({key,path:entry?.path??null,expected:entry?.sha256??null,actual});
}
check('manifest_component_hashes_match_current_snapshot',componentDrift.length===0,{drift:componentDrift});
check('release_fingerprint_matches_current_components',
 manifest.release_fingerprint_sha256===fingerprint,
 {expected:manifest.release_fingerprint_sha256,actual:fingerprint});
check('snapshot_id_matches_release_fingerprint',manifest.snapshot_id===expectedSnapshotId,{expected:expectedSnapshotId,actual:manifest.snapshot_id});

check('catalog_declared_entity_count_is_consistent',
 catalog.entity_count===entities.length,
 {declared:catalog.entity_count,actual:entities.length});
check('manifest_catalog_entity_count_is_current',
 manifest.catalog?.entity_count===entities.length&&manifest.catalog?.declared_entity_count===catalog.entity_count,
 {manifest:manifest.catalog?.entity_count,manifest_declared:manifest.catalog?.declared_entity_count,catalog_declared:catalog.entity_count,actual:entities.length});
check('actual_catalog_contains_current_entities_only',
 entities.every(e=>e.status==='current'),
 {non_current:entities.filter(e=>e.status!=='current').slice(0,25).map(e=>({id:e.id,status:e.status}))});
check('manifest_jurisdiction_entity_counts_are_current',
 jurisdictions.every(j=>manifest.catalog?.entity_count_by_jurisdiction?.[j]===entityCounts[j]),
 {manifest:manifest.catalog?.entity_count_by_jurisdiction,actual:entityCounts});
check('manifest_classifier_version_is_current',
 manifest.catalog?.classifier_version===catalog.classifier_version,
 {manifest:manifest.catalog?.classifier_version,actual:catalog.classifier_version});
check('manifest_administrative_model_is_current',
 manifest.administrative_model?.schema_version===inventory.schema_version&&manifest.administrative_model?.as_of===inventory.as_of,
 {manifest:{schema_version:manifest.administrative_model?.schema_version,as_of:manifest.administrative_model?.as_of},actual:{schema_version:inventory.schema_version,as_of:inventory.as_of}});

check('public_geojson_feature_counts_are_nonzero',featureCounts.RO>0&&featureCounts.MD>0,featureCounts);
check('manifest_public_geojson_feature_counts_are_current',
 manifest.geometry?.RO?.feature_count===featureCounts.RO&&manifest.geometry?.MD?.feature_count===featureCounts.MD,
 {manifest:{RO:manifest.geometry?.RO?.feature_count,MD:manifest.geometry?.MD?.feature_count},actual:featureCounts});

check('manifest_jurisdiction_gate_timestamps_are_current',
 manifest.jurisdiction_gates?.RO?.generated_at===roGate.generated_at&&manifest.jurisdiction_gates?.MD?.generated_at===mdGate.generated_at,
 {manifest:{RO:manifest.jurisdiction_gates?.RO?.generated_at,MD:manifest.jurisdiction_gates?.MD?.generated_at},actual:{RO:roGate.generated_at,MD:mdGate.generated_at}});

const sirutaCount=siruta.record_count??(Array.isArray(siruta.records)?siruta.records.length:null);
const cuatmCount=cuatm.record_count??(Array.isArray(cuatm.records)?cuatm.records.length:null);
check('manifest_ro_official_source_is_current',
 manifest.official_sources?.RO?.reference_year===siruta.reference_year
 && manifest.official_sources?.RO?.fetched_at===siruta.fetched_at
 && manifest.official_sources?.RO?.record_count===sirutaCount
 && manifest.official_sources?.RO?.semantic_sha256===(siruta.semantic_sha256??null)
 && manifest.official_sources?.RO?.source_content_sha256===(siruta.source?.content_sha256??null),
 {manifest:manifest.official_sources?.RO,actual:{reference_year:siruta.reference_year,fetched_at:siruta.fetched_at,record_count:sirutaCount,semantic_sha256:siruta.semantic_sha256??null,source_content_sha256:siruta.source?.content_sha256??null}});
check('manifest_md_official_source_is_current',
 manifest.official_sources?.MD?.source_url===(cuatm.source_url??null)
 && manifest.official_sources?.MD?.fetched_at===(cuatm.fetched_at??null)
 && manifest.official_sources?.MD?.record_count===cuatmCount,
 {manifest:manifest.official_sources?.MD,actual:{source_url:cuatm.source_url??null,fetched_at:cuatm.fetched_at??null,record_count:cuatmCount}});

const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 mode:'ACTUAL',
 snapshot_id:manifest.snapshot_id??null,
 manifest_path:MANIFEST,
 manifest_sha256:sha256(manifestBuf),
 status:failures.length?'FAIL':'PASS',
 policy:'The public ACTUAL RO+MD release is publishable only when both jurisdiction gates pass and the release manifest exactly fingerprints the current catalog, administrative model, public GeoJSON snapshots and official-source snapshots. Any byte-level drift or metadata/count mismatch fails closed.',
 checks,
 failures
};
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
