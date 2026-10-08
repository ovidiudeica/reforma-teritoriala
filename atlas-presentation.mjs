import {geometryClass,geometryLabels} from './geometry-taxonomy.mjs';
// Presentation binding verified against the immutable GitHub release. Never applied to a different snapshot.
export const publishedActualRelease=Object.freeze({tag:'actual-v1.2.0',snapshot:'actual-a9e5a4ddcb5277ef',fingerprint:'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446',url:'https://github.com/ovidiudeica/reforma-teritoriala/releases/tag/actual-v1.2.0',published:'2026-10-07T17:52:36Z'});
export const geometryStyleConfig=Object.freeze(Object.fromEntries(Object.entries({
 regional:{color:'#203f59',weight:1.8,fillColor:'#5d7b8c'},local_uat:{color:'#365e55',weight:1.1,fillColor:'#6d9184'},
 sector:{color:'#806b50',weight:1.4,fillColor:'#b59b77'},component_locality:{color:'#806b50',weight:.8,fillColor:'#b59b77',dashArray:'1 3'},
 context:{color:'#203f59',weight:2,fillColor:'#5d7b8c'},auxiliary:{color:'#65716b',weight:.8,fillColor:'#909b95',dashArray:'2 3'},
 statistical_only:{color:'#66538c',weight:1.7,fillColor:'#a294bd',dashArray:'5 4'},unclassified:{color:'#c12b72',weight:2,fillColor:'#c12b72'}
}).map(([key,value])=>[key,Object.freeze({...value,opacity:.8,fillOpacity:.035})])));
export const selectedStyle=Object.freeze({color:'#b54a38',weight:3,opacity:1,fillOpacity:.12});
export function geometryStyle(key,selected=false){return {...(geometryStyleConfig[key]||geometryStyleConfig.unclassified),...(selected?selectedStyle:{})};}
export const entityGeometryStyle=(entity,selected=false)=>geometryStyle(geometryClass(entity),selected);
export const safeSourceUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}};
const add=(document,parent,tag,text,className)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);if(className)el.className=className;parent.appendChild(el);return el;};
function rowsDom(document,parent,rows){const dl=add(document,parent,'dl',null,'kv');for(const [label,value] of rows){add(document,dl,'dt',label);add(document,dl,'dd',value??'—');}return dl;}
export function legendEntries(entities){const counts=new Map();for(const e of entities){const key=geometryClass(e);counts.set(key,(counts.get(key)||0)+1);}return ['regional','local_uat','sector','component_locality','context','auxiliary','statistical_only','unclassified'].filter(key=>counts.get(key)).map(key=>({key,label:geometryLabels[key],count:counts.get(key),style:geometryStyle(key)})).concat({key:'selected',label:'Entitate selectată',style:geometryStyle('regional',true)});}
export function renderLegend({container,document,entities}){
 const open=container.querySelector?.('details')?.open;container.innerHTML='';const details=add(document,container,'details',null,'atlas-info');details.open=Boolean(open);add(document,details,'summary','Legenda hărții');
 const list=add(document,details,'ul',null,'atlas-legend');for(const entry of legendEntries(entities)){
  const item=add(document,list,'li');item.dataset.legendKey=entry.key;const svg=document.createElementNS?document.createElementNS('http://www.w3.org/2000/svg','svg'):document.createElement('svg');svg.setAttribute('viewBox','0 0 56 20');svg.setAttribute('aria-hidden','true');svg.className?.baseVal!==undefined?svg.setAttribute('class','legend-swatch'):svg.className='legend-swatch';
  const line=document.createElementNS?document.createElementNS('http://www.w3.org/2000/svg','line'):document.createElement('line');for(const [name,value] of Object.entries({x1:3,y1:10,x2:53,y2:10,stroke:entry.style.color,'stroke-width':entry.style.weight,'stroke-dasharray':entry.style.dashArray||'none'}))line.setAttribute(name,value);svg.appendChild(line);item.appendChild(svg);
  const text=add(document,item,'span',entry.label);add(document,text,'small',(entry.style.dashArray?'Linie întreruptă':'Linie continuă')+' · grosime '+entry.style.weight+(entry.key==='selected'?' · evidențierea selecției':''));
 }
 const roles=entities.filter(e=>e.roles?.includes('statistical')).length,separate=entities.filter(e=>e.category==='statistical').length;
 add(document,details,'p',roles+' roluri statistice: '+(roles-separate)+' reutilizează geometria administrativă; numai '+separate+' au limite statistice separate, simbolizate distinct. Rolul statistic nu înseamnă automat un strat cartografic separat.','hint');return details;
}
export function globalProvenance(manifest,gate,index,buildInfo,publication=publishedActualRelease){
 const binding=publication?.snapshot===manifest.snapshot_id&&publication?.fingerprint===manifest.release_fingerprint_sha256?publication:null;
 return {publication:binding,rows:[['Release ACTUAL',binding?.tag||'Publicare neconfirmată pentru snapshot-ul curent'],['Snapshot ACTUAL',manifest.snapshot_id],['Contract public',manifest.public_contract?.contract],['Gate curent',gate.status],['Entități',index?.entity_count??manifest.public_contract?.entity_count],['Jurisdicții',(manifest.jurisdictions||Object.keys(index?.entity_count_by_jurisdiction||manifest.public_contract?.entity_count_by_jurisdiction||{})).join(' / ')],['Manifest generat',manifest.generated_at]],technical:[['Fingerprint',manifest.release_fingerprint_sha256],['Surse actualizate',manifest.source_bundle?.source_watermark],['Metadata aplicație',buildInfo?.app_version],['Publicare din metadata aplicației (independentă)',buildInfo?.actual_release_tag],['Snapshot din metadata aplicației',buildInfo?.actual_snapshot_id]]};
}
export function renderGlobalProvenance({container,document,manifest,gate,index,buildInfo}){
 const model=globalProvenance(manifest,gate,index,buildInfo),open=container.querySelector?.('details')?.open;container.innerHTML='';rowsDom(document,container,model.rows.filter(r=>r[1]!=null));
 if(model.publication){const link=add(document,container,'a','Release verificat pe GitHub','action-button');link.href=safeSourceUrl(model.publication.url);link.target='_blank';link.rel='noopener';}
 const details=add(document,container,'details',null,'atlas-info');details.open=Boolean(open);add(document,details,'summary','Detalii tehnice');rowsDom(document,details,model.technical.filter(r=>r[1]!=null));return model;
}
const confidence=value=>({high:'ridicată',medium:'medie',low:'scăzută',official:'oficială',reviewed:'auditată'}[value]||value);
const method=value=>value?.startsWith('exact_normalized')?'Potrivire exactă a denumirii normalizate':value?.replaceAll('_',' ');
export function entityProvenance(entity,{typeLabel=String,statusLabel=String}={}){
 const legal=entity.legal,s=entity.statistical,r=entity.representation,v=entity.validation||{};
 return [
 {key:'official',label:'Identitate oficială',rows:legal?[['Sursa identității',legal.registry],['ID oficial',legal.id],['Denumire oficială',legal.name],['Tip juridic',legal.type&&typeLabel(legal.type)],['Părinte legal',legal.parent_name],['Reconciliere',statusLabel(v.legal_identity_status)],['Metodă',method(legal.match_method)],['Încredere',confidence(legal.confidence)],['An registru',legal.reference_year],['Sursa registrului',legal.source]]:[],note:legal?null:'Nu este atașată o identitate juridică pozitivă în contractul public ACTUAL.'},
 {key:'statistical',label:'Rol statistic',rows:s?[['Clasificare',s.classification],['Versiune',s.version],['Cod oficial',s.code],['Nivel statistic',s.level],['Părinte statistic',entity.hierarchy?.statistical_parent_name||s.parent_code],['Autoritatea identității statistice',s.identity_authority],['Sursa identității statistice',s.source||s.membership_source],['Geometrie',entity.category==='statistical'?'Limită statistică separată':'Geometrie administrativă reutilizată']]:[],note:s?null:'Nu are rol statistic în contractul public.'},
 {key:'cartographic',label:'Reprezentare cartografică',rows:[['Sursa geometriei',r.source],['Relație OSM',r.osm_relation_id],['Tip reprezentare',typeLabel(r.inferred_type)],['Nivel OSM (metadata cartografică)',r.admin_level],['Fidelitate geometrică',r.public_geometry_precision==='master_coordinate_fidelity'?'Coordonate master, fără simplificare':r.public_geometry_precision],['Încredere geometrică',confidence(v.representation_confidence)],['Referință statistică OSM (evidence)',r.osm_statistical_ref],['Autoritate pentru referința OSM',r.osm_ref_is_identity_authority===false?'Numai evidence OSM; nu stabilește identitatea oficială':null],['Audit reprezentare',v.review_status],['Sursă audit',v.review_source]],url:safeSourceUrl(r.source_url)}
 ];
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function entityProvenanceHtml(entity,options){return entityProvenance(entity,options).map(section=>'<section class="details-section" data-provenance="'+section.key+'"><h3>'+section.label+'</h3>'+(section.note?'<p class="muted">'+escape(section.note)+'</p>':'')+'<dl class="kv">'+section.rows.filter(r=>r[1]!=null&&r[1]!=='').map(([label,value])=>'<dt>'+escape(label)+'</dt><dd>'+escape(value)+'</dd>').join('')+'</dl>'+(section.key==='cartographic'?'<div class="details-actions">'+(section.url?'<a class="action-button" href="'+escape(section.url)+'" target="_blank" rel="noopener">Deschide sursa geometriei</a>':'')+'<button type="button" class="action-button" id="zoom-selected">Zoom la entitate</button></div>':'')+'</section>').join('');}
export function labelMapControls(document){for(const [selector,label] of [['.leaflet-control-zoom-in','Mărește harta'],['.leaflet-control-zoom-out','Micșorează harta']]){const el=document.querySelector?.(selector);el?.setAttribute('aria-label',label);el?.setAttribute('title',label);}}
export function wireAtlasSkipLinks({document,mobile}){
 document.getElementById('skip-map').addEventListener('click',event=>{event.preventDefault();if(mobile.state.mobile)mobile.closeDrawer(false);document.getElementById('map').focus();});
 document.getElementById('skip-navigation').addEventListener('click',event=>{event.preventDefault();if(mobile.state.mobile)mobile.openDrawer();else document.getElementById('entity-search').focus();});
}
