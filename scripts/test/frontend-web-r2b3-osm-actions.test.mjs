import test from 'node:test';
import assert from 'node:assert/strict';
import {planOsmLevelGeometryAction,applyOsmLevelGeometryAction,undoOsmLevelGeometryAction} from '../../atlas-osm-level-geometry-actions.mjs';
import {OSM_UNKNOWN} from '../../atlas-osm-admin-filter.mjs';

const ctx=()=>{
 const nodes=new Map([
 ['ro',{id:'ro',jurisdiction:'RO'}],['md',{id:'md',jurisdiction:'MD'}],
 ['town',{id:'town',jurisdiction:'RO'}],['unknown',{id:'unknown',jurisdiction:'RO'}],
 ['view-nistrenia',{id:'view-nistrenia',jurisdiction:'NI',view_only:true}],
 ['view-nistrenia-group-osm-r1702216',{id:'view-nistrenia-group-osm-r1702216',jurisdiction:'NI',view_only:true}],
 ['view-nistrenia-role-md',{id:'view-nistrenia-role-md',jurisdiction:'NI',view_only:true,source_actual_id:'md'}]
 ]);
 const entityById=new Map([
 ['ro',{id:'ro',jurisdiction:'RO',representation:{admin_level:2}}],
 ['md',{id:'md',jurisdiction:'MD',representation:{admin_level:8}}],
 ['town',{id:'town',jurisdiction:'RO',representation:{admin_level:8}}],
 ['unknown',{id:'unknown',jurisdiction:'RO',representation:{admin_level:null}}]
 ]);
 const osmRoleById=new Map([['md',{osm_admin_level:8}]]);
 const outlineIds=new Set(['view-nistrenia','view-nistrenia-group-osm-r1702216']);
 const visibleEntityIds=new Set(['ro']),visibleOperationalOutlineIds=new Set(['view-nistrenia']);
 return {nodeById:nodes,entityById,osmRoleById,outlineIds,visibleEntityIds,visibleOperationalOutlineIds};
};
const plan=(scope,mode,levels)=>planOsmLevelGeometryAction({mode,levels,...scope});

test('WEB-R2b.3 scoped actions affect independent RO/MD identities and NI outlines; never alias roles',()=>{
 const scope=ctx(),baseline=JSON.stringify([...scope.entityById]);
 const first=plan(scope,'show',[5,8]);
 assert.deepEqual(first.levels,[5,8]);
 assert.deepEqual(first.counts,{RO:1,MD:1,NI:1});
 assert.equal(first.skippedAliases,1);
 assert.deepEqual(first.changes.map(c=>c.id).sort(),['md','town','view-nistrenia-group-osm-r1702216']);
 const tx=applyOsmLevelGeometryAction(first,scope);
 assert.deepEqual([...scope.visibleEntityIds].sort(),['md','ro','town']);
 assert.deepEqual([...scope.visibleOperationalOutlineIds].sort(),['view-nistrenia','view-nistrenia-group-osm-r1702216']);
 assert.equal(JSON.stringify([...scope.entityById]),baseline,'ACTUAL representation remains immutable');
 assert.deepEqual(undoOsmLevelGeometryAction(tx,scope),{reverted:3,conflicts:0});
 assert.deepEqual([...scope.visibleEntityIds],['ro']);
 assert.deepEqual([...scope.visibleOperationalOutlineIds],['view-nistrenia']);
});
test('WEB-R2b.3 explicit hide may target a country outline; unknown never infers a level',()=>{
 const scope=ctx(),before=JSON.stringify([...scope.nodeById]);
 const action=plan(scope,'hide',[2,3,OSM_UNKNOWN]);
 assert.equal(action.hasUnknown,true);
 assert.deepEqual(action.changes.map(c=>c.id).sort(),['ro','view-nistrenia']);
 assert.equal(action.changes.some(c=>c.id==='unknown'),false);
 const tx=applyOsmLevelGeometryAction(action,scope);
 assert.equal(scope.visibleEntityIds.size,0);
 assert.equal(scope.visibleOperationalOutlineIds.size,0);
 undoOsmLevelGeometryAction(tx,scope);
 assert.deepEqual([...scope.visibleEntityIds],['ro']);
 assert.deepEqual([...scope.visibleOperationalOutlineIds],['view-nistrenia']);
 assert.equal(JSON.stringify([...scope.nodeById]),before);
});
test('WEB-R2b.3 stale confirmation is atomic and undo keeps later manual toggles',()=>{
 const scope=ctx(),action=plan(scope,'show',[5,8]);
 scope.visibleEntityIds.add('md');
 assert.throws(()=>applyOsmLevelGeometryAction(action,scope),/checkbox state changed/);
 assert.equal(scope.visibleEntityIds.has('town'),false,'no partial change');
 scope.visibleEntityIds.delete('md');
 const tx=applyOsmLevelGeometryAction(plan(scope,'show',[5,8]),scope);
 scope.visibleEntityIds.delete('town'); // a user toggled the checkbox independently.
 assert.deepEqual(undoOsmLevelGeometryAction(tx,scope),{reverted:2,conflicts:1});
 assert.equal(scope.visibleEntityIds.has('town'),false,'undo cannot overwrite the later selection');
 assert.equal(scope.visibleEntityIds.has('ro'),true);
});
test('WEB-R2b.3 blank numeric level selection has zero changes, not implicit geometry reset',()=>{
 const scope=ctx(),before=[...scope.visibleEntityIds];
 assert.equal(plan(scope,'hide',[OSM_UNKNOWN]).changed,0);
 assert.equal(plan(scope,'show',[]).changed,0);
 assert.deepEqual([...scope.visibleEntityIds],before);
});
test('WEB-R2b.3 wiring separates filter, selection and reversible checkbox actions',async()=>{
 const {readFile}=await import('node:fs/promises');
 const app=await readFile('app.js','utf8'),filters=await readFile('atlas-filters.mjs','utf8'),css=await readFile('atlas-panel-content.css','utf8');
 assert.match(filters,/Comenzi explicite pentru geometriile nivelurilor OSM/);
 assert.match(filters,/Confirmă operațiunea/);
 assert.match(filters,/onOsmGeometryPreview/);
 assert.match(filters,/onOsmGeometryUndo/);
 assert.match(app,/lastOsmLevelGeometryAction/);
 assert.match(app,/outlineIds:new Set\(nistreniaOutlines\?niOutlineIds:\[\]\)/);
 assert.match(app,/atlasUrl\?\.commit\('push'\)/);
 assert.match(css,/\.osm-level-action-confirm\[hidden\]/);
});
