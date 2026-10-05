#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const baseline=JSON.parse(await readFile('public/geo/current/md-administrative.geojson','utf8'));
const before=new Map((baseline.features||[]).map(f=>[f.properties?.catalog_id,{id:f.properties?.catalog_id,name:f.properties?.tags?.name??f.properties?.name??null}]));
const run=(cmd,args)=>{
 const r=spawnSync(cmd,args,{stdio:'inherit',env:process.env});
 if(r.status!==0)process.exit(r.status??1);
};
run('npm',['run','import:osm']);
run('npm',['run','build:osm-actual']);
const current=JSON.parse(await readFile('public/geo/current/md-administrative.geojson','utf8'));
const after=new Map((current.features||[]).map(f=>[f.properties?.catalog_id,{id:f.properties?.catalog_id,name:f.properties?.tags?.name??f.properties?.name??null}]));
const removed=[...before.keys()].filter(id=>!after.has(id)).map(id=>before.get(id));
const added=[...after.keys()].filter(id=>!before.has(id)).map(id=>after.get(id));
const report=JSON.parse(await readFile('data/current/import-report.json','utf8'));
console.log('MD_REFRESH_ID_DIFF='+JSON.stringify({before:before.size,after:after.size,removed,added,warnings:(report.warnings||[]).filter(x=>x.jurisdiction==='MD')}));
