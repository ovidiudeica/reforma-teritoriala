import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {flattenVisibleTree,createTreeWindow} from '../../atlas-tree-window.mjs';
const corpus=JSON.parse(await readFile('public/data/actual-consolidated-tree.json','utf8'));
const nodes=new Map(corpus.nodes.map(node=>[node.id,node]));
const branches=new Set(corpus.nodes.filter(node=>node.child_ids.length).map(node=>node.id));

test('virtual traversal preserves all 5848 identities and validated sibling order',()=>{
 const rows=flattenVisibleTree(nodes,corpus.root_ids,branches);
 assert.equal(rows.length,5848);assert.equal(new Set(rows.map(row=>row.id)).size,5848);
 for(const row of rows){assert.equal(row.depth,nodes.get(row.id).depth);const parent=nodes.get(row.id).parent_id;const siblings=parent?nodes.get(parent).child_ids:corpus.root_ids;assert.equal(row.pos,siblings.indexOf(row.id)+1);assert.equal(row.size,siblings.length);}
});

test('closing a parent preserves independent descendant expansion intent',()=>{
 const open=new Set(branches),parent=corpus.nodes.find(node=>node.depth===1&&node.child_ids.some(id=>branches.has(id))),child=parent.child_ids.find(id=>branches.has(id));
 open.delete(parent.id);assert.ok(open.has(child));assert.ok(!flattenVisibleTree(nodes,corpus.root_ids,open).some(row=>row.id===child));open.add(parent.id);assert.ok(flattenVisibleTree(nodes,corpus.root_ids,open).some(row=>row.id===child));
});

test('5848 rows have bounded windows and every index can be reached without gaps',()=>{
 const rows=flattenVisibleTree(nodes,corpus.root_ids,branches),window=createTreeWindow(rows),covered=new Set();
 for(let top=0;top<window.totalHeight;top+=300){const range=window.range(top,300);assert.ok(range.end-range.start<=17);for(let i=range.start;i<range.end;i++)covered.add(i);assert.equal(window.indexAt(window.offset(range.start)),range.start);}
 assert.equal(covered.size,5848);assert.equal(window.indexAt(1e9),5847);
});

test('measured wrapped rows update offsets and scroll anchoring deterministically',()=>{
 const rows=flattenVisibleTree(nodes,corpus.root_ids,branches),window=createTreeWindow(rows),id=rows[100].id,oldOffset=window.offset(101);
 assert.equal(window.measure(id,76),true);assert.equal(window.measure(id,76),false);window.remeasure();assert.equal(window.offset(101),oldOffset+32);assert.equal(window.indexAt(window.offset(100)+75),100);assert.equal(window.height(100),76);
 window.invalidate();assert.equal(window.height(100),44);assert.equal(window.offset(101),oldOffset);
});

test('invalid measurements and unknown identities cannot corrupt window offsets',()=>{
 const window=createTreeWindow([{id:'root'}]);for(const height of [NaN,Infinity,-1,20])assert.equal(window.measure('root',height),false);assert.equal(window.measure('unknown',50),false);assert.equal(window.totalHeight,44);assert.throws(()=>createTreeWindow([],{minimumHeight:20}),RangeError);assert.deepEqual(createTreeWindow([]).range(0,300),{start:0,end:0});
});
