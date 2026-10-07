import {ancestorPath,createAtlasTree} from './atlas-tree.mjs';
import {geometryClass,geometryVisible,geometryLabels,administrativeClasses,statisticalLevel} from './geometry-taxonomy.mjs';

const map=L.map('map',{zoomControl:true}).setView([46.8,26.6],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
L.control.scale({imperial:false}).addTo(map);

const roots={RO:L.layerGroup().addTo(map),MD:L.layerGroup().addTo(map)};
const tiers=['overview','local','detail'];
const tierGroups=Object.fromEntries(['RO','MD'].flatMap(j=>tiers.map(t=>[j+'_'+t,L.layerGroup()])));
const tierData=new Map();
const chunkData=new Map();
const chunkGroups=new Map();
let chunkIndex=null;
const entityById=new Map();
const activeFilterGroups=new Set(Object.keys(geometryLabels));
const activeStatisticalLevels=new Set([1,2,3,'unclassified']);
let separateStatisticalGeometry=true;
const statisticalGroups={RO:L.layerGroup(),MD:L.layerGroup()};
let selectedEntityId=null;
let selectedLayer=null;
let indexData=null;
let releaseData=null;
let hierarchyTree=null;
const hierarchyNodeById=new Map();
let atlasTree=null;
const statisticalFeatureById=new Map();
const statisticalGeometryLoaded=new Set();


const filterLabels=geometryLabels;
const typeLabels={
 statistical_level_1:'nivel statistic 1',
 statistical_level_2:'nivel statistic 2',
 statistical_level_3:'nivel statistic 3',
 state:'stat (context teritorial)',
 county:'județ',
 district:'raion',
 capital_municipality:'municipiu-capitală',
 municipality:'municipiu',
 town:'oraș',
 commune:'comună',
 independent_village:'sat independent',
 chisinau_sector:'sector al municipiului Chișinău',
 local_uat:'UAT locală',
 sector:'sector',
 level_2_municipality:'municipiu de nivelul II',
 special_territorial_unit:'unitate teritorială specială',
 level_2_or_special_unit:'unitate administrativă de nivel superior',
 level_1_municipality:'municipiu de nivelul I',
 town_uat:'oraș',
 level_1_uat:'UAT de nivelul I',
 commune_or_independent_village_uat:'comună / sat independent',
 municipality_or_city_uat:'municipiu / oraș',
 component_locality:'localitate componentă',
 subdivision_or_component_area:'subdiviziune / localitate',
 intermediate_administrative_unit:'unitate administrativă intermediară',
 component_village_boundary_representation:'reprezentare de sat component',
 municipality_component_locality_boundary_representation:'reprezentare de localitate componentă',
 non_administrative_or_auxiliary_area:'zonă auxiliară'
};
const statusLabels={
 statistical_identity:'identitate statistică oficială',
 reconciled:'identitate oficială reconciliată',
 outside_current_legal_registry:'reprezentare în afara registrului legal curent',
 reviewed_representation_without_legal_identity:'reprezentare de-facto auditată, fără geometrie juridică atribuită',
 unresolved:'identitate oficială nerezolvată',
 not_bound_to_official_registry:'fără legătură cu registrul oficial în contract'
};

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const typeLabel=type=>typeLabels[type]||String(type||'unitate administrativă').replaceAll('_',' ');
function filterGroup(entity){return geometryClass(entity);}
function isVisible(entity){
 return geometryVisible(entity,{geometryClasses:activeFilterGroups,statisticalLevels:activeStatisticalLevels,separateStatisticalGeometry});
}
function styleFor(feature){
 const group=filterGroup(entityById.get(feature.properties?.entity_id));
 const styles={
  regional:{color:'#203f59',weight:1.8,fillColor:'#5d7b8c'},
  local_uat:{color:'#365e55',weight:1.1,fillColor:'#6d9184'},
  sector:{color:'#806b50',weight:.9,fillColor:'#b59b77'},
  component_locality:{color:'#806b50',weight:.8,fillColor:'#b59b77'},
  context:{color:'#203f59',weight:2,fillColor:'#5d7b8c'},
  auxiliary:{color:'#65716b',weight:.8,fillColor:'#909b95'},
  statistical_only:{color:'#66538c',weight:1.7,fillColor:'#a294bd',dashArray:'5 4'},
  unclassified:{color:'#c12b72',weight:2,fillColor:'#c12b72'}
 };
 return {...styles[group],opacity:.8,fillOpacity:.035};
}
const selectedStyle={color:'#b54a38',weight:3,opacity:1,fillOpacity:.12};

const actualReleasePromise=(async()=>{
 const status=document.getElementById('actual-release-status');
 try{
  const [manifestResponse,gateResponse,buildInfoResponse]=await Promise.all([
   fetch('data/current/actual-release-manifest.json',{cache:'no-cache'}),
   fetch('data/current/actual-release-gate.json',{cache:'no-cache'}),
   fetch('public/data/app-build-info.json',{cache:'no-cache'})
  ]);
  if(!manifestResponse.ok||!gateResponse.ok)throw new Error('Release ACTUAL indisponibil');
  const [manifest,gate,buildInfo]=await Promise.all([
   manifestResponse.json(),gateResponse.json(),buildInfoResponse.ok?buildInfoResponse.json():Promise.resolve(null)
  ]);
  if(gate.status!=='PASS')throw new Error('Release ACTUAL nu a trecut gate-ul combinat');
  if(!manifest.snapshot_id||gate.snapshot_id!==manifest.snapshot_id)throw new Error('Manifestul ACTUAL nu corespunde gate-ului');
  if(!['actual-public-entity-v1','actual-public-entity-v2','actual-public-entity-v3'].includes(manifest.public_contract?.contract))throw new Error('Contractul public ACTUAL lipsește din manifest');
  const publishedRelease=buildInfo?.actual_release_tag
   ?'publicat: '+buildInfo.actual_release_tag+(buildInfo.actual_snapshot_id?' · '+buildInfo.actual_snapshot_id:'')
   :'fără release publicat';
  if(status)status.textContent='ACTUAL curent: '+manifest.snapshot_id+' · '+publishedRelease+(buildInfo?.app_version?' · '+buildInfo.app_version:'');
  releaseData={manifest,gate,buildInfo};
  return releaseData;
 }catch(e){
  if(status)status.textContent='ACTUAL: release indisponibil sau nevalidat';
  console.error('Nu s-a putut valida release-ul ACTUAL',e);
  throw e;
 }
})();

async function loadIndex(){
 const release=await actualReleasePromise;
 const response=await fetch(release.manifest.public_contract.path,{cache:'no-cache'});
 if(!response.ok)throw new Error('Indexul public ACTUAL este indisponibil');
 const index=await response.json();
 if(index.contract!==release.manifest.public_contract.contract||index.entity_count!==release.manifest.public_contract.entity_count)throw new Error('Indexul public nu corespunde manifestului');
 indexData=index;
 for(const entity of index.entities||[])entityById.set(entity.id,entity);
 renderFilters();
 wireSearch();
 updateJurisdictionStatus();
 return index;
}

async function loadChunkIndex(){
 const path=releaseData?.manifest?.public_contract?.geometry_chunks?.path;
 if(!path)return null;
 const response=await fetch(path,{cache:'no-cache'});
 if(!response.ok)throw new Error('Indexul chunk-urilor geometrice ACTUAL este indisponibil');
 const data=await response.json();
 if(data.contract!=='actual-public-geometry-chunks-v1'||data.chunk_count!==(data.chunks||[]).length)throw new Error('Index chunk-uri ACTUAL invalid');
 chunkIndex=data;
 return data;
}

function updateJurisdictionStatus(){
 if(!releaseData||!indexData)return;
 for(const j of ['RO','MD']){
  const el=document.getElementById(j.toLowerCase()+'-source-status');
  const gate=releaseData.manifest.jurisdiction_gates?.[j];
  const count=indexData.entity_count_by_jurisdiction?.[j]??0;
  const stamp=gate?.generated_at?new Date(gate.generated_at).toLocaleString('ro-RO'):'—';
  if(el)el.textContent=j+': '+count.toLocaleString('ro-RO')+' entități · gate '+gate?.status+' · '+stamp;
 }
}

function renderFilters(){
 const container=document.getElementById('filter-list');
 const entities=[...entityById.values()];
 container.innerHTML='';
 const addSection=(title,keys,kind,labels,count,note)=>{
  const section=document.createElement('section');
  section.className='filter-section';
  const heading=document.createElement('h3');heading.textContent=title;section.appendChild(heading);
  const controls=document.createElement('div');controls.className='filter-actions';
  for(const [label,enabled] of [['Toate',true],['Niciuna',false]]){
   const button=document.createElement('button');button.type='button';button.textContent=label;
   button.addEventListener('click',()=>{
    for(const input of section.querySelectorAll('input[data-filter]')){
     input.checked=enabled;applyFilter(input);
    }
    refreshGeometryVisibility();
   });controls.appendChild(button);
  }
  section.appendChild(controls);
  for(const key of keys){
   const checked=kind==='geometry'?activeFilterGroups.has(key):activeStatisticalLevels.has(key);
   const row=document.createElement('label');row.className='filter-row';
   row.innerHTML='<input type="checkbox" data-kind="'+kind+'" data-filter="'+key+'"'+(checked?' checked':'')+'><span>'+escapeHtml(labels[key])+' <small>('+count(key).toLocaleString('ro-RO')+')</small></span>';
   section.appendChild(row);
  }
  if(note){const p=document.createElement('p');p.className='hint';p.textContent=note;section.appendChild(p);}
  container.appendChild(section);return section;
 };
 const geometryCount=key=>entities.filter(entity=>geometryClass(entity)===key).length;
 addSection('Tipuri administrative',administrativeClasses,'geometry',filterLabels,geometryCount);
 const levels=[1,2,3];
 if(entities.some(entity=>statisticalLevel(entity)==='unclassified'))levels.push('unclassified');
 const stats=addSection('Niveluri statistice',levels,'statistical',{1:'Nivel statistic 1',2:'Nivel statistic 2',3:'Nivel statistic 3',unclassified:'Rol statistic neclasificat'},key=>entities.filter(entity=>statisticalLevel(entity)===key).length,
  '63 roluri statistice: 45 reutilizează geometria administrativă. Nivelurile controlează rolul statistic, inclusiv geometria reutilizată; filtrele administrative se aplică în continuare.');
 const row=document.createElement('label');row.className='filter-row';
 row.innerHTML='<input type="checkbox" data-separate-statistical'+(separateStatisticalGeometry?' checked':'')+'><span>Limite statistice separate <small>('+geometryCount('statistical_only')+')</small></span>';
 stats.appendChild(row);
 const note=document.createElement('p');note.className='hint';note.textContent='Cele 18 limite separate nu dublează cele 45 geometrii reutilizate.';stats.appendChild(note);
 const other=['context','auxiliary'];
 if(geometryCount('unclassified'))other.push('unclassified');
 addSection('Alte reprezentări',other,'geometry',filterLabels,geometryCount);
 container.onchange=event=>{
  const input=event.target.closest('input');
  if(!input)return;
  if(input.hasAttribute('data-separate-statistical'))setSeparateStatisticalGeometry(input.checked);
  else if(input.dataset.filter)applyFilter(input);
  refreshGeometryVisibility();
 };
}
function setSeparateStatisticalGeometry(value){separateStatisticalGeometry=Boolean(value);}
function applyFilter(input){
 const set=input.dataset.kind==='geometry'?activeFilterGroups:activeStatisticalLevels;
 const key=input.dataset.kind==='geometry'?input.dataset.filter:input.dataset.filter==='unclassified'?'unclassified':Number(input.dataset.filter);
 if(input.checked)set.add(key);else set.delete(key);
}
function refreshGeometryVisibility(){
 rerenderLoadedTiers();
 updateSelectionVisibility();
}
function updateSelectionVisibility(){
 const entity=entityById.get(selectedEntityId);
 const status=document.getElementById('selection-visibility');
 if(status&&entity)status.textContent=isVisible(entity)?'':'Geometria este ascunsă de filtre. Selecția și detaliile rămân disponibile.';

}

function searchEntities(query){
 const q=norm(query);
 if(!q)return [];
 return [...entityById.values()].map(entity=>{
  const fields=[
   entity.display_name,...(entity.searchable_names||[]),
   entity.legal?.id,entity.legal?.name,
   entity.representation?.osm_relation_id,
   entity.hierarchy?.legal_parent_name
  ].map(norm).filter(Boolean);
  const exact=fields.some(v=>v===q);
  const starts=fields.some(v=>v.startsWith(q));
  const contains=fields.some(v=>v.includes(q));
  return {entity,score:exact?0:starts?1:contains?2:99};
 }).filter(x=>x.score<99).sort((a,b)=>a.score-b.score||a.entity.display_name.localeCompare(b.entity.display_name,'ro')).slice(0,20).map(x=>x.entity);
}

function wireSearch(){
 const input=document.getElementById('entity-search');
 const results=document.getElementById('search-results');
 const render=()=>{
  const matches=searchEntities(input.value);
  results.innerHTML='';
  for(const entity of matches){
   const button=document.createElement('button');
   button.type='button';
   button.className='search-result';
   button.innerHTML='<b>'+escapeHtml(entity.display_name)+'</b><small>'+escapeHtml(entity.jurisdiction)+' · '+escapeHtml(typeLabel(entity.display_type))+(entity.legal?.id?' · '+escapeHtml(entity.legal.registry)+' '+escapeHtml(entity.legal.id):'')+'</small>';
   button.addEventListener('click',async()=>{
    input.value=entity.display_name;
    results.innerHTML='';
    await selectEntity(entity.id,{zoom:true,source:'search'});
   });
   results.appendChild(button);
  }
  if(input.value.trim()&&!matches.length)results.innerHTML='<p class="muted">Nicio entitate găsită.</p>';
 };
 input.addEventListener('input',render);
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'){input.value='';results.innerHTML='';}
 });
}

