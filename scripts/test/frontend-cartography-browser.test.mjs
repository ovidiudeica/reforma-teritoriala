import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {launchBrowser,waitFor,delay} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=path.join(tmpdir(),'atlas-browser-evidence');
const entities=JSON.parse(readFileSync(path.join(root,'public/data/actual-entities.json'),'utf8')).entities;
const ro=entities.find(e=>e.jurisdiction==='RO'&&e.representation.inferred_type==='county'&&e.roles.includes('statistical'));
const md=entities.find(e=>e.jurisdiction==='MD'&&e.statistical?.code==='MD115');
const separate=entities.find(e=>e.jurisdiction==='MD'&&e.statistical?.code==='MD120');
const roLocal=entities.find(e=>e.jurisdiction==='RO'&&e.map.tier==='local');
const mdDetail=entities.find(e=>e.jurisdiction==='MD'&&e.map.tier==='detail');
assert.ok([ro,md,separate,roLocal,mdDetail].every(Boolean),'missing RO/MD test identity');

const evidence={contract:'p4.2-chrome-matrix-v1',browser:null,commit:null,matrix:null,
 viewports:[],selections:[],filters:[],lazy:null,zOrder:null,console:null,scenarios:[]};
const browser=await launchBrowser(root),page=await browser.page();
evidence.browser=browser.version.Browser;
const snapshot=()=>page.evaluate("({id:qaApp.selectedEntityId,pressed:document.querySelectorAll('.tree-select[aria-pressed=true]').length,breadcrumb:!!document.querySelector('.hierarchy-breadcrumb'),url:new URL(location.href).searchParams.get('e'),hidden:document.querySelector('#selection-visibility').textContent,highlight:[...document.querySelectorAll('.leaflet-map-pane path')].filter(p=>p.getAttribute('stroke')==='#b54a38').length,zoom:qaApp.captureUrlState().viewport.z})");
async function select(id,label){
 await page.evaluate('qaApp.selectEntity('+JSON.stringify(id)+',{zoom:true,source:"P4.2"})');
 await waitFor(async()=>{const s=await snapshot();return s.id===id&&s.pressed===1&&s.url===id&&s.highlight>0&&s.breadcrumb;},'visible selected SVG '+label,30000);
 const s=await snapshot();assert.ok(s.highlight>0&&s.breadcrumb&&s.zoom<=12);
 evidence.selections.push({label,id,zoom:s.zoom,highlight:s.highlight,pass:true});
 return s;
}
async function shotViewport(width,height){
 await mkdir(output,{recursive:true});
 switch(width){
  case 1440: await page.screenshot(path.join(output,'p42-1440.png')); break;
  case 1280: await page.screenshot(path.join(output,'p42-1280.png')); break;
  case 900: await page.screenshot(path.join(output,'p42-900.png')); break;
  case 360: await page.screenshot(path.join(output,'p42-360.png')); break;
  case 390:
   if(height===844)await page.screenshot(path.join(output,'p42-390-844.png'));
   else if(height===600)await page.screenshot(path.join(output,'p42-390-600.png'));
   else throw Error('Unexpected 390px screenshot height');
   break;
  case 430: await page.screenshot(path.join(output,'p42-430.png')); break;
  default: throw Error('Unexpected P4.2 screenshot viewport');
 }
}
async function check(t,name,fn){await t.test(name,{timeout:180000},async()=>{try{await fn();evidence.scenarios.push({name,result:'PASS'});}catch(error){evidence.scenarios.push({name,result:'FAIL',error:String(error)});throw error;}});}
async function computeMatrix(){
 const app=qaApp,{geometryClass,geometrySubtype,geometryVisible,statisticalLevel}=await import('./geometry-taxonomy.mjs');
 const all=[...app.entityById.values()];
 const classes=[...new Set(all.map(geometryClass))].filter(x=>x!=='statistical_only');
 const subs=[...new Set(all.map(geometrySubtype).filter(Boolean))].sort();
 const states=[];
 for(const juris of [[],['RO'],['MD'],['RO','MD']])for(const admin of [false,true])
  for(let mask=0;mask<8;mask++)for(const separate of [false,true])
   states.push({juris,classes:admin?classes:[],subs:admin?subs:[],levels:[1,2,3].filter(k=>mask&(1<<(k-1))),separate});
 for(const j of ['RO','MD'])for(const subtype of subs)
  states.push({juris:[j],classes,subs:[subtype],levels:[],separate:false});
 let checked=0,mismatches=0,first=null;const visible=new Set();
 const classified=all.map(e=>[e,geometryClass(e),geometrySubtype(e),statisticalLevel(e)]);
 for(const s of states){
  const opts={geometryClasses:new Set(s.classes),geometrySubtypes:new Set(s.subs),
   statisticalLevels:new Set(s.levels),separateStatisticalGeometry:s.separate};
  for(const [e,cls,sub,level] of classified){
   const statistical=level!==null&&s.levels.includes(level);
   const expected=s.juris.includes(e.jurisdiction)&&(cls==='statistical_only'?
    s.separate&&statistical:(s.classes.includes(cls)&&s.subs.includes(sub))||statistical);
   const actual=s.juris.includes(e.jurisdiction)&&geometryVisible(e,opts);
   if(actual!==expected){mismatches++;if(!first)first={id:e.id,state:s};}
   if(actual)visible.add(e.id);checked++;
  }
 }
 return {identities:all.length,states:states.length,checks:checked,mismatches,first,
  everVisible:visible.size,jurisdictions:{RO:all.filter(e=>e.jurisdiction==='RO').length,MD:all.filter(e=>e.jurisdiction==='MD').length}};
}

