#!/usr/bin/env node
// Run only in the isolated network-enabled ACTUAL source candidate, after import:osm.
// Independently verifies source bytes, then audits each previous selected OSM relation ID.
// Never substitutes historical geometry or changes the imported candidate.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {assessOsmSourceContinuityCountry,summarizeOsmSourceContinuity} from '../lib/osm-source-continuity.mjs';

const MANIFEST=process.env.OSM_CURRENT_SOURCE_MANIFEST||'data/sources/osm-current.json';
const BASELINE_MANIFEST=process.env.OSM_CONTINUITY_BASELINE_MANIFEST||'';
const REPORT='outputs/osm-source-continuity.json';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const before=BASELINE_MANIFEST
 ? JSON.parse(await readFile(BASELINE_MANIFEST,'utf8'))
 : JSON.parse(execFileSync('git',['show','HEAD:'+MANIFEST],{encoding:'utf8',maxBuffer:16*1024*1024}));
const after=JSON.parse(await readFile(MANIFEST,'utf8'));
const loadRaw=async(code,entry)=>{
  const semantic=String(entry?.semantic_sha256||'');
  const compressedHash=String(entry?.compressed_sha256||'');
  if(!/^[a-f0-9]{64}$/.test(semantic)||!/^[a-f0-9]{64}$/.test(compressedHash))throw new Error('OSM '+code+' invalid snapshot hashes');
  const expected='data/sources/osm-snapshots/'+code.toLowerCase()+'-'+semantic+'.json.gz';
  if(entry?.snapshot_path!==expected)throw new Error('OSM '+code+' unexpected snapshot path');
  const compressed=await readFile(expected);
  if(sha256(compressed)!==compressedHash)throw new Error('OSM '+code+' compressed SHA-256 mismatch');
  const canonical=gunzipSync(compressed);
  if(sha256(canonical)!==semantic)throw new Error('OSM '+code+' uncompressed SHA-256 mismatch');
  return JSON.parse(canonical.toString('utf8'));
};
let report;
try{
  const countries={};
  for(const code of ['RO','MD']){
    const baselineRaw=await loadRaw(code,before.countries[code]);
    const candidateRaw=await loadRaw(code,after.countries[code]);
    countries[code]=assessOsmSourceContinuityCountry({
      code,before,after,beforeRaw:baselineRaw,afterRaw:candidateRaw
    });
  }
  report=summarizeOsmSourceContinuity({before,after,countries});
  if(!Number.isFinite(Date.parse(after.snapshot_at))||Date.parse(after.snapshot_at)<Date.parse(before.snapshot_at)){
    report.status='BLOCKED_INVALID_SNAPSHOT_DATE';
  }
}catch(error){
  report={schema:'osm-source-per-id-continuity-v1',status:'BLOCKED_INVALID_SOURCE_PROVENANCE',
    baseline_snapshot_at:before?.snapshot_at||null,candidate_snapshot_at:after?.snapshot_at||null,
    error:String(error?.message||error)};
}
await mkdir('outputs',{recursive:true});
await writeFile(REPORT,JSON.stringify(report,null,2)+'\n',{flag:'w'});
console.log(JSON.stringify({status:report.status,report_path:REPORT,
  missing_total:report.missing_total??null,added_total:report.added_total??null,
  missing_by_country:Object.fromEntries(Object.entries(report.countries||{}).map(([code,c])=>[code,c.missing.map(x=>x.relation_id)])),
  error:report.error||null},null,2));
if(report.status!=='PASS'&&process.env.OSM_CONTINUITY_REPORT_ONLY!=='1')process.exitCode=1;
