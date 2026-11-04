#!/usr/bin/env node
// RT-HOST.1/2: immutable, read-only observation, pairing and admission checks.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {captureObservedHost} from '../lib/actual-host-trust.mjs';
import {RT_HOST_REPOSITORY,RT_HOST_WORKFLOW,bytes,captureHostEvidence,compareHostEvidence,validateHostAdmission} from '../lib/rt-host-qualification.mjs';

const args=process.argv.slice(2),mode=args.shift();
const opt=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]??null;};
const requireOpt=name=>{const value=opt(name);if(!value||value.startsWith('--'))throw Error('RT_HOST_REQUIRED_OPTION '+name);return value;};
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const save=async(path,value)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes(value));};
const baselineFile=opt('--base')||'data/current/actual-host-trust-manifest.json';
const baselineBytes=await readFile(baselineFile);
const baseline=JSON.parse(baselineBytes);
const git=cmd=>execFileSync('git',cmd,{encoding:'utf8'}).trim();

if(mode==='capture'){
 const lane=process.env.RT_HOST_LANE;
 if(!['A','B'].includes(lane))throw Error('RT_HOST_LANE must be A or B');
 const commit_sha=git(['rev-parse','HEAD']);
 if(process.env.RT_HOST_EXPECTED_SHA&&process.env.RT_HOST_EXPECTED_SHA!==commit_sha)
  throw Error('RT_HOST_CHECKOUT_SHA_MISMATCH');
 const source={
  repository:process.env.GITHUB_REPOSITORY??'',
  workflow:RT_HOST_WORKFLOW,
  commit_sha,
  event:process.env.GITHUB_EVENT_NAME??'',
  ref:process.env.GITHUB_REF??'',
  run_id:Number(process.env.GITHUB_RUN_ID),
  run_attempt:Number(process.env.GITHUB_RUN_ATTEMPT),
  lane,
  job:process.env.GITHUB_JOB??''
 };
 if(source.repository!==RT_HOST_REPOSITORY)throw Error('RT_HOST_UNEXPECTED_REPOSITORY');
 const record=captureHostEvidence({baseline,baselineBytes,observed:await captureObservedHost(),source});
 const path=opt('--out')||'outputs/rt-host/observation.json';
 await save(path,record);
 console.log(JSON.stringify({mode:'RT_HOST_CAPTURE',lane,commit_sha,run_id:source.run_id,
  image:record.observed.runner.image_version,profile_id:record.profile_id,
  profile_sha256:record.profile_sha256,validator:record.checks.validator_status,
  cpu_pass:record.checks.cpu.every(x=>x.ok),admitted:false,output:path},null,2));
}else if(mode==='compare'){
 const A=await readJson(requireOpt('--a')),B=await readJson(requireOpt('--b'));
 const report=compareHostEvidence({baseline,baselineBytes,A,B,targetImage:opt('--target')});
 const path=opt('--out')||'outputs/rt-host/comparison.json';
 await save(path,report);
 console.log(JSON.stringify({mode:'RT_HOST_COMPARE',status:report.status,failures:report.failures,
  A_image:A.observed.runner.image_version,B_image:B.observed.runner.image_version,
  A_source:A.source,B_source:B.source,proposed_profile_id:report.proposed_profile_id,
  candidate_fingerprint:report.profile_sha256,admitted:false,output:path},null,2));
 // "record-only" is a successful collection, NEVER an admission decision.
 if(args.includes('--require-qualified')&&report.status!=='QUALIFIED_PENDING_SEPARATE_ADMISSION')
  process.exitCode=1;
}else if(mode==='admission'){
 const proposed=await readJson(requireOpt('--proposed'));
 const A=await readJson(requireOpt('--a')),B=await readJson(requireOpt('--b'));
 const comparison=await readJson(requireOpt('--comparison'));
 const report=validateHostAdmission({baseline,baselineBytes,proposed,A,B,comparison});
 const path=opt('--out')||'outputs/rt-host/admission-review.json';
 await save(path,report);
 console.log(JSON.stringify({mode:'RT_HOST_ADMISSION_REVIEW',...report,output:path},null,2));
 if(report.status==='BLOCKED')process.exitCode=1;
}else throw Error('Usage: capture | compare | admission');