try{
 await test('P4.2 Chrome/CDP RO+MD cartographic matrix',{timeout:840000},async t=>{
  await check(t,'exhaustive runtime per-ID matrix: 5848 x 170',async()=>{
   await page.viewport(1440,900);await page.navigate(browser.server.url);
   const data=await page.evaluate('('+computeMatrix.toString()+')()');
   evidence.matrix=data;
   assert.deepEqual([data.identities,data.states,data.checks,data.mismatches,data.everVisible],
    [5848,170,994160,0,5848],JSON.stringify(data.first));
   assert.deepEqual(data.jurisdictions,{RO:3246,MD:2602});
  });
  await check(t,'14 real polygon selections and zoom across 7 viewports RO/MD',async()=>{
   for(const [w,h] of [[1440,900],[1280,800],[900,768],[360,800],[390,844],[430,932],[390,600]]){
    await page.viewport(w,h);
    const v=await page.evaluate("({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,tree:!!document.querySelector('#hierarchy-tree'),map:!!document.querySelector('.leaflet-map-pane'),vectors:document.querySelectorAll('.leaflet-interactive').length,mobile:matchMedia('(max-width: 720px)').matches})");
    assert.equal(v.width,w);assert.equal(v.overflow,false,'horizontal overflow');
    assert.ok(v.tree&&v.map&&v.vectors>0);assert.equal(v.mobile,w<=720);
    await select(ro.id,'RO '+w+'x'+h);await select(md.id,'MD '+w+'x'+h);
    evidence.viewports.push({width:w,height:h,ro:ro.id,md:md.id,vectors:v.vectors});
    await shotViewport(w,h);
   }
  });
  await check(t,'filter OR, jurisdictions and separate statistical z-order in SVG',async()=>{
   await page.viewport(1440,900);
   await select(ro.id,'RO coalesced before filters');
   await page.click('button[aria-label="Niciuna — Tipuri administrative"]');
   await waitFor(async()=>(await snapshot()).highlight>0,'statistical OR retains shared polygon');
   evidence.filters.push('admin OFF / statistical ON -> coalesced visible');
   await page.click('input[data-kind=statistical][data-filter="3"]');
   await waitFor(async()=>{const s=await snapshot();return s.highlight===0&&/ascuns/i.test(s.hidden);},'both roles OFF hides shared polygon');
   evidence.filters.push('admin OFF / statistical OFF -> coalesced hidden');
   await page.click('input[data-kind=statistical][data-filter="3"]');
   await waitFor(async()=>(await snapshot()).highlight>0,'statistical role restored');
   await page.click('button[aria-label="Toate — Tipuri administrative"]');
   await select(ro.id,'RO jurisdiction gate');
   await page.click('#layer-ro');
   await waitFor(async()=>{const s=await snapshot();return s.highlight===0&&/ascuns/i.test(s.hidden);},'RO jurisdiction hidden');
   await page.click('#layer-ro');await waitFor(async()=>(await snapshot()).highlight>0,'RO jurisdiction restored');
   evidence.filters.push('jurisdiction OFF/ON -> hidden/restored SVG');
   await select(separate.id,'MD statistical-only');
   const pane=await page.evaluate("(()=>{const s=document.querySelector('.leaflet-statistical-boundaries-pane'),a=document.querySelector('.leaflet-overlay-pane');return {stat:Number(getComputedStyle(s).zIndex),admin:Number(getComputedStyle(a).zIndex),paths:s.querySelectorAll('path').length,selected:s.querySelectorAll('path[stroke=\"#b54a38\"]').length};})()");
   assert.ok(pane.stat>pane.admin&&pane.paths===18&&pane.selected>0,JSON.stringify(pane));
   evidence.zOrder=pane;
   await page.click('input[data-kind=separate-statistical]');
   await waitFor(async()=>{const s=await snapshot();return s.highlight===0&&/ascuns/i.test(s.hidden);},'separate OFF hides MD120');
   await page.click('input[data-kind=separate-statistical]');
   await waitFor(async()=>(await snapshot()).highlight>0,'separate ON restores MD120');
   evidence.filters.push('separate OFF/ON -> statistical-only hidden/restored');
   await page.screenshot(path.join(output,'p42-statistical-pane.png'));
  });
  await check(t,'lazy RO local and MD detail chunks, no filter refetch or duplicate chunks',async()=>{
   const p=await browser.page();
   try{
    await p.viewport(1440,900);await p.navigate(browser.server.url);
    const start=await p.evaluate('({zoom:qaApp.captureUrlState().viewport.z,chunks:qaApp.chunkGroups.size})');
    assert.ok(start.zoom<7);assert.equal(start.chunks,0,'chunks loaded before threshold');
    const found=[];
    for(const e of [roLocal,mdDetail]){
     await p.evaluate('qaApp.selectEntity('+JSON.stringify(e.id)+',{zoom:true,source:"P4.2"})');
     await waitFor(()=>p.evaluate("qaApp.chunkGroups.size>0&&[...document.querySelectorAll('.leaflet-map-pane path')].some(x=>x.getAttribute('stroke')==='#b54a38')"),'lazy chunk selected '+e.id,30000);
     const state=await p.evaluate('({zoom:qaApp.captureUrlState().viewport.z,chunks:qaApp.chunkGroups.size,id:qaApp.selectedEntityId})');
     assert.equal(state.id,e.id);assert.ok(state.zoom>=(e.map.tier==='detail'?10:7),e.id+' zoom threshold');
     found.push({id:e.id,jurisdiction:e.jurisdiction,tier:e.map.tier,...state});
    }
    const requests=()=>p.requests.filter(r=>r.url.includes('/public/geo/actual/')&&r.url.endsWith('.geojson')).map(r=>r.url);
    const before=requests();
    await p.evaluate("(()=>{qaApp.activeGeometryClasses.delete('regional');qaApp.activeGeometryClasses.delete('local_uat');qaApp.refreshGeometryVisibility();qaApp.activeGeometryClasses.add('regional');qaApp.activeGeometryClasses.add('local_uat');qaApp.refreshGeometryVisibility();})()");
    await delay(250);
    assert.deepEqual(requests(),before,'filter change refetched geometry');
    const chunkUrls=before.filter(s=>s.includes('/chunks/'));
    assert.ok(chunkUrls.length>=2,'lazy chunks not fetched');
    assert.equal(new Set(chunkUrls).size,chunkUrls.length,'duplicate lazy HTTP requests');
    evidence.lazy={start,found,chunkFetches:chunkUrls.length,duplicates:0,refetches:0};
   }finally{await p.close();}
  });
  await check(t,'no JavaScript exceptions, console errors or app fetch errors',async()=>{
   const errors=page.console.filter(x=>x.type==='error'||x.level==='error');
   const failures=page.failures.filter(x=>!x.canceled&&!/tile\.openstreetmap\.org/.test(x.url||''));
   evidence.console={exceptions:page.errors.length,errors:errors.length,failures:failures.length};
   assert.equal(page.errors.length,0);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  });
 });
}finally{
 await mkdir(output,{recursive:true});
 await writeFile(path.join(output,'p42-cartography-matrix.json'),JSON.stringify(evidence,null,2)+'\n');
 await browser.close();
}
