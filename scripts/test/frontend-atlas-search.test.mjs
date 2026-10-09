import {formatEntityName} from '../../atlas-name-format.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSearch,createSearchIndex,searchEntities,rankSearchResult,groupSearchResults,createAtlasSearch,searchOptionId,revealSearchOption} from '../../atlas-search.mjs';
const data=JSON.parse(readFileSync('public/data/actual-entities.json','utf8')),tree=JSON.parse(readFileSync('public/data/actual-consolidated-tree.json','utf8'));
const nodes=new Map(tree.nodes.map(n=>[n.id,n])),index=createSearchIndex(data.entities,nodes);
const byId=new Map(data.entities.map(e=>[e.id,e]));
class Element{
 constructor(tag='div',document){this.tagName=tag.toUpperCase();this.document=document;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.classes=new Set();this.checked=true;this.scrollTop=0;this.clientTop=0;this.clientHeight=100;this._text='';this._html='';this.value='';this.open=false;}
 set className(v){this.classes=new Set(v.split(' '));}get className(){return [...this.classes].join(' ');}
 classList={toggle:(name,on)=>{if(on)this.classes.add(name);else this.classes.delete(name);},contains:name=>this.classes.has(name)};
 set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set innerHTML(v){this._html=v;this._text='';this.children=[];}get innerHTML(){return this._html;}
 appendChild(c){this.children.push(c);c.parentElement=this;return c;}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}focus(){this.document.activeElement=this;}
 async dispatch(k,extra={}){const event={target:this,prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){},...extra};for(const fn of this.listeners[k]??[])await fn(event);return event;}
 async click(){if(this.type==='checkbox'){this.checked=!this.checked;this.indeterminate=false;await this.dispatch('change');}else await this.dispatch('click');}
 descendants(){return this.children.flatMap(c=>[c,...c.descendants()]);}
 querySelectorAll(s){return this.descendants().filter(c=>s==='button'?c.tagName==='BUTTON':s==='nav'?c.tagName==='NAV':s==='details'?c.tagName==='DETAILS':s==='[aria-pressed="true"]'?c.getAttribute('aria-pressed')==='true':s==='.tree-select'?c.classes.has('tree-select'):s==='[role="option"]'?c.getAttribute('role')==='option':false);}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 getBoundingClientRect(){return typeof this.rect==='function'?this.rect():this.rect??{top:0,bottom:30,height:30};}
}
function doc(){const elements=new Map(),document={elements,activeElement:null,getElementById(id){if(!elements.has(id)){const el=new Element('div',document);el.id=id;elements.set(id,el);}return elements.get(id);},createElement:tag=>new Element(tag,document),querySelectorAll:()=>[]};return document;}
function harness(records=index){const document=doc(),input=document.getElementById('entity-search'),container=document.getElementById('search-results'),status=document.getElementById('search-status'),selections=[];input.focus();const controller=createAtlasSearch({document,input,container,status,index:records,onSelect:async(id,options)=>selections.push({id,options})});return {document,input,container,status,controller,selections};}
const options=h=>h.container.querySelectorAll('[role="option"]');
const key=(h,key,extra)=>h.input.dispatch('keydown',{key,...extra});
async function query(h,value){h.input.value=value;await h.input.dispatch('input');}

