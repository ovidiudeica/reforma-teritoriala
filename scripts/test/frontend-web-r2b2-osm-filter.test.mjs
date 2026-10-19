import test from 'node:test';
import assert from 'node:assert/strict';
import {OSM_ADMIN_LEVELS,OSM_UNKNOWN,allOsmLevelFilters,osmTreeVisibleIds} from '../../atlas-osm-admin-filter.mjs';
import {createUrlConfig,parseUrlState,serializeUrlState} from '../../atlas-url-state.mjs';
test('WEB-R2b.2 multiple levels keep matching descendants and ancestors without mutating nodes',()=>{
 const nodes=new Map([['root',{id:'root',child_ids:['a','b']}],['a',{id:'a',child_ids:[]}],['b',{id:'b',child_ids:[]}]]);
 const actual=new Map([['root',{representation:{admin_level:2}}],['a',{representation:{admin_level:4}}],['b',{representation:{admin_level:null}}]]);
 const before=JSON.stringify([...nodes]);
 const ctx={entityById:actual,osmRoleById:new Map()};
 assert.deepEqual([...osmTreeVisibleIds(nodes,['root'],new Set([4]),ctx)].sort(),['a','root']);
 assert.deepEqual([...osmTreeVisibleIds(nodes,['root'],new Set([OSM_UNKNOWN]),ctx)].sort(),['b','root']);
 assert.deepEqual([...osmTreeVisibleIds(nodes,['root'],new Set([2,4]),ctx)].sort(),['a','root']);
 assert.equal(osmTreeVisibleIds(nodes,['root'],new Set(),ctx).size,0);
 assert.equal(JSON.stringify([...nodes]),before);
 assert.deepEqual([...allOsmLevelFilters()],[...OSM_ADMIN_LEVELS,OSM_UNKNOWN]);
});
test('WEB-R2b.2 URL preserves old defaults, explicit none and multi-select',()=>{
 const nodes=new Map([['ro',{child_ids:[]}]]);
 const config=createUrlConfig({entityById:new Map([['ro',{}]]),nodeById:nodes,rootIds:['ro'],filterIndex:{groups:[],subtypeMembers:new Map()}});
 const defaults=parseUrlState('?v=1',config);
 assert.deepEqual(defaults.osmAdminLevels,config.osmAdminLevels);
 const none=parseUrlState('?v=1&a=',config);
 assert.deepEqual(none.osmAdminLevels,[]);
 assert.ok(serializeUrlState(none,config).includes('a='));
 const multi=parseUrlState('?v=1&a=4,8,unknown',config);
 assert.deepEqual(multi.osmAdminLevels,[4,8,'unknown']);
 assert.deepEqual(parseUrlState('?'+serializeUrlState(multi,config),config).osmAdminLevels,multi.osmAdminLevels);
 assert.deepEqual(parseUrlState('?v=1&a=bogus',config).osmAdminLevels,[]);
});
test('WEB-R2b.2 integration tree only, statistics independent, no geometry filtering',async()=>{
 const {readFile}=await import('node:fs/promises');
 const app=await readFile('app.js','utf8'),ui=await readFile('atlas-filters.mjs','utf8'),tree=await readFile('atlas-tree.mjs','utf8');
 assert.match(app,/refreshOsmAdminTree\(\)/);
 assert.match(app,/osmAdminLevels:activeOsmAdminLevels/);
 assert.match(ui,/Nivel administrativ OSM/);
 assert.match(ui,/Niveluri statistice/);
 assert.match(tree,/setVisibleIds\(ids\)/);
 assert.match(ui,/Nu modifică bifele sau geometriile/);
});
