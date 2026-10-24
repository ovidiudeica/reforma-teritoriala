#!/usr/bin/env node
// Read-only exact OSM tag census for pinned Republic of Moldova and reused NI roles.
// Does NOT mutate source data, ACTUAL, legal parents, geometries or public site.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';

const sha256=x=>createHash('sha256').update(x).digest('hex');
const argv=process.argv;
const arg=n=>{let k=argv.indexOf(n);return k>=0?argv[k+1]:null};
const output=resolve(arg('--output')||'outputs/md-ni-tags-audit');
const read=n=>JSON.parse(readFileSync(n,'utf8'));
const src=read('data/sources/osm-current.json');
const md=src.countries?.MD;
assert(md && md.selected_relation_count===2596, 'Expected pinned MD 2596 selected relations');
const raw=readFileSync(md.snapshot_path);
assert.equal(sha256(raw),md.compressed_sha256,'MD snapshot compressed SHA256 drift');
const snapshot=JSON.parse(gunzipSync(raw).toString('utf8'));
assert(Array.isArray(snapshot.elements),'MD Overpass snapshot elements missing');
const relations=snapshot.elements.filter(e=>e.type==='relation');
const byId=new Map(relations.map(r=>[String(r.id),r]));
const ids=md.selected_relation_ids.map(String);
assert.equal(ids.length,2596);
assert.equal(new Set(ids).size,2596);
const missing=ids.filter(id=>!byId.has(id));
assert.equal(missing.length,0,'MD snapshot missing selected relations: '+missing.slice(0,5));
const selected=ids.map(id=>byId.get(id)).sort((a,b)=>a.id-b.id);
const rows=selected.map(r=>({osm_relation_id:r.id,osm_version:r.version??null,osm_timestamp:r.timestamp??null,tags:r.tags??{}}));

const ni=read('docs/p9.0.7.2.15-osm-tag-census.json');
const semantics=read('docs/p9.0.7.2.15-osm-semantic-reconciliation.json');
assert.equal(ni.rows.length,85);
const semanticById=new Map(semantics.rows.map(r=>[String(r.osm_relation_id),r]));
const niRows=ni.rows.map(r=>({osm_relation_id:Number(r.osm_relation_id),actual_id:r.actual_id,pinned_osm_version:r.relation_version,pinned_osm_timestamp:r.relation_timestamp,
  osm_role:semanticById.get(String(r.osm_relation_id))?.osm_role_from_tags??null,
  tags:r.tags, legal_parent_validated:false}));
assert.equal(new Set(niRows.map(r=>r.osm_relation_id)).size,85);

