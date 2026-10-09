import {geometryLabels,geometrySubtypeLabels,geometryParentState,setGeometryGroup} from './geometry-taxonomy.mjs';
const sorted=values=>[...new Set(values)].sort();
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const defaultViewport={lat:46.8,lon:26.6,z:6};
export function createUrlConfig({entityById,nodeById,rootIds,filterIndex,minZoom=0,maxZoom=19}){
 return {entityIds:new Set(entityById.keys()),nodeById,rootIds:sorted(rootIds),groups:filterIndex.groups,classes:sorted(Object.keys(geometryLabels)),subtypes:sorted([...Object.keys(geometrySubtypeLabels),...filterIndex.subtypeMembers.keys()]),levels:[1,2,3,'unclassified'],minZoom,maxZoom};
}
export function validViewport(value,config){
 if(!value||[value.lat,value.lon,value.z].some(v=>v===null||v===undefined||String(v).trim()===''))return null;
 const lat=Number(value.lat),lon=Number(value.lon),z=Number(value.z);
 if(![lat,lon,z].every(Number.isFinite)||lat< -90||lat>90||lon< -180||lon>180||!Number.isInteger(z)||z<config.minZoom||z>config.maxZoom)return null;
 return {lat:Number(lat.toFixed(5)),lon:Number(lon.toFixed(5)),z};
}
export function normalizeUrlState(raw,config){
 const subtypes=new Set(raw.geometrySubtypes??config.subtypes),classes=new Set(config.classes);
 for(const id of [...subtypes])if(!config.subtypes.includes(id))subtypes.delete(id);
 const allowedClasses=raw.geometryClasses?new Set(raw.geometryClasses):classes;
 const geometryState={geometryClasses:classes,geometrySubtypes:subtypes};
 for(const group of config.groups){
  if(!allowedClasses.has(group.id))setGeometryGroup(group,geometryState,false);
  const parent=geometryParentState(group,geometryState);
  if(!parent.checked&&!parent.indeterminate)classes.delete(group.id);
 }
 const viewport=validViewport(raw.viewport,config);
 return {entityId:config.entityIds.has(raw.entityId)?raw.entityId:null,viewport:viewport||{...defaultViewport},viewportExplicit:Boolean(viewport&&raw.viewportExplicit!==false),jurisdictions:sorted(raw.jurisdictions??['RO','MD']).filter(j=>['RO','MD'].includes(j)),geometryClasses:sorted(classes),geometrySubtypes:sorted(subtypes),statisticalLevels:config.levels.filter(level=>new Set(raw.statisticalLevels??config.levels).has(level)),separateStatisticalGeometry:raw.separateStatisticalGeometry!==false,visibleEntityIds:sorted(raw.visibleEntityIds??config.rootIds).filter(id=>config.entityIds.has(id)),openIds:sorted(raw.openIds??config.rootIds).filter(id=>Boolean(config.nodeById.get(id)?.child_ids?.length))};
}
export const defaultUrlState=config=>normalizeUrlState({viewport:defaultViewport,viewportExplicit:false},config);
function fixedList(params,key,allowed){
 if(!params.has(key))return allowed;
 const value=params.get(key);if(value==='')return [];
 const found=value.split(',').filter(v=>allowed.map(String).includes(v));
 return found.length?allowed.filter(v=>found.includes(String(v))):allowed;
}
export function parseUrlState(search,config){
 const params=new URLSearchParams(search);
 if(params.get('v')!=='1')return defaultUrlState(config);
 const viewport=validViewport({lat:params.get('lat'),lon:params.get('lon'),z:params.get('z')},config);
 const disabled=new Set(params.getAll('f'));
 const visibleEntityIds=new Set(config.rootIds);
 for(const id of new Set(params.getAll('x')))if(config.entityIds.has(id)){if(visibleEntityIds.has(id))visibleEntityIds.delete(id);else visibleEntityIds.add(id);}
 return normalizeUrlState({visibleEntityIds,entityId:params.get('e'),viewport,viewportExplicit:Boolean(viewport),jurisdictions:fixedList(params,'j',['RO','MD']),geometrySubtypes:config.subtypes.filter(id=>!disabled.has(id)),statisticalLevels:fixedList(params,'s',config.levels),separateStatisticalGeometry:params.get('b')!=='0',openIds:params.has('t')?params.getAll('t'):config.rootIds},config);
}
export function serializeUrlState(raw,config){
 const state=normalizeUrlState(raw,config),defaults=defaultUrlState(config),params=new URLSearchParams();
 params.set('v','1');if(state.entityId)params.set('e',state.entityId);
 // Explicit default viewport matters for an entity link: otherwise restore would fitBounds.
 if(!equal(state.viewport,defaultViewport)||(state.entityId&&state.viewportExplicit))for(const key of ['lat','lon','z'])params.set(key,String(state.viewport[key]));
 if(!equal(state.jurisdictions,defaults.jurisdictions))params.set('j',state.jurisdictions.join(','));
 for(const id of config.subtypes.filter(id=>!state.geometrySubtypes.includes(id)))params.append('f',id);
 if(!equal(state.statisticalLevels,defaults.statisticalLevels))params.set('s',state.statisticalLevels.join(','));
 if(!state.separateStatisticalGeometry)params.set('b','0');
 if(!equal(state.openIds,defaults.openIds)){if(!state.openIds.length)params.append('t','');else for(const id of state.openIds)params.append('t',id);}
 const toggles=sorted([...new Set([...state.visibleEntityIds,...defaults.visibleEntityIds])].filter(id=>state.visibleEntityIds.includes(id)!==defaults.visibleEntityIds.includes(id)));
 for(const id of toggles)params.append('x',id);
 return [...params.keys()].length===1?'':params.toString();
}
export const canonicalizeUrlState=(search,config)=>serializeUrlState(parseUrlState(search,config),config);
export const sameUrlState=(a,b,config)=>serializeUrlState(a,config)===serializeUrlState(b,config);
export function createAtlasUrlState({browser,config,capture,apply,onError=console.error}){
 let restoring=0,mutating=0,revision=0,queue=Promise.resolve();
 const stateUrl=()=>{const url=new URL(browser.location.href);url.search=serializeUrlState(capture(),config);return url;};
 function commit(mode='replace'){
  if(restoring||mutating)return false;
  try{const url=stateUrl();if(url.href===browser.location.href)return false;browser.history[mode==='push'?'pushState':'replaceState'](null,'',url.href);return true;}catch(error){onError('Atlas URL history unavailable',error);return false;}
 }
 function restore(){
  const requested=browser.location.href;revision++;restoring++;
  const run=async()=>{
   try{await apply(parseUrlState(new URL(requested).search,config));}finally{restoring--;}
   if(browser.location.href===requested)commit('replace');
  };
  queue=queue.then(run,run).catch(error=>onError('Atlas URL restore failed',error));return queue;
 }
 browser.addEventListener('popstate',restore);
 return {restore,commit,shareUrl:()=>stateUrl().href,whenIdle:()=>queue,get isRestoring(){return Boolean(restoring);},async action(mode,fn){const started=revision;mutating++;let result;try{result=fn();}finally{mutating--;if(!mutating)commit(started===revision?mode:'replace');}return await result;}};
}
