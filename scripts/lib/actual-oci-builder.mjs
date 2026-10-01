import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';

export const OCI_BUILDER_PATH='data/current/actual-oci-builder.json';
export const OCI_BUILDER_GATE_PATH='data/current/actual-oci-builder-gate.json';
export const OCI_BUILDER_ALGORITHM='actual-oci-builder-v1';
export const OCI_BUILDER_WORKFLOW_PATH='.github/workflows/build-actual-runtime-image.yml';

export const EXPECTED_OCI_BUILDER={
 buildx:{
  version:'v0.37.1',
  commit:'0b265a9f62db554fa9aba6dd19e1bd5704bc7d8a',
  platform:'linux-amd64',
  binary_url:'https://github.com/docker/buildx/releases/download/v0.37.1/buildx-v0.37.1.linux-amd64',
  binary_sha256:'9447199cdb435f25880548343c128a4b6650e8891ee598905d8d29d39a8e359b'
 },
 buildkit:{
  version:'v0.33.0',
  image:'moby/buildkit:v0.33.0',
  digest:'sha256:6c2fa84a6b61ccd72899dde4239f8d5717f05f9a8ca6f3cad185fb1a95a94de3',
  ref:'moby/buildkit:v0.33.0@sha256:6c2fa84a6b61ccd72899dde4239f8d5717f05f9a8ca6f3cad185fb1a95a94de3',
  image_id:'sha256:41f915d3a122bca46b3da83160cd805697b0faa1bf30b0c0de851eb78f992c70'
 },
 builder:{
  name:'actual-runtime-builder',
  driver:'docker-container',
  platform:'linux/amd64'
 }
};

export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function canonicalizeOciBuilder(value){
 if(Array.isArray(value))return value.map(canonicalizeOciBuilder);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalizeOciBuilder(value[key])]));
 return value;
}

export function ociBuilderFingerprint(manifest){
 const payload=canonicalizeOciBuilder({
  algorithm:OCI_BUILDER_ALGORITHM,
  toolchain:manifest?.toolchain??null,
  builder:manifest?.builder??null,
  source:manifest?.source??null
 });
 return {algorithm:OCI_BUILDER_ALGORITHM,sha256:sha256(Buffer.from(JSON.stringify(payload),'utf8')),payload};
}

export async function inspectOciBuilderDefinition({readFileFn=readFile}={}){
 const workflowBytes=await readFileFn(OCI_BUILDER_WORKFLOW_PATH);
 const workflow=workflowBytes.toString('utf8');
 const e=EXPECTED_OCI_BUILDER;
 const observed={
  buildx_version_pinned:workflow.includes('BUILDX_VERSION='+e.buildx.version),
  buildx_commit_pinned:workflow.includes('BUILDX_COMMIT='+e.buildx.commit),
  buildx_binary_url_pinned:workflow.includes(e.buildx.binary_url),
  buildx_binary_sha256_pinned:workflow.includes('BUILDX_SHA256='+e.buildx.binary_sha256),
  buildkit_ref_pinned:workflow.includes('BUILDKIT_REF='+e.buildkit.ref),
  docker_container_driver:workflow.includes('--driver docker-container'),
  named_builder:workflow.includes('BUILDER_NAME='+e.builder.name),
  runtime_gate_enabled:workflow.includes('ACTUAL_OCI_BUILDER_RUNTIME_CHECK=1 node scripts/process/audit-actual-oci-builder.mjs'),
  explicit_builder_for_build:workflow.includes('docker buildx --builder "$BUILDER_NAME" build'),
  double_build_gate:workflow.includes('test "$DIGEST_A" = "$DIGEST_B"')
 };
 return {
  toolchain:{buildx:{...e.buildx},buildkit:{...e.buildkit}},
  builder:{...e.builder},
  source:{builder_workflow:{path:OCI_BUILDER_WORKFLOW_PATH,sha256:sha256(workflowBytes)}},
  observed
 };
}

export function buildOciBuilderManifest(inspected){
 const draft={
  schema_version:1,
  mode:'ACTUAL_OCI_BUILDER',
  builder_fingerprint_algorithm:OCI_BUILDER_ALGORITHM,
  policy:'Exact OCI builder provenance for ACTUAL runtime images. Buildx binary bytes and release commit are pinned; BuildKit runs only from a digest-pinned docker-container image; the builder driver, name and target platform are fixed; runtime verification must pass before any runtime image build.',
  toolchain:inspected.toolchain,
  builder:inspected.builder,
  source:inspected.source
 };
 const fp=ociBuilderFingerprint(draft);
 return {...draft,builder_fingerprint_sha256:fp.sha256};
}