async function loadHierarchyTree(){
 const descriptor=releaseData?.manifest?.public_contract?.hierarchy;
 const container=document.getElementById('hierarchy-tree');
 if(!descriptor?.path){
  if(container)container.innerHTML='<p class="muted">Ierarhia consolidată va fi disponibilă după activarea P2.3.</p>';
  return null;
 }
 const response=await fetch(descriptor.path,{cache:'no-cache'});
 if(!response.ok)throw new Error('Arborele consolidat ACTUAL este indisponibil');
 const tree=await response.json();
 if(tree.contract!=='actual-consolidated-hierarchy-v1'||tree.node_count!==(tree.nodes||[]).length)throw new Error('Arbore consolidat ACTUAL invalid');
 hierarchyTree=tree;
 hierarchyNodeById.clear();
 for(const node of tree.nodes||[])hierarchyNodeById.set(node.id,node);
 renderHierarchyTree();
 return tree;
}

function renderHierarchyTree(){
 const container=document.getElementById('hierarchy-tree');
 if(!container||!hierarchyTree)return;
 atlasTree=createAtlasTree({container,nodeById:hierarchyNodeById,rootIds:hierarchyTree.root_ids,document,typeLabel,
  onSelect:(id,options)=>selectEntity(id,options).catch(console.error)});
 if(selectedEntityId)atlasTree.select(selectedEntityId);
}
function selectedPath(id){
 if(!hierarchyTree)return [];
 return ancestorPath(hierarchyNodeById,hierarchyTree.root_ids,id);
}
function renderBreadcrumb(entity){
 const nav=document.createElement('nav');
 nav.className='hierarchy-breadcrumb';nav.setAttribute('aria-label','Ierarhie teritorială');
 const list=document.createElement('ol');
 for(const id of selectedPath(entity.id)){
  const node=hierarchyNodeById.get(id),item=document.createElement('li'),button=document.createElement('button');
  button.type='button';button.className='parent-button';button.textContent=node.display_name;
  button.dataset.entityId=id;
  if(id===entity.id)button.setAttribute('aria-current','location');
  if(node.statistical_code){
   const code=document.createElement('span');code.className='tree-code';code.textContent=node.statistical_code;button.appendChild(code);
  }
  button.addEventListener('click',()=>selectEntity(id,{zoom:true,source:'breadcrumb'}).catch(console.error));
  item.appendChild(button);list.appendChild(item);
 }
 nav.appendChild(list);
 const body=document.getElementById('details-body');
 if(body.prepend)body.prepend(nav);else body.appendChild(nav);
}

