#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {area,intersect,featureCollection} from '@turf/turf';

const reconciliation=JSON.parse(await readFile('data/current/ro-official-reconciliation.json','utf8'));
const official=JSON.parse(await readFile('data/sources/ro-siruta-current.json','utf8'));
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const geo=JSON.parse(await readFile('public/geo/current/ro-administrative.geojson','utf8'));

const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[„”"'’]/g,' ')
 .replace(/\b(judetul|judet|municipiul|municipiu|orasul|oras|comuna|sectorul|sector)\b/g,' ')
 .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const lev=(a,b)=>{
 a=norm(a);b=norm(b);
 const m=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)m[i][0]=i;
 for(let j=0;j<=b.length;j++)m[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)m[i][j]=Math.min(
  m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1)
 );
 return m[a.length][b.length];
};
const tagsOf=f=>f?.properties?.tags||f?.properties||{};
const relationId=f=>{
 const raw=String(f?.id||f?.properties?.id||'');
 const m=raw.match(/(?:relation\/)?(\d+)/);
 return m?Number(m[1]):null;
};
const featureByRelation=new Map((geo.features||[]).map(f=>[relationId(f),f]).filter(([id])=>id));
const entityByRelation=new Map((catalog.entities||[]).filter(e=>e.jurisdiction==='RO').map(e=>[Number(e.osm?.relation_id),e]));
const byCode=new Map((official.records||[]).map(x=>[String(x.siruta),x]));
const uats=(official.records||[]).filter(x=>Number(x.level)===2);
const countyName=x=>{
 let p=byCode.get(String(x.parent_siruta||''));
 return x.county_name||p?.name||x.parent_name||null;
};
const uatRows=uats.map(x=>({...x,county_name:countyName(x),n_name:norm(x.name),n_county:norm(countyName(x))}));
const uatByCode=new Map(uatRows.map(x=>[String(x.siruta),x]));
const ascendUat=record=>{
 let x=record,guard=0;
 while(x&&Number(x.level)!==2&&x.parent_siruta&&guard++<8)x=byCode.get(String(x.parent_siruta));
 return x&&Number(x.level)===2?uatByCode.get(String(x.siruta))||null:null;
};
const componentIndex=new Map();
for(const rec of official.records||[]){
 if(Number(rec.level)<=2)continue;
 const k=norm(rec.name); if(!k)continue;
 const uat=ascendUat(rec); if(!uat)continue;
 if(!componentIndex.has(k))componentIndex.set(k,[]);
 componentIndex.get(k).push({record:rec,uat});
}

async function fetchText(url){
 let last;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const r=await fetch(url,{headers:{'user-agent':'reforma-teritoriala-ro-official-exception-audit/0.1'},signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw new Error('HTTP '+r.status);
   return await r.text();
  }catch(e){last=e;if(attempt<3)await new Promise(r=>setTimeout(r,2000*attempt));}
 }
 throw last;
}
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[
 m[1],m[2].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')
]));
function parseHistory(xml,id){
 const versions=[];
 for(const m of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)){
  const a=attrs(m[1]),body=m[2],tags={},members=[];
  for(const t of body.matchAll(/<tag\b([^>]*)\/>/g)){const x=attrs(t[1]);tags[x.k]=x.v;}
  for(const mm of body.matchAll(/<member\b([^>]*)\/>/g)){const x=attrs(mm[1]);members.push({type:x.type,ref:Number(x.ref),role:x.role||''});}
  versions.push({version:Number(a.version),timestamp:a.timestamp,changeset:Number(a.changeset),user:a.user||null,tags,members});
 }
 if(!versions.length)throw new Error('No OSM history parsed for '+id);
 const unique=k=>[...new Set(versions.map(v=>v.tags[k]).filter(v=>v!==undefined))];
 return {
  relation_id:id,
  created_at:versions[0].timestamp,
  current_version:versions.at(-1).version,
  last_modified_at:versions.at(-1).timestamp,
  last_changeset:versions.at(-1).changeset,
  current_tags:versions.at(-1).tags,
  current_member_count:versions.at(-1).members.length,
  history_signals:{
   name_values:unique('name'),official_name_values:unique('official_name'),admin_level_values:unique('admin_level'),
   place_values:unique('place'),place_ro_values:unique('place:ro'),source_values:unique('source'),
   siruta_code_values:[...new Set(versions.flatMap(v=>['siruta:code','ref:siruta','siruta','ref:ins:siruta'].map(k=>v.tags[k]).filter(Boolean)))]
  }
 };
}

const targetIds=[...new Set([
 ...(reconciliation.unmatched_osm||[]).map(x=>x.osm_relation_id),
 ...(reconciliation.duplicate_legal_mappings||[]).flatMap(x=>x.osm_relation_ids||[]),
 ...(reconciliation.type_mismatches||[]).map(x=>x.osm_relation_id)
].filter(Boolean))];
const histories=[],historyErrors=[];
for(const id of targetIds){
 try{histories.push(parseHistory(await fetchText('https://api.openstreetmap.org/api/0.6/relation/'+id+'/history'),id));}
 catch(e){historyErrors.push({relation_id:id,error:e.message});}
}
const historyById=new Map(histories.map(x=>[x.relation_id,x]));

