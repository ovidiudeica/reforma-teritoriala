import test from 'node:test';
import assert from 'node:assert/strict';
import {reducePreview,previewSize,createAtlasPreview} from '../../atlas-preview.mjs';
import {createAtlasLayout} from '../../atlas-layout.mjs';
test('preview auto is reversible and rotation never changes automatic sizing',()=>{
 const auto={mode:'auto',orientation:'portrait'};
 assert.equal(previewSize(auto),null);assert.equal(reducePreview(auto,{type:'rotate'}),auto);
 const phone=reducePreview(auto,{type:'mode',mode:'phone'});assert.deepEqual(previewSize(phone),{width:390,height:844});
 assert.deepEqual(previewSize(reducePreview(phone,{type:'rotate'})),{width:844,height:390});
 assert.equal(previewSize(reducePreview(phone,{type:'mode',mode:'auto'})),null);
 assert.equal(reducePreview(phone,{type:'mode',mode:'unknown'}),phone);
});
test('each device starts in its natural orientation and rotation preserves the selected mode',()=>{
 for(const [mode,width,height] of [['desktop',1440,900],['tablet',768,1024],['phone',390,844]]){
  const state=reducePreview({mode:'auto'},{type:'mode',mode});assert.deepEqual(previewSize(state),{width,height});
  const rotated=reducePreview(state,{type:'rotate'});assert.equal(rotated.mode,mode);assert.deepEqual(previewSize(rotated),{width:height,height:width});
  assert.deepEqual(reducePreview(rotated,{type:'rotate'}),state);
 }
});
test('layout changes notify map preservation before responsive consumers and expose defensive dimensions',()=>{
 const props=new Map(),viewport={clientWidth:1440,clientHeight:836,style:{setProperty:(k,v)=>props.set(k,v)}},stage={scrollLeft:100,scrollTop:80};
 let resize,disconnected=false;
 const browser={innerWidth:390,innerHeight:844,ResizeObserver:class{constructor(fn){resize=fn;}observe(){}disconnect(){disconnected=true;}}};
 const document={getElementById:id=>id==='atlas-viewport'?viewport:stage};
 const layout=createAtlasLayout({document,browser}),events=[];
 layout.onResize(()=>events.push('map'));layout.media.addEventListener('change',e=>events.push('responsive-'+e.matches));
 viewport.clientWidth=390;viewport.clientHeight=844;resize();
 assert.deepEqual(events,['map','responsive-true']);assert.equal(layout.media.matches,true);
 const copy=layout.size;copy.width=0;assert.equal(layout.size.width,390);
 assert.equal(props.get('--atlas-modal-width'),'390px');layout.setSize(null);
 assert.equal(viewport.style.width,'');assert.equal(viewport.style.height,'');assert.equal(stage.scrollLeft,0);assert.equal(stage.scrollTop,0);
 layout.destroy();assert.equal(disconnected,true);
});
test('existing DOM test doubles retain the physical media fallback without browser layout APIs',()=>{
 const media={matches:true},document={getElementById:()=>null};
 const layout=createAtlasLayout({document,browser:{matchMedia:()=>media}});
 assert.equal(layout.media,media);assert.equal(layout.size,null);
 assert.equal(createAtlasPreview({document,layout}).state.mode,'auto');
});