async function ensureStatisticalGeometry(jurisdiction){
 if(statisticalGeometryLoaded.has(jurisdiction))return;
 const descriptor=releaseData?.manifest?.public_contract?.statistical_geometry?.[jurisdiction];
 if(!descriptor?.path)throw new Error('Lipsește geometria statistică publică pentru '+jurisdiction);
 const response=await fetch(descriptor.path,{cache:'no-cache'});
 if(!response.ok)throw new Error('Nu se poate încărca '+descriptor.path);
 const data=await response.json();
 if(data.metadata?.contract!=='actual-public-statistical-geometry-v1'||data.metadata?.jurisdiction!==jurisdiction)throw new Error('Geometrie statistică publică invalidă '+jurisdiction);
 for(const feature of data.features||[]){
  const id=feature.properties?.entity_id;
  if(geometryClass(entityById.get(id))!=='statistical_only')throw new Error('Geometrie statistică duplicată sau nevalidă: '+id);
  statisticalFeatureById.set(id,feature);
 }
 statisticalGeometryLoaded.add(jurisdiction);
 renderStatisticalGeometry(jurisdiction);
 if(!roots[jurisdiction].hasLayer(statisticalGroups[jurisdiction]))roots[jurisdiction].addLayer(statisticalGroups[jurisdiction]);
}

