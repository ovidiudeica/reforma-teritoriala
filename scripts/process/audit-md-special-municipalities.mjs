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
 const diagnostic_class=id==='0300'?'municipality_uat_with_multiple_city_representations':'municipality_uat_with_city_locality';
 const roles=levels.map(r=>({...r,representation_role:r.admin_level==='4'?'municipality_uat':id==='0300'?'city_representation_candidate':'city_locality'}));
 const canonical_uat_relation_id=roles.find(r=>r.representation_role==='municipality_uat')?.relation_id||null;
 const city_representation_relation_ids=roles.filter(r=>r.representation_role!=='municipality_uat').map(r=>r.relation_id);
 const geometry_review=id==='0300'?{required:true,reason:'Multiple lower-level city representations remain; compare geometry before selecting a canonical city representation.'}:{required:false,reason:'Single lower-level city/locality representation; retain alongside municipality UAT.'};
 return {legal_id:id,legal_name:official?.name||c?.legal_name||null,diagnostic_class,canonical_uat_relation_id,city_representation_relation_ids,geometry_review,official_cuatm:{record:slim(official),direct_children:children},osm:{chain:c||null,representations:roles,history:reps,pair_signals:h?.pair_signals||[]},review_conclusion:'Keep all geometries. The admin_level=4 relation is classified as the municipality/UAT representation; lower-level same-identity relations are city/locality representations. No lower-level geometry is deleted or made canonical by this audit.'};
});
const summary=results.reduce((a,x)=>(a[x.diagnostic_class]=(a[x.diagnostic_class]||0)+1,a),{});
const geometryReviewQueue=results.filter(x=>x.geometry_review.required).map(x=>({legal_id:x.legal_id,legal_name:x.legal_name,relation_ids:x.city_representation_relation_ids,reason:x.geometry_review.reason}));
const out={schema_version:2,generated_at:new Date().toISOString(),jurisdiction:'MD',scope:'Special same-CUATM municipality/city representation chains',policy:'Diagnostic only. CUATM structure and OSM history are recorded separately; no OSM relation or reconciliation mapping is removed or changed.',summary,geometry_review_queue:geometryReviewQueue,results};
await mkdir('data/current',{recursive:true});await writeFile('data/current/md-special-municipality-analysis.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(results.map(x=>({legal_id:x.legal_id,class:x.diagnostic_class,cuatm_children:x.official_cuatm.direct_children.length,osm_representations:x.osm.representations})),null,2));
