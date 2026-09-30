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
const [osm,siruta,cuatm]=await Promise.all([
 read('data/sources/osm-current.json'),
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
 mode:'ACTUAL_SOURCE_FRESHNESS',
 checked_at:NOW.toISOString(),
 status:sources.every(item=>item.status==='PASS')?'PASS':'STALE',
 policy,
 sources
};
await writeFile(process.env.ACTUAL_FRESHNESS_REPORT||'actual-source-freshness.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