function tierPath(jurisdiction,tier){
 return releaseData?.manifest?.public_contract?.geometry_tiers?.[jurisdiction]?.[tier]?.path||null;
}
async function ensureTier(jurisdiction,tier){
 const key=jurisdiction+'_'+tier;
 if(tierData.has(key))return tierData.get(key);
 const path=tierPath(jurisdiction,tier);
 if(!path)throw new Error('Lipsește path-ul pentru '+key);
 const response=await fetch(path,{cache:'no-cache'});
 if(!response.ok)throw new Error('Nu se poate încărca '+path);
 const data=await response.json();
 if(data.metadata?.jurisdiction!==jurisdiction||data.metadata?.tier!==tier)throw new Error('Tier public inconsistent: '+key);
 tierData.set(key,data);
 renderTier(jurisdiction,tier);
 return data;
}

function renderCollection(group,data){
 if(!group||!data)return;
 group.clearLayers();
 L.geoJSON(data,{
  smoothFactor:0,
  filter:feature=>{
   const entity=entityById.get(feature.properties?.entity_id);
   return Boolean(entity&&isVisible(entity));
  },
  style:styleFor,
  onEachFeature:(feature,layer)=>{
   const id=feature.properties?.entity_id;
   const entity=entityById.get(id);
   if(!entity)return;
   layer.bindTooltip(entity.display_name,{sticky:true,className:'entity-tooltip'});
   layer.on('click',()=>selectEntity(id,{source:'map'},layer).catch(console.error));
   if(id===selectedEntityId){layer.setStyle(selectedStyle);selectedLayer=layer;}
  }
 }).addTo(group);
}
function renderTier(jurisdiction,tier){
 const key=jurisdiction+'_'+tier;
 renderCollection(tierGroups[key],tierData.get(key));
}
function renderChunk(key){
 renderCollection(chunkGroups.get(key),chunkData.get(key));
}
function renderStatisticalGeometry(jurisdiction){
 renderCollection(statisticalGroups[jurisdiction],{type:'FeatureCollection',features:[...statisticalFeatureById.values()].filter(feature=>entityById.get(feature.properties?.entity_id)?.jurisdiction===jurisdiction)});
}
function rerenderLoadedTiers(){
 selectedLayer=null;
 for(const jurisdiction of statisticalGeometryLoaded)renderStatisticalGeometry(jurisdiction);
 for(const key of tierData.keys()){
  const [jurisdiction,tier]=key.split('_');
  renderTier(jurisdiction,tier);
 }
 for(const key of chunkData.keys())renderChunk(key);
}
function overviewRootIdFor(entity){
 let cursor=entity,depth=0;
 while(cursor&&cursor.map?.tier!=='overview'&&depth++<32)cursor=entityById.get(cursor.hierarchy?.parent_catalog_id)||null;
 return cursor?.map?.tier==='overview'?cursor.id:null;
}
function chunkKey(entry){return entry.jurisdiction+'_'+entry.tier+'_'+entry.root_entity_id;}
function chunkEntries(jurisdiction,tier){
 return (chunkIndex?.chunks||[]).filter(entry=>entry.jurisdiction===jurisdiction&&entry.tier===tier);
}
function bboxIntersectsViewport(bbox){
 if(!Array.isArray(bbox)||bbox.length!==4)return false;
 return map.getBounds().intersects(L.latLngBounds([[bbox[1],bbox[0]],[bbox[3],bbox[2]]]));
}
async function ensureChunk(entry){
 const key=chunkKey(entry);
 if(chunkData.has(key))return chunkData.get(key);
 const response=await fetch(entry.path,{cache:'no-cache'});
 if(!response.ok)throw new Error('Nu se poate încărca '+entry.path);
 const data=await response.json();
 if(data.metadata?.jurisdiction!==entry.jurisdiction||data.metadata?.tier!==entry.tier||data.metadata?.root_entity_id!==entry.root_entity_id)throw new Error('Chunk public inconsistent: '+key);
 if(Number(data.metadata?.feature_count)!==Number(entry.feature_count))throw new Error('Chunk public cu cardinalitate inconsistentă: '+key);
 const group=L.layerGroup();
 chunkGroups.set(key,group);
 chunkData.set(key,data);
 renderChunk(key);
 return data;
}

