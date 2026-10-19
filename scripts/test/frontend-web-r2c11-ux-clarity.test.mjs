import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {osmTreeFilterSummary,OSM_UNKNOWN,allOsmLevelFilters} from '../../atlas-osm-admin-filter.mjs';
import {planOsmLevelGeometryAction} from '../../atlas-osm-level-geometry-actions.mjs';
import {createAtlasFilters} from '../../atlas-filters.mjs';

const fixture=()=>{
 const nodeById=new Map([
  ['ro',{id:'ro',child_ids:['ra','missing']}],
  ['ra',{id:'ra',child_ids:[]}],
  ['missing',{id:'missing',child_ids:[]}],
  ['md',{id:'md',child_ids:['shared']}],
  ['shared',{id:'shared',child_ids:[]}],
  ['view-nistrenia',{id:'view-nistrenia',child_ids:['view-nistrenia-group-osm-r1702216']}],
  ['view-nistrenia-group-osm-r1702216',{id:'view-nistrenia-group-osm-r1702216',child_ids:['view-nistrenia-role-md']}],
  ['view-nistrenia-role-md',{id:'view-nistrenia-role-md',source_actual_id:'shared',child_ids:[]}]
 ]);
 const entityById=new Map([
  ['ro',{id:'ro',jurisdiction:'RO',representation:{admin_level:2}}],
  ['ra',{id:'ra',jurisdiction:'RO',representation:{admin_level:8}}],
  ['missing',{id:'missing',jurisdiction:'RO',representation:{admin_level:null}}],
  ['md',{id:'md',jurisdiction:'MD',representation:{admin_level:2}}],
  ['shared',{id:'shared',jurisdiction:'MD',representation:{admin_level:8}}]
 ]);
 const osmRoleById=new Map([['shared',{osm_admin_level:8}]]);
 const roots=['ro','md','view-nistrenia'];
 const context={entityById,osmRoleById};
 const scope={nodeById,entityById,osmRoleById,
  outlineIds:new Set(['view-nistrenia','view-nistrenia-group-osm-r1702216']),
  visibleEntityIds:new Set(['ro','md']),
  visibleOperationalOutlineIds:new Set(['view-nistrenia'])};
 return {nodeById,roots,context,scope};
};

test('WEB-R2c.1.1: M/A counts use unique full-tree IDs and retain navigation-only ancestors',()=>{
 const {nodeById,roots,context}=fixture(),before=JSON.stringify([...nodeById]);
 const only8=osmTreeFilterSummary(nodeById,roots,new Set([8]),context);
 assert.deepEqual([only8.matches,only8.ancestors,only8.visibleIds.size],[3,4,7]);
 assert.deepEqual([...only8.visibleIds].sort(),['md','ni','ni-group','ra','ro','shared','view-nistrenia-role-md'].map(id=>id==='ni'?'view-nistrenia':id==='ni-group'?'view-nistrenia-group-osm-r1702216':id).sort());
 const empty=osmTreeFilterSummary(nodeById,roots,new Set(),context);
 assert.deepEqual([empty.matches,empty.ancestors,empty.visibleIds.size],[0,0,0]);
 const unknown=osmTreeFilterSummary(nodeById,roots,new Set([OSM_UNKNOWN]),context);
 assert.deepEqual([unknown.matches,unknown.ancestors,unknown.visibleIds.size],[1,1,2]);
 assert.deepEqual([...unknown.visibleIds].sort(),['missing','ro']);
 const group=osmTreeFilterSummary(nodeById,roots,new Set([5]),context);
 assert.deepEqual([group.matches,group.ancestors,group.visibleIds.size],[1,1,2]);
 const all=osmTreeFilterSummary(nodeById,roots,allOsmLevelFilters(),context);
 assert.deepEqual([all.matches,all.ancestors,all.visibleIds.size],[8,0,8]);
 assert.equal(JSON.stringify([...nodeById]),before);
});

test('WEB-R2c.1.1: M counts reused NI navigation aliases, but E/C never treat them as polygons',()=>{
 const {nodeById,roots,context,scope}=fixture();
 const sum=osmTreeFilterSummary(nodeById,roots,new Set([8]),context);
 assert.equal(sum.matches,3,'one RO, one MD and a separate navigation alias row');
 const before=JSON.stringify({ids:[...scope.visibleEntityIds],outlines:[...scope.visibleOperationalOutlineIds]});
 const plan=planOsmLevelGeometryAction({mode:'show',levels:[8,OSM_UNKNOWN],...scope});
 assert.equal(plan.skippedAliases,1);
 assert.deepEqual(plan.eligible,{RO:1,MD:1,NI:0});
 assert.deepEqual(plan.counts,{RO:1,MD:1,NI:0});
 assert.equal(plan.changed,2);
 assert.deepEqual(plan.changes.map(c=>c.id).sort(),['ra','shared']);
 assert.deepEqual(JSON.stringify({ids:[...scope.visibleEntityIds],outlines:[...scope.visibleOperationalOutlineIds]}),before);
});