export async function validateOciBuilderManifest(manifest,{readFileFn=readFile}={}){
 const checks=[],failures=[];
 const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 let inspected=null,error=null;
 try{inspected=await inspectOciBuilderDefinition({readFileFn});}catch(err){error=err;}
 check('builder_schema_and_mode',manifest?.schema_version===1&&manifest?.mode==='ACTUAL_OCI_BUILDER',{schema_version:manifest?.schema_version??null,mode:manifest?.mode??null});
 if(error){
  check('builder_definition_readable',false,{error:error.message});
 }else{
  check('builder_toolchain_exact',JSON.stringify(canonicalizeOciBuilder(manifest?.toolchain??null))===JSON.stringify(canonicalizeOciBuilder({buildx:EXPECTED_OCI_BUILDER.buildx,buildkit:EXPECTED_OCI_BUILDER.buildkit})),{expected:{buildx:EXPECTED_OCI_BUILDER.buildx,buildkit:EXPECTED_OCI_BUILDER.buildkit},actual:manifest?.toolchain??null});
  check('builder_contract_exact',JSON.stringify(canonicalizeOciBuilder(manifest?.builder??null))===JSON.stringify(canonicalizeOciBuilder(EXPECTED_OCI_BUILDER.builder)),{expected:EXPECTED_OCI_BUILDER.builder,actual:manifest?.builder??null});
  check('builder_source_bytes_exact',JSON.stringify(canonicalizeOciBuilder(manifest?.source??null))===JSON.stringify(canonicalizeOciBuilder(inspected.source)),{expected:inspected.source,actual:manifest?.source??null});
  check('builder_workflow_contract',Object.values(inspected.observed).every(Boolean),inspected.observed);
 }
 const fp=ociBuilderFingerprint(manifest);
 check('builder_fingerprint_recomputes',manifest?.builder_fingerprint_algorithm===fp.algorithm&&manifest?.builder_fingerprint_sha256===fp.sha256,{algorithm:fp.algorithm,expected:fp.sha256,actual:manifest?.builder_fingerprint_sha256??null});
 return {status:failures.length?'FAIL':'PASS',checks,failures,inspected,fingerprint:fp};
}

const exec=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:64*1024*1024}).trim();

export async function validateOciBuilderRuntime({readFileFn=readFile}={}){
 const pluginPath=join(homedir(),'.docker/cli-plugins/docker-buildx');
 const checks=[],failures=[];
 const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 const e=EXPECTED_OCI_BUILDER;
 let binarySha=null,versionOutput=null,inspectOutput=null,containerName=null,configImage=null,imageId=null,repoDigests=[];
 try{
  binarySha=sha256(await readFileFn(pluginPath));
  versionOutput=exec('docker',['buildx','version']);
  inspectOutput=exec('docker',['buildx','inspect',e.builder.name,'--bootstrap']);
  containerName=exec('docker',['ps','--filter','name=buildx_buildkit_'+e.builder.name,'--format','{{.Names}}']).split(/\r?\n/).filter(Boolean)[0]??null;
  if(containerName){
   configImage=exec('docker',['inspect',containerName,'--format','{{.Config.Image}}']);
   imageId=exec('docker',['inspect',containerName,'--format','{{.Image}}']);
  }
  const repoJson=exec('docker',['image','inspect',e.buildkit.ref,'--format','{{json .RepoDigests}}']);
  repoDigests=JSON.parse(repoJson);
 }catch(err){
  check('builder_runtime_inspection',false,{error:err.message});
  return {status:'FAIL',checks,failures,observed:{plugin_path:pluginPath,binary_sha256:binarySha,version_output:versionOutput,inspect_output:inspectOutput,container_name:containerName,config_image:configImage,image_id:imageId,repo_digests:repoDigests}};
 }
 check('buildx_binary_sha256_exact',binarySha===e.buildx.binary_sha256,{expected:e.buildx.binary_sha256,actual:binarySha,plugin_path:pluginPath});
 check('buildx_version_commit_exact',versionOutput===`github.com/docker/buildx ${e.buildx.version} ${e.buildx.commit}`,{expected:`github.com/docker/buildx ${e.buildx.version} ${e.buildx.commit}`,actual:versionOutput});
 check('buildkit_driver_exact',new RegExp('^Driver:\\s+'+e.builder.driver+'$','m').test(inspectOutput),{expected:e.builder.driver});
 check('buildkit_version_exact',new RegExp('^BuildKit version:\\s+'+e.buildkit.version.replaceAll('.','\\.')+'$','m').test(inspectOutput),{expected:e.buildkit.version});
 check('buildkit_driver_image_exact',inspectOutput.includes(e.buildkit.ref),{expected:e.buildkit.ref});
 check('buildkit_container_image_exact',configImage===e.buildkit.ref,{expected:e.buildkit.ref,actual:configImage,container_name:containerName});
 check('buildkit_image_id_exact',imageId===e.buildkit.image_id,{expected:e.buildkit.image_id,actual:imageId});
 check('buildkit_repo_digest_exact',repoDigests.includes('moby/buildkit@'+e.buildkit.digest),{expected:'moby/buildkit@'+e.buildkit.digest,actual:repoDigests});
 return {status:failures.length?'FAIL':'PASS',checks,failures,observed:{plugin_path:pluginPath,binary_sha256:binarySha,version_output:versionOutput,inspect_output:inspectOutput,container_name:containerName,config_image:configImage,image_id:imageId,repo_digests:repoDigests}};
}
