import test from 'node:test';
import assert from 'node:assert/strict';
import {sharePayload,shareEmail,createAtlasShare} from '../../atlas-share.mjs';

test('view URL preserves the entire canonical contract without changing the input',()=>{
 const current='https://example.test/atlas/?v=1&e=ro&z=9&lat=44&lon=26&osm=0&gc=county';
 assert.equal(sharePayload(current).url,current);
 assert.equal(current,'https://example.test/atlas/?v=1&e=ro&z=9&lat=44&lon=26&osm=0&gc=county');
});
test('entity link resets only its own copy and encodes identifier as data',()=>{
 const entity={id:'entity/&?#',display_name:'Test'},before=JSON.stringify(entity);
 const data=sharePayload('https://example.test/atlas/?v=1&z=12&osm=0#old',entity),url=new URL(data.url);
 assert.deepEqual([...url.searchParams],[['v','1'],['e',entity.id]]);assert.equal(url.hash,'');assert.equal(url.pathname,'/atlas/');assert.equal(JSON.stringify(entity),before);
});
test('unsafe URL schemes are rejected and email encodes text as a query value',()=>{
 for(const url of ['javascript:alert(1)','file:///tmp/a','data:text/html,test'])assert.throws(()=>sharePayload(url),TypeError);
 const payload={title:'A & B',text:'Atlas',url:'https://example.test/?e=a&z=4'};
 const email=new URL(shareEmail(payload));assert.equal(email.protocol,'mailto:');assert.equal(email.searchParams.get('subject'),payload.title);assert.equal(email.searchParams.get('body'),'Atlas\r\n'+payload.url);assert.equal(email.href.includes('+'),false);assert.ok(email.href.includes('%0D%0A'));const special=new URL(shareEmail({...payload,title:'Atlas A + B\r\nNext'}));assert.equal(special.searchParams.get('subject'),'Atlas A + B Next');assert.ok(special.href.includes('%2B'));assert.deepEqual([...special.searchParams.keys()],['subject','body']);
});
function harness(){
 const elements=new Map();const document={getElementById(id){if(!elements.has(id))elements.set(id,{listeners:{},checked:id==='share-view',addEventListener(type,fn){this.listeners[type]=fn;},focus(){document.activeElement=this;},select(){this.selected=true;}});return elements.get(id);}};
 let url='https://example.test/atlas/?v=1&z=6',entity=null,navigator={};
 const controller=createAtlasShare({document,getCurrentUrl:()=>url,getSelectedEntity:()=>entity,getNavigator:()=>navigator});
 return {document,el:id=>document.getElementById(id),controller,setUrl(value){url=value;},setEntity(value){entity=value;},setNavigator(value){navigator=value;}};
}
test('copy captures live view and falls back to a selectable manual URL',async()=>{
 const h=harness();let copied;h.setNavigator({clipboard:{writeText:async value=>{copied=value;}}});h.setUrl('https://example.test/atlas/?v=1&z=9');await h.el('copy-link').listeners.click();assert.equal(copied,'https://example.test/atlas/?v=1&z=9');assert.equal(h.el('share-status').textContent,'Link copiat.');
 h.setNavigator({});await h.el('copy-link').listeners.click();assert.equal(h.document.activeElement,h.el('share-url'));assert.equal(h.el('share-url').selected,true);
});
test('entity availability and clearing selection restore predictable view sharing',()=>{
 const h=harness();assert.equal(h.el('share-entity').disabled,true);h.setEntity({id:'ro',display_name:'România'});h.controller.refresh();assert.equal(h.el('share-entity').disabled,false);h.el('share-entity').checked=true;h.el('share-view').checked=false;h.controller.refresh();assert.equal(new URL(h.el('share-url').value).searchParams.get('e'),'ro');h.setEntity(null);h.controller.refresh();assert.equal(h.el('share-view').checked,true);assert.equal(h.el('share-entity').checked,false);
});
test('pending clipboard failure cannot steal focus after the panel closes',async()=>{
 const h=harness();let reject;h.setNavigator({clipboard:{writeText:()=>new Promise((_,fail)=>{reject=fail;})}});const pending=h.el('copy-link').listeners.click();const origin={id:'share-toggle'};h.el('share-panel').hidden=true;h.document.activeElement=origin;reject(new Error('Denied'));await pending;assert.equal(h.document.activeElement,origin);
});
test('pending clipboard result does not replace the feedback for a newly chosen URL',async()=>{
 const h=harness();let reject;h.setNavigator({clipboard:{writeText:()=>new Promise((_,fail)=>{reject=fail;})}});const pending=h.el('copy-link').listeners.click();h.setUrl('https://example.test/atlas/?v=1&z=12');h.controller.refresh();reject(new Error('Denied'));await pending;assert.equal(h.el('share-url').value,'https://example.test/atlas/?v=1&z=12');assert.equal(h.el('share-status').textContent,'');assert.notEqual(h.document.activeElement,h.el('share-url'));
});
test('native share is called in the click turn, detects support and distinguishes cancellation',async()=>{
 const h=harness();assert.equal(h.el('share-native').hidden,true);let called=false;
 h.setNavigator({canShare:()=>true,share:data=>{called=true;assert.ok(data.url);return Promise.resolve();}});h.controller.refresh();assert.equal(h.el('share-native').hidden,false);
 const pending=h.el('share-native').listeners.click();assert.equal(called,true);await pending;assert.equal(h.el('share-status').textContent,'Distribuire finalizată.');
 h.setNavigator({share:()=>Promise.reject(Object.assign(new Error(),{name:'AbortError'}))});await h.el('share-native').listeners.click();assert.equal(h.el('share-status').textContent,'Distribuire anulată.');
 h.setNavigator({share:()=>Promise.reject(new Error())});await h.el('share-native').listeners.click();assert.match(h.el('share-status').textContent,/indisponibilă/);
});