function tierWanted(tier,zoom){
 if(tier==='overview')return true;
 if(tier==='local')return zoom>=7;
 return zoom>=10;
}
async function syncTiers(){
 if(!releaseData||!indexData)return;
 const zoom=map.getZoom();
 for(const jurisdiction of ['RO','MD']){
  const enabled=document.getElementById('layer-'+jurisdiction.toLowerCase())?.checked!==false;
  const overviewGroup=tierGroups[jurisdiction+'_overview'];
  if(enabled){
   await ensureTier(jurisdiction,'overview');
   if(!roots[jurisdiction].hasLayer(overviewGroup))roots[jurisdiction].addLayer(overviewGroup);
  }
  for(const tier of ['local','detail']){
   const legacyGroup=tierGroups[jurisdiction+'_'+tier];
   if(chunkIndex){
    if(roots[jurisdiction].hasLayer(legacyGroup))roots[jurisdiction].removeLayer(legacyGroup);
    const wanted=new Set();
    if(enabled&&tierWanted(tier,zoom)){
     for(const entry of chunkEntries(jurisdiction,tier)){
      const root=entityById.get(entry.root_entity_id);
      if(!root||!bboxIntersectsViewport(root.map?.bbox))continue;
      const key=chunkKey(entry);
      wanted.add(key);
      await ensureChunk(entry);
      const group=chunkGroups.get(key);
      if(group&&!roots[jurisdiction].hasLayer(group))roots[jurisdiction].addLayer(group);
     }
    }
    for(const [key,group] of chunkGroups){
     if(!key.startsWith(jurisdiction+'_'+tier+'_'))continue;
     if(!wanted.has(key)&&roots[jurisdiction].hasLayer(group))roots[jurisdiction].removeLayer(group);
    }
   }else{
    if(enabled&&tierWanted(tier,zoom)){
     await ensureTier(jurisdiction,tier);
     if(!roots[jurisdiction].hasLayer(legacyGroup))roots[jurisdiction].addLayer(legacyGroup);
    }else if(roots[jurisdiction].hasLayer(legacyGroup))roots[jurisdiction].removeLayer(legacyGroup);
   }
  }
 }
}

