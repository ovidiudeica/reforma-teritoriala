#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const DAY=24*60*60*1000;
const NOW=new Date(process.env.ACTUAL_FRESHNESS_NOW||Date.now());
if(!Number.isFinite(NOW.getTime()))throw new Error('Invalid ACTUAL_FRESHNESS_NOW');

const policy={
 OSM:Number(process.env.ACTUAL_OSM_MAX_AGE_DAYS||14),
 SIRUTA:Number(process.env.ACTUAL_SIRUTA_MAX_AGE_DAYS||45),
 CUATM:Number(process.env.ACTUAL_CUATM_MAX_AGE_DAYS||45)
};
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const contract=await read('data/sources/osm-source-contract.json');
if(contract?.mode!=='OSM_SOURCE_ACTUAL_SEPARATION')throw new Error('Invalid OSM source/ACTUAL separation contract');
const currentOsmPath=contract.current_osm?.manifest_path;
const actualOsmPinPath=contract.actual_osm_pin?.manifest_path;
if(!currentOsmPath||!actualOsmPinPath||currentOsmPath===actualOsmPinPath)throw new Error('OSM current source must remain distinct from ACTUAL pin');
const [osm,siruta,cuatm]=await Promise.all([
 read(currentOsmPath),
 read('data/sources/ro-siruta-current.json'),
 read('data/sources/cuatm-current.json')
]);

const sources=[
 {name:'OSM',timestamp:osm.snapshot_at||osm.fetched_at,max_age_days:policy.OSM},
 {name:'SIRUTA',timestamp:siruta.fetched_at,max_age_days:policy.SIRUTA},
 {name:'CUATM',timestamp:cuatm.fetched_at,max_age_days:policy.CUATM}
].map(item=>{
 const stamp=new Date(item.timestamp);
 const age_days=(NOW.getTime()-stamp.getTime())/DAY;
 return {...item,age_days:Number(age_days.toFixed(3)),status:Number.isFinite(age_days)&&age_days>=0&&age_days<=item.max_age_days?'PASS':'STALE'};
});
const report={
 schema_version:1,
 mode:'SOURCE_FRESHNESS_WITH_ACTUAL_PIN_SEPARATION',
 checked_at:NOW.toISOString(),
 osm_contract:{
  current_source_manifest:currentOsmPath,
  actual_pinned_manifest:actualOsmPinPath,
  actual_mutation_allowed:contract.guards?.actual_mutation_allowed??null,
  p91_import_allowed:contract.guards?.p91_import_allowed??null,
  semantic_acceptance:contract.guards?.semantic_acceptance??null
 },
 status:sources.every(item=>item.status==='PASS')?'PASS':'STALE',
 policy,
 sources
};
await writeFile('actual-source-freshness.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
