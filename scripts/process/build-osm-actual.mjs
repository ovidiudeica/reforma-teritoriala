#!/usr/bin/env node
import {createHash} from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import osmtogeojson from 'osmtogeojson';
import { area, intersect, featureCollection, pointOnFeature, booleanPointInPolygon } from '@turf/turf';
import {applyMdReviewedParentHierarchyOverrides} from '../lib/md-parent-hierarchy-overrides.mjs';

const OSM_MANIFEST='data/sources/osm-current.json';
const OSM_SNAPSHOT_DIR='data/sources/osm-snapshots';
const CLASSIFIER_VERSION='2.3';
const countries={
 RO:{name:'România',iso:'RO',levels:[4,8,9],stateRelationId:90689},
 MD:{name:'Republica Moldova',iso:'MD',levels:[4,6,8,9],stateRelationId:58974,requiredRelations:[1813306,1813297,58512,1813315,1813316]}
};
const roSemanticEvidence=JSON.parse(await readFile('data/sources/ro-level9-exception-evidence.json','utf8'));
const roSemanticByRelation=new Map((roSemanticEvidence.items||[]).map(x=>[Number(x.osm_relation_id),x]));
const RO_SEMANTIC_CLASSES=new Set([
 'component_village_boundary_representation',
 'municipality_component_locality_boundary_representation'
]);
const sha256=value=>createHash('sha256').update(value).digest('hex');
async function loadOsmSourceManifest(){
 const manifest=JSON.parse(await readFile(OSM_MANIFEST,'utf8'));
 if(manifest.schema_version!==2||!manifest.countries?.RO||!manifest.countries?.MD)throw new Error('Invalid materialized OSM source manifest');
 if(!Number.isFinite(new Date(manifest.snapshot_at).getTime()))throw new Error('Invalid materialized OSM source snapshot_at');
 for(const [code,entry] of Object.entries(manifest.countries))if(!Number.isFinite(new Date(entry?.snapshot_at).getTime()))throw new Error(`Invalid OSM ${code} snapshot_at`);
 return manifest;
}
async function readRawSnapshot(code,entry){
 if(!/^[a-f0-9]{64}$/.test(String(entry.semantic_sha256||'')))throw new Error(`OSM ${code} manifest has invalid semantic hash`);
 if(!/^[a-f0-9]{64}$/.test(String(entry.compressed_sha256||'')))throw new Error(`OSM ${code} manifest has invalid compressed hash`);
 const expected=`${OSM_SNAPSHOT_DIR}/${code.toLowerCase()}-${entry.semantic_sha256}.json.gz`;
 if(entry.snapshot_path!==expected)throw new Error(`Unexpected OSM content-addressed snapshot path for ${code}: ${entry.snapshot_path}`);
 const compressed=await readFile(expected);
 if(sha256(compressed)!==entry.compressed_sha256)throw new Error(`OSM ${code} compressed snapshot hash mismatch`);
 const canonical=gunzipSync(compressed);
 if(sha256(canonical)!==entry.semantic_sha256)throw new Error(`OSM ${code} materialized snapshot semantic hash mismatch`);
 const raw=JSON.parse(canonical.toString('utf8'));
 if(!Array.isArray(raw.elements)||raw.elements.length!==entry.element_count)throw new Error(`OSM ${code} materialized snapshot element count mismatch`);
 const country=raw.elements.find(x=>x.type==='relation'&&x.tags?.['ISO3166-1']===entry.iso&&x.tags?.boundary==='administrative');
 if(!country)throw new Error(`OSM ${code} materialized snapshot is missing country boundary relation`);
 return raw;
}
function norm(v){return (v||'').trim().toLowerCase();}
function classify(country,t={}){
 const l=Number(t.admin_level), p=norm(t.place), n=norm(t['name:ro']||t.name), official=norm(t.official_name);
 if(l===2)return {type:'state',confidence:'high',reason:'Country boundary imported as ACTUAL state context; it does not change UAT parentage or assert a SIRUTA/CUATM legal identity.'};
 if(country==='RO'){
  if(l===4)return {type:n.includes('bucurești')||p==='city'?'capital_municipality':'county',confidence:'high'};
  if(l===9){
   return {type:'subdivision_or_mistagged_boundary',confidence:'low',reason:'RO admin_level=9 requires post-parent validation; only Sector 1–6 inside București is a sector'};
  }
  if(l===8){
   if(p==='city')return {type:'municipality',confidence:'high'};
   if(p==='town')return {type:'town',confidence:'high'};
   if(p==='municipality'){
    if(n.startsWith('municipiul ')||official.startsWith('municipiul '))return {type:'municipality',confidence:'high'};
    if(n.startsWith('orașul ')||official.startsWith('orașul '))return {type:'town',confidence:'high'};
    if(n.startsWith('comuna ')||official.startsWith('comuna '))return {type:'commune',confidence:'high'};
    return {type:'commune',confidence:'medium',reason:'RO admin_level=8 + place=municipality without explicit legal prefix; inferred from dominant OSM convention'};
   }
   return {type:'local_uat',confidence:'low',reason:'RO admin_level=8 lacks a usable place/legal-name discriminator'};
  }
 }
 if(country==='MD'){
  if(l===4){
   if(p==='district')return {type:'district',confidence:'high'};
   if(p==='region')return {type:'special_territorial_unit',confidence:'medium',reason:'MD admin_level=4 + place=region requires legal cross-check'};
   if(p==='municipality')return {type:'level_2_municipality',confidence:'medium',reason:'MD admin_level=4 + place=municipality requires legal cross-check'};
   return {type:'level_2_or_special_unit',confidence:'low',reason:'MD admin_level=4 without recognised place discriminator'};
  }
  if(l===6)return {type:'intermediate_administrative_unit',confidence:'low',reason:'No admin_level=6 features were observed in the 2026-09-25 audit'};
  if(l===8){
   if(p==='town')return {type:'town_uat',confidence:'high'};
   if(p==='city')return {type:'municipality_or_city_uat',confidence:'medium',reason:'OSM place does not encode Moldovan legal municipality status reliably'};
   if(p==='municipality')return {type:'level_1_uat',confidence:'medium',reason:'Administrative UAT boundary; legal subtype requires official-list cross-check'};
   if(p==='village')return {type:'commune_or_independent_village_uat',confidence:'medium',reason:'OSM place=village does not distinguish commune from independent village'};
   return {type:'level_1_uat',confidence:'low',reason:'MD admin_level=8 lacks a usable place/legal discriminator'};
  }
  if(l===9){
   if(p==='borough'&&norm(t['place:ro'])==='sector'&&/^01[1-5]0$/.test(String(t['ref:cuatm:codunic']||'')))return {type:'chisinau_sector',confidence:'high',reason:'Chișinău sector identified by OSM borough/sector semantics and explicit CUATM code 0110–0150'};
   if(['village','town','city'].includes(p))return {type:'component_locality',confidence:'medium',reason:'Nested locality boundary; exact legal subtype requires official-list cross-check'};
   if(p==='allotments')return {type:'non_administrative_or_auxiliary_area',confidence:'low',reason:'place=allotments is not sufficient evidence of an administrative unit'};
   return {type:'subdivision_or_component_area',confidence:'low',reason:'MD admin_level=9 is heterogeneous in current OSM data'};
  }
 }
 return {type:'unclassified',confidence:'low',reason:'No classifier rule matched'};
}
function relationId(feature){
 const id=String(feature.id||''); const m=id.match(/relation\/(\d+)/); return m?Number(m[1]):null;
}
const MD_OFFICIAL_POINT_TOUCH_NORMALIZATIONS=new Map([[12463200,{classification:'official_point_touch_multipolygon',coordinate:[29.2405257,46.7587398],rings:[
 [76585146,918853569,918853568,918853573,918853567,918930470,60741665,94511352],
 [76583058,125859262,918853574]
]}]]);
function ringFromWays(raw,wayIds){
 const wayById=new Map(raw.elements.filter(x=>x.type==='way').map(x=>[x.id,x]));
 const nodeById=new Map(raw.elements.filter(x=>x.type==='node').map(x=>[x.id,x]));
 const unused=wayIds.map(id=>wayById.get(id)); if(unused.some(x=>!x))throw new Error('Missing normalization way');
 const chain=[...unused.shift().nodes];
 while(unused.length){const end=chain.at(-1);const i=unused.findIndex(w=>w.nodes[0]===end||w.nodes.at(-1)===end);if(i<0)throw new Error('Cannot close normalization ring');const w=unused.splice(i,1)[0];const ns=w.nodes[0]===end?w.nodes:[...w.nodes].reverse();chain.push(...ns.slice(1));}
 if(chain[0]!==chain.at(-1))throw new Error('Normalization ring is not closed');
 return chain.map(id=>{const n=nodeById.get(id);if(!n)throw new Error('Missing normalization node '+id);return [n.lon,n.lat];});
}
function normalizeOfficialPointTouch(country,raw,geo,report){
 if(country!=='MD')return;
 for(const [rid,cfg] of MD_OFFICIAL_POINT_TOUCH_NORMALIZATIONS){const f=geo.features.find(x=>relationId(x)===rid);if(!f)throw new Error('Missing official point-touch relation '+rid);const rings=cfg.rings.map(ids=>ringFromWays(raw,ids));f.geometry={type:'MultiPolygon',coordinates:rings.map(r=>[r])};f.properties={...f.properties,topology_normalization:cfg.classification,topology_evidence:'I.P. Cadastrul Bunurilor Imobile WMS w_rsuat:mv_uat3; audit PR #94'};report.warnings.push({type:'official_point_touch_multipolygon_normalized',jurisdiction:country,relation_id:rid,coordinate:cfg.coordinate,component_count:rings.length,coordinate_edit:false});}
}
function entity(country,feature,importedAt){
 const t=feature.properties?.tags||feature.properties||{}, rid=relationId(feature), c=classify(country,t);
 return {id:`osm-r${rid}`,name:t['name:ro']||t.name||null,official_name:t.official_name||null,jurisdiction:country,category:c.type==='state'?'context':'administrative',type:c.type,status:'current',parent_id:null,
  osm:{element_type:'relation',relation_id:rid,admin_level:t.admin_level?Number(t.admin_level):null,boundary:t.boundary||null,relation_type:t.type||null,place:t.place||null,designation:t.designation||null,name_prefix:t['name:prefix']||null,full_name:t.full_name||null,cuatm_code:t['ref:cuatm']||t['ref:cuatm:cod']||null,cuatm_unique_id:t['ref:cuatm:codunic']||null,wikidata:t.wikidata||null,wikipedia:t.wikipedia||null},
  classification:{version:CLASSIFIER_VERSION,confidence:c.confidence,reason:c.reason||null},
  ...(c.type==='state'?{geometry:{role:'administrative_boundary',scope:'state_context',legal_geometry_equivalence_asserted:false}}:{}),
  source:'OpenStreetMap',source_url:`https://www.openstreetmap.org/relation/${rid}`,imported_at:importedAt,review_required:c.confidence==='low'};
}
function assignParents(entities,featuresById,warnings=[]){
 for(const child of entities){
  if(child.type==='state'){child.parent_id=null;continue;}
  const cf=featuresById.get(child.id); if(!cf)continue;
  let pt,childArea;
  try{
   pt=pointOnFeature(cf);
   childArea=area(cf);
  }catch(e){
   warnings.push({type:'invalid_child_geometry',entity_id:child.id,relation_id:child.osm.relation_id,message:e.message});
   child.parent_id=child.jurisdiction;
   continue;
  }
  const cl=child.osm.admin_level??99;
  const candidates=entities.filter(p=>p.jurisdiction===child.jurisdiction&&p.type!=='state'&&(p.osm.admin_level??99)<cl);
  const levels=[...new Set(candidates.map(p=>p.osm.admin_level??0))].sort((a,b)=>b-a);
  let selected=null;
  for(const level of levels){
   const peers=candidates.filter(p=>(p.osm.admin_level??0)===level);
   const strict=[];
   for(const p of peers){
    const pf=featuresById.get(p.id);
    if(!pf)continue;
    try{
     if(booleanPointInPolygon(pt,pf,{ignoreBoundary:true}))strict.push(p);
    }catch(e){
     warnings.push({type:'invalid_parent_geometry',entity_id:p.id,relation_id:p.osm.relation_id,child_id:child.id,message:e.message});
    }
   }
   if(strict.length===1){selected=strict[0];break;}

   // A representative point may land exactly on a shared administrative border.
   // When strict containment is ambiguous or absent, resolve the closest parent
   // level by positive polygon-area overlap; boundary-only contact has zero area.
   const scored=[];
   for(const p of peers){
    const pf=featuresById.get(p.id);
    if(!pf)continue;
    try{
     const overlap=intersect(featureCollection([cf,pf]));
     const overlapArea=overlap?area(overlap):0;
     const coverage=childArea?overlapArea/childArea:0;
     if(coverage>1e-12)scored.push({parent:p,coverage,overlap_area_m2:overlapArea});
    }catch(e){
     warnings.push({type:'parent_overlap_geometry_error',entity_id:p.id,relation_id:p.osm.relation_id,child_id:child.id,message:e.message});
    }
   }
   scored.sort((a,b)=>{
    const coverageDelta=b.coverage-a.coverage;
    if(Math.abs(coverageDelta)>1e-12)return coverageDelta;
    return (Number(a.parent.osm?.relation_id)||0)-(Number(b.parent.osm?.relation_id)||0);
   });
   if(scored.length){
    selected=scored[0].parent;
    if(strict.length!==1||scored.length>1)warnings.push({
     type:'parent_assignment_overlap_resolution',
     child_id:child.id,
     child_relation_id:child.osm.relation_id,
     admin_level:level,
     representative_point:pt.geometry?.coordinates||null,
     strict_candidate_relation_ids:strict.map(p=>p.osm.relation_id),
     overlap_candidates:scored.map(x=>({relation_id:x.parent.osm.relation_id,coverage:x.coverage,overlap_area_m2:x.overlap_area_m2})),
     selected_relation_id:selected.osm.relation_id
    });
    break;
   }
   if(strict.length>1){
    strict.sort((a,b)=>(Number(a.osm?.relation_id)||0)-(Number(b.osm?.relation_id)||0));
    selected=strict[0];
    warnings.push({type:'ambiguous_strict_parent_fallback',child_id:child.id,child_relation_id:child.osm.relation_id,admin_level:level,candidate_relation_ids:strict.map(p=>p.osm.relation_id),selected_relation_id:selected.osm.relation_id});
    break;
   }
  }
  child.parent_id=selected?.id||child.jurisdiction;
 }
}
function finalizeAfterParents(entities){
 const byId=new Map(entities.map(e=>[e.id,e]));
 for(const e of entities){
  if(e.jurisdiction==='MD'){
   const parent=byId.get(e.parent_id);
   const cuatm=String(e.osm?.cuatm_unique_id||e.osm?.cuatm_code||'');
   if(parent?.osm?.relation_id===1691801&&/^01[1-5]0$/.test(cuatm)){
    e.type='chisinau_sector';
    e.classification={version:CLASSIFIER_VERSION,confidence:'high',reason:'Chișinău sector validated by official CUATM code 0110–0150 and geometric municipality parent; OSM admin_level is not used as legal subtype evidence'};
    e.review_required=false;
   }
  }
  if(e.jurisdiction!=='RO'||e.osm.admin_level!==9)continue;
  const n=norm(e.name), parent=byId.get(e.parent_id);
  const parentName=norm(parent?.name);
  if(/^sector(?:ul)? [1-6]$/.test(n)&&parent?.osm?.admin_level===4&&parentName.includes('bucurești')){
   e.type='sector';
   e.classification={version:CLASSIFIER_VERSION,confidence:'high',reason:'Sector 1–6 validated only when its geometric parent is București'};
   e.review_required=false;
   continue;
  }
  const ev=roSemanticByRelation.get(e.osm.relation_id);
  const expectedParent=ev?.osm_parent_relation_id?`osm-r${ev.osm_parent_relation_id}`:null;
  const evidenceMatches=ev
   && ev.legal_hierarchy_verified===true
   && ev.legal_geometry_verified===false
   && RO_SEMANTIC_CLASSES.has(ev.semantic_classification)
   && e.parent_id===expectedParent;
  if(evidenceMatches){
   e.type=ev.semantic_classification;
   e.classification={
    version:CLASSIFIER_VERSION,
    confidence:'high',
    reason:'Semantic classification resolved by audited RO level-9 evidence; OSM geometry remains a representation and is not promoted to official legal geometry.',
    evidence:'data/sources/ro-level9-exception-evidence.json'
   };
   e.review_required=false;
  }
 }
}
async function main(){
 await mkdir('data/current',{recursive:true}); await mkdir('public/geo/current',{recursive:true});
 const osmSource=await loadOsmSourceManifest();
 const all=[], report={
  generated_at:osmSource.snapshot_at,
  classifier_version:CLASSIFIER_VERSION,
  countries:{},
  warnings:[],
  osm_source_snapshot:{
   manifest:OSM_MANIFEST,
   schema_version:osmSource.schema_version,
   query_version:osmSource.query_version,
   snapshot_at:osmSource.snapshot_at,
   fetched_at:osmSource.fetched_at,
   countries:Object.fromEntries(Object.entries(osmSource.countries).map(([code,x])=>[code,{
    snapshot_path:x.snapshot_path,
    semantic_sha256:x.semantic_sha256,
    compressed_sha256:x.compressed_sha256,
    snapshot_at:x.snapshot_at,
    query_sha256:x.query_sha256,
    element_count:x.element_count,
    relation_count:x.relation_count,
    endpoint:x.endpoint
   }]))
  }
 };
 for(const [code,cfg] of Object.entries(countries)){
  const sourceEntry=osmSource.countries[code];
  if(!sourceEntry)throw new Error(`Missing materialized OSM source manifest entry for ${code}`);
  const raw=await readRawSnapshot(code,sourceEntry), geo=osmtogeojson(raw,{flatProperties:false});
  normalizeOfficialPointTouch(code,raw,geo,report);
  const allPolygons=geo.features.filter(f=>relationId(f)&&['Polygon','MultiPolygon'].includes(f.geometry?.type));
  const countryFeature=allPolygons.find(f=>(f.properties?.tags||f.properties||{})['ISO3166-1']===cfg.iso);
  if(!countryFeature) throw new Error(`Missing country boundary geometry for ${code}`);
  if(relationId(countryFeature)!==cfg.stateRelationId)throw new Error(`Unexpected ${code} country boundary relation: expected ${cfg.stateRelationId}, got ${relationId(countryFeature)}`);
  const contained=allPolygons.filter(f=>{
   if(f===countryFeature)return false;
   try{return booleanPointInPolygon(pointOnFeature(f),countryFeature);}
   catch(e){report.warnings.push({type:'country_membership_geometry_error',jurisdiction:code,relation_id:relationId(f),message:e.message});return false;}
  });
  const polygons=[countryFeature,...contained];
  const excluded=allPolygons.filter(f=>f!==countryFeature&&!contained.includes(f)).map(f=>relationId(f));
  if(excluded.length) report.warnings.push({type:'outside_country_boundary_excluded',jurisdiction:code,relation_ids:excluded});
  const entities=polygons.map(f=>entity(code,f,osmSource.snapshot_at));
  const byId=new Map(polygons.map(f=>[`osm-r${relationId(f)}`,f]));
  assignParents(entities,byId,report.warnings);
  if(code==='MD')applyMdReviewedParentHierarchyOverrides(entities,report.warnings);
  finalizeAfterParents(entities); all.push(...entities);
  const entityById=new Map(entities.map(e=>[e.id,e]));
  const fc={type:'FeatureCollection',features:polygons.map(f=>{const id=`osm-r${relationId(f)}`;const e=entityById.get(id);return {...f,properties:{...f.properties,catalog_id:id,parent_id:e?.parent_id||null,jurisdiction:code,entity_type:e?.type||'unclassified',classification_confidence:e?.classification?.confidence||'low',geometry_role:e?.geometry?.role||null,geometry_scope:e?.geometry?.scope||null}};})};
  await writeFile(`public/geo/current/${code.toLowerCase()}-administrative.geojson`,JSON.stringify(fc));
  const confidence=Object.groupBy?Object.groupBy(entities,e=>e.classification.confidence):null;
  report.countries[code]={name:cfg.name,count:entities.length,review_required:entities.filter(x=>x.review_required).length,geojson_features:fc.features.length,state_relation_id:cfg.stateRelationId,
   confidence:confidence?Object.fromEntries(Object.entries(confidence).map(([k,v])=>[k,v.length])):{}};
 }
 all.sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction)||(a.osm.admin_level??99)-(b.osm.admin_level??99)||(a.name||'').localeCompare(b.name||'','ro'));
 await writeFile('data/current/entities.json',JSON.stringify({schema_version:2,generated_at:osmSource.snapshot_at,classifier_version:CLASSIFIER_VERSION,source:'OpenStreetMap via Overpass API',license:'ODbL',entity_count:all.length,entities:all},null,2)+'\n');
 await writeFile('data/current/import-report.json',JSON.stringify(report,null,2)+'\n');
 console.log('Catalog:',all.length,'entities; classifier v'+CLASSIFIER_VERSION);
}
main().catch(e=>{console.error(e);process.exitCode=1;});

