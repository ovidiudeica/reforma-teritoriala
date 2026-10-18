import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateOsmRolesCatalog} from '../../atlas-osm-roles.mjs';
import {validateNistreniaOsmNavigation} from '../../atlas-nistrenia-osm.mjs';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const overlay=read('public/data/p907216-osm-roles.json');
const menu=read('public/data/p909-nistrenia-osm-navigation.json');
const index=read('public/data/actual-entities.json');
const release=read('data/current/actual-release-manifest.json');
const byId=new Map(index.entities.map(row=>[row.id,row]));
const roles=validateOsmRolesCatalog(overlay,byId,{snapshotId:release.snapshot_id,releaseFingerprint:release.release_fingerprint_sha256});

test('P9.0.9 virtual Nistrenia root has exactly seven geographic groups and reuses 85 ACTUAL identities',()=>{
 const validated=validateNistreniaOsmNavigation(menu,roles);
 assert.deepEqual(validated.map(g=>[g.label,g.role_ids.length]),[
  ['Camenca',13],['Rîbnița',23],['Dubăsari',10],
  ['Grigoriopol',16],['Tiraspol',3],['Slobozia',16],['Bender',4]
 ]);
 assert.deepEqual(new Set(validated.flatMap(g=>g.role_ids)),new Set(roles.keys()));
 assert.equal(menu.root_has_actual_geometry,false);
 assert.equal(menu.root_is_legal_jurisdiction,false);
 assert.equal(menu.legal_semantic_acceptance,'BLOCKED_INCOMPLETE');
 assert.equal(menu.actual_mutation_allowed,false);
 assert.equal(menu.p91_import_allowed,false);
 assert.equal(index.entity_count,5848);
 // Homonyms must remain distinct OSM relations, never coalesced.
 const bender=validated.find(g=>g.label==='Bender').role_ids;
 assert(bender.includes('osm-r12463379'));
 assert(bender.includes('osm-r9581354'));
});
test('P9.0.9 menu fails closed on geometries, fake parent grouping, legal promotion or missing roles',()=>{
 const reject=modify=>{
  const corrupted=structuredClone(menu);modify(corrupted);
  assert.throws(()=>validateNistreniaOsmNavigation(corrupted,roles),/P9.0.9 Nistrenia OSM/);
 };
 reject(m=>m.root_has_actual_geometry=true);
 reject(m=>m.root_is_legal_jurisdiction=true);
 reject(m=>m.p91_import_allowed=true);
 reject(m=>m.actual_mutation_allowed=true);
 reject(m=>m.source_osm_snapshot_at='2026-10-17');
 reject(m=>m.groups[0].group_id='osm-r65335');
 reject(m=>m.groups[0].role_ids.push('osm-r65335'));
 reject(m=>m.groups[1].role_ids[0]=m.groups[0].role_ids[0]);
 reject(m=>m.groups[6].role_ids.pop());
 reject(m=>m.groups[2].osm_url='https://example.invalid');
});
test('P9.0.9 menu is deterministically generated and mounted outside the ACTUAL legal tree',()=>{
 const out=execFileSync(process.execPath,['scripts/process/build-p909-nistrenia-menu.mjs','--check'],{encoding:'utf8'});
 assert.match(out,/P909_MENU_REPRO_PASS/);
 const js=readFileSync('app.js','utf8'),html=readFileSync('index.html','utf8');
 assert.doesNotMatch(html,/id="nistrenia-osm-panel"/);
 assert.doesNotMatch(html,/id="nistrenia-osm-toggle"/);
 assert.match(html,/id="hierarchy-tree"/);
 assert.match(js,/loadNistreniaOsmNavigation/);
 assert.match(js,/validateNistreniaOsmNavigation/);
 assert.match(js,/createNistreniaOperationalView/);
 const module=readFileSync('atlas-nistrenia-osm.mjs','utf8');
 assert.doesNotMatch(module,/L\.geoJSON\s*\(|tileLayer\s*\(|createPane\s*\(/);
 assert.doesNotMatch(module,/jurisdiction:\s*['"]PMR/);
});