function clearSelection(){
 selectedEntityId=null;
 atlasTree?.clear();
 if(selectedLayer){selectedLayer.setStyle(styleFor(selectedLayer.feature));selectedLayer=null;}
 rerenderLoadedTiers();

 document.getElementById('details-title').textContent='Nicio selecție';
 document.getElementById('details-body').innerHTML='<p class="muted">Selectează o limită de pe hartă sau caută o entitate după nume ori identificator.</p>';
}

function detailRow(label,value){
 return '<dt>'+escapeHtml(label)+'</dt><dd>'+escapeHtml(value==null||value===''?'—':value)+'</dd>';
}
function renderDetails(entity){
 const title=document.getElementById('details-title');
 const body=document.getElementById('details-body');
 title.textContent=entity.display_name;
 const legal=entity.legal;
 const statisticalHtml=entity.statistical
  ?'<section class="details-section"><h3>Identitate statistică</h3><dl class="kv">'+
    detailRow('Clasificare',entity.statistical.classification)+detailRow('Versiune',entity.statistical.version)+detailRow('Cod',entity.statistical.code)+
    detailRow('Nivel',entity.statistical.level)+detailRow('Părinte statistic',entity.hierarchy?.statistical_parent_name)+
    detailRow('Autoritate',entity.statistical.identity_authority)+detailRow('Geometrie',entity.category==='statistical'?'limită statistică separată':'geometrie administrativă reutilizată')+
    '</dl></section>'
  :'';
 const legalHtml=legal
  ?'<section class="details-section"><h3>Identitate oficială</h3><dl class="kv">'+
    detailRow('Registru',legal.registry)+detailRow('ID',legal.id)+detailRow('Denumire',legal.name)+detailRow('Tip juridic',legal.type?typeLabel(legal.type):null)+
    detailRow('Părinte legal',legal.parent_name)+detailRow('Metodă',legal.match_method)+detailRow('Încredere',legal.confidence)+
    '</dl></section>'
  :'<section class="details-section"><h3>Identitate oficială</h3><p class="muted">Nu este atașată o identitate juridică pozitivă acestei reprezentări în contractul public ACTUAL.</p></section>';
 body.innerHTML=
  '<section class="details-section"><span class="tag'+(entity.validation.legal_identity_status==='unresolved'?' warning-tag':'')+'">'+escapeHtml(statusLabels[entity.validation.legal_identity_status]||entity.validation.legal_identity_status)+'</span><dl class="kv" style="margin-top:10px">'+
  detailRow('Jurisdicție',entity.jurisdiction)+detailRow('Clasă geometrică',filterLabels[geometryClass(entity)]||'Limită statistică separată')+
  '</dl></section>'+
  '<p id="selection-visibility" class="hint"></p>'+legalHtml+statisticalHtml+
  '<section class="details-section"><h3>Reprezentare cartografică</h3><dl class="kv">'+
  detailRow('Sursă',entity.representation.source)+detailRow('Relație OSM',entity.representation.osm_relation_id)+detailRow('admin_level',entity.representation.admin_level)+
  detailRow('Tip reprezentare',typeLabel(entity.representation.inferred_type))+detailRow('Geometrie','coordonate master, fără simplificare')+
  detailRow('Încredere',entity.validation.representation_confidence)+
  '</dl><div class="details-actions"><a class="action-button" href="'+escapeHtml(entity.representation.source_url)+'" target="_blank" rel="noopener">Deschide în OSM</a><button type="button" class="action-button" id="zoom-selected">Zoom la entitate</button></div></section>';
 renderBreadcrumb(entity);
 const zoomButton=body.querySelector('#zoom-selected');
 if(zoomButton)zoomButton.addEventListener('click',()=>zoomToEntity(entity));
}