test('real Iași normalization is accent/case insensitive and trim safe',()=>{
 assert.equal(normalizeSearch('  IAȘI  '),'iasi');assert.equal(normalizeSearch(null),'');
 const ids=q=>searchEntities(q,index).map(r=>r.entity.id);assert.deepEqual(ids(' Iasi '),ids('iaȘi'));assert.ok(ids('Iasi').includes('osm-r1207838'));
});
test('ranking exact display/official/code precedes prefixes and contains; deterministic ties',()=>{
 const fixture=createSearchIndex([{id:'z',jurisdiction:'MD',display_name:'Alpha',searchable_names:[]},{id:'a',jurisdiction:'RO',display_name:'Alpha',searchable_names:[]},{id:'b',jurisdiction:'RO',display_name:'Alphabet',searchable_names:[]},{id:'c',jurisdiction:'RO',display_name:'X Alpha',searchable_names:[]},{id:'code',jurisdiction:'RO',display_name:'Other',legal:{id:'alpha',name:'Other'}},{id:'official',jurisdiction:'RO',display_name:'Separate',legal:{name:'Alpha'}}]);
 const ids=source=>searchEntities('alpha',source).map(r=>r.entity.id);
 assert.deepEqual(ids(fixture),['a','z','official','code','b','c']);assert.deepEqual(ids([...fixture].reverse()),ids(fixture));assert.deepEqual(ids(fixture),ids(fixture));
 assert.ok(rankSearchResult(fixture.find(r=>r.entity.id==='code'),'alpha')<rankSearchResult(fixture.find(r=>r.entity.id==='c'),'alpha'));
});
test('real SIRUTA, CUATM, OSM numeric/r/entity IDs and statistical codes are searchable',()=>{
 for(const [registry,id] of [['SIRUTA','95060'],['CUATM','5734']]){const target=data.entities.find(e=>e.legal?.registry===registry&&e.legal.id===id);assert.equal(searchEntities(id,index)[0].entity.id,target.id);}
 for(const q of ['1207838','r1207838','osm-r1207838'])assert.equal(searchEntities(q,index)[0].entity.id,'osm-r1207838');
 for(const code of ['MD120','RO11']){const target=data.entities.find(e=>e.statistical?.code===code);assert.ok(target);assert.equal(searchEntities(code,index)[0].entity.id,target.id);}
});
test('actual Victoria and Bălți peers have distinct semantic descriptors and shared legal IDs are disambiguated',()=>{
 for(const name of ['Victoria','Bălți']){const peers=index.filter(r=>normalizeSearch(r.entity.display_name)===normalizeSearch(name));assert.ok(peers.length>=3);assert.equal(new Set(peers.map(r=>r.descriptor.secondary)).size,peers.length);for(const r of peers)assert.ok(r.descriptor.parent);}
 const town=index.find(r=>r.entity.id==='osm-r9846233');assert.match(town.descriptor.secondary,/RO · oraș · Județul Brașov · SIRUTA 40465/);
 const fake={...town.entity,hierarchy:{...town.entity.hierarchy,legal_parent_name:'Wrong legal parent'},representation:{...town.entity.representation,admin_level:99}};assert.equal(createSearchIndex([fake,...data.entities.filter(e=>e.id!==fake.id)],nodes).find(r=>r.entity.id===fake.id).descriptor.parent,town.descriptor.parent);
});
test('global twenty after ranking, RO/MD groups stable and entity IDs deduplicated',()=>{
 const found=searchEntities('Victoria',index);assert.ok(found.some(r=>r.entity.jurisdiction==='RO'));assert.ok(found.some(r=>r.entity.jurisdiction==='MD'));assert.deepEqual(groupSearchResults(found).map(g=>g.jurisdiction),['RO','MD']);assert.ok(searchEntities('a',index).length<=20);
 const reused=data.entities.find(e=>e.jurisdiction==='RO'&&e.roles.includes('statistical')&&e.category!=='statistical'&&e.statistical.level===3);
 assert.equal(searchEntities(reused.statistical.code,createSearchIndex([...data.entities,reused],nodes)).filter(r=>r.entity.id===reused.id).length,1);
});
test('RO/MD DOM headings are groups, not options; keyboard follows visual order across groups',async()=>{
 const h=harness();await query(h,'Victoria');assert.deepEqual(h.container.children.map(g=>g.getAttribute('aria-label')),['România','Republica Moldova']);assert.equal(options(h).length,h.controller.state.results.length);
 for(let i=0;i<options(h).length;i++){await key(h,'ArrowDown');assert.equal(h.controller.state.activeId,options(h)[i].dataset.entityId);}assert.equal(h.selections.length,0);
});
test('ArrowDown starts first and clamps at last; ArrowUp starts last and clamps at first',async()=>{
 const h=harness();await query(h,'Victoria');assert.equal(h.controller.state.activeIndex,-1);await key(h,'ArrowDown');assert.equal(h.controller.state.activeIndex,0);await key(h,'ArrowDown');assert.equal(h.controller.state.activeIndex,1);
 for(let i=0;i<30;i++)await key(h,'ArrowDown');assert.equal(h.controller.state.activeIndex,options(h).length-1);
 await query(h,'Victoria');await key(h,'ArrowUp');assert.equal(h.controller.state.activeIndex,options(h).length-1);for(let i=0;i<30;i++)await key(h,'ArrowUp');assert.equal(h.controller.state.activeIndex,0);assert.equal(h.document.activeElement,h.input);
});
test('Enter selects the active entity through central callback then closes and preserves input focus',async()=>{
 const h=harness();await query(h,'Victoria');await key(h,'ArrowDown');await key(h,'ArrowDown');const selected=h.controller.state.results[1].entity;
 await key(h,'Enter');assert.deepEqual(h.selections,[{id:selected.id,options:{zoom:true,source:'search'}}]);assert.equal(h.input.value,formatEntityName(selected.display_name));assert.equal(h.controller.state.open,false);assert.equal(h.controller.state.activeId,null);assert.equal(h.document.activeElement,h.input);
});
test('Enter without active result and IME composition never selects arbitrarily',async()=>{
 const h=harness();await query(h,'Victoria');await key(h,'Enter');assert.equal(h.selections.length,0);await key(h,'ArrowDown',{isComposing:true});assert.equal(h.controller.state.activeId,null);
});
test('Escape closes without altering query or previous entity selection; arrow can reopen',async()=>{
 const h=harness();h.selections.push({id:'previous'});await query(h,'Victoria');await key(h,'ArrowDown');await key(h,'Escape');assert.equal(h.input.value,'Victoria');assert.equal(h.controller.state.activeId,null);assert.equal(h.controller.state.open,false);assert.deepEqual(h.selections,[{id:'previous'}]);assert.equal(h.document.activeElement,h.input);await key(h,'ArrowDown');assert.equal(h.controller.state.activeIndex,0);
});
test('ARIA combobox/listbox option active descendant is unique and cleared on close/query change',async()=>{
 const h=harness();assert.equal(h.input.getAttribute('role'),'combobox');assert.equal(h.input.getAttribute('aria-autocomplete'),'list');assert.equal(h.input.getAttribute('aria-controls'),'search-results');assert.equal(h.container.getAttribute('role'),'listbox');assert.equal(h.input.getAttribute('aria-expanded'),'false');
 await query(h,'Victoria');await key(h,'ArrowDown');assert.equal(h.input.getAttribute('aria-expanded'),'true');const active=options(h).filter(o=>o.getAttribute('aria-selected')==='true');assert.equal(active.length,1);assert.equal(h.input.getAttribute('aria-activedescendant'),active[0].id);assert.equal(new Set(options(h).map(o=>o.id)).size,options(h).length);assert.ok(options(h).every(o=>o.tabIndex===-1));
 await query(h,'Bălți');assert.equal(h.input.getAttribute('aria-activedescendant'),null);await key(h,'ArrowDown');await key(h,'Escape');assert.equal(h.input.getAttribute('aria-activedescendant'),null);assert.ok(options(h).every(o=>o.getAttribute('aria-selected')==='false'));
 assert.notEqual(searchOptionId('a/b'),searchOptionId('a-b'));assert.equal(searchOptionId('a/b'),searchOptionId('a/b'));
});
test('hover never selects; keyboard continues from hover and click selects with focus retained',async()=>{
 const h=harness();await query(h,'Victoria');await options(h)[1].dispatch('pointermove');assert.equal(h.controller.state.activeIndex,1);assert.equal(h.selections.length,0);await key(h,'ArrowDown');assert.equal(h.controller.state.activeIndex,2);assert.equal((await options(h)[2].dispatch('mousedown')).prevented,true);await options(h)[2].click();assert.equal(h.selections[0].id,options(h)[2].dataset.entityId);assert.equal(h.document.activeElement,h.input);
});
test('active scroll only adjusts search container, skips visible options and avoids repeated jitter',async()=>{
 const h=harness();await query(h,'Victoria');h.container.rect={top:10,bottom:110,height:100};h.container.clientHeight=100;
 options(h).forEach((option,i)=>{option.rect=()=>({top:10+i*50-h.container.scrollTop,bottom:40+i*50-h.container.scrollTop,height:30});});
 await key(h,'ArrowDown');assert.equal(h.container.scrollTop,0);await key(h,'ArrowDown');assert.equal(h.container.scrollTop,0);await key(h,'ArrowDown');assert.equal(h.container.scrollTop,30);
 for(let i=0;i<30;i++)await key(h,'ArrowDown');const before=h.container.scrollTop;await key(h,'ArrowDown');assert.equal(h.container.scrollTop,before);assert.equal(h.document.getElementById('hierarchy-tree').scrollTop,0);
 const row=new Element();row.rect={top:40,bottom:70,height:30};revealSearchOption(h.container,row);assert.equal(h.container.scrollTop,before);
});
test('empty query clears options/active/open ARIA; zero-results is separate and Enter does nothing',async()=>{
 const h=harness();await query(h,'Victoria');await key(h,'ArrowDown');await query(h,'  ');assert.equal(options(h).length,0);assert.equal(h.controller.state.open,false);assert.equal(h.input.getAttribute('aria-expanded'),'false');assert.equal(h.input.getAttribute('aria-activedescendant'),null);assert.equal(h.status.textContent,'');
 await query(h,'__no_entity_zzzz__');assert.equal(h.status.textContent,'Nicio entitate găsită.');assert.equal(h.controller.state.open,true);await key(h,'Enter');assert.equal(h.selections.length,0);assert.equal(h.controller.state.activeId,null);
});
test('blur and Tab close simply; safe text rendering and late hierarchy index preserve current query',async()=>{
 const h=harness();await query(h,'Victoria');await key(h,'ArrowDown');await key(h,'Tab');assert.equal(h.controller.state.open,false);await query(h,'Bălți');await h.input.dispatch('blur');assert.equal(h.controller.state.open,false);assert.equal(h.input.value,'Bălți');
 const unsafe=createSearchIndex([{id:'<unsafe>',display_name:'<img src=x>',jurisdiction:'RO',display_type:'town'}]);h.controller.updateIndex(unsafe);await query(h,'<img');assert.equal(options(h)[0].children[0].textContent,'<img src=x>');assert.equal(options(h)[0].children[0].children.length,0);
 h.controller.updateIndex(index);await query(h,'Victoria');h.controller.updateIndex(createSearchIndex(data.entities,nodes));assert.equal(h.controller.state.query,'Victoria');assert.ok(options(h).length>0);
});
test('ACTUAL/P2 identities and counts remain intact',()=>{
 const manifest=JSON.parse(readFileSync('data/current/actual-release-manifest.json','utf8'));assert.equal(data.contract,'actual-public-entity-v3');assert.equal(data.entities.length,5848);assert.equal(tree.nodes.length,5848);assert.equal(data.entities.filter(e=>e.roles.includes('statistical')).length,63);assert.equal(data.entities.filter(e=>e.category==='statistical').length,18);
 assert.equal(manifest.snapshot_id,'actual-a9e5a4ddcb5277ef');assert.equal(manifest.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');const md=byId.get('stat-MD120');assert.equal(md.statistical.code,'MD120');assert.equal(md.representation.osm_statistical_ref,'MD121');assert.equal(md.representation.osm_ref_is_identity_authority,false);
});

test('real keyboard search retains map/tree/details/breadcrumb synchronization and all filter invariants',async t=>{
 const document=doc(),groups=[],mounted=new Set(),fitBounds=[];let zoom=12;
 const group=()=>{const g={layers:[],clearLayers(){this.layers=[];},addLayer(l){this.layers.push(l);},hasLayer(l){return this.layers.includes(l);},removeLayer(l){this.layers=this.layers.filter(x=>x!==l);},addTo(target){target.addLayer?.(this);return this;},eachLayer(fn){this.layers.forEach(fn);}};groups.push(g);return g;};
 const map={setView(){return this;},addLayer:g=>mounted.add(g),removeLayer:g=>mounted.delete(g),fitBounds(...args){fitBounds.push(args);zoom=12;},getZoom:()=>zoom,on(){}};
 const walk=g=>g.layers.flatMap(l=>l.layers?walk(l):[l]),visible=()=>groups.slice(0,2).filter(g=>mounted.has(g)).flatMap(walk);
 const L={map:()=>map,tileLayer:()=>({addTo(){}}),control:{scale:()=>({addTo(){}})},layerGroup:group,geoJSON:(data,config)=>{const g=group();for(const feature of data.features.filter(config.filter)){const layer={feature,bindTooltip(){return this;},on(){},setStyle(style){this.style=style;}};config.onEachFeature(feature,layer);g.addLayer(layer);}g.addTo=target=>{target.addLayer(g);return g;};return g;}};
 const manifest={snapshot_id:'fixture',public_contract:{contract:data.contract,path:'index',entity_count:5848,hierarchy:{path:'tree'},geometry_tiers:Object.fromEntries(['RO','MD'].map(j=>[j,Object.fromEntries(['overview','local','detail'].map(t=>[t,{path:j+'/'+t}]))])),statistical_geometry:{RO:{path:'RO/stat'},MD:{path:'MD/stat'}}}};
 const fetch=async path=>({ok:true,json:async()=>{if(path==='data/current/actual-release-manifest.json')return manifest;if(path==='data/current/actual-release-gate.json')return {status:'PASS',snapshot_id:'fixture'};if(path==='public/data/app-build-info.json')return null;if(path==='index')return data;if(path==='tree')return tree;const [jurisdiction,tier]=path.split('/');return {metadata:tier==='stat'?{contract:'actual-public-statistical-geometry-v1',jurisdiction}:{jurisdiction,tier},features:data.entities.filter(e=>e.jurisdiction===jurisdiction&&(tier==='stat'?e.category==='statistical':e.category!=='statistical'&&e.map.tier===tier)).map(e=>({properties:{entity_id:e.id}}))};}});
 const previous={document:globalThis.document,L:globalThis.L,fetch:globalThis.fetch};
 try{
  Object.assign(globalThis,{document,L,fetch});const app=await import('../../app.js?atlas-search-tests');await app.frontendReady;
   for(const id of ['osm-r9846233','stat-MD120',data.entities.find(e=>e.jurisdiction==='RO'&&e.representation.inferred_type==='county'&&e.statistical?.level===3).id])app.visibleEntityIds.add(id);app.refreshGeometryVisibility();
  const input=document.getElementById('entity-search'),container=document.getElementById('search-results'),body=document.getElementById('details-body'),treeDOM=document.getElementById('hierarchy-tree');input.focus();
  const select=async(entity,q=entity.id)=>{input.value=q;await input.dispatch('input');assert.equal(app.atlasSearch.state.results[0].entity.id,entity.id);await input.dispatch('keydown',{key:'ArrowDown'});await input.dispatch('keydown',{key:'Enter'});};
  const synchronized=entity=>{assert.equal(app.selectedEntityId,entity.id);assert.equal(document.getElementById('details-title').textContent,formatEntityName(entity.display_name));assert.equal(treeDOM.querySelectorAll('[aria-pressed="true"]').length,1);assert.equal(treeDOM.querySelectorAll('[aria-pressed="true"]')[0].dataset.entityId,entity.id);assert.equal(body.querySelector('nav').querySelectorAll('button').at(-1).dataset.entityId,entity.id);assert.equal(input.getAttribute('aria-expanded'),'false');};
  const subtypeInput=id=>document.getElementById('filter-list').descendants().find(e=>e.dataset.kind==='geometry-subtype'&&e.dataset.filter===id);
  const town=byId.get('osm-r9846233');
  await t.test('visible keyboard selection prepares zoom/highlight and central navigation',async()=>{await select(town);synchronized(town);assert.ok(fitBounds.length>0);assert.ok(visible().some(l=>l.feature.properties.entity_id===town.id&&l.style?.color==='#b54a38'));});
  await t.test('hidden subtype search preserves entity/details/breadcrumb/lazy tree and does not enable subtype',async()=>{await subtypeInput('ro.towns').click();const state=[...app.activeGeometrySubtypes];await select(town);synchronized(town);assert.deepEqual([...app.activeGeometrySubtypes],state);assert.ok(!visible().some(l=>l.feature.properties.entity_id===town.id));assert.match(document.getElementById('selection-visibility').textContent,/ascunsă/);await input.dispatch('keydown',{key:'Escape'});synchronized(town);await subtypeInput('ro.towns').click();assert.ok(visible().some(l=>l.feature.properties.entity_id===town.id&&l.style?.color==='#b54a38'));});
  await t.test('deep MD keyboard selection materializes depth five',async()=>{const deep=byId.get(tree.nodes.find(n=>n.depth===5&&n.jurisdiction==='MD').id);await select(deep);synchronized(deep);let current=nodes.get(deep.id);while(current.parent_id){const ancestor=treeDOM.querySelectorAll('.tree-select').find(b=>b.dataset.entityId===current.parent_id);assert.ok(ancestor);current=nodes.get(current.parent_id);}});
  await t.test('statistical-only code search uses the same selection flow even if statistical level is off',async()=>{const md=byId.get('stat-MD120');app.activeStatisticalLevels.delete(3);app.refreshGeometryVisibility();const subtypeState=[...app.activeGeometrySubtypes];await select(md,'MD120');synchronized(md);assert.equal(options({container}).filter(o=>o.dataset.entityId===md.id).length,1);assert.deepEqual([...app.activeGeometrySubtypes],subtypeState);assert.ok(!visible().some(l=>l.feature.properties.entity_id===md.id));assert.match(document.getElementById('selection-visibility').textContent,/ascunsă/);app.activeStatisticalLevels.add(3);app.refreshGeometryVisibility();assert.ok(visible().some(l=>l.feature.properties.entity_id===md.id&&l.style?.color==='#b54a38'));});
  await t.test('coalesced county is one option and jurisdiction-off selection preserves subtype filters',async()=>{const county=data.entities.find(e=>e.jurisdiction==='RO'&&e.representation.inferred_type==='county'&&e.statistical?.level===3);const state=[...app.activeGeometrySubtypes];const checkbox=document.getElementById('layer-ro');checkbox.checked=false;await checkbox.dispatch('change');await select(county,county.statistical.code);synchronized(county);assert.equal(options({container}).filter(o=>o.dataset.entityId===county.id).length,1);assert.deepEqual([...app.activeGeometrySubtypes],state);assert.equal(checkbox.checked,false);assert.ok(!visible().some(l=>l.feature.properties.entity_id===county.id&&l.style?.color==='#b54a38'));});
 }finally{Object.assign(globalThis,previous);}
});