const unmatched=(reconciliation.unmatched_osm||[]).map(x=>{
 const county=norm(x.osm_parent_name);
 const sameCounty=uatRows.filter(r=>r.n_county===county);
 const nearest=sameCounty.map(r=>({
  legal_id:r.siruta,legal_name:r.name,legal_type:r.legal_type||null,legal_parent_name:r.county_name,
  edit_distance:lev(x.osm_name,r.name)
 })).sort((a,b)=>a.edit_distance-b.edit_distance||String(a.legal_id).localeCompare(String(b.legal_id))).slice(0,5);
 const components=(componentIndex.get(norm(x.osm_name))||[])
  .filter(c=>c.uat.n_county===county)
  .map(c=>({component_siruta:c.record.siruta,component_name:c.record.name,legal_id:c.uat.siruta,legal_name:c.uat.name,legal_type:c.uat.legal_type||null,legal_parent_name:c.uat.county_name}));
 return {
  ...x,
  current_osm_tags:tagsOf(featureByRelation.get(x.osm_relation_id)),
  history:historyById.get(x.osm_relation_id)||null,
  exact_component_locality_candidates:components,
  nearest_official_uat_candidates:nearest,
  audit_classification:components.length===1?'exact_component_locality_points_to_single_uat':'requires_review'
 };
});

const duplicateGroups=(reconciliation.duplicate_legal_mappings||[]).map(g=>{
 const items=(g.osm_relation_ids||[]).map(id=>{
  const f=featureByRelation.get(id),e=entityByRelation.get(id);
  return {relation_id:id,name:e?.name||tagsOf(f).name||null,parent_id:e?.parent_id||null,area_km2:f?area(f)/1e6:null,tags:tagsOf(f),history:historyById.get(id)||null};
 });
 let overlap=null;
 if(items.length===2){
  const a=featureByRelation.get(items[0].relation_id),b=featureByRelation.get(items[1].relation_id);
  try{
   const i=intersect(featureCollection([a,b]));
   const ia=i?area(i)/1e6:0,aa=area(a)/1e6,ba=area(b)/1e6;
   overlap={intersection_km2:ia,intersection_over_smaller:Math.min(aa,ba)?ia/Math.min(aa,ba):null,intersection_over_union:(aa+ba-ia)?ia/(aa+ba-ia):null};
  }catch(e){overlap={error:e.message};}
 }
 return {...g,items,overlap};
});

const typeMismatches=(reconciliation.type_mismatches||[]).map(x=>({
 ...x,
 current_osm_tags:tagsOf(featureByRelation.get(x.osm_relation_id)),
 history:historyById.get(x.osm_relation_id)||null,
 audit_classification:'official_legal_type_conflicts_with_osm_classifier'
}));

const checks=[],failures=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)failures.push({name,detail});};
check('all_exception_histories_available',historyErrors.length===0,{errors:historyErrors});
check('all_unmatched_cases_audited',unmatched.length===(reconciliation.unmatched_osm||[]).length,{count:unmatched.length});
check('all_duplicate_groups_audited',duplicateGroups.length===(reconciliation.duplicate_legal_mappings||[]).length,{count:duplicateGroups.length});
check('all_type_mismatches_audited',typeMismatches.length===(reconciliation.type_mismatches||[]).length,{count:typeMismatches.length});

const report={
 schema_version:1,generated_at:new Date().toISOString(),jurisdiction:'RO',
 scope:'Targeted audit of unresolved/duplicate/type-conflict cases from official SIRUTA reconciliation.',
 policy:'Diagnostic only. Exact SIRUTA hierarchy and OSM provenance are recorded; no fuzzy candidate is auto-assigned. OSM geometry is not treated as legal authority.',
 status:failures.length?'FAIL':'PASS',checks,
 summary:{
  target_relation_count:targetIds.length,
  unmatched_case_count:unmatched.length,
  exact_component_locality_single_uat_count:unmatched.filter(x=>x.audit_classification==='exact_component_locality_points_to_single_uat').length,
  requires_review_count:unmatched.filter(x=>x.audit_classification==='requires_review').length,
  duplicate_group_count:duplicateGroups.length,
  type_mismatch_count:typeMismatches.length,
  history_error_count:historyErrors.length
 },
 unmatched,duplicate_groups:duplicateGroups,type_mismatches:typeMismatches,failures
};
const historyOut={schema_version:1,generated_at:report.generated_at,source:'OpenStreetMap API 0.6 relation history',relation_count:targetIds.length,history_count:histories.length,error_count:historyErrors.length,errors:historyErrors,relations:histories};
await mkdir('data/current',{recursive:true});await mkdir('data/sources',{recursive:true});
await writeFile('data/current/ro-official-exception-audit.json',JSON.stringify(report,null,2)+'\n');
await writeFile('data/sources/ro-osm-official-exception-history.json',JSON.stringify(historyOut,null,2)+'\n');
console.log(JSON.stringify({status:report.status,summary:report.summary,failures},null,2));
if(failures.length)process.exitCode=1;
