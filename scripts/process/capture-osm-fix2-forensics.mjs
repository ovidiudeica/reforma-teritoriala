#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const POLICY='data/sources/osm-source-transition-policy.json';
const REPORT=process.env.OSM_FIX2_FORENSICS_REPORT||'outputs/osm-fix2-per-id-forensics.json';
const API='https://api.openstreetmap.org/api/0.6';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const canonicalize=value=>{
 if(Array.isArray(value))return value.map(canonicalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalize(value[k])]));
 return value;
};
const evidenceHash=elements=>sha256(Buffer.from(JSON.stringify(canonicalize(elements)),'utf8'));
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchText(url,{allowGone=false}={}){
 let last;
 for(let attempt=1;attempt<=3;attempt++){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch(url,{headers:{accept:'application/json','user-agent':'reforma-teritoriala-osm-fix2/1.0'},signal:controller.signal});
   const body=await response.text();
   if(allowGone&&(response.status===404||response.status===410))return {status:response.status,body:null};
   if(!response.ok)throw new Error('HTTP '+response.status+' '+body.slice(0,160));
   return {status:response.status,body};
  }catch(error){
   last=error;
   if(attempt<3)await sleep(1000*attempt);
  }finally{clearTimeout(timer);}
 }
 throw new Error('OSM API fetch failed '+url+': '+String(last?.message||last));
}
async function fetchJson(url,options){
 const result=await fetchText(url,options);
 return {...result,json:result.body?JSON.parse(result.body):null};
}
const tags=row=>({
 name:row?.tags?.name||null,official_name:row?.tags?.official_name||null,full_name:row?.tags?.full_name||null,
 boundary:row?.tags?.boundary||null,admin_level:row?.tags?.admin_level||null,place:row?.tags?.place||null,
 landuse:row?.tags?.landuse||null,type:row?.tags?.type||null,
 ref_cuatm_codunic:row?.tags?.['ref:cuatm:codunic']||row?.tags?.cuatm||null,
 ref_rson_idno:row?.tags?.['ref:rson:idno']||null
});

