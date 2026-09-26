#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const audit=JSON.parse(await readFile('data/current/md-cuatm-consistency-audit.json','utf8'));
const cat=JSON.parse(await readFile('data/current/entities.json','utf8'));
const entities=(cat.entities||[]).filter(e=>e.jurisdiction==='MD'),byId=new Map(entities.map(e=>[e.id,e]));
const chains=(audit.duplicate_legal_ids||[]).filter(g=>g.duplicate_class==='same_identity_parent_child_chain');
const norm=v=>v==null?null:String(v).trim().toLowerCase();
function sig(e){return {id:e?.id||null,name:e?.name||null,admin_level:e?.osm?.admin_level??e?.admin_level??null,place:e?.osm?.place??e?.place??null,name_prefix:e?.osm?.name_prefix??e?.name_prefix??null,designation:e?.osm?.designation??e?.designation??null,relation_type:e?.osm?.relation_type??e?.relation_type??null};}
function classify(g){
 const edges=g.same_identity_edges.map(x=>({child:sig(byId.get(x.child)),parent:sig(byId.get(x.parent))}));
 const levelPairs=edges.map(x=>String(x.parent.admin_level||'?')+'>'+String(x.child.admin_level||'?'));
 const canonical=edges.length===1&&levelPairs[0]==='8>9';
 let family=canonical?'uat8_to_component_locality9':'special_chain';
 let subtype='special_non_8_to_9';
 if(canonical){
  const c=edges[0].child,p=edges[0].parent;
  const cp=norm(c.place),pp=norm(p.place);
  if(cp==='village')subtype='village';
  else if(cp==='town')subtype='town';
  else if(cp==='city')subtype='city';
  else subtype='tagging_other';
  if(!c.place)subtype='tagging_other';
 }
 return {legal_id:g.legal_id,legal_name:g.legal_name,count:g.count,family,subtype,level_pairs:levelPairs,edges};
}
const rows=chains.map(classify);
const byFamily=rows.reduce((a,x)=>(a[x.family]=(a[x.family]||0)+1,a),{});
const bySubtype=rows.filter(x=>x.family==='uat8_to_component_locality9').reduce((a,x)=>(a[x.subtype]=(a[x.subtype]||0)+1,a),{});
const levelPairs=rows.flatMap(x=>x.level_pairs).reduce((a,x)=>(a[x]=(a[x]||0)+1,a),{});
const exceptions=rows.filter(x=>x.family==='special_chain');
const out={generated_at:new Date().toISOString(),jurisdiction:'MD',scope:'same_identity_parent_child_chain',policy:'Diagnostic only; no OSM entity or CUATM reconciliation is altered.',chain_group_count:chains.length,summary:{by_family:byFamily,normal_family_subtypes:bySubtype,by_admin_level_edge:levelPairs,normal_family_count:rows.length-exceptions.length,exception_count:exceptions.length},exceptions,groups:rows};
await mkdir('data/current',{recursive:true});
await writeFile('data/current/md-cuatm-chain-pattern-audit.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({chain_group_count:out.chain_group_count,...out.summary},null,2));
