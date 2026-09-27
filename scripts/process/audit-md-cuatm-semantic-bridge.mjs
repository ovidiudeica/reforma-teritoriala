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

const municipalityNames=policy.current_municipalities||[];
const municipalityNorm=new Map();
for(const name of municipalityNames){
 const k=norm(name);
 if(municipalityNorm.has(k))issues.push({issue:'duplicate_policy_municipality_name',name});
 municipalityNorm.set(k,name);
}
const officialMunicipalities=[];
for(const [k,policyName] of municipalityNorm){
 const hits=records.filter(r=>norm(r.name)===k);
 if(hits.length!==1){
  issues.push({issue:'municipality_name_resolution',name:policyName,candidate_count:hits.length,candidates:hits.map(r=>({code:r.code,name:r.name,status_code:r.status_code}))});
  continue;
 }
 const r=hits[0];
 officialMunicipalities.push(r);
 if(String(r.status_code)!=='5')issues.push({issue:'municipality_not_status_5',name:policyName,code:r.code,status_code:r.status_code});
}
const status5=records.filter(r=>String(r.status_code)==='5');
const status5Unexpected=status5.filter(r=>!municipalityNorm.has(norm(r.name)));
for(const r of status5Unexpected)issues.push({issue:'status_5_not_in_exhaustive_municipality_policy',code:r.code,name:r.name});
if(status5.length!==municipalityNames.length)issues.push({issue:'municipality_cardinality',policy_count:municipalityNames.length,status_5_count:status5.length});

const childrenByParent=new Map();
for(const r of records){
 if(r.parent_code==null||r.parent_code==='')continue;
 const p=String(r.parent_code);
 if(!byCode.has(p))issues.push({issue:'broken_parent_reference',code:r.code,parent_code:p});
 if(!childrenByParent.has(p))childrenByParent.set(p,[]);
 childrenByParent.get(p).push(r);
}

const classifications=[];
const status3=records.filter(r=>String(r.status_code)==='3');
for(const r of status3){
 if(municipalityNorm.has(norm(r.name))){
  issues.push({issue:'status_3_overlaps_municipality_list',code:r.code,name:r.name});
  continue;
 }
 classifications.push({
  legal_id:String(r.code),legal_name:r.name,parent_id:r.parent_code==null?null:String(r.parent_code),parent_name:r.parent_name||null,
  status_code:'3',semantic_type:'town',classification_method:'status_3_excluding_exhaustive_current_municipality_list'
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

const byType=classifications.reduce((a,x)=>(a[x.semantic_type]=(a[x.semantic_type]||0)+1,a),{});
const classifiedIds=new Set(classifications.map(x=>x.legal_id));
const expectedPool=[...status3,...status8];
for(const r of expectedPool)if(!classifiedIds.has(String(r.code)))issues.push({issue:'semantic_pool_record_unclassified',code:r.code,name:r.name,status_code:r.status_code});
if(classifiedIds.size!==classifications.length)issues.push({issue:'duplicate_semantic_classification_identity'});

const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 jurisdiction:'MD',
 registry:'CUATM',
 status:issues.length?'FAIL':'PASS',
 policy_source:POLICY,
 official_snapshot:SNAPSHOT,
 policy:'Fail-closed official semantic bridge. status_code=3 is town only after exhaustive municipality-list exclusion. status_code=8 is commune iff direct CUATM component-locality children exist, otherwise independent village. OSM is not used as legal subtype evidence. Component-locality geometry completeness remains a separate policy question.',
 municipality_validation:{
  policy_count:municipalityNames.length,
  status_5_count:status5.length,
  resolved_count:officialMunicipalities.length,
  status_3_overlap_count:status3.filter(r=>municipalityNorm.has(norm(r.name))).length,
  municipalities:officialMunicipalities.map(r=>({legal_id:String(r.code),legal_name:r.name,status_code:String(r.status_code),parent_id:r.parent_code==null?null:String(r.parent_code)}))
 },
 summary:{
  status_3_count:status3.length,
  status_8_count:status8.length,
  classified_count:classifications.length,
  town_count:byType.town||0,
  level_1_municipality_count:0,
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
