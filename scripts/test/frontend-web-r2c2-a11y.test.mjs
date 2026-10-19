import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAtlasFilters} from '../../atlas-filters.mjs';

class Node{
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.listeners={};this.attributes={};this.dataset={};this._text='';this.checked=false;}
 set textContent(t){this._text=String(t);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
 set innerHTML(x){this.children=[];this._text='';}appendChild(x){this.children.push(x);return x;}
 setAttribute(n,v){this.attributes[n]=String(v);}getAttribute(n){return this.attributes[n]??null;}
 addEventListener(n,cb){(this.listeners[n]??=[]).push(cb);}
 focus(){this.doc.activeElement=this;}
 click(){for(const fn of this.listeners.click??[])fn({target:this});}
 key(k){const evt={key:k,prevented:false,preventDefault(){this.prevented=true;}};for(const fn of this.listeners.keydown??[])fn(evt);return evt;}
 descendants(){return this.children.flatMap(n=>[n,...n.descendants()]);}
}
function setup(){
 const doc={activeElement:null,createElement(tag){return new Node(tag,doc);}},container=new Node('div',doc);
 const statistics={roles:0,reused:0,separate:0,jurisdictions:{RO:{roles:0,reused:0,separate:0},MD:{roles:0,reused:0,separate:0}}};
 const index={groups:[],statisticalCounts:new Map(),statisticalLevelStats:new Map([1,2,3].map(x=>[x,statistics])),statisticalRoles:0,reusedStatistical:0,statisticalOnly:0};
 const state={geometryClasses:new Set(),geometrySubtypes:new Set(),statisticalLevels:new Set([1,2,3]),osmAdminLevels:new Set([8]),separateStatisticalGeometry:true};
 let applications=0,undos=0,stale=false;
 const filters=createAtlasFilters({document:doc,container,index,state,onChange:()=>{},onOsmGeometryPreview:()=>stale?null:{
 levels:[8],eligible:{RO:3,MD:0,NI:0},counts:{RO:2,MD:0,NI:0},changed:2,skippedAliases:85,hasUnknown:false,changes:[{kind:'actual',id:'x',was:false,after:true},{kind:'actual',id:'y',was:false,after:true}]
 },onOsmGeometryApply:()=>{applications++;return {message:'Au fost modificate 2 bife geometrice.'};},onOsmGeometryUndo:()=>{undos++;return {message:'Restabilite 2 bife.'};},canUndoOsmGeometry:()=>applications>undos});
 return {doc,container,state,filters,get applications(){return applications},set stale(v){stale=v}};
}
test('WEB-R2c.2: preview is a labelled inline group with focus and predictable return',()=>{
 const a=setup(),g=a.filters.geometryActions;
 g.showButton.click();
 assert.equal(g.confirmation.hidden,false);assert.equal(a.doc.activeElement,g.scope);
 assert.equal(g.showButton.getAttribute('aria-expanded'),'true');
 assert.equal(g.showButton.getAttribute('aria-controls'),'osm-level-action-confirmation');
 assert.equal(g.confirmation.getAttribute('aria-describedby'),'osm-geometry-confirmation-scope');
 assert.equal(g.actionStatus.getAttribute('aria-atomic'),'true');
 const event=g.confirmation.key('Escape');assert.equal(event.prevented,true);
 assert.equal(g.confirmation.hidden,true);assert.equal(a.doc.activeElement,g.showButton);assert.equal(a.applications,0);
 assert.match(g.actionStatus.textContent,/anulată/);
 g.hideButton.click();assert.equal(a.doc.activeElement,g.scope);
 g.cancel.click();assert.equal(a.doc.activeElement,g.hideButton);
 g.showButton.click();g.accept.click();assert.equal(a.applications,1);
 assert.equal(g.confirmation.hidden,true);assert.equal(a.doc.activeElement,g.showButton);
 assert.match(g.actionStatus.textContent,/2 bife/);
});
test('WEB-R2c.2: stale scope fails closed and focus returns, without geometry mutation',()=>{
 const a=setup(),g=a.filters.geometryActions;
 g.showButton.click();a.state.osmAdminLevels.add(9);g.accept.click();
 assert.equal(a.applications,0);assert.equal(a.doc.activeElement,g.showButton);
 assert.match(g.actionStatus.textContent,/Selecția nivelurilor/);
 a.state.osmAdminLevels.delete(9);
 g.showButton.click();a.stale=true;g.accept.click();
 assert.equal(a.applications,0);assert.equal(a.doc.activeElement,g.showButton);
 assert.match(g.actionStatus.textContent,/Bifele s-au schimbat/);
});
test('WEB-R2c.2: responsive keyboard and forced-colors contract preserved',async()=>{
 const [css,filters,url,actions]=await Promise.all(['atlas-panel-content.css','atlas-filters.mjs','atlas-url-state.mjs','atlas-osm-level-geometry-actions.mjs'].map(x=>readFile(x,'utf8')));
 assert.match(css,/@media\(max-width:480px\)/);
 assert.match(css,/forced-colors:active/);
 assert.match(css,/#osm-geometry-confirmation-scope:focus/);
 assert.match(filters,/event.key==='Escape'/);
 assert.match(filters,/focusInitiator/);
 assert.match(url,/params\.set\('a'/);
 assert.match(actions,/Never overwrite later manual edits/);
});
