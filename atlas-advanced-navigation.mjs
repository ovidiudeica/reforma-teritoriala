import {formatEntityName} from './atlas-name-format.mjs';
import {typeLabel} from './atlas-search.mjs';

// P6.3: presentation-only navigator. Only explicit callbacks may affect map/checked state.
const limit=50,historyKey='reforma-teritoriala.recent-entities.v1';
const own=(doc,tag,cls='',label='')=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(label)el.textContent=label;return el;};
const title=e=>formatEntityName(e.display_name);
export function createAtlasAdvancedNavigation({
 document,entities,getChecked,onCheck,onSelect,onZoomPair,onFocusReturn,onOpen=()=>{},storage,
}){
 const dialog=document.getElementById('atlas-advanced-dialog'),content=document.getElementById('atlas-advanced-content');
 const closeButton=document.getElementById('advanced-close');
 const buttons={visible:document.getElementById('advanced-visible'),recent:document.getElementById('advanced-recent'),compare:document.getElementById('advanced-compare')};
 const tabs={visible:document.getElementById('advanced-tab-visible'),recent:document.getElementById('advanced-tab-recent'),compare:document.getElementById('advanced-tab-compare')};
 const byId=new Map(entities.map(e=>[e.id,e]));
 let current='visible',recent=[],pair=[],offset=limit,returnTo=buttons.visible,lastHidden=null;
 const safeStorage=()=>{try{return storage?.getItem?.(historyKey);}catch{return null;}};
 try{const saved=JSON.parse(safeStorage()||'[]');if(Array.isArray(saved))recent=[...new Set(saved)].filter(id=>typeof id==='string'&&byId.has(id)).slice(0,12);}catch{ /* private mode: session only */ }
 function persist(){try{storage?.setItem?.(historyKey,JSON.stringify(recent));}catch{ /* optional */ }}
 function checkedIds(){return [...getChecked()].filter(id=>byId.has(id)).sort((a,b)=>{const x=byId.get(a),y=byId.get(b);return (x.jurisdiction===y.jurisdiction?0:x.jurisdiction==='RO'?-1:1)||title(x).localeCompare(title(y),'ro')||a.localeCompare(b);});}
 function groupLabel(entity){return entity.jurisdiction==='RO'?'România':'Moldova';}
 const append=(target,tag,cls,value)=>{const node=own(document,tag,cls,value);target.appendChild(node);return node;};
 const action=(target,text,handler,cls='action-button')=>{const b=append(target,'button',cls,text);b.type='button';b.addEventListener('click',handler);return b;};
 function updateCounters(){buttons.visible.textContent='Straturi ('+getChecked().size+')';buttons.recent.textContent='Recente'+(recent.length?' ('+recent.length+')':'');buttons.compare.textContent='Compară'+(pair.length?' ('+pair.length+'/2)':'');}
 function select(id){close();Promise.resolve(onSelect(id)).catch(error=>console.error('Navigare avansată: selectare',error));}
 function checkedAction(target,id){const checked=getChecked().has(id);action(target,checked?'Ascunde':'Afișează',()=>{
  const next=!getChecked().has(id);lastHidden=next?null:id;
  onCheck(id,next);render();
 },'action-button atlas-advanced-compact').setAttribute('aria-label',(checked?'Ascunde':'Afișează')+' geometria '+title(byId.get(id)));}
 function compareAction(target,id){const paired=pair.includes(id);action(target,paired?'Scoate din comparație':'Adaugă la comparație',()=>{
  if(paired)pair=pair.filter(x=>x!==id);
  else if(pair.length<2)pair.push(id);
  else pair=[pair[1],id];
  current='compare';render();
 },'action-button atlas-advanced-compact');}
 function entityRow(target,id,kind){const entity=byId.get(id);if(!entity)return;
  const row=append(target,'li','atlas-advanced-row');
  const line=append(row,'div','atlas-advanced-row-title');action(line,title(entity),()=>select(id),'atlas-advanced-entity');
  append(row,'small','atlas-advanced-muted',groupLabel(entity)+' · '+typeLabel(entity.display_type||entity.representation?.inferred_type));
  const controls=append(row,'div','atlas-advanced-row-actions');if(kind!=='recent')checkedAction(controls,id);
  compareAction(controls,id);
 }
 function renderVisible(){const ids=checkedIds();append(content,'p','atlas-advanced-hint',ids.length+' geometrii bifate explicit. Filtrele pot ascunde temporar poligoanele; bifele rămân independente.');
  if(lastHidden&&!getChecked().has(lastHidden))action(content,'Anulează ascunderea: '+title(byId.get(lastHidden)),()=>{onCheck(lastHidden,true);lastHidden=null;render();},'action-button atlas-advanced-compact');
  const list=append(content,'ul','atlas-advanced-list');for(const id of ids.slice(0,offset))entityRow(list,id,'visible');
  if(ids.length>offset)action(content,'Mai multe ('+(ids.length-offset)+' rămase)',()=>{offset+=limit;render();});
 }
 function renderRecent(){append(content,'p','atlas-advanced-hint','Ultimele entități selectate pe acest dispozitiv. Lista nu este transmisă către server și nu modifică geometriile.');
  const list=append(content,'ul','atlas-advanced-list');for(const id of recent)entityRow(list,id,'recent');
  if(!recent.length)append(content,'p','atlas-advanced-muted','Nicio entitate vizitată încă.');
  if(recent.length)action(content,'Șterge istoricul local',()=>{recent=[];persist();render();});
 }
 function renderCompare(){
  append(content,'p','atlas-advanced-hint','Adaugă două entități prin butonul „Compară” din card, straturi sau recente. Geometriile nu sunt activate automat.');
  if(!pair.length)append(content,'p','atlas-advanced-muted','Nicio entitate adăugată.');
  const cols=append(content,'div','atlas-comparison-cards');
  for(const id of pair){const entity=byId.get(id);if(!entity)continue;
   const card=append(cols,'section','atlas-comparison-card');
   append(card,'h3','',title(entity));append(card,'p','atlas-advanced-muted',groupLabel(entity)+' · '+typeLabel(entity.display_type||entity.representation?.inferred_type));
   const rows=append(card,'dl','atlas-comparison-kv');
   for(const [label,value] of [['ID oficial',entity.legal?.id],['Cod statistic',entity.statistical?.code],['Identificator OSM',entity.representation?.osm_relation_id],['Apartenență',entity.hierarchy?.legal_parent_name||entity.hierarchy?.statistical_parent_name],['Stare geometrie',getChecked().has(id)?'Bifată explicit':'Nebifată']]){
    if(value==null||value==='')continue;append(rows,'dt','',label);append(rows,'dd','',String(value));
   }
   const controls=append(card,'div','atlas-comparison-actions');checkedAction(controls,id);action(controls,'Detalii',()=>select(id),'action-button atlas-advanced-compact');
   action(controls,'Elimină',()=>{pair=pair.filter(x=>x!==id);render();},'action-button atlas-advanced-compact');
  }
  if(pair.length===2){action(content,'Centrează pe ambele',()=>onZoomPair(pair.map(id=>byId.get(id))),'action-button').disabled=pair.some(id=>!Array.isArray(byId.get(id)?.map?.bbox));}
  if(pair.length)action(content,'Golește comparația',()=>{pair=[];render();});
 }
 function render(){updateCounters();for(const [key,tab] of Object.entries(tabs)){const active=key===current;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}content.replaceChildren?.();if(current==='visible')renderVisible();else if(current==='recent')renderRecent();else renderCompare();}
 function open(which='visible',origin=buttons[which]){onOpen();current=which;returnTo=origin||buttons.visible;offset=limit;render();if(!dialog.open)dialog.showModal();closeButton.focus();}
 function close(){if(dialog.open)dialog.close();}
 function restoreFocus(){const el=onFocusReturn?.(returnTo)||returnTo;el?.focus?.();}
 for(const [key,button] of Object.entries(buttons))button.addEventListener('click',()=>open(key,button));
 for(const [key,tab] of Object.entries(tabs)){tab.addEventListener('click',()=>{current=key;render();tab.focus();});tab.addEventListener('keydown',event=>{
  if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;event.preventDefault();const keys=Object.keys(tabs);current=keys[(keys.indexOf(key)+(event.key==='ArrowRight'?1:keys.length-1))%keys.length];render();tabs[current].focus();
 });}
 closeButton.addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',restoreFocus);
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)close();});
 function record(id){if(!byId.has(id))return;recent=[id,...recent.filter(value=>value!==id)].slice(0,12);persist();updateCounters();if(dialog.open)render();}
 function addCompare(id){if(!byId.has(id))return;if(!pair.includes(id))pair=pair.length<2?[...pair,id]:[pair[1],id];open('compare',buttons.compare);}
 function refresh(){updateCounters();if(dialog.open)render();}
 updateCounters();
 return {open,close,record,refresh,addCompare,get state(){return {recent:[...recent],pair:[...pair],current,open:dialog.open};}};
}