function zoomToEntity(entity){
 const b=entity.map?.bbox;
 if(Array.isArray(b)&&b.length===4)map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[30,30],maxZoom:12});
}
async function selectEntity(id,options=false,clickedLayer=null){
 const {zoom=false}=typeof options==='boolean'?{zoom:options}:options;
 const entity=entityById.get(id);
 if(!entity)return;
 // Validate and materialize the consolidated path before updating selection.
 try{atlasTree?.select(id);}catch(error){
  console.error('Atlas selection failed for '+id,error);
  const status=document.getElementById('hierarchy-error');
  if(status)status.textContent='Ierarhie indisponibilă pentru '+id;
  throw error;
 }
 const status=document.getElementById('hierarchy-error');
 if(status)status.textContent='';
 if(selectedLayer){selectedLayer.setStyle(styleFor(selectedLayer.feature));selectedLayer=null;}
 selectedEntityId=id;
 renderDetails(entity);
 updateSelectionVisibility();
 rerenderLoadedTiers();
 if(!isVisible(entity))return;
 if(zoom)zoomToEntity(entity);
 const checkbox=document.getElementById('layer-'+entity.jurisdiction.toLowerCase());
 if(checkbox&&!checkbox.checked){checkbox.checked=true;roots[entity.jurisdiction].addTo(map);}
 if(entity.category==='statistical'){
  await ensureStatisticalGeometry(entity.jurisdiction);
  const feature=statisticalFeatureById.get(entity.id);
  if(!feature)throw new Error('Lipsește geometria statistică pentru '+entity.id);
  if(selectedEntityId!==id||!isVisible(entity))return;
  renderStatisticalGeometry(entity.jurisdiction);
  return;
 }
 if(entity.map.tier==='overview'||!chunkIndex)await ensureTier(entity.jurisdiction,entity.map.tier);
 else{
  const rootId=overviewRootIdFor(entity);
  const entry=chunkEntries(entity.jurisdiction,entity.map.tier).find(item=>item.root_entity_id===rootId);
  if(!entry)throw new Error('Lipsește chunk-ul pentru '+entity.id);
  await ensureChunk(entry);
 }
 await syncTiers();
 if(selectedEntityId!==id||!isVisible(entity))return;
 for(const group of [...Object.values(tierGroups),...chunkGroups.values(),...Object.values(statisticalGroups)]){
  group.eachLayer(container=>{
   const inspect=layer=>{
    if(layer.feature?.properties?.entity_id===id){layer.setStyle(selectedStyle);selectedLayer=layer;}
   };
   if(typeof container.eachLayer==='function')container.eachLayer(inspect);else inspect(container);
  });
 }
}

