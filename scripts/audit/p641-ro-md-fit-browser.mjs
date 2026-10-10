import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';
import {roMdBounds} from '../../atlas-ro-md-fit.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
const points=()=>page.evaluate("(()=>{const map=qaApp.map,bboxes=['osm-r58974','osm-r90689'].map(id=>qaApp.entityById.get(id).map.bbox),west=Math.min(...bboxes.map(b=>b[0])),east=Math.max(...bboxes.map(b=>b[2])),south=Math.min(...bboxes.map(b=>b[1])),north=Math.max(...bboxes.map(b=>b[3])),nw=map.latLngToContainerPoint([north,west]),se=map.latLngToContainerPoint([south,east]),size=map.getSize(),zoom=document.querySelector('.leaflet-control-zoom'),home=document.getElementById('map-home'),r=home.getBoundingClientRect(),z=zoom.getBoundingClientRect();return {west,east,south,north,nw:{x:nw.x,y:nw.y},se:{x:se.x,y:se.y},width:size.x,height:size.y,center:map.getCenter(),z:map.getZoom(),icon:{parent:home.parentElement===zoom,width:r.width,height:r.height,zoomWidth:z.width,zoomHeight:z.height,name:home.getAttribute('aria-label'),svg:!!home.querySelector('svg'),children:[...zoom.children].map(e=>e.id||e.className)},selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort(),osm:document.getElementById('basemap-toggle').getAttribute('aria-pressed')}})()");
const fits=(state,label)=>{
 assert.ok(state.nw.x>=10 && state.se.x<=state.width-10,label+' horizontal roots '+JSON.stringify(state));
 assert.ok(state.nw.y>=24 && state.se.y<=state.height-24,label+' vertical roots '+JSON.stringify(state));
 assert.ok(state.icon.parent&&state.icon.svg,label+' icon integrated into zoom bar');
 assert.ok(state.icon.width>=44&&state.icon.height>=44,label+' accessible icon target');
 assert.deepEqual(state.icon.children,['leaflet-control-zoom-in','leaflet-control-zoom-out','map-home','basemap-toggle'],label+' zoom order');
 assert.deepEqual(state.checked,['osm-r58974','osm-r90689'].sort());
};
try{
 await test('P6.4.1 country bbox-fit and integrated Leaflet zoom icon, desktop/mobile portrait/landscape',{timeout:210000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url+'/');
  await waitFor(()=>page.evaluate('qaApp.entityById.size===5848 && document.querySelectorAll(".leaflet-overlay-pane path").length>=2'),'roots loaded');
  await t.test('pure root bbox union validates metadata and rejects corrupt extents',()=>{
    const data=new Map([['osm-r58974',{map:{bbox:[20,43,30,48]}}],['osm-r90689',{map:{bbox:[27,45,31,49]}}]]);
    assert.deepEqual(roMdBounds(data),[[43,20],[49,31]]);
    assert.throws(()=>roMdBounds(new Map([['osm-r58974',data.get('osm-r58974')]])),/indisponibile/);
  });
  await t.test('initial load adapts to both complete country extents across 8 viewport shapes',async()=>{
    for(const [w,h] of [[390,844],[360,640],[430,932],[844,390],[768,1024],[899,768],[900,768],[1440,900]]){
      await page.viewport(w,h);await page.navigate(browser.server.url+'/');
      await waitFor(()=>page.evaluate('qaApp.entityById.size===5848 && document.querySelectorAll(".leaflet-overlay-pane path").length>=2'),'roots '+w+'x'+h);
      const state=await points();fits(state,w+'x'+h);
      assert.equal(state.selected,null);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false,'overflow '+w+'x'+h);
      console.log('P641 root viewport',w+'x'+h,JSON.stringify({zoom:state.z,nw:state.nw,se:state.se,size:[state.width,state.height]}));
    }
  });
  await t.test('recenter after panning, zooming and hiding OSM fits RO+MD without touching checked state',async()=>{
    await page.viewport(390,844);await page.navigate(browser.server.url+'/');
    await page.evaluate("(()=>{qaApp.map.setView([40,38],8,{animate:false});return true;})()");
    await page.click('#basemap-toggle');
    const before=await page.evaluate("({visible:[...qaApp.visibleEntityIds].sort(),selected:qaApp.selectedEntityId,osm:document.querySelector('#basemap-toggle').getAttribute('aria-pressed')})");
    await page.click('#map-home');
    const state=await points();fits(state,'mobile click');assert.equal(state.osm,'false');
    const after=await page.evaluate("({visible:[...qaApp.visibleEntityIds].sort(),selected:qaApp.selectedEntityId,osm:document.querySelector('#basemap-toggle').getAttribute('aria-pressed')})");
    assert.deepEqual(after,before);
    assert.equal(await page.evaluate('document.activeElement.id'),'map-home');
  });
  await t.test('valid explicit viewport URL is preserved on initial load and fit click is undoable via Back',async()=>{
    await page.viewport(844,390);
    await page.navigate(browser.server.url+'/?v=1&lat=46&lon=27&z=8');
    const before=await points();assert.equal(before.z,8);
    assert.ok(Math.abs(before.center.lat-46)<.01&&Math.abs(before.center.lng-27)<.01);
    await page.click('#map-home');const fit=await points();fits(fit,'landscape click');
    assert.notEqual(fit.z,before.z);
    await page.evaluate('history.back()');
    await waitFor(()=>page.evaluate('qaApp.map.getZoom()===8'),'Back original zoom');
    const restored=await points();assert.ok(Math.abs(restored.center.lat-46)<.01);
  });
  await t.test('selected entity remains selected and unchecked geometry is not activated by recenter',async()=>{
    const id=await page.evaluate("[...qaApp.entityById.values()].find(e=>e.jurisdiction==='RO'&&!qaApp.visibleEntityIds.has(e.id)&&e.map?.bbox).id");
    await page.evaluate('qaApp.selectEntity('+JSON.stringify(id)+",{source:'map',zoom:false})");
    const before=await page.evaluate("({selected:qaApp.selectedEntityId,visible:[...qaApp.visibleEntityIds].sort()})");
    const hit=await page.evaluate("(()=>{const e=document.getElementById('map-home'),r=e.getBoundingClientRect(),target=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {unobscured:e===target||e.contains(target),target:target?.id||target?.className||target?.tagName,center:[r.left+r.width/2,r.top+r.height/2],panel:(()=>{const d=document.getElementById('details-panel').getBoundingClientRect();return {top:d.top,bottom:d.bottom}})()}})()");
    console.log('P641 selected icon hit test',JSON.stringify(hit));
    assert.ok(hit.unobscured,'fit icon must not be covered by landscape detail sheet: '+JSON.stringify(hit));
    await page.click('#map-home');fits(await points(),'selected fit');
    const after=await page.evaluate("({selected:qaApp.selectedEntityId,visible:[...qaApp.visibleEntityIds].sort()})");
    assert.deepEqual(after,before);
  });
  await t.test('no application exceptions, console errors or own resource failures',()=>{
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
    assert.deepEqual(page.responses.filter(x=>x.status>=400&&x.url.startsWith(browser.server.url)),[]);
  });
 });
}finally{await browser.close();}
