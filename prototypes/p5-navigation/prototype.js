import {geometryClass,geometrySubtype,geometryVisible,statisticalLevel} from '../../geometry-taxonomy.mjs';
import {typeLabel} from '../../atlas-search.mjs';
import {formatEntityName} from '../../atlas-name-format.mjs';

const byId=id=>document.getElementById(id);
const base=new URL('../../',import.meta.url);
const dataUrl=path=>new URL(path.replace(/^\/+/,''),base).href;
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro-RO').trim();
const state={ready:false,selectedId:null,openIds:new Set(),hiddenIds:new Set(),jurisdictions:new Set(['RO','MD']),
 classes:new Set(),subtypes:new Set(),levels:new Set([1,2,3]),separate:true,tab:'tree',drawer:false,
 entities:new Map(),nodes:new Map(),roots:[],chunks:[],allClasses:[],allSubtypes:[],
 search:[],visibleCount:0,geometryRequests:0,geometryCache:new Map(),selectedGeometry:null,
 map:null,selectedLayer:null,latestSelection:0,initialQuery:null};
const $=name=>byId(name);
const setStatus=value=>{$('status').textContent=value;};
const el=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const fetchJson=async url=>{const resp=await fetch(url,{cache:'no-cache'});if(!resp.ok)throw Error('HTTP '+resp.status+' · '+url);return resp.json();};
const semanticRole=n=>n.roles?.includes('statistical');
function badge(n){
 if(n.display_type==='state')return {label:n.jurisdiction,className:'country'};
 if(semanticRole(n))return {label:(n.jurisdiction==='RO'?'N':'S')+Number(n.statistical_level||'?'),className:n.roles.length>1?'shared':'stats'};
 const types={county:'JUD',district:'RAI',municipality:'MUN',town:'ORA',commune:'COM',component_locality:'LOC',sector:'SEC'};
 return {label:types[n.display_type]||'ADM',className:''};
}
const visible=e=>Boolean(e&&state.jurisdictions.has(e.jurisdiction)&&!state.hiddenIds.has(e.id)&&
 geometryVisible(e,{geometryClasses:state.classes,geometrySubtypes:state.subtypes,statisticalLevels:state.levels,separateStatisticalGeometry:state.separate}));
const filterVisibility=e=>Boolean(e&&state.jurisdictions.has(e.jurisdiction)&&
 geometryVisible(e,{geometryClasses:state.classes,geometrySubtypes:state.subtypes,statisticalLevels:state.levels,separateStatisticalGeometry:state.separate}));
