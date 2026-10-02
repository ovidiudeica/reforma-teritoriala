import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {roOfficialComponentLocalities,uniqueLegalIdentityIds} from '../lib/actual-completeness.mjs';

test('RO component-locality inventory is exactly SIRUTA level 3',()=>{
 const records=[
  {siruta:'10',level:1},
  {siruta:'100',level:2},
  {siruta:'101',level:3},
  {siruta:'102',level:'3'}
 ];
 assert.deepEqual(roOfficialComponentLocalities(records).map(x=>x.siruta),['101','102']);
});

test('CUATM locality coverage counts unique legal identities, not polygon representations',()=>{
 const ids=uniqueLegalIdentityIds(['8341','8341','1910',null,'']);
 assert.deepEqual([...ids].sort(),['1910','8341']);
});

test('geometry-role contract keeps administrative, statistical and locality semantics distinct',async()=>{
 const contract=JSON.parse(await readFile('schemas/actual-geometry-role-contract.json','utf8'));
 assert.equal(contract.schema_version,1);
 assert.equal(contract.contract,'actual-geometry-role-v1');
 assert.equal(contract.mode,'ACTUAL');
 assert.deepEqual(Object.keys(contract.roles).sort(),[
  'administrative_boundary',
  'locality_footprint',
  'statistical_boundary'
 ]);
 assert.equal(contract.roles.administrative_boundary.legal_geometry_equivalence_implied,false);
 assert.equal(contract.roles.statistical_boundary.must_not_be_inferred_from_administrative_hierarchy_alone,true);
 assert.ok(contract.roles.locality_footprint.allowed_subtypes.includes('intravilan'));
 assert.equal(contract.compatibility.actual_public_entity_v1.legacy_geometry_role,'current_representation');
 assert.equal(contract.compatibility.actual_public_entity_v1.canonical_role_for_existing_master_geometry,'administrative_boundary');
});
