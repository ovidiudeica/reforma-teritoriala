import test from 'node:test';
import assert from 'node:assert/strict';
import {compactTreeName} from '../../atlas-tree-labels.mjs';

test('P5.2 compact display labels never change node identity or official name',()=>{
 const cases=[
  [{id:'ro',jurisdiction:'RO',parent_id:null,display_name:'România'},'România'],
  [{id:'md',jurisdiction:'MD',parent_id:null,display_name:'Republica Moldova'},'Moldova'],
  [{id:'cluj',jurisdiction:'RO',parent_id:'ro',display_name:'Județul Cluj'},'Cluj'],
  [{id:'nistru',jurisdiction:'MD',parent_id:'md',display_name:'Unitățile administrativ-teritoriale din stânga Nistrului'},'UATSN'],
  [{id:'gagauzia',jurisdiction:'MD',parent_id:'md',display_name:'Unitatea teritorială autonomă Găgăuzia'},'UTAG'],
  [{id:'stat-MD11',jurisdiction:'MD',parent_id:'stat-MD1',display_name:'Partea de Vest (partea dreapta a Nistrului)'},'Partea de Vest'],
  [{id:'stat-MD12',jurisdiction:'MD',parent_id:'stat-MD1',display_name:'Partea de Est (partea stîngă a Nistrului)'},'Partea de Est'],
  [{id:'city',jurisdiction:'RO',parent_id:'cluj',display_name:'Municipiul Cluj-Napoca'},'Municipiul Cluj-Napoca']
 ];
 for(const [node,expected] of cases){
  const before=JSON.stringify(node);
  assert.equal(compactTreeName(node),expected);
  assert.equal(JSON.stringify(node),before,'identity/data must not be changed');
 }
});
test('P5.2 root display rule does not rename nested identity or non-MD jurisdictions',()=>{
 assert.equal(compactTreeName({jurisdiction:'MD',parent_id:'md',display_name:'Republica Moldova'}),'Republica Moldova');
 assert.equal(compactTreeName({jurisdiction:'RO',parent_id:null,display_name:'Republica Moldova'}),'Republica Moldova');
});

test('unnamed released entity hides its technical fallback only in menu presentation',()=>{
 const node={id:'osm-r12104636',display_name:'osm-r12104636',jurisdiction:'MD',parent_id:'osm-r19090918'};const before=JSON.stringify(node);
 assert.equal(compactTreeName(node),'Entitate fără nume');assert.equal(JSON.stringify(node),before);
 assert.equal(compactTreeName({id:'osm-r1',display_name:'1 Decembrie'}),'1 Decembrie');
});

test('P9.0.9.3 shorten only MD11/MD12 tree captions, never unrelated official names or jurisdictions',()=>{
 const west='Partea de Vest (partea dreapta a Nistrului)';
 const east='Partea de Est (partea stîngă a Nistrului)';
 for(const [id,official,expected] of [['stat-MD11',west,'Partea de Vest'],['stat-MD12',east,'Partea de Est']]){
  const node={id,jurisdiction:'MD',parent_id:'stat-MD1',display_name:official};
  const before=structuredClone(node);
  assert.equal(compactTreeName(node),expected);
  assert.deepEqual(node,before,'must not change canonical name or identity');
  assert.equal(compactTreeName({...node,id:'stat-MD22'}),official,'unrelated ID keeps full name');
  assert.equal(compactTreeName({...node,jurisdiction:'RO'}),official,'non-MD jurisdiction keeps full name');
  assert.equal(compactTreeName({...node,display_name:expected}),expected,'already compact names stay compact');
  assert.equal(compactTreeName({...node,display_name:'Altă denumire oficială'}),'Altă denumire oficială','identity/name drift must not be mislabeled');
 }
});
