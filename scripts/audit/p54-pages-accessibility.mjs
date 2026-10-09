import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P5.4 live Pages focus, accessibility and mobile keyboard smoke',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate('https://ovidiudeica.github.io/reforma-teritoriala/');
  await t.test('public accessibility tree exposes navigation, filters, basemap and map',async()=>{
   const ax=await page.send('Accessibility.getFullAXTree');
   const names=ax.nodes.filter(n=>!n.ignored).map(n=>n.name?.value).filter(Boolean);
   for(const name of ['Entități','Rezultate','Hartă teritorială România și Republica Moldova']){
    assert.ok(names.includes(name),'AX tree missing '+name);
   }
   assert.ok(names.some(n=>String(n).startsWith('Fundal OpenStreetMap activ')),'OSM basemap accessible label');
  });
  await t.test('filters focus entry and Escape recovery',async()=>{
   await page.click('#filters-toggle');
   assert.equal(await page.evaluate("document.activeElement.id"),'filters-close');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').inert"),false);
   await page.key('Escape');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').hidden"),true);
   assert.equal(await page.evaluate("document.activeElement.id"),'filters-toggle');
  });
  await t.test('search tab keyboard and Escape do not change geometric checkboxes',async()=>{
   const initial=await page.evaluate("[...qaApp.visibleEntityIds].sort()");
   await page.query('Cluj');
   assert.equal(await page.evaluate("document.querySelector('#tab-results').getAttribute('aria-selected')"),'true');
   await page.key('Escape');
   assert.equal(await page.evaluate("document.querySelector('#tab-entities').getAttribute('aria-selected')"),'true');
   await page.evaluate("document.querySelector('#tab-entities').focus()");
   await page.key('ArrowRight');
   assert.equal(await page.evaluate("document.activeElement.id"),'tab-results');
   await page.key('ArrowLeft');
   assert.equal(await page.evaluate("document.activeElement.id"),'tab-entities');
   assert.deepEqual(await page.evaluate("[...qaApp.visibleEntityIds].sort()"),initial);
  });
  await t.test('mobile nested drawer Escape restores focus and map',async()=>{
   await page.viewport(390,844);
   await page.click('#mobile-navigation');
   await page.click('#filters-toggle');
   await page.key('Escape');
   assert.equal(await page.evaluate("qaApp.atlasMobile.state.drawer"),true);
   await page.key('Escape');
   await waitFor(()=>page.evaluate("qaApp.atlasMobile.state.drawer===false"),'drawer Escape');
   assert.equal(await page.evaluate("document.activeElement.id"),'mobile-navigation');
   assert.ok(await page.evaluate("document.querySelector('#map').getBoundingClientRect().width>300"));
  });
  await t.test('live application has no JS console failures or own 404s',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(c=>c.type==='error'||c.level==='error'),[]);
   assert.deepEqual(page.responses.filter(r=>{const uri=new URL(r.url);return r.status>=400&&uri.hostname==='ovidiudeica.github.io'&&uri.pathname.startsWith('/reforma-teritoriala/');}),[]);
  });
 });
}finally{await browser.close();}
