import {bboxContains,geographicPoint,pointInGeometry} from './atlas-point-geometry.mjs';
export function createPointIdentifier({entities,chunks,contract,read,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}){
 const byId=new Map(entities.map(e=>[e.id,e])),addresses=new Map(),catalogErrors=[];
 const chunkByKey=new Map(chunks.map(c=>[c.jurisdiction+'|'+c.tier+'|'+c.root_entity_id,c]));
 for(const e of entities){
  let descriptor,kind;
  if(e.category==='statistical'){descriptor=contract.statistical_geometry?.[e.jurisdiction];kind='statistical';}
  else if(e.map?.tier==='overview'){descriptor=contract.geometry_tiers?.[e.jurisdiction]?.overview;kind='overview';}
  else{let ancestor=e;const seen=new Set();while(ancestor&&ancestor.map?.tier!=='overview'&&!seen.has(ancestor.id)){seen.add(ancestor.id);ancestor=byId.get(ancestor.hierarchy?.parent_catalog_id);}descriptor=chunkByKey.get(e.jurisdiction+'|'+e.map?.tier+'|'+ancestor?.id);kind='chunk';}
  const b=e.map?.bbox;
  if(!descriptor?.path||!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||b[0]>b[2]||b[1]>b[3]){catalogErrors.push({id:e.id,error:'Adresă sau bbox indisponibil'});continue;}
  addresses.set(e.id,{entity:e,descriptor,kind});
 }
 let revision=0;const featureIndexes=new WeakMap();
 function cancel(){revision++;}
 async function identify(lon,lat){
  const point=geographicPoint(lon,lat),token=++revision,started=performance.now();
  const candidates=[...addresses.values()].filter(x=>bboxContains(x.entity.map.bbox,point)).sort((a,b)=>a.entity.id<b.entity.id?-1:a.entity.id>b.entity.id?1:0),resources=new Map(),errors=[...catalogErrors],matches=[];
  for(const c of candidates){const path=c.descriptor.path;if(!resources.has(path))resources.set(path,[]);resources.get(path).push(c);}
  // Bounded concurrency; stale queries do not start additional requests.
  const jobs=[...resources];let cursor=0;
  async function worker(){while(cursor<jobs.length&&token===revision){const [path,items]=jobs[cursor++];try{
   const data=await read(path);if(token!==revision)return;
   const first=items[0],m=data.metadata;
   if(m?.jurisdiction!==first.entity.jurisdiction||(first.kind==='chunk'&&(m.tier!==first.entity.map.tier||m.root_entity_id!==first.descriptor.root_entity_id||Number(m.feature_count)!==Number(first.descriptor.feature_count)))||(first.kind==='overview'&&m.tier!=='overview')||(first.kind==='statistical'&&m.contract!=='actual-public-statistical-geometry-v1'))throw Error('Metadate geometrice inconsistente');
   let index=featureIndexes.get(data);if(!index){index=new Map();for(const f of data.features){const id=f?.properties?.entity_id;if(!byId.has(id)||index.has(id))throw Error('Identitate geometrică invalidă');index.set(id,f);}featureIndexes.set(data,index);}
   for(const c of items){if(token!==revision)return;try{const f=index.get(c.entity.id);if(!f)throw Error('Geometrie candidat absentă');const membership=pointInGeometry(point,f.geometry);if(membership!=='outside')matches.push({entity:c.entity,membership});}catch(error){errors.push({id:c.entity.id,error:error.message});}await yieldTask();}
  }catch(error){errors.push({path,error:error.message});}}}
  await Promise.all(Array.from({length:Math.min(3,jobs.length)},worker));
  if(token!==revision)return {stale:true};
  matches.sort((a,b)=>a.entity.jurisdiction.localeCompare(b.entity.jurisdiction)||(a.entity.id<b.entity.id?-1:a.entity.id>b.entity.id?1:0));errors.sort((a,b)=>String(a.id||a.path).localeCompare(String(b.id||b.path)));
  return {point,matches,errors,partial:errors.length>0,resources:[...resources.keys()].sort(),candidates:candidates.length,durationMs:performance.now()-started,stale:false};
 }
 return {identify,cancel,get unavailable(){return [...catalogErrors];}};
}
