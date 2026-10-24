import {fetchNistreniaAdministrativeModel} from './atlas-nistrenia-administrative.mjs';
import {createAtlasExport} from './atlas-export-ui.mjs';
import {mapSvg,printSvg} from './atlas-export-visual.mjs';
import {legendEntries} from './atlas-presentation.mjs';
import {createGeometryResources} from './atlas-geometry-resources.mjs';
import {validateOsmRolesCatalog,renderOsmRoleDetails} from './atlas-osm-roles.mjs';
import {validateNistreniaOsmNavigation} from './atlas-nistrenia-osm.mjs';
import {createNistreniaAdministrativeView,nistreniaSearchEntities,NISTR_EN_ROOT} from './atlas-nistrenia-jurisdiction.mjs';
import {fetchVerifiedNistreniaOutlines,createNistreniaOutlineLayers,niOutlineIds} from './atlas-nistrenia-outlines.mjs';
export {atlasMeasure,geometricClient,geometricUi};
import {createPointIdentifier} from './atlas-point-identification.mjs';
import {createAtlasIdentify} from './atlas-identify-ui.mjs';
import {createNeighbors} from './atlas-neighbors.mjs';
import {createAtlasNeighbors} from './atlas-neighbors-ui.mjs';
import {createGeometricClient} from './atlas-geometric-client.mjs';
import {createGeometricUi} from './atlas-geometric-ui.mjs';
import {createAtlasMeasure} from './atlas-measure-ui.mjs';
import {createAtlasLayout} from './atlas-layout.mjs';
import {createAtlasPreview} from './atlas-preview.mjs';
import {entityGeometryStyle,selectedStyle,renderLegend,renderGlobalProvenance,entityProvenanceHtml,labelMapControls,wireAtlasSkipLinks} from './atlas-presentation.mjs';
import {createAtlasMobileUi} from './atlas-mobile-ui.mjs';
import {createAtlasExplorerShell} from './atlas-explorer-shell.mjs';
import {createAtlasPanels} from './atlas-panels.mjs';
import {createAtlasAdvancedNavigation} from './atlas-advanced-navigation.mjs';
import {createAtlasShare} from './atlas-share.mjs';
import {createAtlasUrlState,createUrlConfig,defaultViewport} from './atlas-url-state.mjs';
import {fitRoMd,attachRoMdZoomControl} from './atlas-ro-md-fit.mjs';
import {createAtlasSearch,createSearchIndex,typeLabel} from './atlas-search.mjs';
import {createAtlasFilters} from './atlas-filters.mjs';
import {ancestorPath,createAtlasTree} from './atlas-tree.mjs';
import {osmLevelForTreeNode} from './atlas-osm-admin-badges.mjs';
import {OSM_ADMIN_LEVELS,OSM_UNKNOWN,allOsmLevelFilters,osmTreeVisibleIds,osmTreeFilterSummary} from './atlas-osm-admin-filter.mjs';
import {planOsmLevelGeometryAction,applyOsmLevelGeometryAction,undoOsmLevelGeometryAction} from './atlas-osm-level-geometry-actions.mjs';
import {validateConsolidatedHierarchy} from './atlas-hierarchy-validate.mjs';
import {formatEntityName} from './atlas-name-format.mjs';
import {geometryClass,geometrySubtype,geometryVisible,geometryLabels,geometrySubtypeLabels,createGeometryFilterIndex} from './geometry-taxonomy.mjs';

