import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
try {
 await test('WEB-R1b: independent accordions, rail and map command responsive QA',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url+'/');
  await page.openPanel('filters');
  await t.test('WEB-R1b.3.1: redundant OSM catalogs absent, reset toolbar anchored identically across panels',async()=>{
   for(const [width,height] of [[1440,900],[390,844],[844,390],[640,360]]){
    await page.viewport(width,height);
    const get=async panel=>{
     await page.openPanel(panel);
     return page.evaluate(`(()=>{
      const toolbar=document.getElementById('atlas-reset-toolbar');
      const heading=document.querySelector('#atlas-controls .atlas-panel-heading');
      const buttons=['geometries-reset','filters-reset'].map(id=>{
       const el=document.getElementById(id),rect=el.getBoundingClientRect();
       return {id,height:rect.height,width:rect.width,visible:rect.height>0,disabled:el.disabled,aria:el.getAttribute('aria-disabled')};
      });
      const tr=toolbar.getBoundingClientRect(),hr=heading.getBoundingClientRect();
      return {panel:document.querySelector('#atlas-controls').dataset.panel,
       x:tr.left,y:tr.top,headingBottom:hr.bottom,height:tr.height,
       overflow:document.documentElement.scrollWidth>innerWidth,
       removed:document.querySelectorAll('#nistrenia-osm-toggle,#nistrenia-osm-panel,#osm-roles-panel,#osm-roles-list').length,
       buttons};
     })()`);
    };
    const entities=await get('entities');
    await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-r131-reset-entities-'+width+'x'+height+'.png'));
    const filters=await get('filters');
    await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-r131-reset-filters-'+width+'x'+height+'.png'));
    assert.equal(entities.panel,'entities');assert.equal(filters.panel,'filters');
    assert.equal(entities.removed,0);assert.equal(filters.removed,0);
    assert.equal(entities.overflow,false);assert.equal(filters.overflow,false);
    assert.ok(Math.abs(entities.x-filters.x)<=1,JSON.stringify({width,height,entities,filters}));
    assert.ok(Math.abs(entities.y-filters.y)<=1,JSON.stringify({width,height,entities,filters}));
    assert.ok(entities.y>=entities.headingBottom-1&&filters.y>=filters.headingBottom-1);
    assert.equal(entities.buttons.filter(b=>b.visible).length,1);
    assert.equal(filters.buttons.filter(b=>b.visible).length,1);
    assert.equal(entities.buttons[0].visible,true);assert.equal(filters.buttons[1].visible,true);
    for(const b of [entities.buttons[0],filters.buttons[1]])assert.ok(b.width>=44&&b.height>=44,JSON.stringify({width,height,b}));
   }
   await page.viewport(1440,900);
   await page.openPanel('filters');
   await page.click('#layer-ro');
   const dirty=await page.evaluate("({ro:document.getElementById('layer-ro').checked,resetDisabled:document.getElementById('filters-reset').disabled,visible:[...qaApp.visibleEntityIds].sort()})");
   assert.equal(dirty.ro,false);assert.equal(dirty.resetDisabled,false);
   await page.click('#filters-reset');
   const clean=await page.evaluate("({ro:document.getElementById('layer-ro').checked,visible:[...qaApp.visibleEntityIds].sort()})");
   assert.equal(clean.ro,true);assert.deepEqual(clean.visible,dirty.visible,'filter reset cannot change geometry checkboxes');
   await page.openPanel('entities');
   await page.evaluate("qaApp.atlasTree.getNode('view-nistrenia')?.checkbox.click()");
   assert.equal(await page.evaluate("qaApp.visibleOperationalOutlineIds.has('view-nistrenia')"),false);
   await page.click('#geometries-reset');
   assert.equal(await page.evaluate("qaApp.visibleOperationalOutlineIds.has('view-nistrenia')"),true);
  });
  await t.test('desktop grouped rail, close X, filters do not mutate map or URL',async()=>{
   const d=await page.evaluate(`(()=>{
    const nav=[...document.querySelectorAll('#atlas-navigation-rail>button')].map(x=>x.id);
    const x=document.querySelector('#drawer-close'),r=x.getBoundingClientRect();
    return {nav,close:x.textContent.trim(),aria:x.getAttribute('aria-label'),width:r.width,height:r.height,
      section:document.querySelector('#filters-panel .atlas-panel-disclosure')?.tagName,
      token:getComputedStyle(document.documentElement).getPropertyValue('--atlas-type-body').trim()};
   })()`);
   assert.deepEqual(d.nav.slice(0,5),['mobile-navigation','mobile-search','advanced-visible','filters-toggle','navigation-more']);
   assert.equal(d.close,'×');assert.match(d.aria,/Închide/);assert.ok(d.width>=44&&d.height>=44);
   assert.equal(d.section,'DETAILS');assert.equal(d.token,'13px');
   const old=await page.evaluate('location.href');
   await page.click('#filters-panel .atlas-panel-disclosure>summary');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel .atlas-panel-disclosure').open"),false);
   assert.equal(await page.evaluate('location.href'),old);
   await page.click('#filters-panel .atlas-panel-disclosure>summary');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel .atlas-panel-disclosure').open"),true);
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-desktop-filters.png'));
  });
  await t.test('statistical names do not collapse into vertical letters at desktop, phone, landscape or 200% zoom',async()=>{
   try {
    for(const [width,height,zoom] of [[1440,900,'100%'],[390,844,'100%'],[844,390,'100%'],[1440,900,'200%']]){
     // CSS zoom exercises text enlargement with actual layout reflow, not an
     // artificial change to the accessibility or 44px hit-target threshold.
     await page.viewport(width,height);
     await page.evaluate('document.body.style.zoom="100%"');
     await page.openPanel('filters');
     await page.call(function(zoom){document.body.style.zoom=zoom;},zoom);
     // Zoom changes the effective responsive layout asynchronously. Use the
     // actual navigation control again after the breakpoint has settled,
     // then require measurable on-screen rows (no hidden DOM false positives).
     await page.openPanel('filters');
     await waitFor(()=>page.call(function(){
      const stat=[...document.querySelectorAll('#filters-panel details.filter-section')]
       .find(el=>el.querySelector(':scope > summary')?.textContent.trim()==='Niveluri statistice');
      if(!stat)return false;
      stat.open=true;
      const row=stat.querySelector('label.filter-row-statistical');
      return document.querySelector('#atlas-controls').dataset.panel==='filters' &&
       row?.getBoundingClientRect().width>=80;
     }),'zoom-adjusted statistical rows visible',10000);
     const rows=await page.call(function(){
      const stat=[...document.querySelectorAll('#filters-panel details.filter-section')]
       .find(el=>el.querySelector(':scope > summary')?.textContent.trim()==='Niveluri statistice');
      if(!stat)throw Error('Missing statistical filters disclosure');
      stat.open=true;
      stat.scrollIntoView({block:'nearest'});
      return [...stat.querySelectorAll('label.filter-row-statistical')].map(row=>{
       const name=row.querySelector('span'),meta=row.querySelector('small'),
        nr=name.getBoundingClientRect(),mr=meta.getBoundingClientRect(),
        rr=row.getBoundingClientRect(),cs=getComputedStyle(name);
       return {name:name.textContent,labelWidth:nr.width,labelHeight:nr.height,
        lineHeight:parseFloat(cs.lineHeight),labelBelowCount:mr.top>=nr.bottom-1,
        rowHeight:rr.height,overflow:row.scrollWidth>row.clientWidth+1,
        inputKind:row.querySelector('input')?.dataset.kind};
      });
     });
     assert.ok(rows.length>=4,'three numbered levels plus separate-geometries control');
     for(const row of rows){
      assert.ok(row.labelWidth>=80,JSON.stringify({width,height,zoom,row}));
      assert.ok(row.labelHeight<=row.lineHeight*3*(zoom==='200%'?2:1)+2,JSON.stringify({width,height,zoom,row}));
      assert.ok(row.labelBelowCount,JSON.stringify({width,height,zoom,row}));
      assert.ok(row.rowHeight>=44,JSON.stringify({width,height,zoom,row}));
      assert.equal(row.overflow,false,JSON.stringify({width,height,zoom,row}));
     }
     await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-r1b2-filters-'+width+'x'+height+'-'+(zoom==='200%'?'200pct':'100pct')+'.png'));
    }
   } finally {
    await page.evaluate('document.body.style.zoom=""');
    await page.viewport(1440,900);
   }
  });
  await t.test('phone five primary targets, More focus, Escape and drawer close',async()=>{
   await page.viewport(390,844);await page.evaluate('qaApp.atlasPanels.close({focus:false})');
   const p=await page.evaluate(`[...document.querySelectorAll('#atlas-navigation-rail>button')]
    .filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none')
    .map(e=>({id:e.id,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))`);
   assert.deepEqual(p.map(x=>x.id),['mobile-navigation','mobile-search','advanced-visible','filters-toggle','navigation-more']);
   assert.ok(p.every(x=>x.w>=44&&x.h>=44));
   await page.click('#navigation-more');
   assert.equal(await page.evaluate('qaApp.atlasPanels.state.menu'),true);
   assert.equal(await page.evaluate('document.activeElement.id'),'identify-toggle');
   const count=await page.evaluate(`[...document.querySelectorAll('#atlas-navigation-rail>button')]
     .filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none').length`);
   assert.equal(count,11);
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-mobile-more.png'));
   await page.key('Escape');
   assert.equal(await page.evaluate('document.activeElement.id'),'navigation-more');
   await page.click('#filters-toggle');
   assert.equal(await page.evaluate("document.querySelector('#atlas-controls').dataset.panel"),'filters');
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-mobile-filters.png'));
   await page.click('#drawer-close');
  });
  await t.test('compact landscape remains touch sized and card provenance is collapsible',async()=>{
   await page.viewport(640,360);await page.evaluate('qaApp.atlasPanels.close({focus:false})');
   const p=await page.evaluate(`[...document.querySelectorAll('#atlas-navigation-rail>button')]
    .filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none')
    .map(e=>({id:e.id,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))`);
   assert.equal(p.length,5);assert.ok(p.every(x=>x.w>=44&&x.h>=44));
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-landscape-640x360.png'));
   await page.viewport(1440,900);
   await page.evaluate("qaApp.selectEntity('osm-r58974',{source:'WEB-R1b',zoom:false})");
   await waitFor(()=>page.evaluate("!document.querySelector('#details-panel').hidden"),'card');
   const d=await page.evaluate(`[...document.querySelectorAll('#details-body details.details-section')]
     .map(e=>({tag:e.tagName,summary:e.querySelector('summary')?.textContent.trim()}))`);
   assert.equal(d.length,3);assert.ok(d.every(x=>x.tag==='DETAILS'&&x.summary));
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-desktop-card.png'));
  });
  await t.test('R1b.3 panel density, controls and typography preserve responsive reachability',async()=>{
   for(const [width,height] of [[1440,900],[390,844],[844,390],[640,360]]){
    await page.viewport(width,height);
    for(const panel of ['filters','measure','share','info']){
     await page.openPanel(panel);
     const data=await page.call(function(){
      const host=document.querySelector('#atlas-controls');
      const heading=host.querySelector('.atlas-panel-heading');
      const headings=Array.from(host.querySelectorAll('details.atlas-panel-disclosure > summary'))
        .filter(e=>e.checkVisibility() && e.getBoundingClientRect().height>0)
        .map(e=>({height:e.getBoundingClientRect().height,background:getComputedStyle(e).backgroundColor}));
      const actions=[...host.querySelectorAll('.action-button,.filter-actions button')]
       .filter(e=>!e.disabled&&e.checkVisibility()&&e.getBoundingClientRect().height)
       .map(e=>({id:e.id||e.textContent.trim(),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));
      const form=host.querySelector('#measure-form');
      return {headingHeight:heading.getBoundingClientRect().height,
       hostWidth:host.clientWidth,scrollWidth:host.scrollWidth,
       titleSize:getComputedStyle(heading.querySelector('h2')).fontSize,
       headings,actions,columns:form?getComputedStyle(form).gridTemplateColumns:null};
     });
     assert.ok(data.headingHeight>=44,JSON.stringify({width,height,panel,data}));
     assert.equal(data.titleSize,'16px');
     assert.ok(data.scrollWidth<=data.hostWidth+1,JSON.stringify({width,height,panel,data}));
     assert.ok(data.headings.every(e=>e.height>=44),JSON.stringify({width,height,panel,data}));
     assert.ok(data.actions.every(e=>e.w>=44&&e.h>=44),JSON.stringify({width,height,panel,data}));
     if(panel==='measure'){
      assert.ok(data.columns&&data.columns!=='none');
     }
     await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence',
      'web-r1b-r1b3-'+width+'x'+height+'-'+panel+'.png'));
    }
   }
   await page.viewport(1440,900);
   await page.openPanel('filters');
   const initial=await page.evaluate('location.href');
   const state=await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,visible:[...qaApp.visibleEntityIds].sort()})');
   await page.click('#filters-panel .filter-section > summary');
   await page.click('#filters-panel .filter-section > summary');
   assert.equal(await page.evaluate('location.href'),initial);
   assert.equal(await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,visible:[...qaApp.visibleEntityIds].sort()})'),state);
  });
  await t.test('no runtime errors',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
 });
}finally{await browser.close();}
