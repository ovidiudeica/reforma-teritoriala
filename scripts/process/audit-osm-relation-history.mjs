#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';

const groups=[
 {legal_id:'1050',legal_name:'Țînțăreni',relations:[12496850,19090932,18967632]},
 {legal_id:'3417',legal_name:'Dondușeni',relations:[19055800,19055814,18967876]},
 {legal_id:'7160',legal_name:'Văratic',relations:[19045240,19045254,18966798]},
 {legal_id:'8034',legal_name:'Recea',relations:[19100165,19100169,19100182]},
 {legal_id:'8341',legal_name:'Rogojeni, loc.st.c.f.',relations:[20181256,18968117]},
 {legal_id:'0100',legal_name:'Chișinău',relations:[1691801,1748490]},
 {legal_id:'0300',legal_name:'Bălți',relations:[58983,12207955,18967626]},
 {legal_id:'0500',legal_name:'Bender',relations:[9581354,12463379]}
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchText(url){
 let last;
 for(let i=1;i<=3;i++)try{
  const r=await fetch(url,{headers:{'user-agent':'reforma-teritoriala-history-audit/0.1'}});
  if(!r.ok)throw new Error('HTTP '+r.status);
  return await r.text();
 }catch(e){last=e;if(i<3)await sleep(2000*i);}
 throw last;
}
function attrs(s){return Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2].replaceAll('&quot;','"').replaceAll('&amp;','&')]));}
function versions(xml,id){
 const out=[];
 for(const m of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)){
  const a=attrs(m[1]),body=m[2],tags={},members=[];
  for(const t of body.matchAll(/<tag\b([^>]*)\/>/g)){const x=attrs(t[1]);tags[x.k]=x.v;}
  for(const mm of body.matchAll(/<member\b([^>]*)\/>/g)){const x=attrs(mm[1]);members.push({type:x.type,ref:Number(x.ref),role:x.role||''});}
  out.push({version:Number(a.version),timestamp:a.timestamp,changeset:Number(a.changeset),uid:a.uid?Number(a.uid):null,user:a.user||null,visible:a.visible!=='false',tags,members});
 }
 if(!out.length)throw new Error('No relation versions parsed for '+id);
 return out.sort((a,b)=>a.version-b.version);
}
function tagDiff(a,b){
 const keys=[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].sort();
 return keys.flatMap(k=>(a?.[k]===b?.[k]?[]:[{key:k,from:a?.[k]??null,to:b?.[k]??null}]));
}
function memberKey(m){return m.type+':'+m.ref+':'+m.role;}
function summarize(id,vs){
 const changes=vs.map((v,i)=>{
  const prev=vs[i-1],ps=new Set((prev?.members||[]).map(memberKey)),cs=new Set(v.members.map(memberKey));
  return {version:v.version,timestamp:v.timestamp,changeset:v.changeset,user:v.user,visible:v.visible,
   tag_changes:prev?tagDiff(prev.tags,v.tags):Object.entries(v.tags).sort().map(([key,to])=>({key,from:null,to})),
   members:{count:v.members.length,added:prev?[...cs].filter(x=>!ps.has(x)):v.members.map(memberKey),removed:prev?[...ps].filter(x=>!cs.has(x)):[]}};
 });
 const first=vs[0],last=vs.at(-1);
 return {relation_id:id,created_at:first.timestamp,created_changeset:first.changeset,current_version:last.version,last_modified_at:last.timestamp,last_changeset:last.changeset,current_tags:last.tags,current_member_count:last.members.length,versions:changes};
}
function compare(group,byId){
 const rows=group.relations.map(id=>byId.get(id));
 const signals=[];
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j];
  const close=Math.abs(new Date(a.created_at)-new Date(b.created_at))<=7*86400000;
  const sameCreationChangeset=a.created_changeset===b.created_changeset;
  const sameLastChangeset=a.last_changeset===b.last_changeset;
  signals.push({relations:[a.relation_id,b.relation_id],same_creation_changeset:sameCreationChangeset,created_within_7_days:close,same_last_changeset:sameLastChangeset});
 }
 return signals;
}
async function main(){
 await mkdir('data/sources',{recursive:true});
 const histories=[],errors=[];
 for(const g of groups)for(const id of g.relations){
  try{const xml=await fetchText('https://api.openstreetmap.org/api/0.6/relation/'+id+'/history');histories.push(summarize(id,versions(xml,id)));}
  catch(e){errors.push({relation_id:id,error:e.message});}
 }
 const byId=new Map(histories.map(x=>[x.relation_id,x]));
 const groupReviews=groups.map(g=>({...g,relations:g.relations.map(id=>byId.get(id)||{relation_id:id,error:'history unavailable'}),pair_signals:compare(g,byId)}));
 const out={schema_version:1,generated_at:new Date().toISOString(),source:'OpenStreetMap API 0.6 relation history',source_pattern:'https://api.openstreetmap.org/api/0.6/relation/{id}/history',relation_count:groups.flatMap(g=>g.relations).length,history_count:histories.length,error_count:errors.length,errors,groups:groupReviews};
 await writeFile('data/sources/md-osm-multiple-representation-history.json',JSON.stringify(out,null,2)+'\n');
 console.log('OSM relation histories:',histories.length,'errors:',errors.length);
 if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