function census(rows){
 const keys=new Map(),levels=new Map(),values={};
 for(const r of rows){const tags=r.tags;for(const [k,v] of Object.entries(tags)){keys.set(k,(keys.get(k)||0)+1);
  if(['admin_level','boundary','type','place','place:ro','name:prefix','ref:cuatm:2:codunic','ref:cuatm:statut','ISO3166-2'].includes(k)){
   if(!values[k])values[k]={};values[k][v]=(values[k][v]||0)+1;
  }}
  const l=tags.admin_level??'<MISSING>';levels.set(l,(levels.get(l)||0)+1);
 }
 return {total:rows.length,distinct_keys:keys.size,coverage:Object.fromEntries([...keys.entries()].sort((a,b)=>a[0].localeCompare(b[0]))),admin_levels:Object.fromEntries([...levels.entries()].sort((a,b)=>a[0].localeCompare(b[0]))),selected_values:values};
}
const mdCensus=census(rows);
const niCensus=census(niRows);
const mdById=new Map(rows.map(r=>[String(r.osm_relation_id),r]));
const crosswalk=niRows.map(r=>{
 const baseline=mdById.get(String(r.osm_relation_id));
 const rawDelta=[];
 if(baseline){const keys=new Set([...Object.keys(baseline.tags),...Object.keys(r.tags)]);
  for(const k of [...keys].sort())if(baseline.tags[k]!==r.tags[k])rawDelta.push({key:k,md_snapshot:baseline.tags[k]??null,ni_pinned:r.tags[k]??null});
 }
 return {osm_relation_id:r.osm_relation_id,actual_id:r.actual_id,in_selected_md_snapshot:!!baseline,
  md_snapshot_version:baseline?.osm_version??null,ni_pinned_version:r.pinned_osm_version,
  tag_delta_between_different_dates:rawDelta,do_not_infer_legal_ni_parent:true};
});
const allKeys=new Set([...Object.keys(mdCensus.coverage),...Object.keys(niCensus.coverage)]);
const tagMatrix=[...allKeys].sort().map(k=>({key:k,MD_count:mdCensus.coverage[k]||0,NI_reused_85_count:niCensus.coverage[k]||0}));
const flagged={
 md_statistical_entities_outside_osm_snapshot:6,
 ni_reused_with_md_cuatm:niRows.filter(r=>Object.keys(r.tags).some(k=>k.startsWith('ref:cuatm:'))).length,
 ni_with_admin_level_8:niRows.filter(r=>r.tags.admin_level==='8').length,
 ni_with_admin_level_4:niRows.filter(r=>r.tags.admin_level==='4').length,
 ni_with_place_municipality:niRows.filter(r=>r.tags.place==='municipality').length,
 ni_md_snapshot_not_found:crosswalk.filter(r=>!r.in_selected_md_snapshot).length,
 ni_md_tag_drift_across_dates:crosswalk.filter(r=>r.tag_delta_between_different_dates.length).length
};
const report={schema:'md-ni-osm-tag-audit-v1',source:'© OpenStreetMap contributors (ODbL)',audit_day:'2026-10-24',
 source_snapshot_date:md.snapshot_at,snapshot_zip_sha256:sha256(raw),snapshot_path:md.snapshot_path,
 ni_pinned_census_day:ni.capture_day,ni_pinned_census_sha256:sha256(readFileSync('docs/p9.0.7.2.15-osm-tag-census.json')),
 scope:{MD_OSM_RELATIONS:rows.length,MD_ACTUAL_STATISTICAL_NON_RELATIONS:6,NI_REUSED_OSM_RELATIONS:niRows.length,NI_ROOT_AND_SEVEN_SOURCE_ONLY:'separate live-source record'},
 MD:mdCensus,NI_REUSED_85:niCensus,flagged,
 interpretation:'Metadata and tags identify OSM entities, not the legal authority of a jurisdiction. Nistrenia reused 85 are the same OSM relation identities present in Moldova ACTUAL. Difference across snapshots may be time changes. The seven de facto outline relations are separate and must not be mixed with MD CUATM classifications.',
 protected:{actual_changed:false,cuatm_changed:false,polygons_changed:false,p91_import_allowed:false},
 completeness:{MD_selected_snapshot_tags_complete:true,NI_reused_85_tags_complete:true,NI_root_and_seven_source_only_live_tag_audit_separate:true,post_2026_10_05_MD_changes_not_examined:true,OSM_Boundaries_export_all_tags_not_available_without_paid_tier:true}
};
mkdirSync(output,{recursive:true});
const write=(n,v)=>writeFileSync(resolve(output,n),JSON.stringify(v,null,2)+'\n','utf8');
write('summary.json',report);write('all-tag-keys-md-ni.json',tagMatrix);write('ni85-md-crosswalk.json',crosswalk);
writeFileSync(resolve(output,'md-all-2596-tags.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
writeFileSync(resolve(output,'ni-reused-85-tags.jsonl'),niRows.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log('MD_NI_TAG_AUDIT_PASS '+JSON.stringify({
 md_relations:rows.length,ni_roles:niRows.length,md_keys:mdCensus.distinct_keys,ni_keys:niCensus.distinct_keys,
 ni_cuatm:flagged.ni_reused_with_md_cuatm,missing_ni_from_md:flagged.ni_md_snapshot_not_found,temporal_tag_differences:flagged.ni_md_tag_drift_across_dates,
 md_admin_levels:mdCensus.admin_levels,ni_admin_levels:niCensus.admin_levels,
 snapshot_sha256:sha256(raw)
}));
