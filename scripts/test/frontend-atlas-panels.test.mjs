import test from 'node:test';import assert from 'node:assert/strict';
import {createAtlasPanels,panelDefinitions} from '../../atlas-panels.mjs';
function fixture(mobile=false){
 const nodes=new Map(),keys=[],media={matches:mobile,addEventListener(_,fn){keys.push(fn)}},events={};let searching=false;
 const document={activeElement:null,addEventListener(name,fn){(events[name]??=[]).push(fn)},getElementById(id){
  if(!nodes.has(id))nodes.set(id,{id,hidden:false,inert:false,dataset:{},attributes:{},listeners:{},classList:{toggle(){}},setAttribute(k,v){this.attributes[k]=String(v)},addEventListener(k,fn){this.listeners[k]=fn},focus(){document.activeElement=this},contains(node){return node===this}});
  return nodes.get(id);
 }};
 const panels=createAtlasPanels({document,media,isSearchOpen:()=>searching});
 return {panels,document,el:id=>document.getElementById(id),search(value){searching=value},breakpoint(matches){media.matches=matches;for(const fn of keys)fn({matches})},escape(){const e={key:'Escape',defaultPrevented:false,preventDefault(){this.defaultPrevented=true}};for(const fn of events.keydown)e.defaultPrevented||fn(e);return e}};
}
test('all routes activate one content container and preserve content/input state',()=>{
 const h=fixture(),input=h.el('entity-search'),filter=h.el('filters-panel');input.value='Iași';filter.checked=false;
 for(const key of Object.keys(panelDefinitions)){
  h.panels.open(key);assert.equal(h.panels.state.active,key);const current=panelDefinitions[key].content;
  const content=[...new Set(Object.values(panelDefinitions).map(x=>x.content))];
  assert.equal(content.filter(id=>!h.el(id).hidden).length,1);
  assert.ok(content.filter(id=>id!==current).every(id=>h.el(id).inert));
 }
 h.panels.open('entities');assert.equal(input,h.el('entity-search'));assert.equal(input.value,'Iași');assert.equal(filter.checked,false);
});
test('close releases the panel and returns focus to its navigation origin',()=>{
 const h=fixture(true);assert.equal(h.panels.state.active,null);assert.equal(h.el('atlas-controls').inert,true);
 h.panels.open('filters');assert.equal(h.document.activeElement.id,'drawer-close');assert.equal(h.panels.state.drawer,true);
 h.panels.close();assert.equal(h.panels.state.drawer,false);assert.equal(h.document.activeElement.id,'filters-toggle');assert.equal(h.el('atlas-controls').hidden,true);
});
test('Escape gives search results their first dismissal before closing navigation',()=>{
 const h=fixture(true);h.panels.open('search');assert.equal(h.document.activeElement.id,'entity-search');
 h.search(true);assert.equal(h.escape().defaultPrevented,false);assert.equal(h.panels.state.active,'search');
 h.search(false);assert.equal(h.escape().defaultPrevented,true);assert.equal(h.panels.state.active,null);assert.equal(h.document.activeElement.id,'mobile-search');
});
test('responsive transitions remember the last route while mobile starts with a free map',()=>{
 const h=fixture();h.panels.open('recent');h.breakpoint(true);assert.equal(h.panels.state.active,null);assert.equal(h.el('atlas-controls').inert,true);
 h.breakpoint(false);assert.equal(h.panels.state.active,'recent');assert.equal(h.el('atlas-controls').inert,false);
});
test('unknown and inherited keys fail closed and state snapshots cannot mutate the manager',()=>{
 const h=fixture();for(const key of ['missing','constructor','__proto__'])h.panels.open(key);
 assert.equal(h.panels.state.active,'entities');const state=h.panels.state;state.active='info';assert.equal(h.panels.state.active,'entities');
});
