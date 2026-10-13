import {entityMetadata,geometryExport,fileName,csvRows,entityColumns,metadataRow,downloadFile,issueReport,issueCategories,comparisonExport,comparisonRow,measurementExport,model} from './atlas-export.mjs';
export function createAtlasExport({document,getManifest,getEntity,getSource,readFeature,getCurrentUrl,getMeasurement,getVisual,printVisual,getMetrics=()=>null}){
 const json=data=>JSON.stringify(data,null,2)+'\n';
 function append(target,tag,text){const e=document.createElement(tag);e.textContent=text??'';target.appendChild(e);return e;}
 function action(target,status,label,run){const b=append(target,'button',label);b.type='button';b.className='action-button';b.addEventListener('click',async()=>{if(b.disabled)return;b.disabled=true;status.textContent='Se pregătește exportul…';try{const message=await run();status.textContent=message||'Fișier pregătit; descărcarea a fost solicitată browserului.';}catch(e){status.textContent=e.message||'Export indisponibil. Reîncearcă.';}finally{b.disabled=false;}});return b;}
 function card(target,entity){
  if(document.nodeType!==9)return;
  const details=append(target,'details');details.className='atlas-export-actions';append(details,'summary','Export și raportare');
  const status=append(details,'p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  let busy=false;
  async function save(format){if(busy)throw Error('Un export este deja în pregătire');busy=true;try{const manifest=getManifest(),source=getSource(entity.id);let data;if(format==='geojson'){if(!source)throw Error('Geometrie ACTUAL indisponibilă; reîncearcă după încărcarea atlasului');data=geometryExport(entity,await readFeature(entity.id),manifest,source);}else {const m=getMetrics(entity.id);data=entityMetadata(entity,manifest,m?source:null);if(m&&Number.isFinite(m.areaM2)&&Number.isFinite(m.perimeterMetres))data.calculated={areaM2:m.areaM2,perimeterMetres:m.perimeterMetres,components:m.components,holes:m.holes,model};}
   const content=format==='csv'?csvRows(entityColumns,[metadataRow(data)]):json(data);downloadFile(document,fileName(entity,format),content,format==='csv'?'text/csv;charset=utf-8':format==='geojson'?'application/geo+json':'application/json');
  }finally{busy=false;}}
  const geo=action(details,status,'Descarcă GeoJSON',()=>save('geojson'));geo.disabled=!getSource(entity.id);
  if(geo.disabled)append(details,'p','Geometria verificabilă nu este disponibilă. Metadatele pot fi exportate.');
  action(details,status,'Descarcă JSON',()=>save('json'));action(details,status,'Descarcă CSV',()=>save('csv'));
  const reporting=append(details,'details');append(reporting,'summary','Raportează o problemă');
  const label=append(reporting,'label','Categoria problemei '),select=append(label,'select');for(const category of issueCategories){const o=append(select,'option',category);o.value=category;}
  const text=append(reporting,'textarea');text.readOnly=true;text.rows=9;text.setAttribute('aria-label','Textul raportului, pentru copiere manuală');
  const link=append(reporting,'a','Deschide formularul GitHub');link.className='action-button';link.target='_blank';link.rel='noopener noreferrer';
  function refresh(){const report=issueReport(entity,getManifest(),select.value,getCurrentUrl());text.value=report.text;link.href=report.url;}
  select.addEventListener('change',refresh);refresh();
  const copy=append(reporting,'button','Copiază raportul');copy.type='button';copy.className='action-button';copy.addEventListener('click',async()=>{try{if(!globalThis.navigator?.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(text.value);status.textContent='Raport copiat.';}catch{text.focus();text.select();status.textContent='Copiere automată indisponibilă. Copiază textul selectat.';}});
  append(reporting,'p','Completează descrierea în GitHub și publică numai după verificare. Raportul nu include GPS sau starea sesiunii.');
 }
 function comparison(target,report,ids,status){
  const entities=ids.map(getEntity),sources=ids.map(getSource),data=comparisonExport(report,entities,getManifest(),sources);
  for(const format of ['json','csv'])action(target,status,'Exportă rezultatele '+format.toUpperCase(),()=>{const row=comparisonRow(data);downloadFile(document,'comparatie_'+ids.join('_')+'.'+format,format==='json'?json(data):csvRows(Object.keys(row),[row]),format==='json'?'application/json':'text/csv;charset=utf-8');});
 }
 function measurement(){const target=document.getElementById('measure-panel');if(!target)return;const d=append(target,'details');d.className='atlas-export-actions';append(d,'summary','Exportă măsurarea');const status=append(d,'p');status.setAttribute('role','status');const availability=append(d,'p');const commands=[];for(const format of ['json','geojson'])commands.push(action(d,status,'Descarcă măsurarea '+format.toUpperCase(),()=>{const data=measurementExport(getMeasurement());const out=format==='geojson'?{type:'Feature',geometry:data.geometry,properties:{schemaVersion:data.schemaVersion,kind:data.kind,calculated:data.calculated,model:data.model,provenance:data.provenance}}:data;downloadFile(document,'masurare_utilizator_'+data.mode+'.'+format,json(out),format==='json'?'application/json':'application/geo+json');}));const refresh=()=>{const state=getMeasurement(),ready=Boolean(state?.finished&&!state.armed);for(const button of commands)button.disabled=!ready;availability.textContent=ready?'Măsurare finalizată; export disponibil.':'Finalizează măsurarea validă pentru a activa exportul.';};d.addEventListener('toggle',refresh);if(globalThis.MutationObserver){const observer=new MutationObserver(refresh);observer.observe(document.getElementById('measure-status'),{childList:true,subtree:true});}refresh();}
 function visual(){const target=document.getElementById('share-panel');if(!target)return;const d=append(target,'details');d.className='atlas-export-actions';append(d,'summary','Imprimare și imaginea hărții');append(d,'p','SVG și PDF vectorial, fără rasterul OSM. Sunt incluse geometriile și marcajele vizibile; verifică marcajele personale înainte de export. Harta și încadrarea curentă rămân neschimbate.');
  const label=append(d,'label','Orientarea paginii '),orientation=append(label,'select');for(const [v,t]of [['portrait','A4 portret'],['landscape','A4 landscape']]){const o=append(orientation,'option',t);o.value=v;}
  const status=append(d,'p');status.setAttribute('role','status');action(d,status,'Descarcă imaginea hărții (SVG)',()=>downloadFile(document,'harta_atlas.svg',getVisual(),'image/svg+xml'));action(d,status,'Imprimă harta',()=>{printVisual(getVisual(),orientation.value);return 'Documentul vectorial este pregătit pentru imprimare sau PDF.';});
 }
 return {card,comparison,measurement,visual};
}