document.getElementById('details-close').addEventListener('click',clearSelection);
document.getElementById('layer-ro').addEventListener('change',event=>{event.target.checked?roots.RO.addTo(map):map.removeLayer(roots.RO);syncTiers().catch(console.error);});
document.getElementById('layer-md').addEventListener('change',event=>{event.target.checked?roots.MD.addTo(map):map.removeLayer(roots.MD);syncTiers().catch(console.error);});
map.on('zoomend moveend',()=>syncTiers().catch(console.error));

const frontendReady=(async()=>{
 try{
  await loadIndex();
  await loadHierarchyTree();
  await loadChunkIndex();
  await Promise.all(['RO','MD'].map(ensureStatisticalGeometry));
  await Promise.all([ensureTier('RO','overview'),ensureTier('MD','overview')]);
  await syncTiers();
 }catch(e){
  console.error('Inițializarea modulului ACTUAL a eșuat',e);
  document.getElementById('filter-list').innerHTML='<p class="muted">Datele ACTUAL nu au putut fi validate.</p>';
 }
})();

export {frontendReady,entityById,activeFilterGroups,activeStatisticalLevels,statisticalFeatureById,statisticalGeometryLoaded,statisticalGroups,selectedEntityId,selectEntity,clearSelection,hierarchyNodeById,renderCollection,ensureStatisticalGeometry,refreshGeometryVisibility,setSeparateStatisticalGeometry};
