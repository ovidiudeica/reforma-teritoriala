import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createUrlConfig,defaultUrlState,normalizeUrlState,parseUrlState,serializeUrlState,canonicalizeUrlState,sameUrlState,validViewport,createAtlasUrlState,defaultViewport} from '../../atlas-url-state.mjs';
import {createGeometryFilterIndex,geometryParentState} from '../../geometry-taxonomy.mjs';
import {createAtlasTree,ancestorPath} from '../../atlas-tree.mjs';
const data=JSON.parse(readFileSync('public/data/actual-entities.json','utf8')),tree=JSON.parse(readFileSync('public/data/actual-consolidated-tree.json','utf8'));
const entities=new Map(data.entities.map(e=>[e.id,e])),nodes=new Map(tree.nodes.map(n=>[n.id,n])),filterIndex=createGeometryFilterIndex(data.entities);
const config=createUrlConfig({entityById:entities,nodeById:nodes,rootIds:tree.root_ids,filterIndex});
const town=entities.get('osm-r9846233'),commune=data.entities.find(e=>e.jurisdiction==='RO'&&e.representation.inferred_type==='commune');
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
class Browser{
 constructor(search=''){this.entries=['https://example.test/atlas/index.html'+(search?'?'+search:'')];this.pointer=0;this.pushes=0;this.replaces=0;this.listeners={};this.history={pushState:(_,title,url)=>{this.pushes++;this.entries.splice(this.pointer+1);this.entries.push(new URL(url,this.location.href).href);this.pointer++;},replaceState:(_,title,url)=>{this.replaces++;this.entries[this.pointer]=new URL(url,this.location.href).href;}};}
 get location(){return new URL(this.entries[this.pointer]);}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 async go(delta){this.pointer=Math.max(0,Math.min(this.entries.length-1,this.pointer+delta));for(const fn of this.listeners.popstate??[])await fn({});}
 async visit(search){this.entries[this.pointer]='https://example.test/atlas/index.html'+(search?'?'+search:'');for(const fn of this.listeners.popstate??[])await fn({});}
}
const nontrivial=()=>normalizeUrlState({...defaultUrlState(config),entityId:town.id,viewport:{lat:45.123456,lon:27.234567,z:9},viewportExplicit:true,jurisdictions:['MD'],geometrySubtypes:config.subtypes.filter(id=>!['ro.towns','md.districts'].includes(id)),statisticalLevels:[1,2,'unclassified'],separateStatisticalGeometry:false,openIds:tree.root_ids.concat(tree.nodes.find(n=>n.depth===3&&n.child_ids.length>0&&n.jurisdiction==='MD').id)},config);
const sets=state=>({geometryClasses:new Set(state.geometryClasses),geometrySubtypes:new Set(state.geometrySubtypes)});
function historyHarness(search=''){
 const browser=new Browser(search);let state=defaultUrlState(config),controller;const restored=[];
 controller=createAtlasUrlState({browser,config,capture:()=>state,apply:async value=>{state=value;restored.push(value);assert.equal(controller.commit('push'),false);},onError:()=>{}});
 return {browser,controller,restored,get state(){return state;},set state(v){state=v;}};
}