const counts=new Map();
function descendants(id){
 if(counts.has(id))return counts.get(id);
 const n=state.nodes.get(id);if(!n)return 0;
 let sum=0;for(const ch of n.child_ids){sum+=1+descendants(ch);}counts.set(id,sum);return sum;
}
const rows=new Map();
function drawNode(id,depth=0){
 const n=state.nodes.get(id),e=state.entities.get(id);if(!n||!e)return el('p','loading','Entitate lipsă: '+id);
 const wrap=el('div','tree-node'),row=el('div','tree-row');row.style.setProperty('--indent',Math.min(depth,9));row.dataset.entityId=id;
 const kids=n.child_ids.length>0;
 const disclose=el('button','disclose',kids?(state.openIds.has(id)?'▾':'▸'):'');
 disclose.type='button';disclose.disabled=!kids;disclose.setAttribute('aria-label',(state.openIds.has(id)?'Restrânge ':'Extinde ')+formatEntityName(n.display_name));
 disclose.setAttribute('aria-expanded',String(state.openIds.has(id)));
 const box=el('input','geo-checkbox');box.type='checkbox';box.checked=!state.hiddenIds.has(id);
 box.setAttribute('aria-label','Afișează limita: '+formatEntityName(n.display_name));
 box.addEventListener('change',()=>{if(box.checked)state.hiddenIds.delete(id);else state.hiddenIds.add(id);refreshMapAndTree();});
 const role=badge(n),pill=el('span','level '+role.className,role.label);
 const select=el('button','node-select');select.type='button';select.dataset.selectId=id;
 const name=el('span','node-name',formatEntityName(n.display_name));
 const secondaryParts=[typeLabel(n.display_type)];
 if(n.statistical_code)secondaryParts.push(n.statistical_code);
 const childCount=descendants(id);if(childCount)secondaryParts.push(childCount.toLocaleString('ro-RO')+' subordonate');
 const secondary=el('span','node-meta',secondaryParts.join(' · '));
 select.append(name,secondary);
 select.title=secondaryParts.join(' · ');
 select.setAttribute('aria-label','Selectează '+formatEntityName(n.display_name)+' · '+secondaryParts.join(' · '));
 select.addEventListener('click',()=>selectEntity(id));
 row.append(disclose,box,pill,select);
 const children=el('div','children');children.setAttribute('role','group');children.setAttribute('aria-label','Subordonate '+formatEntityName(n.display_name));
 if(!state.openIds.has(id))children.hidden=true;
 let made=false;
 const ensureChildren=()=>{if(made)return;made=true;for(const child of n.child_ids)children.appendChild(drawNode(child,depth+1));};
 function toggle(force){
  const next=force??!state.openIds.has(id);
  if(!kids)return;
  if(next){state.openIds.add(id);ensureChildren();children.hidden=false;}
  else{state.openIds.delete(id);children.hidden=true;}
  disclose.textContent=next?'▾':'▸';disclose.setAttribute('aria-expanded',String(next));
  disclose.setAttribute('aria-label',(next?'Restrânge ':'Extinde ')+formatEntityName(n.display_name));
 }
 disclose.addEventListener('click',()=>toggle());
 wrap.append(row,children);
 rows.set(id,{row,box,select,toggle,ensureChildren,n});
 if(kids&&state.openIds.has(id))ensureChildren();
 return wrap;
}
function buildTree(){
 rows.clear();counts.clear();
 const tree=$('tree');tree.replaceChildren();
 for(const id of state.roots)tree.appendChild(drawNode(id,0));
 updateRows();
 $('tree-count').textContent=state.nodes.size.toLocaleString('ro-RO')+' entități · 2 state';
}
function openPath(id){
 const path=[];let key=id;
 while(key&&state.nodes.has(key)&&path.length<25){path.push(key);key=state.nodes.get(key).parent_id;}
 path.reverse();for(const ancestor of path.slice(0,-1))rows.get(ancestor)?.toggle(true);
 const row=rows.get(id)?.row;row?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function updateRows(){
 for(const [id,entry] of rows){
  const e=state.entities.get(id);
  entry.row.classList.toggle('is-selected',state.selectedId===id);
  entry.select.setAttribute('aria-current',state.selectedId===id?'true':'false');
  entry.box.checked=!state.hiddenIds.has(id);
  const filtered=!filterVisibility(e);
  entry.row.classList.toggle('is-filtered',filtered);
  entry.row.title=filtered?'Geometria este filtrată global; entitatea rămâne selectabilă':'';
  entry.row.style.opacity=filtered?'.60':'1';
 }
}
function makeSearchIndex(){
 state.search=[...state.entities.values()].map(e=>{
  const n=state.nodes.get(e.id);
  const fields=[e.id,e.display_name,e.official_name,e.legal?.id,e.legal?.name,
   e.legal?.registry,e.statistical?.code,e.representation?.osm_relation_id,
   e.representation?.osm_relation_id!=null?'r'+e.representation.osm_relation_id:null,
   ...(e.searchable_names||[])].filter(Boolean);
  const text=[...new Set(fields.map(normalize))];
  return {id:e.id,text,name:normalize(e.display_name),n,e};
 });
}
function closeSearch(){const c=$('search-results');c.hidden=true;c.replaceChildren();$('search').setAttribute('aria-expanded','false');}
function findMatches(query){
 const q=normalize(query);if(!q)return [];
 return state.search.map(r=>{
  let score=100;for(const s of r.text){if(s===q)score=Math.min(score,0);else if(s.startsWith(q))score=Math.min(score,1);else if(s.includes(q))score=Math.min(score,3);}
  return score===100?null:{...r,score};
 }).filter(Boolean).sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,'ro')).slice(0,24);
}
function renderSearch(){
 const q=$('search').value,list=$('search-results');list.replaceChildren();
 if(!q.trim()){closeSearch();return;}
 const matches=findMatches(q);$('search').setAttribute('aria-expanded','true');list.hidden=false;
 if(!matches.length){list.appendChild(el('p','search-help','Nicio entitate găsită. Încearcă un nume sau cod.'));return;}
 for(const item of matches){
  const btn=el('button','result-row');btn.type='button';btn.setAttribute('role','option');
  btn.append(el('b','',formatEntityName(item.e.display_name)),
   el('small','',(item.e.jurisdiction+' · '+typeLabel(item.e.display_type)+' · '+(item.e.statistical?.code||item.e.legal?.id||item.e.id))));
  btn.addEventListener('click',()=>{closeSearch();selectEntity(item.id);$('search').value='';});
  list.appendChild(btn);
 }
}
function checkboxRow(label,checked,onChange,count){
 const wrap=el('div','filter-item'),input=el('input');
 input.type='checkbox';input.checked=checked;input.setAttribute('aria-label',label);
 input.addEventListener('change',()=>onChange(input.checked));
 const labelEl=el('label','',label);labelEl.addEventListener('click',()=>input.click());
 wrap.append(input,labelEl);if(count!==undefined)wrap.appendChild(el('small','',String(count)));
 return wrap;
}
function group(title){const section=el('section','filter-group');section.appendChild(el('h3','',title));$('filter-content').appendChild(section);return section;}
function refreshFilters(){
 const host=$('filter-content');host.replaceChildren();
 const j=group('Jurisdicții');
 for(const code of ['RO','MD'])j.appendChild(checkboxRow(code==='RO'?'România':'Republica Moldova',state.jurisdictions.has(code),on=>{
  if(on)state.jurisdictions.add(code);else state.jurisdictions.delete(code);filterChanged();
 },code==='RO'?'3.246':'2.602'));
 const g=group('Clase de reprezentare');
 const mapLabels={context:'Context teritorial',regional:'Unități regionale',local_uat:'UAT locale',sector:'Sectoare',component_locality:'Localități componente',auxiliary:'Alte reprezentări'};
 for(const cls of state.allClasses){
  const number=[...state.entities.values()].filter(e=>geometryClass(e)===cls).length;
  g.appendChild(checkboxRow(mapLabels[cls]||cls,state.classes.has(cls),on=>{if(on)state.classes.add(cls);else state.classes.delete(cls);filterChanged();},number));
 }
 const subt=group('Subtipuri administrative');
 const disclosure=el('details');const summary=el('summary','','Extinde lista subtipurilor');disclosure.append(summary);
 for(const sub of state.allSubtypes){
  const number=[...state.entities.values()].filter(e=>geometrySubtype(e)===sub).length;
  disclosure.appendChild(checkboxRow(typeLabel(sub),state.subtypes.has(sub),on=>{if(on)state.subtypes.add(sub);else state.subtypes.delete(sub);filterChanged();},number));
 }
 subt.append(disclosure);
 const st=group('Niveluri statistice');
 st.appendChild(el('p','filter-intro','NUTS doar pentru RO; pentru MD sunt niveluri statistice naționale. Rolurile comune folosesc regula SAU între filtrele administrative și statistice.'));
 for(const level of [1,2,3])st.appendChild(checkboxRow('Nivel statistic '+level,state.levels.has(level),on=>{
  if(on)state.levels.add(level);else state.levels.delete(level);filterChanged();
 }));
 st.appendChild(checkboxRow('Afișează limite statistice separate',state.separate,on=>{state.separate=on;filterChanged();},'18'));
 host.appendChild(el('p','filter-summary','Filtrele afectează numai vizibilitatea pe hartă; căutarea, ierarhia și detaliile rămân accesibile.'));
 updateFilterBadge();
}
function updateFilterBadge(){
 let dirty=0;
 for(const code of ['RO','MD'])if(!state.jurisdictions.has(code))dirty++;
 for(const cls of state.allClasses)if(!state.classes.has(cls))dirty++;
 for(const sub of state.allSubtypes)if(!state.subtypes.has(sub))dirty++;
 for(const level of [1,2,3])if(!state.levels.has(level))dirty++;
 if(!state.separate)dirty++;
 const b=$('filter-badge');b.textContent=String(dirty);b.hidden=!dirty;
}
function filterChanged(){
 updateFilterBadge();updateRows();refreshSelectionGeometry();
}
function resetFilters(){
 state.jurisdictions=new Set(['RO','MD']);state.classes=new Set(state.allClasses);
 state.subtypes=new Set(state.allSubtypes);state.levels=new Set([1,2,3]);state.separate=true;state.hiddenIds.clear();
 refreshFilters();refreshMapAndTree();setStatus('Filtrele și vizibilitatea individuală au fost resetate.');
}
function refreshMapAndTree(){updateRows();refreshSelectionGeometry();}
function switchTab(tab,focus=false){
 state.tab=tab;
 for(const name of ['tree','filters']){
  const active=name===tab;
  $('tab-'+name).classList.toggle('active',active);
  $('tab-'+name).setAttribute('aria-selected',String(active));
  $('tab-'+name).tabIndex=active?0:-1;
  $('panel-'+name).hidden=!active;
 }
 if(focus)$('tab-'+tab).focus();
}
function hideDrawer(){
 state.drawer=false;$('sidebar').classList.remove('open');$('backdrop').hidden=true;$('nav-open').setAttribute('aria-expanded','false');
 if(matchMedia('(max-width:720px)').matches)$('nav-open').focus();
 setTimeout(()=>state.map?.invalidateSize(),220);
}
function showDrawer(tab='tree'){
 switchTab(tab);state.drawer=true;$('sidebar').classList.add('open');$('backdrop').hidden=false;
 $('nav-open').setAttribute('aria-expanded','true');$('search').focus();
}
function resetView(){state.map?.setView([46.3,26.5],6,{animate:false});}
async function getGeometry(id){
 const entity=state.entities.get(id);if(!entity)return null;
 const jurisdiction=entity.jurisdiction.toLowerCase();
 let url=null;
 if(geometryClass(entity)==='statistical_only'||entity.category==='statistical')url='public/geo/actual/'+jurisdiction+'-statistical.geojson';
 else if(entity.map?.tier==='overview')url='public/geo/actual/'+jurisdiction+'-overview.geojson';
 else{
  let cursor=entity,depth=0;
  while(cursor&&cursor.map?.tier!=='overview'&&depth++<32)cursor=state.entities.get(cursor.hierarchy?.parent_catalog_id);
  const tier=entity.map?.tier,root=cursor?.id;
  const chunk=state.chunks.find(c=>c.jurisdiction===entity.jurisdiction&&c.tier===tier&&c.root_entity_id===root);
  if(chunk)url=chunk.path;
 }
 if(!url)return null;
 if(!state.geometryCache.has(url)){
  const promise=fetchJson(dataUrl(url));
  state.geometryCache.set(url,promise);state.geometryRequests++;
  promise.catch(()=>state.geometryCache.delete(url));
 }
 const geo=await state.geometryCache.get(url);
 if(geo?.metadata?.jurisdiction!==entity.jurisdiction)throw Error('Jurisdicție geometrică invalidă');
 return (geo.features||[]).find(f=>f.properties?.entity_id===id)||null;
}
function clearLayer(){if(state.selectedLayer){state.map?.removeLayer(state.selectedLayer);state.selectedLayer=null;}state.selectedGeometry=null;}
async function refreshSelectionGeometry(){
 const id=state.selectedId;const seq=++state.latestSelection;clearLayer();
 if(!id||!state.map)return;
 const e=state.entities.get(id);
 if(!visible(e)){$('details-notice').textContent='Limita este ascunsă de filtre. Selecția și detaliile rămân active.';return;}
 $('details-notice').textContent='Se încarcă geometria originală…';
 try{
  const feature=await getGeometry(id);
  if(seq!==state.latestSelection)return;
  if(!feature){$('details-notice').textContent='Nu există poligon în reprezentarea publică pentru această identitate.';return;}
  const layer=L.geoJSON(feature,{style:{color:'#087e86',weight:3.6,opacity:1,fillColor:'#22a99f',fillOpacity:.19}});
  layer.addTo(state.map);state.selectedLayer=layer;state.selectedGeometry=feature.properties.entity_id;
  const bounds=layer.getBounds();
  if(bounds.isValid())state.map.fitBounds(bounds,{padding:[35,35],maxZoom:11,animate:false});
  $('details-notice').textContent='Geometrie ACTUAL originală · '+e.jurisdiction+' · '+(e.map?.tier||'statistical');
  setStatus('Geometrie afișată: '+formatEntityName(e.display_name));
 }catch(err){
  if(seq!==state.latestSelection)return;
  $('details-notice').textContent='Geometria nu a putut fi încărcată: '+err.message;
  setStatus('Eroare la încărcarea geometriei. Identitatea rămâne selectată.');
 }
}
function selectEntity(id,updateUrl=true){
 const e=state.entities.get(id);if(!e)return;
 state.selectedId=id;openPath(id);updateRows();
 $('selection-count').textContent='1 entitate';$('selection-clear').disabled=false;
 $('details').hidden=false;$('details-title').textContent=formatEntityName(e.display_name);
 $('details-type').textContent=typeLabel(e.display_type).toLocaleUpperCase('ro-RO');
 $('details-id').textContent=e.id;
 const trail=[];let cursor=id;while(cursor&&state.nodes.has(cursor)&&trail.length<12){const n=state.nodes.get(cursor);trail.push(formatEntityName(n.display_name));cursor=n.parent_id;}
 $('details-crumb').textContent=trail.reverse().join(' › ');
 const tags=$('details-tags');tags.replaceChildren();
 tags.append(el('span','',e.jurisdiction),el('span','',typeLabel(e.display_type)));
 if(e.statistical?.code)tags.appendChild(el('span','',e.statistical.code));
 if(e.legal?.id)tags.appendChild(el('span','',(e.legal.registry||'ID')+' '+e.legal.id));
 if(updateUrl){const u=new URL(location.href);u.searchParams.set('e',id);history.pushState({e:id},'',u);}
 if(state.drawer&&matchMedia('(max-width:720px)').matches)hideDrawer();
 refreshSelectionGeometry();
}
function clearSelection(updateUrl=true){
 state.selectedId=null;++state.latestSelection;clearLayer();updateRows();
 $('selection-count').textContent='0 entități';$('selection-clear').disabled=true;$('details').hidden=true;
 if(updateUrl){const u=new URL(location.href);u.searchParams.delete('e');history.pushState({},'',u);}
}
function initMap(){
 if(!globalThis.L){setStatus('Leaflet indisponibil. Arborele și filtrele sunt funcționale, dar harta necesită conectivitate CDN.');return;}
 state.map=L.map('map',{zoomControl:true,preferCanvas:false}).setView([46.3,26.5],6);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(state.map);
}
function wire(){
 $('search').addEventListener('input',renderSearch);
 $('search').addEventListener('keydown',ev=>{
  if(ev.key==='Escape'){closeSearch();$('search').blur();}
  if(ev.key==='Enter'){const first=$('search-results').querySelector('.result-row');if(first){ev.preventDefault();first.click();}}
 });
 document.addEventListener('click',ev=>{if(!ev.target.closest('.search-wrap')&&!ev.target.closest('#search-results'))closeSearch();});
 for(const t of ['tree','filters'])$('tab-'+t).addEventListener('click',()=>switchTab(t));
 $('tab-tree').parentElement.addEventListener('keydown',ev=>{
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(ev.key))return;
  ev.preventDefault();const next=ev.key==='ArrowRight'||ev.key==='End'?'filters':'tree';switchTab(next,true);
 });
 $('collapse-all').addEventListener('click',()=>{
  for(const [id,entry] of rows)if(!state.roots.includes(id))entry.toggle(false);
  for(const id of state.roots)rows.get(id)?.toggle(false);
 });
 $('expand-roots').addEventListener('click',()=>{for(const id of state.roots)rows.get(id)?.toggle(true);});
 $('reset-filters').addEventListener('click',resetFilters);
 $('selection-clear').addEventListener('click',()=>clearSelection());
 $('details-close').addEventListener('click',()=>clearSelection());
 $('zoom-selected').addEventListener('click',()=>refreshSelectionGeometry());
 $('nav-open').addEventListener('click',()=>showDrawer());$('nav-close').addEventListener('click',hideDrawer);
 $('backdrop').addEventListener('click',hideDrawer);$('mobile-filter-open').addEventListener('click',()=>showDrawer('filters'));
 $('map-reset').addEventListener('click',resetView);
 $('copy-link').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(location.href);setStatus('Legătura selecției a fost copiată.');}
  catch{setStatus('Copiere indisponibilă: copiază URL-ul din bara browserului.');}
 });
 document.addEventListener('keydown',ev=>{
  if(ev.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){ev.preventDefault();if(matchMedia('(max-width:720px)').matches)showDrawer();$('search').focus();}
  if(ev.key==='Escape'){if(state.drawer)hideDrawer();else closeSearch();}
 });
 const splitter=$('splitter');let startX=null;
 splitter.addEventListener('pointerdown',ev=>{if(matchMedia('(max-width:720px)').matches)return;startX=ev.clientX;splitter.setPointerCapture(ev.pointerId);});
 splitter.addEventListener('pointermove',ev=>{if(startX===null)return;const w=Math.min(600,Math.max(300,ev.clientX));document.documentElement.style.setProperty('--side-width',w+'px');splitter.setAttribute('aria-valuenow',String(w));state.map?.invalidateSize();});
 splitter.addEventListener('pointerup',()=>{startX=null;});
 splitter.addEventListener('keydown',ev=>{
  if(!['ArrowRight','ArrowLeft','Home'].includes(ev.key))return;ev.preventDefault();
  const current=parseInt(splitter.getAttribute('aria-valuenow')||'410',10);
  const w=ev.key==='Home'?410:Math.min(600,Math.max(300,current+(ev.key==='ArrowRight'?20:-20)));
  document.documentElement.style.setProperty('--side-width',w+'px');splitter.setAttribute('aria-valuenow',String(w));state.map?.invalidateSize();
 });
 window.addEventListener('popstate',()=>{const id=new URL(location.href).searchParams.get('e');if(id&&state.entities.has(id))selectEntity(id,false);else clearSelection(false);});
 window.addEventListener('resize',()=>{if(!matchMedia('(max-width:720px)').matches&&state.drawer)hideDrawer();state.map?.invalidateSize();});
}
async function init(){
 wire();initMap();switchTab('tree');
 try{
  const [tree,index,chunks,build]=await Promise.all([
   fetchJson(dataUrl('public/data/actual-consolidated-tree.json')),
   fetchJson(dataUrl('public/data/actual-entities.json')),
   fetchJson(dataUrl('public/data/actual-geometry-chunks.json')),
   fetchJson(dataUrl('public/data/app-build-info.json'))
  ]);
  if(tree.contract!=='actual-consolidated-hierarchy-v1'||index.entities?.length!==5848||tree.nodes?.length!==index.entities.length||tree.root_ids?.length!==2||chunks.chunk_count!==115)throw Error('Contract ACTUAL/P2 incompatibil cu P5.0');
  state.entities=new Map(index.entities.map(e=>[e.id,e]));
  state.nodes=new Map(tree.nodes.map(n=>[n.id,n]));
  state.roots=tree.root_ids;state.chunks=chunks.chunks;
  for(const n of state.nodes.values()){if(!state.entities.has(n.id)||n.parent_id!==null&&!state.nodes.get(n.parent_id)?.child_ids.includes(n.id))throw Error('Legătură consolidată invalidă: '+n.id);}
  state.allClasses=[...new Set(index.entities.map(geometryClass))].filter(x=>x!=='statistical_only').sort();
  state.allSubtypes=[...new Set(index.entities.map(geometrySubtype).filter(Boolean))].sort();
  state.classes=new Set(state.allClasses);state.subtypes=new Set(state.allSubtypes);
  state.openIds=new Set(state.roots);makeSearchIndex();buildTree();refreshFilters();
  $('release-tag').textContent=build.actual_snapshot_id||'Release ACTUAL';
  state.ready=true;setStatus('5.848 entități · 115 chunk-uri · RO + MD');
  const initial=new URL(location.href).searchParams.get('e');if(initial&&state.entities.has(initial))selectEntity(initial,false);
 }catch(err){
  setStatus('Prototip indisponibil: '+err.message);
  $('tree').replaceChildren(el('p','loading','Nu s-au putut citi datele ACTUAL. Rulează pagina de pe serverul repository-ului.'));
 }
}
const readState=()=>({ready:state.ready,selectedId:state.selectedId,drawnId:state.selectedGeometry,
 nodes:state.nodes.size,entities:state.entities.size,open:[...state.openIds],tab:state.tab,
 hidden:state.hiddenIds.size,filters:{jurisdictions:[...state.jurisdictions],classes:[...state.classes],levels:[...state.levels],separate:state.separate},
 geometryRequests:state.geometryRequests,drawer:state.drawer});
Object.defineProperty(window,'__p5Prototype',{value:Object.freeze({readState,selectEntity,clearSelection,findMatches,openPath,resetFilters}),writable:false});
init();
