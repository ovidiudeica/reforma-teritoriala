import test from 'node:test';
import assert from 'node:assert/strict';
import {numericOsmLevel,osmLevelForTreeNode,createOsmLevelBadge} from '../../atlas-osm-admin-badges.mjs';

test('WEB-R2b.1 verified numeric badges without level inference',()=>{
 const entityById=new Map([['ro',{representation:{admin_level:2}}],['md',{representation:{admin_level:2}}],['stat',{representation:{admin_level:null}}]]);
 const osmRoleById=new Map([['r1',{osm_admin_level:8}]]);
 const ctx={entityById,osmRoleById};
 assert.equal(osmLevelForTreeNode({id:'ro'},ctx),2);
 assert.equal(osmLevelForTreeNode({id:'md'},ctx),2);
 assert.equal(osmLevelForTreeNode({id:'stat'},ctx),null);
 assert.equal(osmLevelForTreeNode({id:'view-nistrenia'},ctx),3);
 assert.equal(osmLevelForTreeNode({id:'view-nistrenia-group-osm-r1702216'},ctx),5);
 assert.equal(osmLevelForTreeNode({id:'view-nistrenia-group-osm-r944727'},ctx),5);
 assert.equal(osmLevelForTreeNode({id:'view-nistrenia-group-osm-r999'},ctx),null);
 assert.equal(osmLevelForTreeNode({id:'view-nistrenia-role-r1',source_actual_id:'r1'},ctx),8);
 assert.equal(osmLevelForTreeNode({id:'view-nistrenia-role-unknown'},ctx),null);
 for(const input of [null,undefined,'','a','7.5',13,-1,NaN])assert.equal(numericOsmLevel(input),null);
});
test('WEB-R2b.1 badge is text, not button or action, with explicit accessibility',()=>{
 const spans=[];const doc={createElement:tag=>{const node={tag,attributes:{},setAttribute(k,v){this.attributes[k]=v;}};spans.push(node);return node;}};
 const badge=createOsmLevelBadge(doc,5);
 assert.equal(badge.tag,'span');
 assert.equal(badge.textContent,'5');
 assert.equal(badge.attributes['aria-label'],'Nivel administrativ OSM 5');
 assert.equal(createOsmLevelBadge(doc,null),null);
});
test('WEB-R2b.1 desktop/mobile tree integration is presentation-only',async()=>{
 const fs=await import('node:fs/promises');
 const tree=await fs.readFile('atlas-tree.mjs','utf8');
 const app=await fs.readFile('app.js','utf8');
 const css=await fs.readFile('atlas-tree.css','utf8');
 assert.match(tree,/createOsmLevelBadge\(document,getOsmAdminLevel\(node\)\)/);
 assert.match(app,/getOsmAdminLevel:node=>osmLevelForTreeNode/);
 assert.match(css,/\.tree-osm-admin-badge\{/);
 assert.match(css,/font-variant-numeric:tabular-nums/);
 assert.match(tree,/gridcell/);
 assert.match(tree,/checkbox\.addEventListener\('change'/);
});
