import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadSpec,validateSpec,validateDisk,effectiveCensus} from '../audit/ni-fin0-spec.mjs';
const fixture=()=>structuredClone(loadSpec());
test('frozen adopted sources, 85 canonical roles and eight outlines verify',()=>assert.equal(validateDisk().derived_administrative_nodes,242));
test('four source-index shared city mentions do not create four extra towns',()=>assert.equal(validateSpec(fixture()).shared_city_mentions,4));
test('CLI executes the real fixed-input validation on Windows and Linux',()=>assert.equal(JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('../audit/ni-fin0-spec.mjs',import.meta.url))],{encoding:'utf8'})).status,'PASS_SPECIFICATION_ONLY'));
test('Maiac is a numbered raion sibling; lettered Grigoriopol villages retain their city parent',()=>{
 const {census,corrections}=fixture(),effective=effectiveCensus(census,corrections);
 assert.equal(effective.place_mentions.find(x=>x.id==='place-28').parent_id,'unit-22');
 for(const id of ['place-25','place-26','place-27'])assert.equal(effective.place_mentions.find(x=>x.id===id).parent_id,'place-24');
 assert.equal(census.place_mentions.find(x=>x.id==='place-28').parent_id,'place-24','original evidence must remain intact');
});
for(const [name,change] of [
 ['missing upper unit',x=>x.census.upper_units.pop()],
 ['duplicate place identity',x=>x.census.place_mentions.push(x.census.place_mentions[0])],
 ['unknown council parent',x=>x.census.councils[0].parent_id='unit-missing'],
 ['place cycle',x=>x.census.place_mentions[4].parent_id=x.census.place_mentions[4].id],
 ['invented common city identity',x=>x.census.place_mentions[0].annex_index=9999],
 ['unbound documentary parent correction',x=>x.corrections.rows[0].original_parent_id='unit-invented'],
 ['council geometry by centre inheritance',x=>x.contract.council_inherits_centre_polygon=true],
 ['name match promoted to geometry certainty',x=>x.crosswalk.localities[0].match_status='GEOMETRY_VERIFIED'],
 ['ACTUAL mutation authorized',x=>x.contract.actual_mutation_allowed=true],
 ['premature functional closure',x=>x.contract.NI_FUNCTIONAL_COMPLETE=true],
 ['2023 represented as 2026',x=>x.contract.baseline_year=2026],
 ['OSM role duplicated',x=>x.census.OSM_85_crosswalk[1].actual_id=x.census.OSM_85_crosswalk[0].actual_id]
])test('reject '+name,()=>{const x=fixture();change(x);assert.throws(()=>validateSpec(x));});
