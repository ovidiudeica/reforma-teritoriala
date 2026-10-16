// P9.0.7.2.16: presentation-only derivative; NEVER changes ACTUAL, geometry, hierarchy or legal identity.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source='docs/p9.0.7.2.15-osm-semantic-reconciliation.json';
const release='data/current/actual-release-manifest.json';
const index='public/data/actual-entities.json';
const target='public/data/p907216-osm-roles.json';
const parse=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const src=parse(source),manifest=parse(release),idx=parse(index);
const entity=new Map(idx.entities.map(e=>[e.id,e]));
assert.equal(src.total,85);
assert.equal(src.pinned_geometry_accepted,85);
assert.equal(src.legal_certification_accepted,0);
assert.equal(src.actual_production_overlay_enabled,false);
assert.equal(manifest.public_contract.path,index);
assert.equal(manifest.public_contract.entity_count,idx.entity_count);
assert.equal(entity.size,idx.entity_count);
const labels={
 OSM_RURAL_COUNCIL_AREA:'Perimetru de consiliu sătesc (OSM)',
 OSM_SETTLEMENT_COUNCIL_AREA:'Perimetru de consiliu al așezării (OSM)',
 OSM_CITY_COUNCIL_AREA:'Perimetru de consiliu orășenesc (OSM)',
 OSM_LEVEL8_MUNICIPALITY_AREA_UNSPECIFIED:'Zonă administrativă locală, tip nespecificat (OSM)',
 OSM_CITY_BOUNDARY:'Limită de oraș (OSM)',
 OSM_TOWN_BOUNDARY:'Limită de localitate urbană (OSM)',
 OSM_VILLAGE_BOUNDARY:'Limită de sat (OSM)',
 OSM_LEVEL4_MUNICIPALITY_BOUNDARY:'Limită de municipiu, nivel 4 (OSM)'
};
const rows=src.rows.map(x=>{
 const e=entity.get(x.actual_id);
 assert(e,'Missing ACTUAL existing geometry entity: '+x.actual_id);
 assert.equal(e.jurisdiction,'MD');
 assert.equal(e.representation.source,'OpenStreetMap');
 assert.equal(String(e.representation.osm_relation_id),x.osm_relation_id);
 assert.equal(String(e.representation.admin_level),x.osm_admin_level);
 assert.equal(e.representation.place??null,x.osm_place);
 assert(Array.isArray(e.map?.bbox)&&e.map.bbox.length===4);
 assert.equal(x.cartographic_geometry_acceptance,'ACCEPTED_PINNED_OSM_GEOMETRY');
 assert.equal(x.cartographic_osm_tag_acceptance,'ACCEPTED_EXACT_RELATION_TAGS');
 assert.equal(x.de_facto_legal_2026_parent_certification,'BLOCKED_INCOMPLETE');
 assert.equal(x.permission_to_promote_ACTUAL,false);
 assert(x.legal_moldova_parent_unchanged);
 const label=labels[x.osm_role_from_tags];
 assert(label,'Unrecognized OSM role: '+x.osm_role_from_tags);
 return {
  id:x.actual_id,
  existing_actuaL_entity_id:e.id,
  display_name:e.display_name,
  osm_name:x.osm_name,
  osm_name_ro:x.osm_name_ro,
  role:x.osm_role_from_tags,
  role_label:label,
  osm_admin_level:Number(x.osm_admin_level),
  osm_place:x.osm_place,
  osm_relation_id:Number(x.osm_relation_id),
  osm_relation_version:x.osm_relation_version,
  osm_relation_timestamp:x.osm_relation_timestamp,
  osm_url:'https://www.openstreetmap.org/relation/'+x.osm_relation_id,
  context_flags:x.context_notes,
  geometry_source:'EXISTING_ACTUAL_PUBLIC_GEOJSON_ONLY',
  source_snapshot_osm:'2026-10-12T20:21:35Z',
  osM_to_actuaL_geometry_byte_identity_claimed:false,
  legal_de_facto_certified:false
 };
});
assert.equal(rows.length,85);
assert.equal(new Set(rows.map(r=>r.id)).size,85);
const result={
 contract:'p907216-osm-role-ui-overlay-v1',
 mode:'DESCRIPTIVE_EXISTING_ACTUAL_GEOMETRY',
 ui_status:'SOURCE_VERIFIED_OSM_TAGS_LEGAL_UNCERTIFIED',
 osm_attribution:'© OpenStreetMap contributors, ODbL',
 osm_source_date:'2026-10-12T20:21:35Z',
 osm_evidence_sha256:sha(source),
 existing_actual_snapshot_id:manifest.snapshot_id,
 existing_actual_release_fingerprint_sha256:manifest.release_fingerprint_sha256,
 existing_actual_entity_count:idx.entity_count,
 indexed_actual_entities:85,
 relation_count:85,
 legal_de_facto_certified:0,
 no_new_geometries:true,
 no_new_jurisdictions:true,
 existing_actual_legal_parent_unchanged:true,
 no_new_OSM_API_calls_at_runtime:true,
 source_geometry_byte_equivalence_to_osm_2026_10_12_claimed:false,
 row_sort:'SOURCE_OSM_ORDER',
 rows
};
const expected=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--check')){
 assert.equal(readFileSync(target,'utf8'),expected);
 console.log('P907216_UI_CATALOG_REPRO_PASS: 85 role overlays bound to ACTUAL entities, 0 new polygons or legal claims');
}else{
 writeFileSync(target,expected);
 console.log('P907216_UI_CATALOG_BUILT '+JSON.stringify({roles:rows.length,bytes:Buffer.byteLength(expected),sha256:createHash('sha256').update(expected).digest('hex')}));
}
