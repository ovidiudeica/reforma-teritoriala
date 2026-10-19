import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=process.env.ATLAS_QA_OUTPUT||'/tmp/atlas-browser-evidence';
const browser=await launchBrowser(root),page=await browser.page();
async function osmControls(){
 return page.call(function(){
  const section=[...document.querySelectorAll('#filter-list>details')].find(el=>el.querySelector('summary')?.textContent.trim()==='Nivel administrativ OSM');
  if(!section)throw Error('OSM administrative filter section unavailable');
  section.open=true;
  const actions=section.querySelector('.osm-level-geometry-actions');
  const buttons=actions.querySelectorAll('.osm-level-geometry-buttons>button');
  return {sectionOpen:section.open,buttonCount:buttons.length};
 });
}
async function state(){
 return page.call(function(){
  const wrapper=document.querySelector('.osm-level-geometry-actions');
  const buttons=wrapper.querySelectorAll('.osm-level-geometry-buttons>button');
  const confirm=wrapper.querySelector('.osm-level-action-confirm');
  const btns=confirm.querySelectorAll('button');
  const bounds=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};};
  return {
   source:document.activeElement===buttons[0]?'show':document.activeElement===buttons[1]?'hide':document.activeElement===buttons[2]?'undo':document.activeElement===btns[0]?'accept':document.activeElement===btns[1]?'cancel':'other',
   expanded:buttons[1].getAttribute('aria-expanded'),hidden:confirm.hidden,
   regionRole:confirm.getAttribute('role'),description:confirm.getAttribute('aria-describedby'),
   scopeId:confirm.querySelector('p')?.id,scope:confirm.querySelector('p')?.textContent,
   notice:wrapper.querySelector('[role="status"]')?.textContent,
   geometry:[...qaApp.visibleEntityIds].sort(),ni:[...qaApp.visibleOperationalOutlineIds].sort(),
   osm:[...qaApp.captureUrlState().osmAdminLevels].sort(),selection:qaApp.selectedEntityId,
   width:innerWidth,globalOverflow:document.documentElement.scrollWidth>innerWidth+2,
   panelOverflow:document.querySelector('#filters-panel').scrollWidth>document.querySelector('#filters-panel').clientWidth+2,
   confirmationOverflow:!confirm.hidden&&confirm.scrollWidth>confirm.clientWidth+2,
   accept:bounds(btns[0]),cancel:bounds(btns[1]),inert:document.querySelector('#filters-panel').inert
  };
 });
}
const clickAction=async index=>page.call(function(index){const wrap=document.querySelector('.osm-level-geometry-actions');wrap.querySelectorAll('.osm-level-geometry-buttons>button')[index].click();},index);
const clickConfirm=async index=>page.call(function(index){document.querySelectorAll('.osm-level-action-confirm button')[index].click();},index);
try{
 await test('WEB-R2c.2 real Chromium accessibility and adaptive inline OSM confirmation',{timeout:230000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.entityById.size===5848&&qaApp.osmRoleById.size===85"),'ACTUAL and NI loaded');
  for(const [width,height] of [[1440,900],[900,768],[768,1024],[430,932],[390,844],[360,800],[844,390],[390,600]]){
   await t.test('preview, Escape, cancel and touch bounds '+width+'x'+height,async()=>{
    await page.viewport(width,height);await page.openPanel('filters');await osmControls();
    const initial=await state();
    assert.equal(initial.inert,false);
    await clickAction(1);
    const preview=await state();
    assert.equal(preview.hidden,false);assert.equal(preview.source,'accept');
    assert.equal(preview.expanded,'true');
    assert.equal(preview.regionRole,'group');
    assert.equal(preview.description,preview.scopeId);
    assert.match(preview.scope,/geometrii eligibile/);
    assert.deepEqual(preview.geometry,initial.geometry);
    assert.deepEqual(preview.ni,initial.ni);
    assert.deepEqual(preview.osm,initial.osm);
    assert.ok(preview.accept.height>=44&&preview.cancel.height>=44,'44 CSS-px buttons');
    assert.equal(preview.panelOverflow,false,'panel horizontal overflow');
    assert.equal(preview.confirmationOverflow,false,'confirmation horizontal overflow');
    assert.equal(preview.globalOverflow,false,'document horizontal overflow');
    await mkdir(output,{recursive:true});await page.screenshot(path.join(output,'web-r2c2-confirm-'+width+'x'+height+'.png'));
    await page.key('Escape');
    let after=await state();
    assert.equal(after.hidden,true);assert.equal(after.source,'hide');assert.equal(after.expanded,'false');
    assert.match(after.notice,/Previzualizarea a fost închisă/);
    assert.deepEqual(after.geometry,initial.geometry);
    await clickAction(1);await clickConfirm(1);
    after=await state();assert.equal(after.hidden,true);assert.equal(after.source,'hide');
    assert.match(after.notice,/Operațiunea a fost anulată/);
    assert.deepEqual(after.geometry,initial.geometry);
   });
  }
  await t.test('valid confirm and Undo preserve NI and filters, return focus',async()=>{
   await page.viewport(1440,900);await page.openPanel('filters');await osmControls();
   await page.call(function(){
    const section=[...document.querySelectorAll('#filter-list>details')].find(x=>x.querySelector('summary')?.textContent.trim()==='Nivel administrativ OSM');
    for(const input of section.querySelectorAll('input[data-kind="osm-admin-level"]')){
     const required=input.dataset.filter==='2';
     if(input.checked!==required)input.click();
    }
   });
   const initial=await state();assert.deepEqual(initial.osm,[2]);
   await clickAction(1);let current=await state();
   assert.equal(current.source,'accept');
   assert.match(current.scope,/Vor fi debifate/);
   assert.deepEqual(current.geometry,initial.geometry);
   await clickConfirm(0);current=await state();
   assert.equal(current.source,'hide');assert.equal(current.hidden,true);
   assert.equal(current.geometry.includes('osm-r90689'),false);
   assert.equal(current.geometry.includes('osm-r58974'),false);
   assert.deepEqual(current.ni,initial.ni);
   assert.deepEqual(current.osm,initial.osm);
   assert.equal(current.selection,initial.selection);
   await clickAction(2);current=await state();
   assert.equal(current.source,'undo');
   assert.deepEqual(current.geometry,initial.geometry);
   assert.deepEqual(current.ni,initial.ni);
   assert.deepEqual(current.osm,initial.osm);
   assert.match(current.notice,/Restabilite/);
  });
  await t.test('200% reflow and forced-colors focus indication',async()=>{
   await page.viewport(1440,900);await page.openPanel('filters');await osmControls();
   await page.evaluate("document.body.style.zoom='200%'");
   await page.openPanel('filters');await osmControls();await clickAction(1);
   const before=await state();assert.equal(before.hidden,false);
   assert.equal(before.panelOverflow,false);
   assert.equal(before.confirmationOverflow,false);
   await page.screenshot(path.join(output,'web-r2c2-200pct-confirm.png'));
   await page.send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
   await page.key('Tab'); // keyboard modality makes :focus-visible unambiguous
   const contrast=await page.evaluate("({forced:matchMedia('(forced-colors:active)').matches,outline:getComputedStyle(document.activeElement).outlineWidth,style:getComputedStyle(document.activeElement).outlineStyle})");
   assert.equal(contrast.forced,true);
   assert.ok(parseFloat(contrast.outline)>=3&&contrast.style==='solid',JSON.stringify(contrast));
   await page.screenshot(path.join(output,'web-r2c2-forced-colors.png'));
   await page.send('Emulation.setEmulatedMedia',{features:[]});
   await page.key('Escape');
   await page.evaluate("document.body.style.zoom=''");
  });
  assert.equal(page.errors.length,0,'no Chrome runtime exception');
 });
}finally{await page.close();await browser.close();}
