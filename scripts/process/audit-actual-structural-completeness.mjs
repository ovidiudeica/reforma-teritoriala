#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [inventory,catalog,pub,siruta,cuatm,mdRecon]=await Promise.all([
 read('data/current/administrative-inventory.json'),read('data/current/entities.json'),read('public/data/actual-entities.json'),
 read('data/sources/ro-siruta-current.json'),read('data/sources/cuatm-current.json'),read('data/current/md-cuatm-reconciliation.json')
]);
const OUTPUT='data/current/actual-structural-completeness-audit.json';
const publicEntities=pub.entities||[], catalogEntities=catalog.entities||[];
const publicLegal=new Map();
for(const e of publicEntities){const r=e.legal?.registry,id=e.legal?.id;if(r&&id){const k=r+':'+String(id);if(!publicLegal.has(k))publicLegal.set(k,[]);publicLegal.get(k).push(e.id);}}
const rows=[],blocking=[];
const add=(jurisdiction,type,official,covered,missing,mode,detail={})=>{const row={jurisdiction,type,official_count:official,covered_official_identity_count:covered,missing_official_identity_count:missing.length,coverage_status:mode,missing_official_identities:missing,...detail};rows.push(row);if(mode==='FAIL')blocking.push({jurisdiction,type,missing_count:missing.length,missing_official_identities:missing});};
const sir=siruta.records||[];
const roUat=sir.filter(r=>Number(r.level)===2);
for(const type of ['municipality','town','commune','sector']){
 const official=roUat.filter(r=>(r.legal_type||'commune')===type);
 const missing=official.filter(r=>!publicLegal.has('SIRUTA:'+String(r.siruta))).map(r=>({id:String(r.siruta),name:r.name,parent_id:r.parent_siruta??null,parent_name:r.parent_name??null}));
 add('RO',type,official.length,official.length-missing.length,missing,missing.length?'FAIL':'PASS',{official_registry:'SIRUTA',exhaustive:true});
}
const roCounties=[...new Map(roUat.filter(r=>r.county_code).map(r=>[String(r.county_code),r.county_name||null])).entries()];
add('RO','county',roCounties.length,null,[], 'NOT_DETERMINED',{official_registry:'SIRUTA',exhaustive:true,reason:'Current SIRUTA snapshot identifies county codes/names but public county entities are not bound to SIRUTA legal IDs; requires a county-code identity bridge before exact identity completeness can be asserted.'});
add('RO','state',1,catalogEntities.some(e=>e.jurisdiction==='RO'&&String(e.osm?.admin_level)==='2')?1:0,[], 'OBSERVATIONAL',{reason:'State is not represented by SIRUTA UAT identity.'});
add('RO','component_locality',sir.filter(r=>Number(r.level)!==2).length,null,[],'NOT_DETERMINED',{official_registry:'SIRUTA',reason:'Inventory declares component localities, but ACTUAL geometry policy does not currently require exhaustive polygon boundaries for settlements.'});

const md=cuatm.records||[], matchedIds=new Set((mdRecon.matches||[]).filter(x=>x.legal_id).map(x=>String(x.legal_id)));
const statusMap={district:['2'],level_2_municipality:['5'],special_territorial_unit:['2'],level_1_municipality:['3'],town:['3'],commune:['8'],independent_village:['8'],chisinau_sector:['4']};
const isChisinauSector=r=>r.status_code==='4'&&r.parent_code==='0100';
const classifiers={
 chisinau_sector:isChisinauSector,
 district:r=>r.status_code==='2'&&!/gagauz/i.test(r.name||''),
 special_territorial_unit:r=>r.status_code==='2'&&/gagauz/i.test(r.name||''),
 level_2_municipality:r=>r.status_code==='5',
 level_1_municipality:r=>r.status_code==='3'&&r.parent_code!=null,
 town:r=>r.status_code==='3'&&r.parent_code!=null,
 commune:r=>r.status_code==='8',
 independent_village:r=>r.status_code==='8'
};
for(const type of ['district','level_2_municipality','special_territorial_unit','level_1_municipality','town','commune','independent_village','chisinau_sector']){
 let official=md.filter(classifiers[type]);
 // CUATM status alone cannot distinguish town vs level-I municipality, nor commune vs independent village.
 if(['level_1_municipality','town','commune','independent_village'].includes(type)){add('MD',type,official.length,null,[],'NOT_DETERMINED',{official_registry:'CUATM',reason:'CUATM status_code alone does not uniquely distinguish this declared semantic subtype; subtype classifier/bridge is required before exact per-type completeness can be asserted.'});continue;}
 const missing=official.filter(r=>!matchedIds.has(String(r.code))).map(r=>({id:String(r.code),name:r.name,parent_id:r.parent_code??null,parent_name:r.parent_name??null,status_code:r.status_code}));
 add('MD',type,official.length,official.length-missing.length,missing,missing.length?'FAIL':'PASS',{official_registry:'CUATM',exhaustive:true});
}
add('MD','state',1,catalogEntities.some(e=>e.jurisdiction==='MD'&&String(e.osm?.admin_level)==='2')?1:0,[],'OBSERVATIONAL',{reason:'State is outside CUATM UAT identity.'});
add('MD','locality',md.filter(r=>['6','9'].includes(String(r.status_code))).length,null,[],'NOT_DETERMINED',{official_registry:'CUATM',reason:'Inventory declares component localities, but ACTUAL geometry policy does not currently require exhaustive polygon boundaries for settlements.'});
const declared=Object.entries(inventory.countries).flatMap(([j,c])=>c.levels.map(x=>j+':'+x.type));
const audited=new Set(rows.map(x=>x.jurisdiction+':'+x.type));
const undeclaredCoverage=declared.filter(x=>!audited.has(x));
const report={schema_version:1,generated_at:new Date().toISOString(),mode:'ACTUAL',scope:['RO','MD'],status:blocking.length?'FAIL':'PASS',policy:{pass:'Exact official-identity coverage where the official registry and subtype mapping are exhaustive.',fail:'At least one official identity in an exactly auditable declared type is absent from the public ACTUAL legal-identity set.',not_determined:'Declared types whose official source or current semantic classifier is insufficient for an exact per-type completeness assertion. This is never treated as PASS.'},declared_type_count:declared.length,audited_type_count:rows.length,undeclared_coverage:undeclaredCoverage,blocking_gap_count:blocking.reduce((n,x)=>n+x.missing_count,0),blocking_gaps:blocking,types:rows};
await mkdir('data/current',{recursive:true});await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(blocking.length)process.exit(1);

// CI validation trigger: structural completeness runs only after regenerated public contract.