const atlasLayout=createAtlasLayout({document,browser:globalThis.window});
const map=L.map('map',{zoomControl:true,trackResize:false,minZoom:0,maxZoom:19}).setView([46.8,26.6],6);
// Install each native Leaflet corner once; responsive CSS moves the same command group.
map.zoomControl?.setPosition?.('bottomright');
map.attributionControl?.setPosition?.('topright');
let osmBasemapVisible=true;
const statisticalPane=map.createPane?.('statistical-boundaries');
if(statisticalPane?.style)statisticalPane.style.zIndex='450';
const osmTiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors · ODbL'}).addTo(map);
function setOsmBasemapVisible(value){
 const visible=Boolean(value);
 if(visible!==osmBasemapVisible){if(visible)osmTiles.addTo(map);else map.removeLayer(osmTiles);osmBasemapVisible=visible;}
 const button=document.getElementById('basemap-toggle');
 if(button){button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Fundal OpenStreetMap activ. Dezactivează fundalul':'Fundal OpenStreetMap dezactivat. Activează fundalul');button.setAttribute('title',visible?'Dezactivează fundalul OpenStreetMap':'Activează fundalul OpenStreetMap');}
}
L.control.scale({position:'topleft',imperial:false,maxWidth:100}).addTo(map);
labelMapControls(document);
attachRoMdZoomControl(document,L);
const neighborsClearButton=document.getElementById('neighbors-map-clear');
if(neighborsClearButton&&document.nodeType===9){L.DomEvent.disableClickPropagation(neighborsClearButton);L.DomEvent.disableScrollPropagation?.(neighborsClearButton);}
atlasLayout.observeMapAnnotations();


const roots={RO:L.layerGroup().addTo(map),MD:L.layerGroup().addTo(map)};
const tiers=['overview','local','detail'];
const tierGroups=Object.fromEntries(['RO','MD'].flatMap(j=>tiers.map(t=>[j+'_'+t,L.layerGroup()])));
const tierData=new Map();
const chunkData=new Map();
const chunkGroups=new Map();
const geometryRequests=new Map();
const geometryPathAllowlist=new Set();
const geometricSourceDescriptors=new Map();
const geometryResources=createGeometryResources({fetch:(...args)=>fetch(...args),allowPath:path=>geometryPathAllowlist.has(path),getDescriptor:path=>document.nodeType===9?geometricSourceDescriptors.get(path):null});
let pointIdentifier=null;
let atlasIdentify=null;
let neighborsEngine=null;
let atlasNeighbors=null;
let atlasMeasure=null;
let geometricUi=null;
const geometricClient=createGeometricClient({feature:id=>{if(!neighborsEngine)throw Error('Index geometric indisponibil');return neighborsEngine.feature(id);},pairRelation:(a,b)=>neighborsEngine.pairRelation(a,b)});
let geometrySyncRevision=0;
// Selection and viewport sync share in-flight requests; failed loads remain retryable.
function geometryRequest(key,load){
 if(geometryRequests.has(key))return geometryRequests.get(key);
 const pending=load().finally(()=>geometryRequests.delete(key));
 geometryRequests.set(key,pending);return pending;
}
let chunkIndex=null;
const entityById=new Map();
let osmRoleById=new Map();
let nistreniaCatalog=null;
let nistreniaView=null;
let nistreniaAdministrativeModel=null;
let nistreniaOutlineFeatures=null;
let nistreniaOutlineProof=null;
let nistreniaOutlines=null;
const visibleOperationalOutlineIds=new Set(); // OSM-only independent outline checkboxes, never ACTUAL IDs.
const activeFilterGroups=new Set(Object.keys(geometryLabels));
const activeGeometryClasses=activeFilterGroups; // Compatibility alias, not a second class state.
const activeGeometrySubtypes=new Set(Object.keys(geometrySubtypeLabels));
let geometryFilterIndex=null;
let atlasFilters=null;
let lastOsmLevelGeometryAction=null;
let filtersPanelOpen=false;
let navigationTab='entities';
function setNavigationTab(tab){
 navigationTab=tab==='results'?'results':'entities';
 atlasPanels.open(navigationTab==='results'?'search':'entities',{focus:false});
}
function setFiltersPanelOpen(value,{restoreFocus=false}={}){
 if(value)atlasPanels.open('filters');
 else if(atlasPanels.state.active==='filters'){
  if(atlasPanels.state.mobile)atlasPanels.close({focus:restoreFocus});
  else atlasPanels.open('entities',{focus:restoreFocus});
 }
}
function updateFilterCount(){
 const count=document.getElementById('filters-count');if(!count)return;
 const inactive=(geometryFilterIndex?.groups||[]).filter(group=>!activeGeometryClasses.has(group.id)).length+
  [...geometryFilterIndex?.subtypeMembers?.keys?.()||[]].filter(id=>!activeGeometrySubtypes.has(id)).length+
  [1,2,3,'unclassified'].filter(level=>!activeStatisticalLevels.has(level)).length+
  [...OSM_ADMIN_LEVELS,OSM_UNKNOWN].filter(level=>!activeOsmAdminLevels.has(level)).length+
  ['RO','MD'].filter(j=>document.getElementById('layer-'+j.toLowerCase())?.checked===false).length+
  Number(Boolean(nistreniaView&&!document.getElementById('layer-ni')?.checked))+
  Number(!separateStatisticalGeometry);
 count.textContent=inactive?'('+inactive+' '+(inactive===1?'dezactivat':'dezactivate')+')':'';
 const reset=document.getElementById('filters-reset');if(reset)reset.disabled=inactive===0;
}
const activeStatisticalLevels=new Set([1,2,3,'unclassified']);
const activeOsmAdminLevels=allOsmLevelFilters();
let separateStatisticalGeometry=true;
const statisticalGroups={RO:L.layerGroup(),MD:L.layerGroup()};
let selectedEntityId=null;
let selectedLayer=null;
let indexData=null;
let releaseData=null;
let hierarchyTree=null;
const hierarchyNodeById=new Map();
const visibleEntityIds=new Set(); // Explicit checkbox state; independent of taxonomy filters.
let atlasTree=null;
let atlasSearch=null;
let atlasUrl=null;
let atlasAdvanced=null;
let atlasShare=null;
function exportSource(id){
 const entity=entityById.get(id);if(!entity||!releaseData||!chunkIndex)return null;
 const contract=releaseData.manifest.public_contract;
 if(entity.category==='statistical')return contract.statistical_geometry?.[entity.jurisdiction]||null;
 if(entity.map?.tier==='overview')return contract.geometry_tiers?.[entity.jurisdiction]?.overview||null;
 let root=entity;const seen=new Set();while(root&&root.map?.tier!=='overview'&&!seen.has(root.id)){seen.add(root.id);root=entityById.get(root.hierarchy?.parent_catalog_id);}
 return chunkIndex.chunks.find(c=>c.jurisdiction===entity.jurisdiction&&c.tier===entity.map?.tier&&c.root_entity_id===root?.id)||null;
}
const atlasExport=createAtlasExport({document,getManifest:()=>releaseData?.manifest,getEntity:id=>entityById.get(id),getSource:exportSource,readFeature:async id=>{
 const source=exportSource(id);if(!source?.sha256)throw Error('Geometrie ACTUAL neverificabilă');
 const data=await geometryResources.read(source.path);const matches=data.features.filter(f=>f.properties?.entity_id===id);
 if(matches.length!==1)throw Error('Identitate geometrică absentă sau duplicată');await geometricClient.metrics(id);return matches[0];
},getCurrentUrl:()=>globalThis.location.href,getMetrics:id=>geometricClient.peekMetrics(id),getMeasurement:()=>atlasMeasure?.state,
getVisual:()=>mapSvg({map,L,snapshotId:releaseData?.manifest.snapshot_id,selection:[selectedEntityId,...atlasAdvanced?.state.pair||[]].filter((id,i,a)=>id&&a.indexOf(id)===i).map(id=>entityById.get(id)?.display_name||id),legend:legendEntries([...entityById.values()])}),
printVisual:(svg,orientation)=>printSvg(document,svg,orientation)});
if(document.nodeType===9){atlasExport.measurement();atlasExport.visual();}
const mobileMedia=atlasLayout.media;
const atlasPanels=createAtlasPanels({document,media:mobileMedia,isSearchOpen:()=>Boolean(atlasSearch?.state.open)});
atlasPanels.onChange(({active})=>{
 filtersPanelOpen=active==='filters';navigationTab=active==='search'?'results':'entities';
 if(active==='entities')atlasTree?.revealSelected();
 if(active==='share')atlasShare?.refresh();
 resizeMapPreservingView();
});
const atlasExplorerShell=createAtlasExplorerShell({document,map,window:globalThis.window,media:atlasLayout.media,layout:atlasLayout,panels:atlasPanels,onResize:resizeMapPreservingView});
document.querySelector?.('[data-mode=actual]')?.addEventListener('click',()=>atlasPanels.close());
const atlasMobile=createAtlasMobileUi({document,media:mobileMedia,panels:atlasPanels,onClear:clearSelection});
wireAtlasSkipLinks({document,mobile:atlasMobile});
atlasIdentify=createAtlasIdentify({document,browser:globalThis.window,panels:atlasPanels,
 identify:(lon,lat)=>{if(!pointIdentifier)throw Error('Indexul geometric ACTUAL nu este disponibil.');return pointIdentifier.identify(lon,lat);},
 getTreeScroll:()=>document.getElementById('hierarchy-tree').scrollTop,setTreeScroll:top=>{document.getElementById('hierarchy-tree').scrollTop=top;},getSelection:()=>selectedEntityId,
 cancel:()=>pointIdentifier?.cancel(),onDetails:id=>selectEntity(id,{source:'identify',zoom:false}),
 onCenter:point=>atlasUrl?atlasUrl.action('push',()=>map.panTo([point[1],point[0]],{animate:false})):map.panTo([point[1],point[0]],{animate:false}),
 canMark:point=>{const limit=map.options?.crs?.projection?.MAX_LATITUDE;return limit===undefined||Math.abs(point[1])<=limit;},
 mark:point=>L.circleMarker([point[1],point[0]],{radius:7,className:'identify-point-marker',color:'#9b1c1c',fillColor:'#fff',fillOpacity:1,weight:3,interactive:false,pane:'markerPane'}).addTo(map)});
map.on('click',event=>{if(atlasMeasure?.armed)atlasMeasure.fromMap(event.latlng);else if(atlasIdentify?.armed)atlasIdentify.fromMap(event.latlng);});
atlasNeighbors=createAtlasNeighbors({document,panels:atlasPanels,
 analyze:id=>{if(!neighborsEngine)throw Error('Indexul topologic ACTUAL nu este disponibil.');return neighborsEngine.analyze(id);},cancel:()=>neighborsEngine?.cancel(),
 feature:id=>neighborsEngine.feature(id),frontier:row=>neighborsEngine.frontier(row),
 highlight:(features,borders)=>L.geoJSON({type:'FeatureCollection',features},{interactive:false,style:{className:'neighbors-highlight',color:borders?'#941c1c':'#2457a7',weight:borders?5:3,fillColor:'#4479c2',fillOpacity:borders?0:.18}}).addTo(map),
 onDetails:id=>selectEntity(id,{source:'neighbors',zoom:false}),getTreeScroll:()=>document.getElementById('hierarchy-tree').scrollTop,setTreeScroll:top=>{document.getElementById('hierarchy-tree').scrollTop=top;},getSelection:()=>selectedEntityId});
if(document.nodeType===9){
 geometricUi=createGeometricUi({document,panels:atlasPanels,client:geometricClient,onExport:(target,report,ids,status)=>atlasExport.comparison(target,report,ids,status),highlight:(report,mode)=>{
  const group=L.layerGroup().addTo(map),add=(geometry,color,className,dashArray,weight=3,fillOpacity=.14)=>{if(geometry)L.geoJSON(geometry,{interactive:false,style:{color,fillColor:color,fillOpacity,className,dashArray,weight}}).addTo(group);};
  if(mode==='both'){add(report.features[0].geometry,'#174d89','comparison-A',null,1,0);add(report.features[1].geometry,'#ab5214','comparison-B','9 5',1,0);}
  if(mode==='both'||mode==='intersection')add(report.geometries.intersection,'#69409b','comparison-common',null,5);
  if(mode==='both'||mode==='differences'){add(report.geometries.exclusiveA,'#174d89','comparison-exclusive-A','2 5');add(report.geometries.exclusiveB,'#ab5214','comparison-exclusive-B','14 6');}
  return group;
 }});
 atlasMeasure=createAtlasMeasure({document,panels:atlasPanels,draw:(points,mode,finished)=>{const group=L.layerGroup().addTo(map),latlngs=[];let anchor=map.getCenter().lng;for(const p of points){const longitude=p[0]+360*Math.round((anchor-p[0])/360);latlngs.push([p[1],longitude]);anchor=longitude;}if(latlngs.length>1){if(mode==='area'&&finished)L.polygon(latlngs,{interactive:false,color:'#713c9b',fillOpacity:.15,dashArray:'8 4'}).addTo(group);else L.polyline(latlngs,{interactive:false,color:'#713c9b',dashArray:'8 4'}).addTo(group);}for(const p of latlngs)L.circleMarker(p,{interactive:false,radius:4,className:'measurement-point',color:'#713c9b',fillColor:'#fff',fillOpacity:1}).addTo(group);return group;}});
 const command=document.getElementById('measure-map-command');if(command){L.DomEvent.disableClickPropagation(command);L.DomEvent.disableScrollPropagation?.(command);}
 const comparisonLegend=document.getElementById('comparison-map-legend');if(comparisonLegend){L.DomEvent.disableClickPropagation(comparisonLegend);L.DomEvent.disableScrollPropagation?.(comparisonLegend);}
}

function resizeMapPreservingView(){
 if(!map.invalidateSize)return;
 const element=document.getElementById('map'),old=map.getSize?.();
 if(old&&old.x===element.clientWidth&&old.y===element.clientHeight)return;
 const center=map.getCenter(),zoom=map.getZoom();
 queueMicrotask(()=>{
  const resize=()=>{map.invalidateSize({animate:false,pan:false});map.setView([center.lat,center.lng],zoom,{animate:false,reset:true});};
  if(atlasUrl)void atlasUrl.action('replace',resize);else resize();
 });
}
atlasLayout.onResize(()=>{resizeMapPreservingView();atlasMobile.ensureFocusVisible();});
const atlasPreview=createAtlasPreview({document,layout:atlasLayout,browser:globalThis.window});
const statisticalFeatureById=new Map();
const statisticalGeometryLoaded=new Set();


const filterLabels=geometryLabels;
const statusLabels={
 statistical_identity:'identitate statistică oficială',
 reconciled:'identitate oficială reconciliată',
 outside_current_legal_registry:'reprezentare în afara registrului legal curent',
 reviewed_representation_without_legal_identity:'reprezentare de-facto auditată, fără geometrie juridică atribuită',
 unresolved:'identitate oficială nerezolvată',
 not_bound_to_official_registry:'fără legătură cu registrul oficial în contract'
};

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function filterGroup(entity){return geometryClass(entity);}
function jurisdictionChecked(j){const input=document.getElementById('layer-'+String(j||'md').toLowerCase());return j==='NI'?Boolean(input?.checked&&!input.disabled):input?.checked!==false;}
function operationalJurisdiction(entity){return nistreniaView?.roleIds.has(entity?.id)?'NI':entity?.jurisdiction;}
function isVisible(entity){
 return Boolean(entity&&visibleEntityIds.has(entity.id)&&jurisdictionChecked(operationalJurisdiction(entity))&&geometryVisible(entity,{geometryClasses:activeFilterGroups,geometrySubtypes:activeGeometrySubtypes,statisticalLevels:activeStatisticalLevels,separateStatisticalGeometry}));
}
function syncJurisdictionRoots(){
 if(jurisdictionChecked('RO'))roots.RO.addTo(map);else map.removeLayer(roots.RO);
 if(jurisdictionChecked('MD')||jurisdictionChecked('NI'))roots.MD.addTo(map);else map.removeLayer(roots.MD);
 nistreniaOutlines?.sync(visibleOperationalOutlineIds,jurisdictionChecked('NI'));
}
function enableNistreniaOperational(){
 const input=document.getElementById('layer-ni');
 if(!input||!nistreniaView)throw Error('Nistrenia OSM: catalog operațional nevalidat');
 input.checked=true;syncJurisdictionRoots();updateFilterCount();
}
function styleFor(feature){return entityGeometryStyle(entityById.get(feature.properties?.entity_id));}

const actualReleasePromise=(async()=>{
 const status=document.getElementById('actual-release-status');
 try{
  const [manifestResponse,gateResponse,buildInfoResponse]=await Promise.all([
   fetch('data/current/actual-release-manifest.json',{cache:'no-cache'}),
   fetch('data/current/actual-release-gate.json',{cache:'no-cache'}),
   fetch('public/data/app-build-info.json',{cache:'no-cache'}).catch(()=>({ok:false}))
  ]);
  if(!manifestResponse.ok||!gateResponse.ok)throw new Error('Release ACTUAL indisponibil');
  const [manifest,gate,buildInfo]=await Promise.all([
   manifestResponse.json(),gateResponse.json(),buildInfoResponse.ok?buildInfoResponse.json().catch(()=>null):Promise.resolve(null)
  ]);
  if(gate.status!=='PASS')throw new Error('Release ACTUAL nu a trecut gate-ul combinat');
  if(!manifest.snapshot_id||gate.snapshot_id!==manifest.snapshot_id)throw new Error('Manifestul ACTUAL nu corespunde gate-ului');
  if(!['actual-public-entity-v1','actual-public-entity-v2','actual-public-entity-v3'].includes(manifest.public_contract?.contract))throw new Error('Contractul public ACTUAL lipsește din manifest');
  releaseData={manifest,gate,buildInfo};
  for(const descriptor of [...Object.values(manifest.public_contract.geometry_tiers||{}).flatMap(tiers=>Object.values(tiers)),...Object.values(manifest.public_contract.statistical_geometry||{})])if(typeof descriptor?.path==='string'){geometryPathAllowlist.add(descriptor.path);geometricSourceDescriptors.set(descriptor.path,{sha256:descriptor.sha256});}
  const provenance=renderGlobalProvenance({container:document.getElementById('global-provenance'),document,...releaseData});
  if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='ACTUAL curent: '+manifest.snapshot_id+' · gate '+gate.status+' · publicat: '+(provenance.publication?.tag||'neconfirmat pentru acest snapshot');}
  return releaseData;
 }catch(e){
  if(status){status.setAttribute('role','alert');status.setAttribute('aria-live','assertive');status.textContent='ACTUAL: release indisponibil sau nevalidat. Datele nu au fost activate.';}
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
 geometryFilterIndex=createGeometryFilterIndex(index.entities||[]);
 for(const subtype of geometryFilterIndex.subtypeMembers.keys())activeGeometrySubtypes.add(subtype);
 renderFilters();
 renderLegend({container:document.getElementById('atlas-legend'),document,entities:index.entities});
 renderGlobalProvenance({container:document.getElementById('global-provenance'),document,...releaseData,index});
 wireSearch();
 updateJurisdictionStatus();
 return index;
}

async function loadOsmRoleCatalog(){
 // Independent OSM metadata; no extra geometries, legal hierarchy or sovereign state.
 const response=await fetch('public/data/p907216-osm-roles.json',{cache:'no-cache'});
 if(!response.ok)throw Error('Catalogul descriptiv OSM nu este disponibil');
 const verified=validateOsmRolesCatalog(await response.json(),entityById,{
  snapshotId:releaseData.manifest.snapshot_id,
  releaseFingerprint:releaseData.manifest.release_fingerprint_sha256
 });
 osmRoleById=verified;
 return verified;
}
async function loadNistreniaOsmNavigation(){
 const response=await fetch('public/data/p909-nistrenia-osm-navigation.json',{cache:'no-cache'});
 if(!response.ok)throw Error('Gruparea OSM Nistrenia indisponibilă');
 const catalog=await response.json();
 // This validated source contract still drives the Nistrenia tree; only its duplicate presentation is removed.
 validateNistreniaOsmNavigation(catalog,osmRoleById);
 nistreniaCatalog=catalog;
 return catalog;
}
async function loadChunkIndex(){
 const path=releaseData?.manifest?.public_contract?.geometry_chunks?.path;
 if(!path)return null;
 const response=await fetch(path,{cache:'no-cache'});
 if(!response.ok)throw new Error('Indexul chunk-urilor geometrice ACTUAL este indisponibil');
 const data=await response.json();
 if(data.contract!=='actual-public-geometry-chunks-v1'||data.chunk_count!==(data.chunks||[]).length)throw new Error('Index chunk-uri ACTUAL invalid');
 chunkIndex=data;
 for(const entry of data.chunks||[])if(typeof entry.path==='string'){geometryPathAllowlist.add(entry.path);geometricSourceDescriptors.set(entry.path,{sha256:entry.sha256,bytes:entry.bytes});}
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
 const state={geometryClasses:activeGeometryClasses,geometrySubtypes:activeGeometrySubtypes,statisticalLevels:activeStatisticalLevels,osmAdminLevels:activeOsmAdminLevels,
  get separateStatisticalGeometry(){return separateStatisticalGeometry;}};
 atlasFilters=createAtlasFilters({container:document.getElementById('filter-list'),document,index:geometryFilterIndex,state,
  onSeparate:setSeparateStatisticalGeometry,onChange:()=>{refreshOsmAdminTree();refreshGeometryVisibility();atlasUrl?.commit('push');},
  onOsmGeometryPreview:(mode,levels)=>hierarchyTree?planOsmLevelGeometryAction({mode,levels,nodeById:nistreniaView?.nodes||hierarchyNodeById,entityById,osmRoleById,outlineIds:new Set(nistreniaOutlines?niOutlineIds:[]),visibleEntityIds,visibleOperationalOutlineIds}):null,
  onOsmGeometryApply:plan=>{const transaction=applyOsmLevelGeometryAction(plan,{visibleEntityIds,visibleOperationalOutlineIds});lastOsmLevelGeometryAction=transaction;refreshGeometryVisibility();syncTiers().catch(console.error);atlasUrl?.commit('push');return {message:'Au fost modificate '+transaction.changes.length+' bife geometrice. Filtrele și selecția au rămas neschimbate.'};},
  onOsmGeometryUndo:()=>{if(!lastOsmLevelGeometryAction)return {message:'Nu există o operațiune de anulat.'};const result=undoOsmLevelGeometryAction(lastOsmLevelGeometryAction,{visibleEntityIds,visibleOperationalOutlineIds});lastOsmLevelGeometryAction=null;refreshGeometryVisibility();syncTiers().catch(console.error);atlasUrl?.commit('push');return {message:'Restabilite '+result.reverted+' bife; '+result.conflicts+' modificări ulterioare păstrate.'};},
  canUndoOsmGeometry:()=>Boolean(lastOsmLevelGeometryAction)});
}
function setSeparateStatisticalGeometry(value){separateStatisticalGeometry=Boolean(value);}
// WEB-R2c.1.1: feedback reflects only validated full-tree node IDs, never checked polygons.
function osmTreeFeedback(summary){
 atlasFilters?.setOsmTreeSummary(summary);
 const empty=document.getElementById('hierarchy-empty');
 if(!empty)return;
 const none=summary.visibleIds.size===0;
 empty.hidden=!none;
 empty.textContent=none?(activeOsmAdminLevels.size===0
  ?'Niciun nivel OSM selectat. Arborele este gol, dar geometriile nu au fost șterse. Selectează un nivel sau apasă «Toate nivelurile în arbore».' 
  :'Nu există rânduri potrivite filtrelor curente. Modifică nivelurile OSM sau celelalte filtre.'):'';
}
function osmTreeSummary(){
 return osmTreeFilterSummary(nistreniaView?.nodes||hierarchyNodeById,nistreniaView?.rootIds||hierarchyTree.root_ids,activeOsmAdminLevels,{entityById,osmRoleById});
}
function refreshOsmAdminTree(){
 if(!atlasTree||!hierarchyTree)return;
 const summary=osmTreeSummary();
 const all=activeOsmAdminLevels.size===OSM_ADMIN_LEVELS.length+1;
 atlasTree.setVisibleIds(all?null:summary.visibleIds);
 osmTreeFeedback(summary);
}
function resetGlobalFilters(){
 activeOsmAdminLevels.clear();for(const level of [...OSM_ADMIN_LEVELS,OSM_UNKNOWN])activeOsmAdminLevels.add(level);
 activeGeometryClasses.clear();for(const id of Object.keys(geometryLabels))activeGeometryClasses.add(id);
 activeGeometrySubtypes.clear();for(const id of Object.keys(geometrySubtypeLabels))activeGeometrySubtypes.add(id);
 for(const id of geometryFilterIndex?.subtypeMembers?.keys?.()||[])activeGeometrySubtypes.add(id);
 activeStatisticalLevels.clear();for(const level of [1,2,3,'unclassified'])activeStatisticalLevels.add(level);
 setSeparateStatisticalGeometry(true);
 for(const jurisdiction of ['RO','MD']){
  const input=document.getElementById('layer-'+jurisdiction.toLowerCase());
  if(input)input.checked=true;
 }
 const niReset=document.getElementById('layer-ni');if(niReset)niReset.checked=Boolean(nistreniaView);
 syncJurisdictionRoots();
 refreshOsmAdminTree();refreshGeometryVisibility();syncTiers().catch(console.error);atlasUrl?.commit('push');
}
function refreshGeometryVisibility(){
 syncGeometryReset();
 atlasFilters?.sync();
 updateFilterCount();
 rerenderLoadedTiers();
 nistreniaOutlines?.sync(visibleOperationalOutlineIds,jurisdictionChecked('NI'));
 atlasTree?.refreshVisibility();
 updateSelectionVisibility();
 atlasAdvanced?.refresh();
}
function geometryResetDisabled(){
 return !hierarchyTree||(visibleEntityIds.size===hierarchyTree.root_ids.length&&hierarchyTree.root_ids.every(id=>visibleEntityIds.has(id))&&visibleOperationalOutlineIds.size===(nistreniaOutlines?1:0)&&(!nistreniaOutlines||visibleOperationalOutlineIds.has(NISTR_EN_ROOT)));
}
function syncGeometryReset(){
 // ARIA disabling preserves native keyboard focus after reset (disabled blurs).
 const disabled=geometryResetDisabled();
 for(const id of ['geometries-reset','map-geometries-reset'])document.getElementById(id)?.setAttribute('aria-disabled',String(disabled));
 if(!disabled)document.getElementById('geometries-reset-status').textContent='';
}
function resetGeometries(){
 if(geometryResetDisabled())return;
 lastOsmLevelGeometryAction=null;
 visibleEntityIds.clear();
 for(const id of hierarchyTree.root_ids)visibleEntityIds.add(id);
 visibleOperationalOutlineIds.clear();if(nistreniaOutlines)visibleOperationalOutlineIds.add(NISTR_EN_ROOT);
 refreshGeometryVisibility();
 syncTiers().catch(console.error);
 atlasUrl?.commit('push');
 document.getElementById('geometries-reset-status').textContent='Geometriile au fost resetate la România, Moldova și Nistrenia. Selecția și filtrele sunt păstrate.';
}
for(const id of ['geometries-reset','map-geometries-reset'])document.getElementById(id)?.addEventListener('click',resetGeometries);
function updateSelectionVisibility(){
 const ownOutline=nistreniaOutlines?.has(selectedEntityId);
 const entity=nistreniaView?.isVirtual(selectedEntityId)?nistreniaView.nodes.get(selectedEntityId):entityById.get(selectedEntityId);
 const status=document.getElementById('selection-visibility');
 const action=document.getElementById('selection-visibility-action');
 if(!status)return;
 if(action)action.hidden=true;
 if(!entity){status.textContent='';return;}
 if(!ownOutline&&!entity.map?.bbox){status.textContent='Această înregistrare nu are un contur propriu certificat. Consultați separat eventualele referințe OSM.';return;}
 const checked=(ownOutline?visibleOperationalOutlineIds:visibleEntityIds).has(entity.id);
 const jurisdictionAllowed=jurisdictionChecked(ownOutline?'NI':operationalJurisdiction(entity));
 if((ownOutline?checked:isVisible(entity))&&jurisdictionAllowed){status.textContent='';return;}
 if(!checked){
  status.textContent='Geometria este ascunsă. Activează explicit această entitate pentru afișare; filtrele rămân independente.';
  if(action){action.hidden=false;action.textContent='Afișează geometria';action.dataset.action='show';}
 }else{
  status.textContent='Geometria este ascunsă de filtre. Selecția și detaliile rămân disponibile.';
  if(action){action.hidden=false;action.textContent='Deschide filtrele';action.dataset.action='filters';}
 }
}

function searchEntitiesWithNistrenia(){
 return [...entityById.values(),...nistreniaSearchEntities(nistreniaView,entityById)];
}
function renderNistreniaDetails(id){
 const node=nistreniaView.nodes.get(id),parent=nistreniaView.nodes.get(node.parent_id);
 const types={root:'Jurisdicție virtuală',raion:'Raion',upper_city:'Oraș distinct',council:'Consiliu sătesc',place:'Localitate'};
 const statuses={GEOMETRY_VERIFIED:'Contur OSM verificat în snapshotul conservat',GEOMETRY_CANDIDATE:'Corespondență geometrică propusă; identitatea nu este certificată',NO_GEOMETRY_EVIDENCE:'Fără geometrie individuală probată',TOPOLOGY_CONFLICT:'Conflict topologic'};
 document.getElementById('details-title').textContent=node.display_name;
 document.getElementById('details-summary').textContent=types[node.kind]+' · organizare declarată în 2023';
 const resources=node.kind==='root'?[...nistreniaView.roleIds]:node.geometry_candidates;
 const resourceRows=resources.map(ref=>{
  const actual=entityById.get(ref),source=nistreniaView.resources.get(ref),role=osmRoleById.get(ref);
  const legalParent=entityById.get(actual.hierarchy?.consolidated_parent_id)?.display_name;
  const geometricParent=[...nistreniaView.resources.values()].find(x=>x.osm_relation_id===source.geometric_osm_parent_id)?.display_name;
  return '<li><strong>'+escapeHtml(actual.display_name)+'</strong> · '+escapeHtml(role?.role_label||'Rol cartografic OSM')+'<p>OSM '+source.osm_relation_id+' · nivel '+escapeHtml(String(source.osm_admin_level??'nedocumentat'))+' · versiunea '+source.osm_version+' · '+escapeHtml(source.osm_timestamp)+'</p>'+(legalParent?'<p>Părinte oficial MD păstrat: '+escapeHtml(legalParent)+'.</p>':'')+(geometricParent?'<p>Grupare geometrică OSM: '+escapeHtml(geometricParent)+'; nu stabilește apartenența administrativă sau controlul efectiv.</p>':'')+'<p><a href="https://www.openstreetmap.org/relation/'+source.osm_relation_id+'" target="_blank" rel="noopener noreferrer">Relația OSM</a> · <button type="button" data-ni-resource="'+escapeHtml(ref)+'">'+(visibleEntityIds.has(ref)?'Ascunde':'Arată')+' conturul OSM</button></p></li>';
 }).join('');
 const outline=nistreniaOutlineProof.relations.find(item=>item.id===id);
 document.getElementById('details-body').innerHTML='<section class="details-section"><h3>Organizare administrativă documentată</h3><p>'+escapeHtml(node.temporal_notice)+'</p>'+detailRow('Părinte documentar',parent?.display_name||'—')+detailRow('Geometrie',statuses[node.geometry_status])+detailRow('Statut documentar','Confirmat numai pentru sursa din 2023; actualizare contemporană provizorie')+'<p>Prezentare descriptivă separată de organizarea juridică a Republicii Moldova. Apartenența declarată și conturul OSM nu demonstrează controlul efectiv sau o jurisdicție juridică nouă.</p>'+detailRow('Referințe în anexă',node.source_refs.join(', ')||'Anexa integrală')+'<p><a href="https://github.com/ovidiudeica/reforma-teritoriala/blob/447f9bdbca5eb2869d107641a14398f7a273165e/docs/evidence/ni-jur-independent-20261020/documentary/PMR-ATD-ANNEX1-133268-text.json" target="_blank" rel="noopener noreferrer">Anexa documentară conservată</a></p>'+(outline?'<p>Contur OSM '+outline.osm_relation_id+' · versiunea '+outline.relation_version+' · '+escapeHtml(outline.relation_timestamp)+' · © OpenStreetMap contributors, ODbL.</p>':'')+'</section>'+(resourceRows?'<section class="details-section"><h3>Contururi OSM de consultat separat</h3><p>Aceste referințe nu certifică poligonul administrativ al unității selectate.</p><ul>'+resourceRows+'</ul></section>':'')+(node.additional_md_name_candidates?.length?'<section class="details-section"><h3>Omonime în catalogul MD</h3><p>Potriviri nominale, fără confirmarea identității sau a geometriei.</p><ul>'+node.additional_md_name_candidates.map(x=>'<li>'+escapeHtml(x.display_name)+' · '+escapeHtml(x.official_md_parent||'')+' · '+escapeHtml(x.actual_id)+'</li>').join('')+'</ul></section>':'');
 for(const button of document.querySelectorAll('[data-ni-resource]'))button.addEventListener('click',()=>{
  const ref=button.dataset.niResource;if(!nistreniaView.roleIds.has(ref))return;
  if(visibleEntityIds.has(ref))visibleEntityIds.delete(ref);else visibleEntityIds.add(ref);
  refreshGeometryVisibility();syncTiers().catch(console.error);renderNistreniaDetails(id);atlasUrl?.commit('push');
 });
}
async function selectNistreniaNode(id,options={zoom:true,source:'tree'}){
 if(!nistreniaView?.isVirtual(id))return selectEntity(id,options);
 const actualId=nistreniaView.toActual.get(id);
 if(actualId){await selectEntity(actualId,options);atlasTree?.select(id);return;}
 const apply=()=>{
  if(!nistreniaView.nodes.has(id))throw Error('Nistrenia: administrative record unavailable '+id);
  atlasTree?.select(id);
  const changed=selectedEntityId!==id;selectedEntityId=id;
  if(selectedLayer){selectedLayer.setStyle(styleFor(selectedLayer.feature));selectedLayer=null;}
  document.getElementById('geometry-status').textContent='';
  atlasMobile.selection(id,{source:options.source});
  renderNistreniaDetails(id);if(changed)for(const key of ['details-panel','details-content','details-body'])document.getElementById(key).scrollTop=0;updateSelectionVisibility();rerenderLoadedTiers();
  if(nistreniaOutlines?.has(id))atlasAdvanced?.record(id);
  if(atlasPanels.state.active==='share')atlasShare?.refresh();
  // A parent name selects only its own UI/source identity, never its descendants.
  if(options.zoom!==false&&nistreniaOutlines?.has(id))map.fitBounds(nistreniaOutlines.bounds(id),{padding:[30,30],maxZoom:12,...(options.source==='url'?{animate:false}:{})});
 };
 return atlasUrl?atlasUrl.action('push',apply):apply();
}

function wireSearch(){
  const input=document.getElementById('entity-search');
  atlasSearch=createAtlasSearch({input,clearButton:document.getElementById('search-clear'),empty:document.getElementById('search-empty'),container:document.getElementById('search-results'),status:document.getElementById('search-status'),document,index:createSearchIndex([...entityById.values()],hierarchyNodeById),onSelect:async(id,options)=>{setFiltersPanelOpen(false);setNavigationTab('entities');if(nistreniaView?.isVirtual(id))await selectNistreniaNode(id,options);else await selectEntity(id,options);}});
  input.addEventListener('focus',()=>{if(filtersPanelOpen)setFiltersPanelOpen(false);});
  input.addEventListener('input',()=>{if(input.value.trim())setNavigationTab('results');else setNavigationTab('entities');});
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
 // Fail closed before changing any controller or exposing partially validated nodes.
 const validated=validateConsolidatedHierarchy(tree,entityById,{expectedCount:releaseData.manifest.public_contract.entity_count});
 hierarchyNodeById.clear();
 for(const [id,node] of validated)hierarchyNodeById.set(id,node);
 hierarchyTree=tree;
 nistreniaView=nistreniaCatalog&&nistreniaOutlineFeatures&&nistreniaAdministrativeModel?createNistreniaAdministrativeView({model:nistreniaAdministrativeModel,entityById,officialNodes:hierarchyNodeById,officialRoots:tree.root_ids}):null;
  if(nistreniaView){
   nistreniaOutlines=createNistreniaOutlineLayers({L,map,features:nistreniaOutlineFeatures,onSelect:id=>selectNistreniaNode(id,{zoom:false,source:'map'}).catch(console.error)});
   visibleOperationalOutlineIds.clear();visibleOperationalOutlineIds.add(NISTR_EN_ROOT);
  }
 const niFilter=document.getElementById('layer-ni');if(niFilter){niFilter.disabled=!nistreniaView;niFilter.title=nistreniaView?'Organizare declarată în 2023; actualizarea contemporană este provizorie.':'Prezentarea NI este indisponibilă: sursa nu a putut fi validată.';}
  visibleEntityIds.clear();
  for(const id of tree.root_ids)visibleEntityIds.add(id);
  renderHierarchyTree();
  syncGeometryReset();
 atlasSearch?.updateIndex(createSearchIndex(searchEntitiesWithNistrenia(),nistreniaView?.nodes||hierarchyNodeById));
 atlasAdvanced=createAtlasAdvancedNavigation({
  document,panels:atlasPanels,entities:[...entityById.values(),...(nistreniaView?niOutlineIds:[]).map(id=>{
    const node=nistreniaView.nodes.get(id),bounds=nistreniaOutlines.bounds(id),sw=bounds.getSouthWest(),ne=bounds.getNorthEast();
    return {...node,map:{bbox:[sw.lng,sw.lat,ne.lng,ne.lat]},representation:{inferred_type:node.display_type,osm_relation_id:nistreniaOutlineFeatures.get(id).properties.osm_relation_id}};
   })],getChecked:()=>new Set([...visibleEntityIds,...visibleOperationalOutlineIds]),
  storage:globalThis.window?.localStorage,
  onGeometricCompare:(target,ids)=>ids.some(id=>nistreniaOutlines?.has(id))?null:geometricUi?.compare(target,ids),
  onCheck:(id,checked)=>{
   if(nistreniaOutlines?.has(id)){if(checked)visibleOperationalOutlineIds.add(id);else visibleOperationalOutlineIds.delete(id);}
   else{if(!entityById.has(id))return;if(checked)visibleEntityIds.add(id);else visibleEntityIds.delete(id);}
   refreshGeometryVisibility();syncTiers().catch(console.error);atlasUrl?.commit('push');
  },
  onSelect:id=>(nistreniaOutlines?.has(id)?selectNistreniaNode(id,{zoom:true,source:'advanced'}):selectEntity(id,{zoom:true,source:'advanced'})),
  onZoomPair:entities=>{
   if(entities.length!==2||entities.some(entity=>!Array.isArray(entity?.map?.bbox)))return;
   const bounds=entities.map(entity=>entity.map.bbox);
   map.fitBounds([[Math.min(...bounds.map(b=>b[1])),Math.min(...bounds.map(b=>b[0]))],[Math.max(...bounds.map(b=>b[3])),Math.max(...bounds.map(b=>b[2]))]],{padding:[30,30],maxZoom:12});
  }
 });
 return tree;
}

function renderHierarchyTree(){
 const container=document.getElementById('hierarchy-tree');
 if(!container||!hierarchyTree)return;
 const isTreeGeometryVisible=id=>{
  if(nistreniaOutlines?.has(id))return visibleOperationalOutlineIds.has(id)&&jurisdictionChecked('NI');
  const entity=entityById.get(nistreniaView?.actualId(id)||id);
  return Boolean(entity&&isVisible(entity));
 };
 const isTreeChecked=id=>{
  if(nistreniaOutlines?.has(id))return visibleOperationalOutlineIds.has(id);
  return visibleEntityIds.has(nistreniaView?.actualId(id)||id);
 };
 atlasTree?.destroy();
 atlasTree=createAtlasTree({
  container,nodeById:nistreniaView?.nodes||hierarchyNodeById,rootIds:nistreniaView?.rootIds||hierarchyTree.root_ids,document,typeLabel,
  getOsmAdminLevel:node=>osmLevelForTreeNode(node,{entityById,osmRoleById}),
  visibleIds:activeOsmAdminLevels.size===OSM_ADMIN_LEVELS.length+1?null:osmTreeVisibleIds(nistreniaView?.nodes||hierarchyNodeById,nistreniaView?.rootIds||hierarchyTree.root_ids,activeOsmAdminLevels,{entityById,osmRoleById}),
  isGeometryAvailable:id=>Boolean(nistreniaOutlines?.has(id)||entityById.has(id)),
  isGeometryVisible:isTreeGeometryVisible,isEntityChecked:isTreeChecked,
  onVisibilityChange:(id,checked)=>{
   if(nistreniaOutlines?.has(id)){
    if(checked)visibleOperationalOutlineIds.add(id);else visibleOperationalOutlineIds.delete(id);
   }else{
    const actualId=nistreniaView?.toActual.get(id)||id;
    if(!entityById.has(actualId))return;
    if(checked)visibleEntityIds.add(actualId);else visibleEntityIds.delete(actualId);
   }
   syncJurisdictionRoots();refreshGeometryVisibility();syncTiers().catch(console.error);atlasUrl?.commit('push');
  },
  onDisclosureChange:()=>atlasUrl?.commit('replace'),
  onSelect:(id,options)=>(nistreniaView?.isVirtual(id)?selectNistreniaNode(id,options):selectEntity(id,options)).catch(console.error)
 });
 if(selectedEntityId){
  atlasTree.select(selectedEntityId);
  if(nistreniaView?.isVirtual(selectedEntityId))renderNistreniaDetails(selectedEntityId);else renderDetails(entityById.get(selectedEntityId));
  updateSelectionVisibility();
 }
 osmTreeFeedback(osmTreeSummary());
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
  button.type='button';button.className='parent-button';button.textContent=formatEntityName(node.display_name);
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
 return geometryRequest('statistical:'+jurisdiction,async()=>{
 const descriptor=releaseData?.manifest?.public_contract?.statistical_geometry?.[jurisdiction];
 // Clearing an already rendered jurisdiction is an explicit revalidation, not a cache hit.
 if([...statisticalFeatureById.keys()].some(id=>entityById.get(id)?.jurisdiction===jurisdiction))geometryResources.invalidate(descriptor?.path);
 if(!descriptor?.path)throw new Error('Lipsește geometria statistică publică pentru '+jurisdiction);
 const data=await geometryResources.read(descriptor.path);
 if(data.metadata?.contract!=='actual-public-statistical-geometry-v1'||data.metadata?.jurisdiction!==jurisdiction)throw new Error('Geometrie statistică publică invalidă '+jurisdiction);
 for(const feature of data.features||[]){
  const id=feature.properties?.entity_id;
  if(geometryClass(entityById.get(id))!=='statistical_only')throw new Error('Geometrie statistică duplicată sau nevalidă: '+id);
  statisticalFeatureById.set(id,feature);
 }
 statisticalGeometryLoaded.add(jurisdiction);
 renderStatisticalGeometry(jurisdiction);
 if(!roots[jurisdiction].hasLayer(statisticalGroups[jurisdiction]))roots[jurisdiction].addLayer(statisticalGroups[jurisdiction]);
 });
}

function tierPath(jurisdiction,tier){
 return releaseData?.manifest?.public_contract?.geometry_tiers?.[jurisdiction]?.[tier]?.path||null;
}
async function ensureTier(jurisdiction,tier){
 const key=jurisdiction+'_'+tier;
 if(tierData.has(key))return tierData.get(key);
 return geometryRequest('tier:'+key,async()=>{
 const path=tierPath(jurisdiction,tier);
 if(!path)throw new Error('Lipsește path-ul pentru '+key);
 const data=await geometryResources.read(path);
 if(data.metadata?.jurisdiction!==jurisdiction||data.metadata?.tier!==tier)throw new Error('Tier public inconsistent: '+key);
 tierData.set(key,data);
 renderTier(jurisdiction,tier);
 return data;
 });
}

function renderCollection(group,data,options={}){
 if(!group||!data)return;
 group.clearLayers();
 L.geoJSON(data,{
  ...options,
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
   layer.bindTooltip(formatEntityName(entity.display_name),{sticky:true,className:'entity-tooltip'});
   layer.on('click',event=>{if(atlasMeasure?.armed){atlasMeasure.fromMap(event.latlng);L.DomEvent.stopPropagation(event);return;}if(atlasIdentify?.armed){atlasIdentify.fromMap(event.latlng);L.DomEvent.stopPropagation(event);return;}selectEntity(id,{source:'map'},layer).catch(console.error);});
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
 renderCollection(statisticalGroups[jurisdiction],{type:'FeatureCollection',features:[...statisticalFeatureById.values()].filter(feature=>entityById.get(feature.properties?.entity_id)?.jurisdiction===jurisdiction)},{pane:'statistical-boundaries'});
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
function checkedChunkRoots(jurisdiction,tier){
 const roots=new Set();
 for(const id of visibleEntityIds){
  const entity=entityById.get(id);
  if(entity?.jurisdiction!==jurisdiction||entity.map?.tier!==tier)continue; // Filters hide rendering, never unload a checked entity's chunk.
  const root=overviewRootIdFor(entity);
  if(root)roots.add(root);
 }
 return roots;
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
 return geometryRequest('chunk:'+key,async()=>{
 const data=await geometryResources.read(entry.path);
 if(data.metadata?.jurisdiction!==entry.jurisdiction||data.metadata?.tier!==entry.tier||data.metadata?.root_entity_id!==entry.root_entity_id)throw new Error('Chunk public inconsistent: '+key);
 if(Number(data.metadata?.feature_count)!==Number(entry.feature_count))throw new Error('Chunk public cu cardinalitate inconsistentă: '+key);
 const group=L.layerGroup();
 chunkGroups.set(key,group);
 chunkData.set(key,data);
 renderChunk(key);
 return data;
 });
}

function tierWanted(tier,zoom){
 if(tier==='overview')return true;
 if(tier==='local')return zoom>=7;
 return zoom>=10;
}
async function syncTiers(){
 const revision=++geometrySyncRevision;
 if(!releaseData||!indexData)return;
 const zoom=map.getZoom();
 for(const jurisdiction of ['RO','MD']){
  const enabled=jurisdictionChecked(jurisdiction)||(jurisdiction==='MD'&&jurisdictionChecked('NI'));
  const overviewGroup=tierGroups[jurisdiction+'_overview'];
  if(enabled){
   await ensureTier(jurisdiction,'overview');
   if(revision!==geometrySyncRevision)return;
   if(!roots[jurisdiction].hasLayer(overviewGroup))roots[jurisdiction].addLayer(overviewGroup);
  }
  for(const tier of ['local','detail']){
   const legacyGroup=tierGroups[jurisdiction+'_'+tier];
   if(chunkIndex){
    if(roots[jurisdiction].hasLayer(legacyGroup))roots[jurisdiction].removeLayer(legacyGroup);
    const wanted=new Set();
    if(enabled&&tierWanted(tier,zoom)){
     const checkedRoots=checkedChunkRoots(jurisdiction,tier);
     for(const entry of chunkEntries(jurisdiction,tier)){
      if(!checkedRoots.has(entry.root_entity_id))continue;
      const root=entityById.get(entry.root_entity_id);
      if(!root||!bboxIntersectsViewport(root.map?.bbox))continue;
      const key=chunkKey(entry);
      wanted.add(key);
      await ensureChunk(entry);
      if(revision!==geometrySyncRevision)return;
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
     if(revision!==geometrySyncRevision)return;
     if(!roots[jurisdiction].hasLayer(legacyGroup))roots[jurisdiction].addLayer(legacyGroup);
    }else if(roots[jurisdiction].hasLayer(legacyGroup))roots[jurisdiction].removeLayer(legacyGroup);
   }
  }
 }
}

function clearSelection(){
 selectedEntityId=null;
 if(atlasPanels.state.active==='share')atlasShare?.refresh();
 atlasMobile.selection(null);
 document.getElementById('details-summary').textContent='';
 document.getElementById('selection-visibility').textContent='';
 const visibilityAction=document.getElementById('selection-visibility-action');if(visibilityAction)visibilityAction.hidden=true;
 document.getElementById('geometry-status').textContent='';
 atlasTree?.clear();
 if(selectedLayer){selectedLayer.setStyle(styleFor(selectedLayer.feature));selectedLayer=null;}
 rerenderLoadedTiers();

 document.getElementById('details-title').textContent='Nicio selecție';
 document.getElementById('details-body').innerHTML='<p class="muted">Selectează o limită de pe hartă sau caută o entitate după nume ori identificator.</p>';
 atlasUrl?.commit('push');
}

function detailRow(label,value){
 return '<dt>'+escapeHtml(label)+'</dt><dd>'+escapeHtml(value==null||value===''?'—':value)+'</dd>';
}
function renderDetails(entity){
 const title=document.getElementById('details-title');
 const body=document.getElementById('details-body');
 title.textContent=formatEntityName(entity.display_name);
 document.getElementById('details-summary').textContent=typeLabel(entity.representation.inferred_type);
 body.innerHTML=
  '<section class="details-section"><span class="tag'+(entity.validation.legal_identity_status==='unresolved'?' warning-tag':'')+'">'+escapeHtml(statusLabels[entity.validation.legal_identity_status]||entity.validation.legal_identity_status)+'</span><dl class="kv" style="margin-top:10px">'+
  detailRow('Jurisdicție',entity.jurisdiction)+(nistreniaView?.roleIds.has(entity.id)?detailRow('Jurisdicție operațională (OSM)','Nistrenia · de facto, fără recunoaștere internațională'):'')+detailRow('Clasă geometrică',filterLabels[geometryClass(entity)]||'Limită statistică separată')+
  '</dl></section>'+entityProvenanceHtml(entity,{typeLabel,statusLabel:value=>statusLabels[value]||value});
 renderOsmRoleDetails({container:body,document,row:osmRoleById.get(entity.id)});
 renderBreadcrumb(entity);
 const zoomButton=body.querySelector('#zoom-selected');
 if(zoomButton)zoomButton.addEventListener('click',()=>zoomToEntity(entity));
 const compare=document.createElement('button');compare.type='button';compare.id='compare-selected';compare.className='action-button';compare.textContent='Adaugă la comparație';compare.addEventListener('click',()=>atlasAdvanced?.addCompare(entity.id));body.appendChild(compare);
 if(atlasNeighbors){const neighbors=document.createElement('button');neighbors.type='button';neighbors.id='neighbors-toggle';neighbors.className='action-button';neighbors.textContent='Arată vecinii';neighbors.addEventListener('click',()=>atlasNeighbors.open(entity.id,neighbors));body.appendChild(neighbors);}
 geometricUi?.card(body,entity.id);
 atlasExport.card(body,entity);
}

function zoomToEntity(entity,options={}){
 const b=entity.map?.bbox;
 if(Array.isArray(b)&&b.length===4)map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[30,30],maxZoom:12,...options});
}
async function selectEntity(id,options=false,clickedLayer=null){
 if(nistreniaView?.isVirtual(id))return selectNistreniaNode(id,typeof options==='boolean'?{zoom:options}:options);
 try{return await (atlasUrl?atlasUrl.action('push',()=>applySelection(id,options,clickedLayer)):applySelection(id,options,clickedLayer));}
 catch(error){if(selectedEntityId===id)document.getElementById('geometry-status').textContent='Geometria nu a putut fi încărcată pentru '+id+'. Identitatea și selecția rămân disponibile.';throw error;}
}
async function applySelection(id,options=false,clickedLayer=null){
 const {zoom=false,source}=typeof options==='boolean'?{zoom:options}:options;
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
 if(atlasPanels.state.active==='share')atlasShare?.refresh();
 document.getElementById('geometry-status').textContent='';
 atlasMobile.selection(id,{source});
 renderDetails(entity);
 updateSelectionVisibility();
 rerenderLoadedTiers();
 atlasAdvanced?.record(id);
 if(!isVisible(entity))return;
 if(zoom)zoomToEntity(entity,source==='url'?{animate:false}:{});

 updateSelectionVisibility();
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

function captureUrlState(){
 const current=map.getCenter?.()||{lat:defaultViewport.lat,lng:defaultViewport.lon};
 const center=map.wrapLatLng?.(current)||current;
 return {osmBasemapVisible,entityId:selectedEntityId,viewport:{lat:center.lat,lon:center.lng,z:map.getZoom()},viewportExplicit:true,jurisdictions:['RO','MD','NI'].filter(j=>Boolean(document.getElementById('layer-'+j.toLowerCase())?.checked)),geometryClasses:activeGeometryClasses,geometrySubtypes:activeGeometrySubtypes,statisticalLevels:activeStatisticalLevels,osmAdminLevels:activeOsmAdminLevels,separateStatisticalGeometry,openIds:atlasTree.getOpenIds(),visibleEntityIds,visibleOperationalOutlineIds};
}
async function applyUrlState(state){
 lastOsmLevelGeometryAction=null;
 const replace=(target,values)=>{target.clear();for(const value of values)target.add(value);};
 replace(activeGeometryClasses,state.geometryClasses);replace(activeGeometrySubtypes,state.geometrySubtypes);replace(activeStatisticalLevels,state.statisticalLevels);replace(activeOsmAdminLevels,state.osmAdminLevels);replace(visibleEntityIds,state.visibleEntityIds);replace(visibleOperationalOutlineIds,state.visibleOperationalOutlineIds||[]);setSeparateStatisticalGeometry(state.separateStatisticalGeometry);setOsmBasemapVisible(state.osmBasemapVisible);
 for(const j of ['RO','MD','NI']){const control=document.getElementById('layer-'+j.toLowerCase());if(control)control.checked=state.jurisdictions.includes(j)&&!(j==='NI'&&!nistreniaView);}syncJurisdictionRoots();
 atlasTree.setOpenIds(state.openIds);refreshOsmAdminTree();refreshGeometryVisibility();
 if(!state.viewportExplicit&&!state.entityId&&typeof map.getSize==='function')fitRoMd(map,entityById);
  else map.setView([state.viewport.lat,state.viewport.lon],state.viewport.z,{animate:false});
 if(state.entityId)await selectEntity(state.entityId,{source:'url',zoom:!state.viewportExplicit});else clearSelection();
 await syncTiers();updateSelectionVisibility();
}
async function initializeUrlState(){
 const browser=globalThis.window;
 if(!browser?.location||!browser?.history||!browser.addEventListener)return;
 const config=createUrlConfig({entityById,nodeById:nistreniaView?.nodes||hierarchyNodeById,rootIds:hierarchyTree.root_ids,treeRootIds:nistreniaView?.rootIds||hierarchyTree.root_ids,operationalOutlineIds:nistreniaOutlines?niOutlineIds:[],virtualEntityIds:nistreniaView?.virtualIds||[],filterIndex:geometryFilterIndex});
 atlasUrl=createAtlasUrlState({browser,config,capture:captureUrlState,apply:applyUrlState});await atlasUrl.restore();atlasShare?.refresh();
}
atlasShare=createAtlasShare({document,getCurrentUrl:()=>atlasUrl?.shareUrl()||null,getSelectedEntity:()=>nistreniaView?.isVirtual(selectedEntityId)?{...nistreniaView.nodes.get(selectedEntityId),urlVersion:2}:entityById.get(selectedEntityId)||null});


document.getElementById('details-close').addEventListener('click',()=>atlasMobile.clear());
document.getElementById('map-home')?.addEventListener('click',()=>{if(atlasUrl)void atlasUrl.action('push',()=>fitRoMd(map,entityById));else fitRoMd(map,entityById);});
document.getElementById('basemap-toggle')?.addEventListener('click',()=>{setOsmBasemapVisible(!osmBasemapVisible);atlasUrl?.commit('push');if(atlasPanels.state.active==='share')atlasShare?.refresh();});
document.getElementById('filters-reset')?.addEventListener('click',resetGlobalFilters);
document.getElementById('selection-visibility-action')?.addEventListener('click',()=>{
 const ownOutline=nistreniaOutlines?.has(selectedEntityId);
 const entity=nistreniaView?.isVirtual(selectedEntityId)?nistreniaView.nodes.get(selectedEntityId):entityById.get(selectedEntityId);if(!entity)return;
 const action=document.getElementById('selection-visibility-action');
 if(action?.dataset.action==='show'){
  (ownOutline?visibleOperationalOutlineIds:visibleEntityIds).add(entity.id);refreshGeometryVisibility();syncTiers().catch(console.error);atlasUrl?.commit('push');
 }else if(action?.dataset.action==='filters'){
  if(atlasMobile.state.mobile&&!atlasMobile.state.drawer)atlasMobile.openDrawer();
  setFiltersPanelOpen(true);
 }
});
document.getElementById('layer-ro').addEventListener('change',event=>{updateFilterCount();event.target.checked?roots.RO.addTo(map):map.removeLayer(roots.RO);syncTiers().catch(console.error);atlasTree?.refreshVisibility();updateSelectionVisibility();atlasUrl?.commit('push');});
document.getElementById('layer-md').addEventListener('change',()=>{syncJurisdictionRoots();refreshGeometryVisibility();syncTiers().catch(console.error);atlasUrl?.commit('push');});
document.getElementById('layer-ni')?.addEventListener('change',()=>{syncJurisdictionRoots();refreshGeometryVisibility();syncTiers().catch(console.error);atlasUrl?.commit('push');});
map.on('zoomend moveend',()=>{if(!atlasUrl?.isRestoring)syncTiers().catch(console.error);atlasUrl?.commit('replace');if(atlasPanels.state.active==='share')atlasShare?.refresh();});

const frontendReady=(async()=>{
 let phase='index';
 try{
  await loadIndex();
  try{await loadOsmRoleCatalog();await loadNistreniaOsmNavigation();
    const verified=await fetchVerifiedNistreniaOutlines((...args)=>fetch(...args),crypto.subtle,nistreniaCatalog);
    nistreniaOutlineFeatures=verified.features;nistreniaOutlineProof=verified.proof;
    nistreniaAdministrativeModel=(await fetchNistreniaAdministrativeModel((...args)=>fetch(...args),crypto.subtle,{actualIds:new Set(entityById.keys())})).model;}
  catch(error){
   console.warn('Catalogul cartografic OSM a fost blocat',error);
  }
  phase='hierarchy';await loadHierarchyTree();
  phase='geometry';await loadChunkIndex();
  if(chunkIndex)pointIdentifier=createPointIdentifier({entities:[...entityById.values()],chunks:chunkIndex.chunks,contract:releaseData.manifest.public_contract,read:geometryResources.read});
  if(chunkIndex)neighborsEngine=createNeighbors({entities:[...entityById.values()],snapshotId:releaseData.manifest.snapshot_id,catalogSha256:releaseData.manifest.public_contract.sha256,sourceHashes:Object.fromEntries([...Object.values(releaseData.manifest.public_contract.geometry_tiers||{}).flatMap(tiers=>Object.values(tiers)),...Object.values(releaseData.manifest.public_contract.statistical_geometry||{}),...chunkIndex.chunks].map(d=>[d.path,d.sha256])),readGeometry:geometryResources.read});
  await initializeUrlState();
  updateFilterCount();
  await Promise.all(['RO','MD'].map(ensureStatisticalGeometry));
  await Promise.all([ensureTier('RO','overview'),ensureTier('MD','overview')]);
  await syncTiers();
 }catch(e){
  console.error('Inițializarea modulului ACTUAL a eșuat',e);
  if(phase==='hierarchy')document.getElementById('hierarchy-error').textContent='Ierarhia consolidată este indisponibilă. Indexul de căutare rămâne încărcat.';
  else if(phase==='geometry')document.getElementById('geometry-load-status').textContent='Geometria este indisponibilă. Identitățile și arborele rămân încărcate.';
  else document.getElementById('filter-list').innerHTML='<p role="alert" class="muted">Indexul ACTUAL nu a putut fi validat. Verifică statusul release-ului.</p>';
 }
})();

export {atlasExport,exportSource,atlasNeighbors,neighborsEngine,atlasIdentify,pointIdentifier,geometryResources,atlasShare,atlasTree,atlasPanels,atlasLayout,atlasPreview,map,styleFor,atlasMobile,atlasUrl,captureUrlState,applyUrlState,atlasSearch,frontendReady,entityById,activeFilterGroups,activeGeometryClasses,activeGeometrySubtypes,activeStatisticalLevels,statisticalFeatureById,statisticalGeometryLoaded,statisticalGroups,selectedEntityId,selectEntity,clearSelection,hierarchyNodeById,visibleEntityIds,renderCollection,ensureChunk,ensureTier,syncTiers,chunkGroups,tierGroups,ensureStatisticalGeometry,refreshGeometryVisibility,setSeparateStatisticalGeometry,atlasAdvanced,atlasExplorerShell,visibleOperationalOutlineIds,nistreniaOutlines,nistreniaOutlineFeatures,osmRoleById,nistreniaCatalog,nistreniaView};