async function main(){
 const [policy,cuatmClassification]=await Promise.all([
  readJson(POLICY),readJson('data/current/md-cuatm-non-cuatm-allotments.json')
 ]);
 const classificationById=new Map((cuatmClassification.items||[]).map(x=>[Number(x.osm_relation_id),x]));
 const rows=[],failures=[];
 for(const expected of policy.expected_transition.retired_relations||[]){
  const history=await fetchJson(API+'/relation/'+expected.relation_id+'/history.json');
  const elements=(history.json?.elements||[]).filter(x=>x.type==='relation'&&Number(x.id)===Number(expected.relation_id));
  const last=elements.at(-1),lastVisible=[...elements].reverse().find(x=>x.visible!==false);
  const current=await fetchText(API+'/relation/'+expected.relation_id+'/full.json',{allowGone:true});
  const cuatm=classificationById.get(Number(expected.relation_id))||null;
  const checks={
   history_present:elements.length>0,
   deletion_matches:Boolean(last?.visible===false
    && last.timestamp===expected.deletion_timestamp
    && Number(last.changeset)===Number(expected.deletion_changeset)),
   current_api_gone:current.status===Number(expected.required_current_api_status),
   previous_semantics:Boolean(lastVisible
    && lastVisible.tags?.boundary===expected.expected_previous.boundary
    && String(lastVisible.tags?.admin_level)===String(expected.expected_previous.admin_level)
    && lastVisible.tags?.place===expected.expected_previous.place),
   cuatm_unique_id_matches:String(lastVisible?.tags?.['ref:cuatm:codunic']||lastVisible?.tags?.cuatm||'')===String(expected.cuatm_unique_id),
   prior_cuatm_classification_matches:Boolean(cuatm
    && String(cuatm.raw_cuatm_unique_id)===String(expected.cuatm_unique_id)
    && cuatm.legal_id===null
    && cuatm.unmatched_reason==='code_absent_from_official_snapshot')
  };
  if(!Object.values(checks).every(Boolean))failures.push({relation_id:expected.relation_id,checks});
  rows.push({
   relation_id:expected.relation_id,
   osm_history_url:API+'/relation/'+expected.relation_id+'/history.json',
   history_elements_sha256:evidenceHash(elements),
   versions:elements.map(x=>({version:x.version,timestamp:x.timestamp,changeset:x.changeset,visible:x.visible!==false})),
   last_visible:lastVisible?{version:lastVisible.version,timestamp:lastVisible.timestamp,changeset:lastVisible.changeset,tags:tags(lastVisible),
    member_ways:(lastVisible.members||[]).filter(x=>x.type==='way').map(x=>x.ref)}:null,
   deletion:last?.visible===false?{version:last.version,timestamp:last.timestamp,changeset:last.changeset}:null,
   current_probe:{url:API+'/relation/'+expected.relation_id+'/full.json',http_status:current.status},
   cuatm_registry_context:cuatm?{
    raw_cuatm_unique_id:cuatm.raw_cuatm_unique_id,raw_cuatm_code:cuatm.raw_cuatm_code,
    legal_id:cuatm.legal_id,unmatched_reason:cuatm.unmatched_reason,
    verified_parent_legal_id:cuatm.verified_parent_legal_id,verified_parent_legal_name:cuatm.verified_parent_legal_name
   }:null,
   source_verdict:'RETIRED_FROM_CURRENT_OSM',
   legal_verdict:'NO_LEGAL_SUCCESSION_INFERENCE',
   checks
  });
 }
 const addedExpected=policy.expected_transition.added_relations?.[0];
 const added=await fetchJson(API+'/relation/'+addedExpected.relation_id+'.json');
 const currentRelation=(added.json?.elements||[]).find(x=>x.type==='relation'&&Number(x.id)===Number(addedExpected.relation_id));
 const additionChecks={
  current_relation_present:Boolean(currentRelation),
  version:Number(currentRelation?.version)===Number(addedExpected.version),
  timestamp:currentRelation?.timestamp===addedExpected.timestamp,
  changeset:Number(currentRelation?.changeset)===Number(addedExpected.changeset),
  cuatm:String(currentRelation?.tags?.['ref:cuatm:codunic']||'')===String(addedExpected.cuatm_unique_id),
  rson:String(currentRelation?.tags?.['ref:rson:idno']||'')===String(addedExpected.rson_idno),
  admin_level:String(currentRelation?.tags?.admin_level||'')===String(addedExpected.expected_current.admin_level),
  boundary:currentRelation?.tags?.boundary===addedExpected.expected_current.boundary,
  place:currentRelation?.tags?.place===addedExpected.expected_current.place
 };
 if(!Object.values(additionChecks).every(Boolean))failures.push({relation_id:addedExpected.relation_id,checks:additionChecks});
 const oldBoierul=rows.find(x=>x.relation_id===18967907);
 const linkExpected=policy.expected_transition.cartographic_successor_links?.[0];
 const cartographicLink={
  from_relation_id:linkExpected.from_relation_id,to_relation_id:linkExpected.to_relation_id,
  shared_cuatm_unique_id:String(oldBoierul?.last_visible?.tags?.ref_cuatm_codunic||'')===String(currentRelation?.tags?.['ref:cuatm:codunic']||'')
   ?String(currentRelation.tags['ref:cuatm:codunic']):null,
  shared_changeset:Number(oldBoierul?.deletion?.changeset)===Number(currentRelation?.changeset)?Number(currentRelation.changeset):null,
  shared_timestamp:oldBoierul?.deletion?.timestamp===currentRelation?.timestamp?currentRelation.timestamp:null,
  old_way_refs:oldBoierul?.last_visible?.member_ways||[],
  new_way_refs:(currentRelation?.members||[]).filter(x=>x.type==='way').map(x=>x.ref),
  cartographic_verdict:'UNRESOLVED',
  legal_successor_verdict:'UNRESOLVED'
 };
 if(cartographicLink.shared_cuatm_unique_id===linkExpected.required_shared_cuatm_unique_id
   && cartographicLink.shared_changeset===linkExpected.required_shared_changeset
   && cartographicLink.shared_timestamp===linkExpected.required_shared_timestamp){
  cartographicLink.cartographic_verdict='OSM_CARTOGRAPHIC_SUCCESSOR_SUPPORTED';
 }else failures.push({link:'18967907->21515245',cartographicLink});
 const changesetIds=[...new Set(rows.map(x=>x.deletion?.changeset).filter(Boolean).concat(currentRelation?.changeset||[]))].sort((a,b)=>a-b);
 const changesets=[];
 for(const id of changesetIds){
  const response=await fetchJson(API+'/changeset/'+id+'.json');
  const element=(response.json?.elements||[]).find(x=>x.type==='changeset')||null;
  changesets.push({changeset_id:id,url:API+'/changeset/'+id+'.json',elements_sha256:evidenceHash(element?[element]:[]),
   created_at:element?.created_at||null,closed_at:element?.closed_at||null,tags:element?.tags||null});
 }
 const report={
  schema:'osm-fix2-per-id-forensics-v1',
  status:failures.length?'BLOCKED_EVIDENCE':'PASS',
  transition_id:policy.transition_id,
  retired_relations:rows,
  added_relation:{
   relation_id:addedExpected.relation_id,
   osm_url:API+'/relation/'+addedExpected.relation_id+'.json',
   element_sha256:evidenceHash(currentRelation?[currentRelation]:[]),
   relation:currentRelation?{version:currentRelation.version,timestamp:currentRelation.timestamp,changeset:currentRelation.changeset,
    tags:tags(currentRelation),member_ways:(currentRelation.members||[]).filter(x=>x.type==='way').map(x=>x.ref)}:null,
   source_verdict:'CURRENT_OSM_ADDITION',legal_verdict:'NO_LEGAL_IDENTITY_INFERENCE',checks:additionChecks
  },
  cartographic_successor:cartographicLink,
  changesets,
  failures,
  guards:{actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'}
 };
 await mkdir('outputs',{recursive:true});
 await writeFile(REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,report:REPORT,retired_count:rows.length,
  added_relation:addedExpected.relation_id,cartographic_successor:cartographicLink.cartographic_verdict,
  legal_successor:cartographicLink.legal_successor_verdict,failures:failures.length},null,2));
 if(report.status!=='PASS')process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