class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.listeners={};this._text='';this._html='';this.checked=false;this.indeterminate=false;}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 set innerHTML(v){this._html=String(v);this._text='';this.children=[];}
 get innerHTML(){return this._html;}
 appendChild(child){this.children.push(child);return child;}
 setAttribute(name,value){this.attributes[name]=String(value);}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 async click(){for(const fn of this.listeners.click??[])await fn({target:this});}
 descendants(){return this.children.flatMap(child=>[child,...child.descendants()]);}
}
test('WEB-R2c.1.1: UI summary and tree-only OSM buttons cannot toggle geometries/statistics',async()=>{
 const document={createElement:tag=>new Element(tag)},container=new Element();
 const state={geometryClasses:new Set(),geometrySubtypes:new Set(),statisticalLevels:new Set([1,2,3]),osmAdminLevels:allOsmLevelFilters(),separateStatisticalGeometry:true};
 const index={groups:[],statisticalCounts:new Map(),statisticalLevelStats:new Map(),statisticalRoles:0,reusedStatistical:0,statisticalOnly:0};
 let onChange=0;const ui=createAtlasFilters({container,document,index,state,onChange:()=>onChange++});
 assert.match(container.textContent,/Numărătoarea arborelui va fi disponibilă/);
 ui.setOsmTreeSummary({matches:3,ancestors:4});
 assert.match(container.textContent,/3 potriviri și 4 strămoși de navigare/);
 const bife=[...state.geometryClasses],stats=[...state.statisticalLevels];
 const none=container.descendants().find(el=>el.tagName==='BUTTON'&&el.textContent==='Niciun nivel în arbore');
 assert.ok(none);
 await none.click();
 assert.equal(state.osmAdminLevels.size,0);
 assert.deepEqual([...state.geometryClasses],bife);
 assert.deepEqual([...state.statisticalLevels],stats);
 assert.equal(onChange,1);
 const all=container.descendants().find(el=>el.tagName==='BUTTON'&&el.textContent==='Toate nivelurile în arbore');
 assert.ok(all);await all.click();
 assert.deepEqual([...state.osmAdminLevels],[...allOsmLevelFilters()]);
 assert.deepEqual([...state.statisticalLevels],stats);
 assert.equal(onChange,2);
});
test('WEB-R2c.1.1: empty state is distinct from loading/errors and URL/Undo implementation unchanged',async()=>{
 const [app,html,filter,url,actions]=await Promise.all(['app.js','index.html','atlas-filters.mjs','atlas-url-state.mjs','atlas-osm-level-geometry-actions.mjs'].map(p=>readFile(p,'utf8')));
 assert.match(html,/id="hierarchy-empty"[^>]*hidden/);
 assert.match(html,/Filtrul OSM controlează separat ce rânduri apar în arbore/);
 assert.match(app,/Niciun nivel OSM selectat\. Arborele este gol/);
 assert.match(app,/Nu există rânduri potrivite filtrelor curente/);
 assert.match(app,/osmTreeFeedback\(osmTreeSummary\(\)\)/);
 assert.match(filter,/Vor fi bifate/);
 assert.match(filter,/geometrii eligibile/);
 assert.match(filter,/Selectează cel puțin un nivel OSM numeric/);
 assert.match(actions,/Never overwrite later manual edits/);
 assert.match(url,/params\.set\('a',state\.osmAdminLevels\.join\(','\)\)/);
 assert.match(url,/params\.append\('x',id\)/);
 assert.match(url,/params\.append\('o',id\)/);
});

test('WEB-R2c.1.1: public ACTUAL corpus counts are independent of DOM virtualization',async()=>{
 const [index,tree]=await Promise.all(['public/data/actual-entities.json','public/data/actual-consolidated-tree.json'].map(async p=>JSON.parse(await readFile(p,'utf8'))));
 const nodeById=new Map(tree.nodes.map(n=>[n.id,n])),entityById=new Map(index.entities.map(e=>[e.id,e]));
 assert.equal(entityById.size,5848);
 const context={entityById,osmRoleById:new Map()};
 const all=osmTreeFilterSummary(nodeById,tree.root_ids,allOsmLevelFilters(),context);
 assert.equal(all.matches+all.ancestors,all.visibleIds.size);
 assert.ok(all.visibleIds.size<=nodeById.size);
 const filtered=osmTreeFilterSummary(nodeById,tree.root_ids,new Set([8]),context);
 assert.equal(filtered.matches,[...nodeById.values()].filter(n=>entityById.get(n.id)?.representation?.admin_level===8).length);
 assert.ok(filtered.ancestors>=0);
 assert.equal(new Set(filtered.visibleIds).size,filtered.visibleIds.size);
});
