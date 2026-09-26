#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const ids=['0100','0300','0500'];
const cu=JSON.parse(await readFile('data/sources/cuatm-current.json','utf8'));
const hist=JSON.parse(await readFile('data/sources/md-osm-multiple-representation-history.json','utf8'));
const chain=JSON.parse(await readFile('data/current/md-cuatm-chain-pattern-audit.json','utf8'));
const records=cu.records||[],byCode=new Map(records.map(x=>[x.code,x]));
const hg=new Map((hist.groups||[]).map(x=>[x.legal_id,x]));
const cg=new Map((chain.groups||[]).map(x=>[x.legal_id,x]));
const slim=r=>r&&({code:r.code,parent_code:r.parent_code,status_code:r.status_code,name:r.name,statistical_code:r.statistical_code,parent_statistical_code:r.parent_statistical_code,row:r.row});
const results=ids.map(id=>{
 const official=byCode.get(id),children=records.filter(x=>x.parent_code===id).map(slim);
 const h=hg.get(id),c=cg.get(id);
 const reps=(h?.relations||[]).map(r=>({relation_id:r.relation_id,created_at:r.created_at,created_changeset:r.created_changeset,current_version:r.current_version,last_modified_at:r.last_modified_at,last_changeset:r.last_changeset,current_tags:r.current_tags,current_member_count:r.current_member_count}));
 const levels=reps.map(r=>({relation_id:r.relation_id,admin_level:r.current_tags?.admin_level||null,place:r.current_tags?.place||null,name:r.current_tags?.name||null,name_prefix:r.current_tags?.['name:prefix']||r.current_tags?.name_prefix||null,official_name:r.current_tags?.official_name||null,full_name:r.current_tags?.full_name||null,cuatm:r.current_tags?.['ref:cuatm']||r.current_tags?.['ref:cuatm:codunic']||null}));
 const levelSet=new Set(levels.map(x=>x.admin_level));
 let diagnostic_class='municipality_uat_and_city_locality_representations';
 if(id==='0300')diagnostic_class='municipality_uat_intermediate_city_and_component_city_chain';
 return {legal_id:id,legal_name:official?.name||c?.legal_name||null,diagnostic_class,official_cuatm:{record:slim(official),direct_children:children},osm:{chain:c||null,representations:levels,history:reps,pair_signals:h?.pair_signals||[]},review_conclusion:'Keep all geometries. Treat the admin_level=4 municipality boundary as the UAT-level representation and lower-level same-identity city boundaries as locality/urban representations pending geometry canonicalization.'};
});
const out={schema_version:1,generated_at:new Date().toISOString(),jurisdiction:'MD',scope:'Special same-CUATM municipality/city representation chains',policy:'Diagnostic only. CUATM structure and OSM history are recorded separately; no OSM relation or reconciliation mapping is removed or changed.',results};
await mkdir('data/current',{recursive:true});await writeFile('data/current/md-special-municipality-analysis.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(results.map(x=>({legal_id:x.legal_id,class:x.diagnostic_class,cuatm_children:x.official_cuatm.direct_children.length,osm_representations:x.osm.representations})),null,2));
