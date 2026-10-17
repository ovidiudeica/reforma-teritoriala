// P9.0.9 — deterministic, read-only grouping of 85 source-verified OSM roles; no ACTUAL changes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const source=JSON.parse(readFileSync('docs/p9.0.7.2.15-osm-semantic-reconciliation.json','utf8'));
const roles=JSON.parse(readFileSync('public/data/p907216-osm-roles.json','utf8'));
const groupDefinitions=[
 ['1702216','Camenca'],['1702217','Rîbnița'],['1702215','Dubăsari'],
 ['1702214','Grigoriopol'],['1702219','Tiraspol'],['1702218','Slobozia'],['944727','Bender']
];
assert.equal(source.schema_version,'p907215-two-axis-osm-semantic-reconciliation-v1');
assert.equal(source.total,85);
assert.equal(source.relation_tags_accepted,85);
assert.equal(source.legal_certification_accepted,0);
assert.equal(source.p91_import_allowed,false);
assert.equal(source.actual_mutation_allowed,false);
assert.equal(roles.contract,'p907216-osm-role-ui-overlay-v1');
assert.equal(roles.rows.length,85);
assert.equal(roles.legal_de_facto_certified,0);
assert.equal(roles.no_new_geometries,true);
const roleSet=new Set(roles.rows.map(r=>r.id));
assert.equal(roleSet.size,85);
const groups=groupDefinitions.map(([osmId,label])=>{
 const role_ids=source.rows.filter(row=>String(row.geometric_osm_parent_id)===osmId).map(row=>row.actual_id);
 assert(role_ids.length>0);
 return {group_id:'osm-r'+osmId,label,osm_relation_id:Number(osmId),
  osm_url:'https://www.openstreetmap.org/relation/'+osmId,
  relation_kind:'OSM_GEOMETRIC_GROUP_ONLY',role_ids,role_count:role_ids.length};
});
const ids=groups.flatMap(g=>g.role_ids);
assert.equal(ids.length,85,'Some relations have no geometric OSM group');
assert.equal(new Set(ids).size,85,'Repeated source relations');
for(const id of ids)assert(roleSet.has(id),'Source OSM role not in validated ACTUAL index: '+id);
assert.deepEqual(new Set(ids),new Set(source.rows.map(row=>row.actual_id)));
const catalog={
 schema:'p909-nistrenia-osm-navigation-v1',
 source:'docs/p9.0.7.2.15-osm-semantic-reconciliation.json',
 source_osm_snapshot_at:roles.osm_source_date,
 source_ledger_sha256:source.upstream_verified_geometry_ledger_sha256,
 root_label:'Nistrenia',
 root_osm_relation_id:65335,
 root_osm_url:'https://www.openstreetmap.org/relation/65335',
 root_has_actual_geometry:false,
 root_is_legal_jurisdiction:false,
 mode:'VIRTUAL_OSM_CARTOGRAPHIC_GROUPS_EXISTING_ACTUAL_ONLY',
 group_count:7,entity_count:85,
 role_catalog_contract:roles.contract,
 legal_semantic_acceptance:'BLOCKED_INCOMPLETE',
 p91_import_allowed:false,actual_mutation_allowed:false,
 groups
};
const target='public/data/p909-nistrenia-osm-navigation.json',output=JSON.stringify(catalog,null,2)+'\n';
if(process.argv.includes('--check')){
 assert.equal(readFileSync(target,'utf8'),output,'P9.0.9 menu drift');
 console.log('P909_MENU_REPRO_PASS: 7 groups, 85 existing ACTUAL IDs, 0 additional geometry or legal authority');
}else{
 writeFileSync(target,output);
 console.log('P909_MENU_GENERATED: 7 groups, 85 existing ACTUAL IDs');
}
