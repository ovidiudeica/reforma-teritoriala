#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [inventory,catalog,pub,siruta,cuatm,mdRecon,mdSemantic,roOfficialOnly,roOtherLevel]=await Promise.all([
 read('data/current/administrative-inventory.json'),read('data/current/entities.json'),read('public/data/actual-entities.json'),
 read('data/sources/ro-siruta-current.json'),read('data/sources/cuatm-current.json'),read('data/current/md-cuatm-reconciliation.json'),read('data/current/md-cuatm-semantic-bridge.json'),
 read('data/sources/ro-official-only-reviewed-resolutions.json'),read('data/sources/ro-other-level-reviewed-resolutions.json')
]);
if(mdSemantic.status!=='PASS')throw new Error('MD CUATM semantic bridge is not PASS');
const OUTPUT='data/current/actual-structural-completeness-audit.json';
const publicEntities=pub.entities||[], catalogEntities=catalog.entities||[];
const publicLegal=new Map();
for(const e of publicEntities){const r=e.legal?.registry,id=e.legal?.id;if(r&&id){const k=r+':'+String(id);if(!publicLegal.has(k))publicLegal.set(k,[]);publicLegal.get(k).push(e.id);}}
const reviewedRoOfficialOnly=new Set((roOfficialOnly.items||[]).map(x=>String(x.legal_id)));
const reviewedRoOtherLevel=new Set((roOtherLevel.items||[]).map(x=>String(x.legal_id)));
const reviewedRoCoverage=new Set([...reviewedRoOfficialOnly,...reviewedRoOtherLevel]);
const rows=[],blocking=[];
const add=(jurisdiction,type,official,covered,missing,mode,detail={})=>{const row={jurisdiction,type,official_count:official,covered_official_identity_count:covered,missing_official_identity_count:missing.length,coverage_status:mode,missing_official_identities:missing,...detail};rows.push(row);if(mode==='FAIL')blocking.push({jurisdiction,type,missing_count:missing.length,missing_official_identities:missing});};
const sir=siruta.records||[];
const roUat=sir.filter(r=>Number(r.level)===2);
for(const type of ['municipality','town','commune','sector']){
 const official=roUat.filter(r=>(r.legal_type||'commune')===type);
 const missing=official.filter(r=>!publicLegal.has('SIRUTA:'+String(r.siruta))&&!reviewedRoCoverage.has(String(r.siruta))).map(r=>({id:String(r.siruta),name:r.name,parent_id:r.parent_siruta??null,parent_name:r.parent_name??null}));
 add('RO',type,official.length,official.length-missing.length,missing,missing.length?'FAIL':'PASS',{official_registry:'SIRUTA',exhaustive:true,reviewed_exception_coverage_count:official.filter(r=>reviewedRoCoverage.has(String(r.siruta))).length});
}
const roCounties=[...new Map(roUat.filter(r=>r.county_code).map(r=>[String(r.county_code),r.county_name||null])).entries()];
const missingRoCounties=roCounties.filter(([code])=>!publicLegal.has('SIRUTA:'+code)).map(([id,name])=>({id,name}));
add('RO','county',roCounties.length,roCounties.length-missingRoCounties.length,missingRoCounties,missingRoCounties.length?'FAIL':'PASS',{official_registry:'SIRUTA',exhaustive:true,identity_bridge:'data/current/ro-county-siruta-bridge.json'});
add('RO','state',1,null,[],'OBSERVATIONAL',{reason:'State boundary is intentionally outside the ACTUAL administrative-unit catalog imported at levels 4/8/9; country geometry is used as import containment context, not a catalog entity.'});
add('RO','component_locality',sir.filter(r=>Number(r.level)!==2).length,null,[],'NOT_DETERMINED',{official_registry:'SIRUTA',reason:'Inventory declares component localities, but ACTUAL geometry policy does not currently require exhaustive polygon boundaries for settlements.'});

const md=cuatm.records||[];
const isChisinauSector=r=>r.status_code==='4'&&r.parent_code==='0100';
const semanticByType=new Map();
for(const x of mdSemantic.classifications||[]){
 if(!semanticByType.has(x.semantic_type))semanticByType.set(x.semantic_type,[]);
 semanticByType.get(x.semantic_type).push(x);
}
const officialByType={
 district:md.filter(r=>r.status_code==='2'&&!/gagauz/i.test(r.name||'')),
 level_2_municipality:md.filter(r=>r.status_code==='5'),
 special_territorial_unit:md.filter(r=>r.status_code==='2'&&/gagauz/i.test(r.name||''),),
 level_1_municipality:semanticByType.get('level_1_municipality')||[],
 town:semanticByType.get('town')||[],
 commune:semanticByType.get('commune')||[],
 independent_village:semanticByType.get('independent_village')||[],
 chisinau_sector:md.filter(isChisinauSector)
};
for(const type of ['district','level_2_municipality','special_territorial_unit','level_1_municipality','town','commune','independent_village','chisinau_sector']){
 const official=officialByType[type]||[];
 const missing=official.filter(r=>{
  const id=String(r.code??r.legal_id);
  return !publicLegal.has('CUATM:'+id);
 }).map(r=>({id:String(r.code??r.legal_id),name:r.name??r.legal_name??null,parent_id:r.parent_code??r.parent_id??null,parent_name:r.parent_name??null,status_code:r.status_code??null,semantic_type:r.semantic_type??type}));
 add('MD',type,official.length,official.length-missing.length,missing,missing.length?'FAIL':'PASS',{
  official_registry:'CUATM',exhaustive:true,
  semantic_bridge:['level_1_municipality','town','commune','independent_village'].includes(type)?'data/current/md-cuatm-semantic-bridge.json':null
 });
}
add('MD','state',1,null,[],'OBSERVATIONAL',{reason:'State boundary is intentionally outside the ACTUAL administrative-unit catalog imported at levels 4/6/8/9; country geometry is used as import containment context, not a catalog entity.'});
add('MD','locality',md.filter(r=>['6','9'].includes(String(r.status_code))).length,null,[],'NOT_DETERMINED',{official_registry:'CUATM',reason:'Inventory declares component localities, but ACTUAL geometry policy does not currently require exhaustive polygon boundaries for settlements.'});
const declared=Object.entries(inventory.countries).flatMap(([j,c])=>c.levels.map(x=>j+':'+x.type));
const audited=new Set(rows.map(x=>x.jurisdiction+':'+x.type));
const undeclaredCoverage=declared.filter(x=>!audited.has(x));
const undetermined=rows.filter(x=>x.coverage_status==='NOT_DETERMINED');
const report={schema_version:1,generated_at:new Date().toISOString(),mode:'ACTUAL',scope:['RO','MD'],status:blocking.length?'FAIL':undetermined.length?'NOT_DETERMINED':'PASS',policy:{pass:'Exact official-identity coverage where the official registry and subtype mapping are exhaustive.',fail:'At least one official identity in an exactly auditable declared type is absent from the public ACTUAL legal-identity set.',not_determined:'Declared types whose official source or current semantic classifier is insufficient for an exact per-type completeness assertion. This is never treated as PASS.'},declared_type_count:declared.length,audited_type_count:rows.length,undeclared_coverage:undeclaredCoverage,blocking_gap_count:blocking.reduce((n,x)=>n+x.missing_count,0),blocking_gaps:blocking,not_determined_type_count:undetermined.length,not_determined_types:undetermined.map(x=>({jurisdiction:x.jurisdiction,type:x.type,reason:x.reason||null})),types:rows};
await mkdir('data/current',{recursive:true});await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exit(1);

// CI validation trigger: structural completeness runs only after regenerated public contract.
