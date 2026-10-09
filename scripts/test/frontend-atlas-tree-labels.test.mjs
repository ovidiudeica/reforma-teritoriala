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
