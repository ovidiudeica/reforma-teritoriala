#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const SNAPSHOT='data/sources/cuatm-current.json';
const POLICY='data/sources/md-cuatm-semantic-policy.json';
const OUTPUT='data/current/md-cuatm-semantic-bridge.json';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

const [snapshot,policy]=await Promise.all([read(SNAPSHOT),read(POLICY)]);
const records=snapshot.records||[];
const issues=[];
const byCode=new Map();
for(const r of records){
 const code=String(r.code??'');
 if(!code){issues.push({issue:'missing_code',record:r});continue;}
 if(byCode.has(code))issues.push({issue:'duplicate_cuatm_code',code});
 else byCode.set(code,r);
}

const childrenByParent=new Map();
for(const r of records){
 if(r.parent_code==null||r.parent_code==='')continue;
 const p=String(r.parent_code);
 if(!byCode.has(p))issues.push({issue:'broken_parent_reference',code:r.code,parent_code:p});
 if(!childrenByParent.has(p))childrenByParent.set(p,[]);
 childrenByParent.get(p).push(r);
}

const currentMunicipalities=policy.current_municipalities||[];
const level2Municipalities=policy.level_2_municipalities||[];
const municipalityByNorm=new Map();
for(const name of currentMunicipalities){
 const k=norm(name);
 if(municipalityByNorm.has(k))issues.push({issue:'duplicate_policy_municipality_name',name});
 municipalityByNorm.set(k,name);
}
const level2ByNorm=new Map();
for(const name of level2Municipalities){
 const k=norm(name);
 if(level2ByNorm.has(k))issues.push({issue:'duplicate_policy_level2_municipality_name',name});
 if(!municipalityByNorm.has(k))issues.push({issue:'level2_municipality_not_in_current_municipality_set',name});
 level2ByNorm.set(k,name);
}

const status5=records.filter(r=>String(r.status_code)==='5');
const resolvedMunicipalities=[];
for(const [k,policyName] of municipalityByNorm){
 const hits=status5.filter(r=>norm(r.name)===k);
 if(hits.length!==1){
  issues.push({issue:'municipality_status_5_resolution',name:policyName,candidate_count:hits.length,candidates:hits.map(r=>({code:r.code,name:r.name,status_code:r.status_code}))});
  continue;
 }
 resolvedMunicipalities.push(hits[0]);
}
for(const r of status5){
 if(!municipalityByNorm.has(norm(r.name)))issues.push({issue:'status_5_not_in_exhaustive_municipality_policy',code:r.code,name:r.name});
}
if(status5.length!==currentMunicipalities.length)issues.push({issue:'municipality_cardinality',policy_count:currentMunicipalities.length,status_5_count:status5.length});

for(const [k,policyName] of level2ByNorm){
 const hits=status5.filter(r=>norm(r.name)===k);
 if(hits.length!==1)issues.push({issue:'level2_municipality_resolution',name:policyName,candidate_count:hits.length});
}
const status3MunicipalityOverlap=records.filter(r=>String(r.status_code)==='3'&&municipalityByNorm.has(norm(r.name)));
if(status3MunicipalityOverlap.length)issues.push({issue:'status_3_overlaps_official_municipality_names',items:status3MunicipalityOverlap.map(r=>({code:r.code,name:r.name,parent_code:r.parent_code}))});

const classifications=[];
for(const r of status5){
 const semanticType=level2ByNorm.has(norm(r.name))?'level_2_municipality':'level_1_municipality';
 classifications.push({
  legal_id:String(r.code),legal_name:r.name,parent_id:r.parent_code==null?null:String(r.parent_code),parent_name:r.parent_name||null,
  status_code:'5',semantic_type:semanticType,
  classification_method:semanticType==='level_2_municipality'?'law_764_level_2_municipality_set':'status_5_excluding_exhaustive_level_2_set'
 });
}

const status3=records.filter(r=>String(r.status_code)==='3');
for(const r of status3){
 classifications.push({
  legal_id:String(r.code),legal_name:r.name,parent_id:r.parent_code==null?null:String(r.parent_code),parent_name:r.parent_name||null,
  status_code:'3',semantic_type:'town',classification_method:'cuatm_status_3_town'
 });
}

const status8=records.filter(r=>String(r.status_code)==='8');
for(const r of status8){
 const children=childrenByParent.get(String(r.code))||[];
 const invalid=children.filter(c=>String(c.status_code)!=='9');
 if(invalid.length){
  issues.push({issue:'status_8_has_non_status_9_children',code:r.code,name:r.name,children:invalid.map(c=>({code:c.code,name:c.name,status_code:c.status_code}))});
  continue;
 }
 const semanticType=children.length?'commune':'independent_village';
 classifications.push({
  legal_id:String(r.code),legal_name:r.name,parent_id:r.parent_code==null?null:String(r.parent_code),parent_name:r.parent_name||null,
  status_code:'8',semantic_type:semanticType,
  classification_method:children.length?'status_8_with_direct_status_9_components':'status_8_without_direct_components',
  direct_component_count:children.length,
  direct_component_ids:children.map(c=>String(c.code))
 });
}

const expectedPool=[...status5,...status3,...status8];
const classifiedIds=new Set(classifications.map(x=>x.legal_id));
for(const r of expectedPool)if(!classifiedIds.has(String(r.code)))issues.push({issue:'semantic_pool_record_unclassified',code:r.code,name:r.name,status_code:r.status_code});
if(classifiedIds.size!==classifications.length)issues.push({issue:'duplicate_semantic_classification_identity'});

const byType=classifications.reduce((a,x)=>(a[x.semantic_type]=(a[x.semantic_type]||0)+1,a),{});
const report={
 schema_version:2,
 generated_at:new Date().toISOString(),
 jurisdiction:'MD',
 registry:'CUATM',
 status:issues.length?'FAIL':'PASS',
 policy_source:POLICY,
 official_snapshot:SNAPSHOT,
 policy:'Fail-closed official semantic bridge. CUATM status_code=5 is municipality; Law 764/2001 separates level II (Chișinău, Bălți) from level I municipalities. status_code=3 is town. status_code=8 is commune iff direct CUATM component-locality children exist, otherwise independent village. OSM is never used as legal subtype evidence. Component-locality geometry completeness remains a separate policy question.',
 municipality_validation:{
  policy_count:currentMunicipalities.length,
  status_5_count:status5.length,
  resolved_count:resolvedMunicipalities.length,
  level_2_policy_count:level2Municipalities.length,
  status_3_municipality_name_overlap_count:status3MunicipalityOverlap.length,
  municipalities:status5.map(r=>({legal_id:String(r.code),legal_name:r.name,status_code:'5',parent_id:r.parent_code==null?null:String(r.parent_code),semantic_type:level2ByNorm.has(norm(r.name))?'level_2_municipality':'level_1_municipality'}))
 },
 summary:{
  status_5_count:status5.length,
  status_3_count:status3.length,
  status_8_count:status8.length,
  classified_count:classifications.length,
  level_2_municipality_count:byType.level_2_municipality||0,
  level_1_municipality_count:byType.level_1_municipality||0,
  town_count:byType.town||0,
  commune_count:byType.commune||0,
  independent_village_count:byType.independent_village||0,
  issue_count:issues.length
 },
 classifications,
 issues
};
await mkdir('data/current',{recursive:true});
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,municipality_validation:report.municipality_validation,summary:report.summary,issues:issues.slice(0,50)},null,2));
if(issues.length)process.exit(1);
