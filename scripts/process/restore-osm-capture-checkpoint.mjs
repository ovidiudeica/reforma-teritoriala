// Read-only recovery of bytes from this repository, workflow and exact code SHA.
// Artifact contents are data; no downloaded program or shell text is executed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openSync,closeSync,createReadStream} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {validateResumeEnvelope} from '../lib/osm-capture-session.mjs';
import {extractCaptureCheckpoint} from '../lib/osm-capture-archive.mjs';
const id=process.env.OSM_RESUME_RUN_ID,repo=process.env.GITHUB_REPOSITORY;
assert.match(id??'',/^\d+$/);assert.equal(repo,'ovidiudeica/reforma-teritoriala');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const api=p=>JSON.parse(execFileSync('gh',['api','repos/'+repo+'/'+p],{encoding:'utf8',maxBuffer:4000000}));
const run=api('actions/runs/'+id),a=validateResumeEnvelope(run,api('actions/runs/'+id+'/artifacts').artifacts,{id,sha,repo});
await mkdir('outputs/osm-capture-checkpoint',{recursive:true});const zip='outputs/osm-resume-original.zip',fd=openSync(zip,'w');let download;try{download=spawnSync('gh',['api','repos/'+repo+'/actions/artifacts/'+a.id+'/zip'],{stdio:['ignore',fd,'pipe']});}finally{closeSync(fd);}assert.equal(download.status,0,'Checkpoint artifact download failed');const hash=createHash('sha256');for await(const chunk of createReadStream(zip))hash.update(chunk);assert.equal('sha256:'+hash.digest('hex'),a.digest,'GitHub checkpoint artifact digest mismatch');
extractCaptureCheckpoint(zip);
await writeFile('outputs/osm-resume-receipt.json',JSON.stringify({run_id:id,head_sha:sha,artifact_id:a.id,artifact_digest:a.digest,status:'RESTORED_DATA_PENDING_INVENTORY_EPOCH_AND_CHUNK_VALIDATION',source_promoted:false},null,2)+'\n');
console.log('Exact-head checkpoint restored; every state and chunk is revalidated by the importer.');
