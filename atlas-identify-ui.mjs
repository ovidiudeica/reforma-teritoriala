import {geographicPoint} from './atlas-point-geometry.mjs';
import {typeLabel} from './atlas-search.mjs';
import {formatEntityName} from './atlas-name-format.mjs';
export function parseCoordinate(value){const text=String(value).trim();if(!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(text))throw Error('Introdu două coordonate numerice complete.');return Number(text.replace(',','.'));}
export function createAtlasIdentify({document,browser,panels,identify,cancel,onDetails,onCenter,mark,getTreeScroll=()=>0,setTreeScroll=()=>{},getSelection=()=>null}){
 const el=id=>document.getElementById(id),panel=el('identify-panel');if(!panel)return null;
 const form=el('identify-form'),lat=el('identify-lat'),lon=el('identify-lon'),status=el('identify-status'),error=el('identify-error'),list=el('identify-results'),coordinates=el('identify-coordinates'),accuracy=el('identify-accuracy'),copy=el('identify-copy'),center=el('identify-center'),actionStatus=el('identify-action-status');
 let armed=false,point=null,result=null,marker=null,revision=0,internalClose=false,treeBookmark=null;
 panels.onBeforeChange?.(({from,to})=>{if(from==='entities'&&to==='identify')treeBookmark={top:getTreeScroll(),selected:getSelection()};});
 const removeMarker=()=>{marker?.remove();marker=null;};
 function clear(){revision++;cancel();armed=false;removeMarker();point=null;result=null;document.getElementById('map').classList.remove('identify-picking');el('identify-map-status').textContent='';el('identify-pick').textContent='Alege un punct pe hartă';list.replaceChildren();list.setAttribute('aria-busy','false');status.textContent='';error.textContent='';coordinates.textContent='';accuracy.textContent='';actionStatus.textContent='';copy.disabled=true;center.disabled=true;el('identify-copy-value').hidden=true;el('identify-copy-value').value='';lat.removeAttribute('aria-invalid');lon.removeAttribute('aria-invalid');}
 function render(report){
  list.replaceChildren();
  for(const jurisdiction of ['RO','MD']){
   const matches=report.matches.filter(x=>x.entity.jurisdiction===jurisdiction);if(!matches.length)continue;
   const heading=document.createElement('h3');heading.textContent=jurisdiction==='RO'?'România':'Republica Moldova';list.appendChild(heading);
   const levels=new Map();for(const match of matches){const e=match.entity,key=e.category==='statistical'&&e.statistical?.level!=null?'Nivel statistic '+e.statistical.level:e.representation?.admin_level!=null?'Nivel administrativ OSM '+e.representation.admin_level:typeLabel(e.display_type);if(!levels.has(key))levels.set(key,[]);levels.get(key).push(match);}
   for(const [level,items]of [...levels].sort(([a],[b])=>a.localeCompare(b,'ro',{numeric:true}))){const h=document.createElement('h4');h.textContent=level;list.appendChild(h);const ul=document.createElement('ul');list.appendChild(ul);
    for(const {entity:e,membership}of items){const li=document.createElement('li'),title=document.createElement('strong'),body=document.createElement('p'),button=document.createElement('button');title.textContent=formatEntityName(e.display_name);body.textContent=typeLabel(e.display_type)+' · '+e.id+(e.representation?.osm_relation_id!=null?' · OSM r'+e.representation.osm_relation_id:'')+' · '+(membership==='boundary'?'Pe limită':'Interior geometric');
     if(e.category!=='statistical'&&e.statistical?.level!=null)body.textContent+=' · Rol statistic, nivel '+e.statistical.level;
     if(e.validation?.legal_identity_status==='reconciled'&&e.legal?.id)body.textContent+=' · Identitate validată '+e.legal.registry+' '+e.legal.id;
     if(e.validation?.statistical_identity_status==='official'&&e.statistical?.code)body.textContent+=' · '+e.statistical.classification+' '+e.statistical.code;
     button.type='button';button.dataset.entityId=e.id;button.className='action-button';button.textContent='Detalii';button.setAttribute('aria-label','Detalii: '+formatEntityName(e.display_name));button.addEventListener('click',()=>{panels.close({focus:false});Promise.resolve(onDetails(e.id)).catch(()=>{actionStatus.textContent='Detaliile nu au putut fi deschise.';});});li.append(title,body,button);ul.appendChild(li);
    }
   }
  }
 }
 async function query(longitude,latitude,deviceAccuracy=null){
  const token=++revision;cancel();armed=false;document.getElementById('map').classList.remove('identify-picking');error.textContent='';actionStatus.textContent='';el('identify-copy-value').hidden=true;removeMarker();point=null;result=null;copy.disabled=true;center.disabled=true;list.replaceChildren();list.setAttribute('aria-busy','true');status.textContent='Se verifică geometriile ACTUAL…';coordinates.textContent='';accuracy.textContent='';
  try{
   const p=geographicPoint(longitude,latitude);point=p;el('identify-pick').textContent='Identifică alt punct';lat.removeAttribute('aria-invalid');lon.removeAttribute('aria-invalid');lat.value=String(latitude);lon.value=String(longitude);coordinates.textContent='Latitudine '+latitude.toFixed(7)+' · Longitudine '+longitude.toFixed(7);accuracy.textContent=deviceAccuracy==null?'':Number.isFinite(deviceAccuracy)&&deviceAccuracy>=0?'Precizia raportată de dispozitiv: ±'+Math.round(deviceAccuracy)+' m. Nu reprezintă precizia geometriei.':'Dispozitivul nu a raportat o precizie validă.';
   marker=mark(p);copy.disabled=false;center.disabled=false;const report=await identify(longitude,latitude);if(token!==revision||report.stale)return;
   result=report;render(report);error.textContent=report.partial?'Rezultate parțiale: '+report.errors.length+' geometrii sau resurse nu au putut fi verificate. Nu se poate confirma absența altor apartenențe.':'';
   status.textContent=report.matches.length+' unități identificate geometric.'+(report.matches.length===0&&!report.partial?' Nicio geometrie ACTUAL disponibilă nu conține punctul.':'');
  }catch(e){if(token===revision){error.textContent=e.message;status.textContent='Identificarea nu a putut fi finalizată.';}}
  finally{if(token===revision)list.setAttribute('aria-busy','false');}
 }
 form.addEventListener('submit',event=>{event.preventDefault();lat.removeAttribute('aria-invalid');lon.removeAttribute('aria-invalid');try{const latitude=parseCoordinate(lat.value),longitude=parseCoordinate(lon.value);geographicPoint(longitude,latitude);void query(longitude,latitude);}catch(e){clear();lat.setAttribute('aria-invalid','true');lon.setAttribute('aria-invalid','true');error.textContent=e.message;lat.focus();}});
 el('identify-pick').addEventListener('click',()=>{clear();armed=true;internalClose=true;panels.close({focus:false});internalClose=false;el('map').classList.add('identify-picking');el('identify-map-status').textContent='Identificare activă: alege un punct pe hartă. Escape anulează instrumentul.';el('map').focus();});
 panels.onChange(({active})=>{if(active!=='identify'&&!internalClose){clear();lat.value='';lon.value='';}if(active==='entities'&&treeBookmark){if(treeBookmark.selected===getSelection())setTreeScroll(treeBookmark.top);treeBookmark=null;}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&armed&&!event.defaultPrevented){event.preventDefault();clear();panels.open('identify',{focus:false});panels.close();}},true);
 copy.addEventListener('click',async()=>{if(!point)return;const token=revision,text=point[1]+', '+point[0];try{if(!browser.navigator?.clipboard?.writeText)throw Error();await browser.navigator.clipboard.writeText(text);if(token===revision)actionStatus.textContent='Coordonatele au fost copiate.';}catch{if(token!==revision)return;const fallback=el('identify-copy-value');fallback.value=text;fallback.hidden=false;fallback.focus();fallback.select();actionStatus.textContent='Copiază manual coordonatele selectate.';}});
 center.addEventListener('click',()=>{if(point)onCenter(point);});
 const geo=browser.navigator?.geolocation;el('identify-location').disabled=!geo||browser.isSecureContext===false;
 if(el('identify-location').disabled)el('identify-location-help').textContent='Geolocația nu este disponibilă în acest browser/context.';
 el('identify-location').addEventListener('click',()=>{
  clear();const token=revision;status.textContent='Se solicită locația dispozitivului…';
  try{geo.getCurrentPosition(position=>{if(token===revision)void query(position.coords.longitude,position.coords.latitude,position.coords.accuracy);},failure=>{if(token!==revision)return;status.textContent='';error.textContent=({1:'Permisiunea pentru locație a fost refuzată.',2:'Locația dispozitivului nu este disponibilă.',3:'Determinarea locației a depășit timpul permis.'})[failure.code]||'Geolocația nu a putut fi obținută.';},{enableHighAccuracy:false,timeout:10000,maximumAge:0});}catch{error.textContent='Geolocația nu este disponibilă.';status.textContent='';}
 });
 clear();return {get armed(){return armed;},fromMap(latlng){if(!armed)return;const longitude=Math.abs(latlng.lng)<=180?latlng.lng:((latlng.lng+180)%360+360)%360-180;armed=false;panels.open('identify');void query(longitude,latlng.lat);},query,clear,get state(){return {armed,point:point?[...point]:null,result};}};
}
