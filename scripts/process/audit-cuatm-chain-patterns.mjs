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
 let pattern=canonical?'uat_level8_to_component_level9':'noncanonical_chain_shape';
 if(canonical){
  const c=edges[0].child,p=edges[0].parent;
  if(norm(c.place)==='village'&&['comuna','municipality','town','city','village',null].includes(norm(p.place)))pattern='uat8_to_locality9_village';
  else pattern='uat8_to_locality9_other_tags';
 }
 return {legal_id:g.legal_id,legal_name:g.legal_name,count:g.count,pattern,level_pairs:levelPairs,edges};
}
const rows=chains.map(classify);
const byPattern=rows.reduce((a,x)=>(a[x.pattern]=(a[x.pattern]||0)+1,a),{});
const levelPairs=rows.flatMap(x=>x.level_pairs).reduce((a,x)=>(a[x]=(a[x]||0)+1,a),{});
const exceptions=rows.filter(x=>x.pattern!=='uat8_to_locality9_village');
const out={generated_at:new Date().toISOString(),jurisdiction:'MD',scope:'same_identity_parent_child_chain',policy:'Diagnostic only; no OSM entity or CUATM reconciliation is altered.',chain_group_count:chains.length,summary:{by_pattern:byPattern,by_admin_level_edge:levelPairs,exception_count:exceptions.length},exceptions,groups:rows};
await mkdir('data/current',{recursive:true});
await writeFile('data/current/md-cuatm-chain-pattern-audit.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({chain_group_count:out.chain_group_count,...out.summary},null,2));