test('bare URL parses exact defaults and default serializes without query',()=>{
 const defaults=defaultUrlState(config);assert.deepEqual(parseUrlState('',config),defaults);assert.deepEqual(defaults.viewport,defaultViewport);assert.equal(defaults.entityId,null);assert.equal(defaults.separateStatisticalGeometry,true);assert.deepEqual(defaults.statisticalLevels,[1,2,3,'unclassified']);assert.equal(serializeUrlState(defaults,config),'');assert.equal(canonicalizeUrlState('v=1',config),'');
});
test('serialization is byte-identical across action ordering; lists are sorted without duplicates',()=>{
 const a=nontrivial(),b={...a,geometrySubtypes:[...a.geometrySubtypes].reverse(),geometryClasses:[...a.geometryClasses].reverse(),openIds:[...a.openIds].reverse().concat(a.openIds),jurisdictions:[...a.jurisdictions].reverse(),statisticalLevels:[...a.statisticalLevels].reverse()};
 assert.equal(serializeUrlState(a,config),serializeUrlState(b,config));const params=new URLSearchParams(serializeUrlState(b,config));assert.deepEqual(params.getAll('f'),['md.districts','ro.towns']);assert.deepEqual(params.getAll('t'),[...new Set(a.openIds)].sort());
});
test('nontrivial normalized state round trips all navigation/filter/tree facets',()=>{
 const state=nontrivial(),parsed=parseUrlState(serializeUrlState(state,config),config);assert.deepEqual(parsed,state);assert.ok(sameUrlState(state,parsed,config));assert.equal(parsed.viewport.lat,45.12346);assert.equal(parsed.viewport.lon,27.23457);
});
test('entity lookup validates known IDs and removes unknown selections',()=>{
 assert.equal(parseUrlState('v=1&e='+town.id,config).entityId,town.id);assert.equal(parseUrlState('v=1&e=unknown',config).entityId,null);assert.equal(canonicalizeUrlState('v=1&e=unknown',config),'');
});
test('viewport validates bounds, complete tuple, zoom range and finite values',()=>{
 assert.deepEqual(validViewport({lat:-90,lon:180,z:0},config),{lat:-90,lon:180,z:0});
 for(const viewport of [{lat:91,lon:0,z:6},{lat:0,lon:181,z:6},{lat:'NaN',lon:0,z:6},{lat:0,lon:0,z:-1},{lat:0,lon:0,z:20},{lat:0,lon:0,z:1.5},{lat:'',lon:0,z:6},{lat:null,lon:0,z:6},{lat:0,lon:0}])assert.equal(validViewport(viewport,config),null);
 assert.equal(parseUrlState('v=1&lat=10&lon=20',config).viewportExplicit,false);assert.deepEqual(parseUrlState('v=1&lat=91&lon=20&z=6',config).viewport,defaultViewport);
});
test('viewport explicitness distinguishes entity-only link from exact default viewport',()=>{
 const semantic=parseUrlState('v=1&e='+town.id,config);assert.equal(semantic.viewportExplicit,false);assert.equal(serializeUrlState(semantic,config),'v=1&e='+town.id);
 const exact={...semantic,viewportExplicit:true};assert.match(serializeUrlState(exact,config),/lat=46.8&lon=26.6&z=6/);assert.equal(sameUrlState(semantic,exact,config),false);
});
test('jurisdiction both/RO/MD/none round trip independently from subtype filters',()=>{
 for(const jurisdictions of [['RO','MD'],['RO'],['MD'],[]]){const state=normalizeUrlState({...nontrivial(),jurisdictions},config),parsed=parseUrlState(serializeUrlState(state,config),config);assert.deepEqual(parsed.jurisdictions,[...jurisdictions].sort());assert.deepEqual(parsed.geometrySubtypes,state.geometrySubtypes);}
});
test('subtype restore produces consistent mixed/none parent checkbox states',()=>{
 const state=parseUrlState('v=1&f=ro.towns&f=md.districts',config),regional=filterIndex.groups.find(g=>g.id==='regional'),local=filterIndex.groups.find(g=>g.id==='local_uat');assert.deepEqual(geometryParentState(regional,sets(state)),{checked:false,indeterminate:true});assert.deepEqual(geometryParentState(local,sets(state)),{checked:false,indeterminate:true});
 const off=normalizeUrlState({...state,geometryClasses:state.geometryClasses.filter(c=>c!=='regional')},config);for(const j of regional.jurisdictions)for(const sub of j.subtypes)assert.ok(!off.geometrySubtypes.includes(sub.id));assert.ok(!off.geometryClasses.includes('regional'));assert.deepEqual(parseUrlState(serializeUrlState(off,config),config),off);
});
test('statistical level three and separate geometry remain independent of subtypes',()=>{
 const state=parseUrlState('v=1&s=1,2,unclassified&b=0&f=ro.towns',config);assert.deepEqual(state.statisticalLevels,[1,2,'unclassified']);assert.equal(state.separateStatisticalGeometry,false);assert.ok(!state.geometrySubtypes.includes('ro.towns'));const restored=parseUrlState(serializeUrlState(state,config),config);assert.deepEqual(restored,state);
 assert.deepEqual(parseUrlState('v=1&b=0',config).statisticalLevels,config.levels);assert.deepEqual(parseUrlState('v=1&s=',config).statisticalLevels,[]);
});
test('manual tree disclosure restore is lazy/exact; selected path is added afterward',async()=>{
 const document=doc(),container=document.getElementById('tree'),changes=[];const controller=createAtlasTree({document,container,nodeById:nodes,rootIds:tree.root_ids,onSelect(){},onDisclosureChange:()=>changes.push(true)});
 const branch=tree.nodes.find(n=>n.depth===4&&n.jurisdiction==='MD'&&n.child_ids.length>0),path=ancestorPath(nodes,tree.root_ids,branch.id);
 controller.setOpenIds([branch.id,'unknown',town.id]);assert.deepEqual(controller.getOpenIds(),[branch.id]);assert.ok(controller.getNode(branch.id));for(const id of path.slice(0,-1))assert.equal(controller.getNode(id).wrapper.open,false);
 for(const wrapper of container.querySelectorAll('details'))await wrapper.dispatch('toggle');assert.equal(changes.length,0);
 controller.select(branch.child_ids[0]);for(const id of path)assert.equal(controller.getNode(id).wrapper.open,true);
 const actual=controller.getOpenIds();assert.ok(actual.includes(branch.id));controller.getNode(branch.id).wrapper.open=false;await controller.getNode(branch.id).wrapper.dispatch('toggle');assert.equal(changes.length,1);assert.ok(!controller.getOpenIds().includes(branch.id));
});
test('tree URL validation excludes unknown IDs and leaves; empty tree is explicit',()=>{
 const leaf=tree.nodes.find(n=>!n.child_ids.length);assert.deepEqual(parseUrlState('v=1&t=unknown&t='+leaf.id,config).openIds,[]);assert.equal(serializeUrlState({...defaultUrlState(config),openIds:[]},config),'v=1&t=');
});
test('URLSearchParams round trips special characters in entity/subtype/tree IDs',()=>{
 const id='id,&+= /?ș',sub='facet,&+= /?ș',node='tree,&+= /?ș';const special={...config,entityIds:new Set([...config.entityIds,id]),subtypes:[...config.subtypes,sub].sort(),nodeById:new Map([...nodes,[node,{child_ids:['leaf']}]] )};
 const state=normalizeUrlState({...defaultUrlState(special),entityId:id,geometrySubtypes:special.subtypes.filter(v=>v!==sub),openIds:[node]},special);assert.deepEqual(parseUrlState(serializeUrlState(state,special),special),state);
});
test('canonicalization drops duplicates, unknown/default parameters and future schemas safely',()=>{
 const root=config.rootIds[0];const query='foo=x&v=1&v=2&j=RO,MD&s=1,2,3,unclassified&b=1&e=unknown&f=ro.towns&f=ro.towns&f=unknown&t='+root+'&t='+root+'&t=unknown&lat=NaN&lon=9&z=5';assert.equal(canonicalizeUrlState(query,config),'v=1&f=ro.towns&t='+root);
 assert.deepEqual(parseUrlState('v=99&e='+town.id+'&f=ro.towns',config),defaultUrlState(config));assert.equal(canonicalizeUrlState('v=99&e='+town.id,config),'');assert.equal(canonicalizeUrlState('v=1&s=99&j=XX',config),'');
});
test('realistic URL stays compact and excludes internal/loading/search/provenance state',()=>{
 const query=serializeUrlState({...nontrivial(),query:'Victoria',activeSearchId:town.id,loadedChunks:['chunk'],fingerprint:'secret',geometrySubtypes:config.subtypes.filter(id=>!['ro.towns','md.districts','md.towns'].includes(id))},config);assert.ok(query.length<650,query.length);assert.equal(new URLSearchParams(query).has('query'),false);assert.ok(!query.includes('secret'));assert.ok(!query.includes('chunk'));
});
test('history push A/B and popstate restore selection/filters/viewport/tree with no new entry',async()=>{
 const h=historyHarness();await h.controller.restore();const a=nontrivial();h.state=a;h.controller.commit('push');const b=normalizeUrlState({...a,entityId:commune.id,viewport:{lat:46,lon:24,z:11},geometrySubtypes:config.subtypes,openIds:config.rootIds},config);h.state=b;h.controller.commit('push');const length=h.browser.entries.length,pushes=h.browser.pushes;await h.browser.go(-1);assert.deepEqual(h.state,a);assert.equal(h.browser.entries.length,length);assert.equal(h.browser.pushes,pushes);await h.browser.go(1);assert.deepEqual(h.state,b);
});
test('five viewport changes replace current entry rather than creating history spam',async()=>{
 const h=historyHarness();await h.controller.restore();for(let i=0;i<5;i++){h.state=normalizeUrlState({...h.state,viewport:{lat:45+i/100,lon:26,z:9},viewportExplicit:true},config);h.controller.commit('replace');}assert.equal(h.browser.pushes,0);assert.equal(h.browser.entries.length,1);assert.equal(parseUrlState(h.browser.location.search,config).viewport.lat,45.04);
});
test('selection transaction guards map callbacks and makes discrete A/B navigation',async()=>{
 const h=historyHarness();await h.controller.restore();for(const entity of [town,commune])await h.controller.action('push',async()=>{h.state=normalizeUrlState({...h.state,entityId:entity.id,viewport:{lat:45,lon:25,z:10},viewportExplicit:true},config);assert.equal(h.controller.commit('replace'),false);});assert.equal(h.browser.pushes,2);await h.browser.go(-1);assert.equal(h.state.entityId,town.id);
});
test('history API errors are isolated and do not throw; share URL still reflects live state',()=>{
 const browser=new Browser(),errors=[];browser.history.replaceState=()=>{throw Error('Denied');};const state=nontrivial(),controller=createAtlasUrlState({browser,config,capture:()=>state,apply:async()=>{},onError:(...args)=>errors.push(args)});assert.equal(controller.commit('replace'),false);assert.equal(errors.length,1);assert.deepEqual(parseUrlState(new URL(controller.shareUrl()).search,config),state);
});
test('pending selection superseded by popstate never pushes an entry after restore',async()=>{
 const h=historyHarness();await h.controller.restore();let done;const pending=h.controller.action('push',async()=>{h.state=nontrivial();await new Promise(resolve=>{done=resolve;});});const pushes=h.browser.pushes;assert.equal(pushes,1);await h.browser.go(-1);done();await pending;assert.equal(h.browser.pushes,pushes);assert.equal(h.state.entityId,null);
});
test('rapid A/B selections push immediately even when geometry promises resolve out of order',async()=>{
 const h=historyHarness();await h.controller.restore();const releases=[];
 const pending=[];for(const entity of [town,commune])pending.push(h.controller.action('push',async()=>{h.state=normalizeUrlState({...h.state,entityId:entity.id,viewport:{lat:45,lon:25,z:10},viewportExplicit:true},config);await new Promise(resolve=>releases.push(resolve));}));
 assert.equal(h.browser.pushes,2);releases[1]();await pending[1];releases[0]();await pending[0];assert.equal(h.browser.pushes,2);await h.browser.go(-1);assert.equal(h.state.entityId,town.id);await h.browser.go(1);assert.equal(h.state.entityId,commune.id);
});
test('queued popstate guards writes immediately, before the restore microtask starts',async()=>{
 const h=historyHarness();await h.controller.restore();const a=nontrivial(),b=normalizeUrlState({...a,entityId:commune.id,viewport:{lat:46,lon:24,z:11}},config);h.state=a;h.controller.commit('push');h.state=b;h.controller.commit('push');
 const pushes=h.browser.pushes,length=h.browser.entries.length;const back=h.browser.go(-1);assert.equal(h.controller.isRestoring,true);assert.equal(h.controller.commit('replace'),false);const forward=h.browser.go(1);await Promise.all([back,forward]);assert.equal(h.controller.isRestoring,false);assert.deepEqual(h.state,b);assert.equal(h.browser.pushes,pushes);assert.equal(h.browser.entries.length,length);
});
test('ACTUAL/P2 contract counts and MD120/MD121 evidence remain intact',()=>{
 const manifest=JSON.parse(readFileSync('data/current/actual-release-manifest.json','utf8'));assert.equal(data.contract,'actual-public-entity-v3');assert.equal(data.entities.length,5848);assert.equal(tree.nodes.length,5848);assert.equal(data.entities.filter(e=>e.roles.includes('statistical')).length,63);assert.equal(data.entities.filter(e=>e.category==='statistical').length,18);assert.equal(manifest.snapshot_id,'actual-a9e5a4ddcb5277ef');assert.equal(manifest.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');assert.equal(entities.get('stat-MD120').statistical.code,'MD120');assert.equal(entities.get('stat-MD120').representation.osm_statistical_ref,'MD121');assert.equal(entities.get('stat-MD120').representation.osm_ref_is_identity_authority,false);
});
test('real frontend URL hydration/history integrates selection, filters, viewport, tree and existing Atlas controls',async t=>{
 const initial=nontrivial(),browser=new Browser(serializeUrlState(initial,config)),document=doc(),groups=[],mounted=new Set(),requests=[],fits=[],events=new Map();let viewport={...defaultViewport};
 const group=()=>{const g={layers:[],clearLayers(){this.layers=[];},addLayer(l){this.layers.push(l);},hasLayer(l){return this.layers.includes(l);},removeLayer(l){this.layers=this.layers.filter(x=>x!==l);},addTo(target){target.addLayer?.(this);return this;},eachLayer(fn){this.layers.forEach(fn);}};groups.push(g);return g;};
 const emit=name=>{for(const fn of events.get(name)||[])fn();};
 const map={setView([lat,lon],z,options){viewport={lat,lon,z};emit('zoomend');emit('moveend');return this;},addLayer:g=>mounted.add(g),removeLayer:g=>mounted.delete(g),fitBounds(bounds,options){fits.push({bounds,options});viewport={lat:(bounds[0][0]+bounds[1][0])/2,lon:(bounds[0][1]+bounds[1][1])/2,z:12};emit('zoomend');emit('moveend');},getCenter:()=>({lat:viewport.lat,lng:viewport.lon}),getZoom:()=>viewport.z,on(names,fn){for(const name of names.split(' ')){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}}};
 const walk=g=>g.layers.flatMap(l=>l.layers?walk(l):[l]),visible=()=>groups.slice(0,2).filter(g=>mounted.has(g)).flatMap(walk);
 const L={map:()=>map,tileLayer:()=>({addTo(){}}),control:{scale:()=>({addTo(){}})},layerGroup:group,geoJSON:(data,options)=>{const g=group();for(const feature of data.features.filter(options.filter)){const layer={feature,handlers:{},bindTooltip(){return this;},on(name,fn){this.handlers[name]=fn;},setStyle(style){this.style=style;}};options.onEachFeature(feature,layer);g.addLayer(layer);}g.addTo=target=>{target.addLayer(g);return g;};return g;}};
 const manifest={snapshot_id:'fixture',public_contract:{contract:data.contract,path:'index',entity_count:5848,hierarchy:{path:'tree'},geometry_tiers:Object.fromEntries(['RO','MD'].map(j=>[j,Object.fromEntries(['overview','local','detail'].map(t=>[t,{path:j+'/'+t}]))])),statistical_geometry:{RO:{path:'RO/stat'},MD:{path:'MD/stat'}}}};
 const fetch=async path=>{requests.push(path);return {ok:true,json:async()=>{if(path==='data/current/actual-release-manifest.json')return manifest;if(path==='data/current/actual-release-gate.json')return {status:'PASS',snapshot_id:'fixture'};if(path==='public/data/app-build-info.json')return null;if(path==='index')return data;if(path==='tree')return tree;const [jurisdiction,tier]=path.split('/');return {metadata:tier==='stat'?{contract:'actual-public-statistical-geometry-v1',jurisdiction}:{jurisdiction,tier},features:data.entities.filter(e=>e.jurisdiction===jurisdiction&&(tier==='stat'?e.category==='statistical':e.category!=='statistical'&&e.map.tier===tier)).map(e=>({properties:{entity_id:e.id}}))};}};};
 const previous={document:globalThis.document,L:globalThis.L,fetch:globalThis.fetch,window:globalThis.window},navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');const copied=[];
 try{
  Object.assign(globalThis,{document,L,fetch,window:browser});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async value=>copied.push(value)}}});
  const app=await import('../../app.js?atlas-url-tests');await app.frontendReady;assert.ok(app.atlasUrl);const body=document.getElementById('details-body'),treeDOM=document.getElementById('hierarchy-tree'),input=document.getElementById('entity-search'),filtersDOM=document.getElementById('filter-list');
  const selected=id=>{assert.equal(app.selectedEntityId,id);assert.equal(document.getElementById('details-title').textContent,entities.get(id).display_name);const selected=treeDOM.querySelectorAll('[aria-pressed="true"]');assert.equal(selected.length,1);assert.equal(selected[0].dataset.entityId,id);assert.equal(body.querySelector('nav').querySelectorAll('button').at(-1).dataset.entityId,id);assert.equal(new URLSearchParams(browser.location.search).get('e'),id);};
  const subtype=id=>filtersDOM.descendants().find(e=>e.dataset.kind==='geometry-subtype'&&e.dataset.filter===id);
  await t.test('complex pre-ready URL restores filters, details/breadcrumb/tree and exact viewport without fitBounds',()=>{
   selected(town.id);assert.equal(fits.length,0);assert.deepEqual(viewport,initial.viewport);assert.equal(document.getElementById('layer-ro').checked,false);assert.equal(document.getElementById('layer-md').checked,true);assert.equal(subtype('ro.towns').checked,false);assert.equal(subtype('md.districts').checked,false);assert.equal(filtersDOM.descendants().find(e=>e.dataset.kind==='statistical'&&e.dataset.filter==='3').checked,false);assert.equal(filtersDOM.descendants().find(e=>e.dataset.kind==='separate-statistical').checked,false);
   assert.match(document.getElementById('selection-visibility').textContent,/ascunsă/);assert.ok(!visible().some(l=>l.feature.properties.entity_id===town.id));assert.equal(browser.pushes,0);assert.equal(browser.location.search.slice(1),serializeUrlState(app.captureUrlState(),config));
   for(const id of initial.openIds)assert.ok(app.captureUrlState().openIds.includes(id));for(const id of ancestorPath(nodes,tree.root_ids,town.id).slice(0,-1))assert.ok(app.captureUrlState().openIds.includes(id));assert.ok(treeDOM.querySelectorAll('.tree-select').length<5848);assert.equal(app.atlasUrl.isRestoring,false);
  });
  await t.test('entity-only URL zooms normally; explicit viewport including default prevents fitBounds override',async()=>{
   let count=fits.length;await browser.visit('v=1&e='+commune.id);selected(commune.id);assert.equal(fits.length,count+1);assert.equal(fits.at(-1).options.animate,false);assert.ok(new URLSearchParams(browser.location.search).has('lat'));
   count=fits.length;await browser.visit('v=1&e='+commune.id+'&lat=44.8&lon=24.3&z=8');selected(commune.id);assert.deepEqual(viewport,{lat:44.8,lon:24.3,z:8});assert.equal(fits.length,count);
   await browser.visit('v=1&e='+commune.id+'&lat=46.8&lon=26.6&z=6');assert.deepEqual(viewport,defaultViewport);assert.equal(fits.length,count);assert.ok(new URLSearchParams(browser.location.search).has('lat'));
  });
  await t.test('visible entity restore preserves jurisdiction OFF and subtype state',async()=>{
   await browser.visit('v=1&e='+commune.id+'&j=MD&f=ro.towns&lat=46&lon=25&z=10');selected(commune.id);assert.equal(document.getElementById('layer-ro').checked,false);assert.ok(!app.activeGeometrySubtypes.has('ro.towns'));assert.ok(!visible().some(l=>l.feature.properties.entity_id===commune.id));assert.match(document.getElementById('selection-visibility').textContent,/ascunsă/);
   input.value=commune.id;await input.dispatch('input');await input.dispatch('keydown',{key:'ArrowDown'});await input.dispatch('keydown',{key:'Enter'});assert.equal(document.getElementById('layer-ro').checked,true);assert.equal(document.getElementById('selection-visibility').textContent,'');assert.ok(!app.activeGeometrySubtypes.has('ro.towns'));
  });
  await t.test('hidden MD120 remains selected in URL with official identity and independent filters',async()=>{
   await browser.visit('v=1&e=stat-MD120&s=1,2,unclassified');selected('stat-MD120');assert.equal(app.activeStatisticalLevels.has(3),false);assert.ok(app.activeGeometrySubtypes.has('ro.towns'));assert.ok(!visible().some(l=>l.feature.properties.entity_id==='stat-MD120'));assert.match(document.getElementById('selection-visibility').textContent,/ascunsă/);
  });
  await t.test('coalesced county is one selection and one reused geometry',async()=>{
   const county=data.entities.find(e=>e.jurisdiction==='RO'&&e.representation.inferred_type==='county'&&e.statistical?.level===3);await browser.visit('v=1&e='+county.id);selected(county.id);assert.equal(visible().filter(l=>l.feature.properties.entity_id===county.id).length,1);assert.ok(visible().some(l=>l.feature.properties.entity_id===county.id&&l.style?.color==='#b54a38'));
  });
  await t.test('manual disclosures replace URL; deferred programmatic toggles do not write; selection path wins on restore',async()=>{
   await browser.visit('v=1&e='+town.id+'&lat=46&lon=26&z=10');const parent=nodes.get(town.id).parent_id;
   const parentButton=treeDOM.querySelectorAll('.tree-select').find(b=>b.dataset.entityId===parent),disclosure=parentButton.parentElement.children.find(e=>e.tagName==='DETAILS');assert.ok(disclosure.open);const length=browser.entries.length;
   disclosure.open=false;await disclosure.dispatch('toggle');assert.ok(!new URLSearchParams(browser.location.search).getAll('t').includes(parent));assert.equal(browser.entries.length,length);
   const link=browser.location.search.slice(1);await browser.visit(link);assert.ok(disclosure.open);selected(town.id);assert.ok(new URLSearchParams(browser.location.search).getAll('t').includes(parent));
   const replaces=browser.replaces;for(const d of treeDOM.querySelectorAll('details'))await d.dispatch('toggle');assert.equal(browser.replaces,replaces);
  });
  await t.test('five real map moveend events replace and retain chunk/tier loading',async()=>{
   const pushes=browser.pushes,length=browser.entries.length;for(let i=0;i<5;i++)map.setView([45+i/100,25],12);await app.syncTiers();assert.equal(browser.pushes,pushes);assert.equal(browser.entries.length,length);assert.equal(parseUrlState(browser.location.search,config).viewport.lat,45.04);assert.ok(visible().length>0);
  });
  await t.test('search keyboard, filters, tree and map selection remain centralized and push discrete history',async()=>{
   const search=app.atlasSearch;input.focus();input.value=commune.id;await input.dispatch('input');await input.dispatch('keydown',{key:'ArrowDown'});let count=browser.pushes;await input.dispatch('keydown',{key:'Enter'});selected(commune.id);assert.equal(browser.pushes,count+1);assert.equal(search.state.open,false);
   count=browser.pushes;await subtype('ro.towns').click();assert.equal(browser.pushes,count+1);assert.equal(app.activeGeometrySubtypes.has('ro.towns'),false);assert.equal(app.atlasSearch,search);assert.equal(new URLSearchParams(browser.location.search).getAll('f').includes('ro.towns'),true);
   const county=entities.get(town.hierarchy.consolidated_parent_id);count=browser.pushes;await treeDOM.querySelectorAll('.tree-select').find(b=>b.dataset.entityId===county.id).click();selected(county.id);assert.equal(browser.pushes,count+1);
   const sector=visible().find(l=>entities.get(l.feature.properties.entity_id).jurisdiction==='RO'&&entities.get(l.feature.properties.entity_id).representation.inferred_type==='sector');assert.ok(sector);count=browser.pushes;await sector.handlers.click();selected(sector.feature.properties.entity_id);assert.equal(browser.pushes,count+1);
   count=browser.pushes;const j=document.getElementById('layer-md');j.checked=false;await j.dispatch('change');assert.equal(browser.pushes,count+1);assert.equal(new URLSearchParams(browser.location.search).get('j'),'RO');
  });
  await t.test('real Back/Forward restores entity/filter/tree/viewport without new push and leaves search ephemeral',async()=>{
   const before=normalizeUrlState(app.captureUrlState(),config);input.value='Victoria';await input.dispatch('input');await input.dispatch('keydown',{key:'ArrowDown'});const searchState=app.atlasSearch.state;assert.equal(searchState.open,true);
   const pushes=browser.pushes,length=browser.entries.length;await browser.go(-1);assert.equal(browser.pushes,pushes);assert.equal(browser.entries.length,length);assert.equal(app.atlasSearch.state.query,searchState.query);assert.equal(app.atlasSearch.state.activeId,searchState.activeId);assert.equal(app.atlasSearch.state.open,true);assert.ok(!browser.location.search.includes('Victoria'));
   await browser.go(1);assert.equal(browser.pushes,pushes);assert.ok(sameUrlState(app.captureUrlState(),before,config));selected(before.entityId);
  });
  await t.test('clear selection pushes; Back restores details/tree and preserves disclosure state',async()=>{
   const id=app.selectedEntityId,open=app.captureUrlState().openIds,pushes=browser.pushes;await document.getElementById('details-close').click();assert.equal(app.selectedEntityId,null);assert.equal(body.querySelector('nav'),null);assert.equal(treeDOM.querySelectorAll('[aria-pressed="true"]').length,0);assert.deepEqual(app.captureUrlState().openIds,open);assert.equal(browser.pushes,pushes+1);assert.equal(new URLSearchParams(browser.location.search).has('e'),false);
   await browser.go(-1);selected(id);assert.equal(browser.pushes,pushes+1);
  });
  await t.test('invalid IDs/duplicates canonicalize safely and unknown version returns bare defaults',async()=>{
   await browser.visit('junk=x&v=1&e=missing&j=RO,MD&s=9&f=missing&t=missing&lat=91&lon=20&z=10');assert.equal(app.selectedEntityId,null);assert.deepEqual(viewport,defaultViewport);assert.equal(browser.location.search,'?v=1&t=');
   await browser.visit('v=99&e='+town.id+'&f=ro.towns');assert.equal(browser.location.search,'');assert.equal(app.selectedEntityId,null);assert.equal(app.activeGeometrySubtypes.has('ro.towns'),true);assert.deepEqual(app.captureUrlState().openIds,config.rootIds);
  });
  await t.test('copy link uses live canonical state and gives success/failure feedback',async()=>{
   await document.getElementById('copy-link').click();assert.equal(copied.at(-1),app.atlasUrl.shareUrl());assert.equal(document.getElementById('share-status').textContent,'Link copiat.');globalThis.navigator.clipboard.writeText=async()=>{throw Error('Denied');};await document.getElementById('copy-link').click();assert.match(document.getElementById('share-status').textContent,/Copiere indisponibilă/);
  });
  assert.equal(browser.location.pathname,'/atlas/index.html');assert.equal(data.entities.length,5848);assert.equal(tree.nodes.length,5848);assert.ok(requests.every(path=>!path.includes('Victoria')));
 }finally{Object.assign(globalThis,previous);if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else delete globalThis.navigator;}
});
