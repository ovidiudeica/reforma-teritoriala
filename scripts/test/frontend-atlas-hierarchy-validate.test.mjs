import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateConsolidatedHierarchy} from '../../atlas-hierarchy-validate.mjs';

const tree=JSON.parse(await readFile('public/data/actual-consolidated-tree.json','utf8'));
const index=JSON.parse(await readFile('public/data/actual-entities.json','utf8'));
const byId=new Map(index.entities.map(entity=>[entity.id,entity]));
const clone=()=>structuredClone(tree);
const validate=(candidate=tree,entities=byId,expectedCount=index.entity_count)=>
 validateConsolidatedHierarchy(candidate,entities,{expectedCount});
const corrupt=(mutation,pattern)=>{
 const candidate=clone();
 mutation(candidate);
 assert.throws(()=>validate(candidate),pattern);
};
const byNode=(data,id)=>data.nodes.find(node=>node.id===id);

test('P3.3 valid 5848-node RO+MD ACTUAL release tree passes exact frontend contract',()=>{
 const result=validate();
 assert.equal(result.size,5848);
 assert.deepEqual(tree.root_ids,['osm-r90689','osm-r58974']);
 assert.equal(result.get(tree.root_ids[0]).depth,0);
 assert.equal(result.get(tree.root_ids[1]).depth,0);
 const statistical=[...result.values()].filter(node=>node.roles.includes('statistical'));
 assert.equal(statistical.length,63);
 assert.equal(statistical.filter(node=>node.roles.length===1).length,18);
 assert.equal(statistical.filter(node=>node.roles.some(role=>role!=='statistical')).length,45);
 assert.deepEqual([...result.keys()],tree.nodes.map(node=>node.id));
});

test('P3.3 invalid metadata, missing index or duplicate nodes are rejected before DOM activation',()=>{
 corrupt(d=>{d.contract='stale';},/unsupported contract/);
 corrupt(d=>{d.schema_version=2;},/unsupported contract/);
 corrupt(d=>{d.mode='ISTORIC';},/unsupported contract/);
 corrupt(d=>{d.root_ids=[d.root_ids[0],d.root_ids[0]];},/unexpected or duplicate/);
 corrupt(d=>{d.root_ids.reverse();},/unexpected or duplicate/);
 corrupt(d=>{d.node_count+=1;},/node_count/);
 corrupt(d=>{d.node_count-=1;},/node_count/);
 corrupt(d=>{d.max_depth+=1;},/max_depth/);
 corrupt(d=>{d.nodes.pop();d.node_count--;},/node_count differs from public entity index/);
 corrupt(d=>{d.nodes[5]=structuredClone(d.nodes[4]);},/duplicate node id/);
 corrupt(d=>{d.entity_count_by_jurisdiction.RO++;},/jurisdiction counts/);
 assert.throws(()=>validate(tree,new Map()),/public entity index/);
 assert.throws(()=>validate(tree,byId,index.entity_count+1),/release manifest/);
});

test('P3.3 node identity and official semantic contract are byte-preserving',()=>{
 const victim=tree.nodes.find(n=>n.parent_id!==null&&n.statistical_code);
 assert.ok(victim);
 corrupt(d=>{byNode(d,victim.id).display_name+=' TEST';},/display_name.*entity index/);
 corrupt(d=>{byNode(d,victim.id).display_type='invented';},/display_type.*entity index/);
 corrupt(d=>{byNode(d,victim.id).statistical_code='X123';},/statistical_code.*entity index/);
 corrupt(d=>{byNode(d,victim.id).statistical_level=9;},/statistical_level.*entity index/);
 corrupt(d=>{byNode(d,victim.id).roles.reverse();},/roles.*entity index/);
 corrupt(d=>{byNode(d,victim.id).jurisdiction=victim.jurisdiction==='RO'?'MD':'RO';},/jurisdiction/);
 corrupt(d=>{byNode(d,victim.id).id='synthetic-duplicate';},/missing public entity/);
 const unaffected=validate();
 assert.equal(unaffected.get(victim.id).display_name,victim.display_name);
});

test('P3.3 orphan, cycle, duplicate edges and mismatched parents fail closed',()=>{
 const branch=tree.nodes.find(n=>n.depth===3&&n.child_ids.length>0);
 const leaf=tree.nodes.find(n=>n.depth>2&&n.child_ids.length===0&&n.parent_id);
 assert.ok(branch&&leaf);
 corrupt(d=>{byNode(d,branch.id).child_ids.push('missing-child');},/orphan child/);
 corrupt(d=>{byNode(d,branch.id).child_ids.push(branch.child_ids[0]);},/duplicate or malformed child_id/);
 corrupt(d=>{byNode(d,branch.id).child_ids.push(branch.id);},/reciprocal parent mismatch|cycle/);
 corrupt(d=>{byNode(d,branch.child_ids[0]).parent_id=d.root_ids[0];},/parent_id differs from ACTUAL entity index/);
 corrupt(d=>{byNode(d,leaf.id).depth+=1;},/depth differs/);
 corrupt(d=>{byNode(d,leaf.id).parent_id=null;},/parent_id differs/);
 corrupt(d=>{byNode(d,leaf.id).child_ids=[leaf.id];},/reciprocal parent mismatch|cycle/);
 corrupt(d=>{byNode(d,leaf.id).child_ids=[d.root_ids[0]];},/state root nested|reciprocal parent mismatch/);
});

test('P3.3 no partial index state or source mutations after validation rejection',()=>{
 const before=JSON.stringify(tree),sourceCount=byId.size;
 const invalid=clone();invalid.nodes[0].display_name='CORRUPT';
 assert.throws(()=>validate(invalid),/display_name/);
 assert.equal(byId.size,sourceCount);
 assert.equal(JSON.stringify(tree),before);
 assert.equal(validate().size,sourceCount);
});
