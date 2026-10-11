import {formatEntityName} from './atlas-name-format.mjs';

// Share is presentation only: URLs are captured live, never applied to atlas state.
export function sharePayload(currentUrl,entity=null){
 const url=new URL(currentUrl);
 if(!['http:','https:'].includes(url.protocol))throw new TypeError('Unsupported atlas URL');
 if(entity){url.search='';url.hash='';url.searchParams.set('v','1');url.searchParams.set('e',entity.id);}
 const title=entity?'Reforma Teritorială — '+formatEntityName(entity.display_name):'Reforma Teritorială — vederea curentă';
 return {url:url.href,title,text:entity?'Explorează entitatea în atlas.':'Explorează această vedere a atlasului.'};
}
export const shareEmail=payload=>'mailto:?'+new URLSearchParams({subject:payload.title,body:payload.text+'\n'+payload.url}).toString();
export function createAtlasShare({document,getCurrentUrl,getSelectedEntity,getNavigator=()=>globalThis.navigator}){
 const el=id=>document.getElementById(id),view=el('share-view'),entityChoice=el('share-entity'),copy=el('copy-link'),native=el('share-native'),email=el('share-email'),link=el('share-open'),urlField=el('share-url'),status=el('share-status'),description=el('share-description');
 let lastUrl='';
 function payload(){const current=getCurrentUrl();return current?sharePayload(current,entityChoice?.checked?getSelectedEntity():null):null;}
 function refresh(){
  const entity=getSelectedEntity();if(entityChoice){entityChoice.disabled=!entity;if(!entity&&entityChoice.checked){entityChoice.checked=false;if(view)view.checked=true;}}
  const data=payload();copy.disabled=!data;
  if(urlField)urlField.value=data?.url||'';
  if(email){email.href=data?shareEmail(data):'';email.hidden=!data;}
  if(link){link.href=data?.url||'';link.hidden=!data;}
  const nav=getNavigator();if(native){native.hidden=!data||typeof nav?.share!=='function';native.disabled=Boolean(data&&nav?.canShare&&!nav.canShare(data));}
  if(description)description.textContent=entityChoice?.checked?'Linkul selectează entitatea și folosește vederea și filtrele implicite.':'Linkul păstrează vederea, selecția, filtrele, bifele și fundalul curent.';
  if(lastUrl!==data?.url){status.textContent='';lastUrl=data?.url||'';}
 }
 copy.addEventListener('click',async()=>{
  const data=payload();if(!data)return;
  try{const nav=getNavigator();if(!nav?.clipboard?.writeText)throw new Error('Clipboard unavailable');await nav.clipboard.writeText(data.url);if(payload()?.url===data.url)status.textContent='Link copiat.';}
  catch{
   if(payload()?.url!==data.url)return;
   status.textContent='Copiere indisponibilă. Selectează și copiază linkul de mai jos.';
   const panel=el('share-panel');if(urlField&&!panel?.hidden&&!panel?.inert){urlField.value=data.url;urlField.focus?.();urlField.select?.();}
  }
 });
 native?.addEventListener('click',async()=>{
  const data=payload();if(!data)return;
  try{await getNavigator().share(data);if(payload()?.url===data.url)status.textContent='Distribuire finalizată.';}
  catch(error){if(payload()?.url===data.url)status.textContent=error?.name==='AbortError'?'Distribuire anulată.':'Distribuire indisponibilă. Folosește copierea linkului sau e-mailul.';}
 });
 for(const choice of [view,entityChoice])choice?.addEventListener('change',refresh);
 refresh();return {refresh};
}
