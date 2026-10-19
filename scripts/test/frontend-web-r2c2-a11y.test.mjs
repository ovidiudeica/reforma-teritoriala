import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAtlasFilters} from '../../atlas-filters.mjs';
import {allOsmLevelFilters} from '../../atlas-osm-admin-filter.mjs';

class MockElement{
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.checked=false;this.hidden=false;this.disabled=false;this._text='';}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
 set innerHTML(value){this._text='';this.children=[];}
 appendChild(child){this.children.push(child);return child;}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 addEventListener(name,handler){(this.listeners[name]??=[]).push(handler);}
 focus(){this.doc.activeElement=this;}
 click(){for(const f of this.listeners.click||[])f({type:'click',target:this});}
 key(name){let prevented=false,stopped=false;for(const f of this.listeners.keydown||[])f({key:name,preventDefault:()=>{prevented=true;},stopPropagation:()=>{stopped=true;}});return {prevented,stopped};}
 descendants(){return this.children.flatMap(x=>[x,...x.descendants()]);}
}

const setup=()=>{
 const doc={activeElement:null,createElement(tag){return new MockElement(tag,this);}};
 const container=doc.createElement('div');
 const zero={roles:0,reused:0,separate:0,jurisdictions:{RO:{roles:0,reused:0,separate:0},MD:{roles:0,reused:0,separate:0}}};
 const index={groups:[],statisticalCounts:new Map(),statisticalLevelStats:new Map([1,2,3].map(x=>[x,zero])),statisticalRoles:0,reusedStatistical:0,statisticalOnly:0};
 const state={geometryClasses:new Set(['regional']),geometrySubtypes:new Set(),statisticalLevels:new Set([1,2,3]),osmAdminLevels:new Set([2]),separateStatisticalGeometry:true};
 const counters={applied:0,undone:0,plans:0};
 const plan={changed:2,levels:[2],eligible:{RO:2,MD:1,NI:0},counts:{RO:1,MD:1,NI:0},skippedAliases:85,hasUnknown:false,changes:[{id:'osm-r90689',to:false},{id:'osm-r58974',to:false}]};
 const ui=createAtlasFilters({container,document:doc,index,state,onChange:()=>{throw Error('OSM geometry action cannot change filters');},
  onOsmGeometryPreview:()=>{counters.plans++;return plan;},
  onOsmGeometryApply:()=>{counters.applied++;return {message:'Au fost modificate 2 bife geometrice.'};},
  onOsmGeometryUndo:()=>{counters.undone++;return {message:'Restabilite 2 bife; 0 modificări ulterioare păstrate.'};},
  canUndoOsmGeometry:()=>counters.undone===0&&counters.applied>0});
 return {doc,state,ui,plan,counters};
};
test('WEB-R2c.2: preview is an inline named group; accept is focused with explicit description',()=>{
 const {doc,state,ui,counters}=setup(),g=ui.geometryActions;
 g.hideButton.focus();g.hideButton.click();
 assert.equal(g.confirmation.hidden,false);
 assert.equal(g.confirmation.getAttribute('role'),'group');
 assert.equal(g.confirmation.getAttribute('aria-describedby'),g.scope.id);
 assert.equal(g.hideButton.getAttribute('aria-controls'),g.confirmation.id);
 assert.equal(g.hideButton.getAttribute('aria-expanded'),'true');
 assert.equal(g.showButton.getAttribute('aria-expanded'),'false');
 assert.equal(doc.activeElement,g.accept);
 assert.match(g.scope.textContent,/2 dintre 3 geometrii eligibile/);
 assert.equal(counters.applied,0);
 assert.deepEqual([...state.geometryClasses],['regional']);
});

test('WEB-R2c.2: cancel/Escape return focus to initiating control without geometry mutation',()=>{
 const {doc,ui,counters}=setup(),g=ui.geometryActions;
 g.hideButton.click();g.cancel.click();
 assert.equal(g.confirmation.hidden,true);
 assert.equal(g.hideButton.getAttribute('aria-expanded'),'false');
 assert.equal(doc.activeElement,g.hideButton);
 assert.match(g.actionStatus.textContent,/Operațiunea a fost anulată/);
 g.showButton.click();
 const event=g.confirmation.key('Escape');
 assert.deepEqual(event,{prevented:true,stopped:true});
 assert.equal(g.confirmation.hidden,true);
 assert.equal(doc.activeElement,g.showButton);
 assert.match(g.actionStatus.textContent,/Previzualizarea a fost închisă/);
 assert.deepEqual(g.confirmation.key('Enter'),{prevented:false,stopped:false});
 assert.equal(counters.applied,0);
});

test('WEB-R2c.2: stale and valid confirmations restore focus without changing F/S/URL logic',()=>{
 const {doc,state,ui,counters}=setup(),g=ui.geometryActions;
 const stats=[...state.statisticalLevels];
 g.hideButton.click();state.osmAdminLevels.add(8);g.accept.click();
 assert.equal(doc.activeElement,g.hideButton);
 assert.match(g.actionStatus.textContent,/Selecția nivelurilor s-a schimbat/);
 assert.equal(counters.applied,0);
 state.osmAdminLevels.delete(8);
 g.hideButton.click();g.accept.click();
 assert.equal(doc.activeElement,g.hideButton);
 assert.equal(g.confirmation.hidden,true);
 assert.equal(g.hideButton.getAttribute('aria-expanded'),'false');
 assert.equal(counters.applied,1);
 assert.equal(g.actionStatus.textContent,'Au fost modificate 2 bife geometrice.');
 assert.deepEqual([...state.statisticalLevels],stats);
 g.undoButton.click();
 assert.equal(doc.activeElement,g.showButton,'Undo disabled: focus moves to a stable enabled action');
 assert.equal(counters.undone,1);
 assert.match(g.actionStatus.textContent,/Restabilite 2 bife/);
});
test('WEB-R2c.2: responsive/forced-colors source protects 44px targets and status role',async()=>{
 const [css,code]=await Promise.all(['atlas-panel-content.css','atlas-filters.mjs'].map(x=>readFile(x,'utf8')));
 assert.match(css,/flex-wrap:wrap/);
 assert.match(css,/flex:1 1 150px/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(code,/actionStatus\.setAttribute\('role','status'\)/);
 assert.match(code,/confirmation\.addEventListener\('keydown'/);
 assert.match(code,/accept\.focus\?\.\(\)/);
});
