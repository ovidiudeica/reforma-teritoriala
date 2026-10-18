import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateOsmRolesCatalog,osmRoleLabels} from '../../atlas-osm-roles.mjs';

const read=p=>JSON.parse(readFileSync(p,'utf8'));
const catalog=read('public/data/p907216-osm-roles.json');
const index=read('public/data/actual-entities.json');
const release=read('data/current/actual-release-manifest.json');
const entities=new Map(index.entities.map(e=>[e.id,e]));
const inputs={snapshotId:release.snapshot_id,releaseFingerprint:release.release_fingerprint_sha256};

test('P9.0.7.2.16 85 OSM roles are bound to all existing ACTUAL geometry IDs without extra polygons',()=>{
 const verified=validateOsmRolesCatalog(catalog,entities,inputs);
 assert.equal(verified.size,85);
 assert.equal(index.entity_count,5848);
 assert.equal(catalog.indexed_actual_entities,85);
 assert.equal(catalog.no_new_geometries,true);
 assert.equal(catalog.existing_actual_legal_parent_unchanged,true);
 assert.equal(catalog.legal_de_facto_certified,0);
 assert.equal(catalog.source_geometry_byte_equivalence_to_osm_2026_10_12_claimed,false);
 for(const row of verified.values()){
  const e=entities.get(row.id);
  assert.equal(row.osm_url,e.representation.source_url);
  assert.equal(row.id,e.id);
  assert.equal(row.existing_actual_entity_id,e.id);
  assert.equal(e.jurisdiction,'MD');
  assert.equal(e.representation.place??null,row.osm_place);
  assert.equal(row.legal_de_facto_certified,false);
 }
 const roleCounts={};
 for(const row of verified.values())roleCounts[row.role]=(roleCounts[row.role]||0)+1;
 assert.deepEqual(roleCounts,{
  OSM_VILLAGE_BOUNDARY:1,
  OSM_LEVEL8_MUNICIPALITY_AREA_UNSPECIFIED:24,
  OSM_CITY_BOUNDARY:3,
  OSM_TOWN_BOUNDARY:6,
  OSM_RURAL_COUNCIL_AREA:46,
  OSM_SETTLEMENT_COUNCIL_AREA:3,
  OSM_CITY_COUNCIL_AREA:1,
  OSM_LEVEL4_MUNICIPALITY_BOUNDARY:1
 });
 assert.deepEqual(new Set(Object.values(osmRoleLabels)).size,8);
});
test('OSM roles cannot mix across release snapshots, IDs, administrative tags, fake legal promotions or invented geometries',()=>{
 const valid=()=>structuredClone(catalog);
 const reject=(mutate,pattern=/P9 OSM cartografic/)=>{
  const copy=valid();mutate(copy);
  assert.throws(()=>validateOsmRolesCatalog(copy,entities,inputs),pattern);
 };
 reject(c=>c.rows.push(structuredClone(c.rows[0])));
 reject(c=>c.rows[1].id=c.rows[0].id);
 reject(c=>c.rows[0].osm_relation_id=999999);
 reject(c=>c.rows[0].role='OSM_IMAGINARY_MUNICIPALITY');
 reject(c=>c.rows[0].legal_de_facto_certified=true);
 reject(c=>c.rows[0].osm_to_actual_geometry_byte_identity_claimed=true);
 reject(c=>c.existing_actual_snapshot_id='actual-synthetic');
 reject(c=>c.existing_actual_release_fingerprint_sha256='fake');
 reject(c=>c.no_new_geometries=false);
 reject(c=>c.legal_de_facto_certified=85);
 reject(c=>c.rows[0].osm_url='https://example.com');
 reject(c=>c.rows[0].osm_place='city');
 reject(c=>c.rows[0].geometry_source='NEW_GEOJSON');
 const check=new Map(entities);const a=check.get(catalog.rows[0].id);check.set(a.id,{...a,representation:{...a.representation,osm_relation_id:0}});
 assert.throws(()=>validateOsmRolesCatalog(catalog,check,inputs),/P9 OSM cartografic/);
});
test('catalog generated deterministically from P9 dossier and immutable released ACTUAL index',()=>{
 const out=execFileSync(process.execPath,['scripts/process/build-p907216-osm-role-ui.mjs','--check'],{encoding:'utf8'});
 assert.match(out,/P907216_UI_CATALOG_REPRO_PASS/);
 const script=readFileSync('app.js','utf8');
 const ui=readFileSync('atlas-osm-roles.mjs','utf8');
 const html=readFileSync('index.html','utf8');
 assert.match(script,/loadOsmRoleCatalog/);
 assert.match(script,/validateOsmRolesCatalog/);
 assert.match(script,/validateNistreniaOsmNavigation/);
 assert.match(script,/renderOsmRoleDetails/);
 assert.doesNotMatch(ui,/L\.geoJSON\s*\(|tileLayer\s*\(/);
 assert.doesNotMatch(html,/id="osm-roles-panel"|id="osm-roles-list"|id="osm-roles-search"/);
 assert.doesNotMatch(html,/id="nistrenia-osm-toggle"|id="nistrenia-osm-panel"/);
 assert.match(html,/id="geometries-reset"/);
 assert.match(html,/id="filters-reset"/);
 assert.match(html,/id="nistrenia-catalog-error"/);
});
