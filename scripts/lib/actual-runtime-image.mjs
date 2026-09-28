import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const RUNTIME_IMAGE_PATH='data/current/actual-runtime-image.json';
export const RUNTIME_IMAGE_ALGORITHM='actual-oci-runtime-v1';
export const RUNTIME_DOCKERFILE_PATH='container/actual-runtime/Dockerfile';
export const RUNTIME_BUILDER_WORKFLOW_PATH='.github/workflows/build-actual-runtime-image.yml';
export const EXPECTED_RUNTIME_IMAGE={
 image:'ghcr.io/ovidiudeica/reforma-teritoriala-actual-runtime',
 digest:'sha256:f42f3147dade3cdc7cc0765a70e4549a882015e81194ae242e709fc7aa0a0f40',
 ref:'ghcr.io/ovidiudeica/reforma-teritoriala-actual-runtime@sha256:f42f3147dade3cdc7cc0765a70e4549a882015e81194ae242e709fc7aa0a0f40',
 platform:'linux/amd64',
 base_image:'node:24.21.0-bookworm',
 base_digest:'sha256:64af3819f9275802414d7cdc38c27e9d82bd564dec4d4da87d008255d36c63b4',
 base_ref:'node:24.21.0-bookworm@sha256:64af3819f9275802414d7cdc38c27e9d82bd564dec4d4da87d008255d36c63b4',
 node:'24.21.0',
 npm:'11.19.0'
};
export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function canonicalizeRuntime(value){
 if(Array.isArray(value))return value.map(canonicalizeRuntime);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalizeRuntime(value[key])]));
 return value;
}

export function runtimeImageFingerprint(manifest){
 const payload=canonicalizeRuntime({
  algorithm:RUNTIME_IMAGE_ALGORITHM,
  runtime:manifest?.runtime??null,
  source:manifest?.source??null,
  reproducibility:manifest?.reproducibility??null
 });
 return {
  algorithm:RUNTIME_IMAGE_ALGORITHM,
  sha256:sha256(Buffer.from(JSON.stringify(payload),'utf8')),
  payload
 };
}

export async function inspectRuntimeImageDefinition({readFileFn=readFile}={}){
 const [dockerfileBytes,builderBytes]=await Promise.all([
  readFileFn(RUNTIME_DOCKERFILE_PATH),
  readFileFn(RUNTIME_BUILDER_WORKFLOW_PATH)
 ]);
 const dockerfile=dockerfileBytes.toString('utf8');
 const builder=builderBytes.toString('utf8');
 const baseMatch=dockerfile.match(/^ARG BASE_IMAGE=(node:24\.21\.0-bookworm@(sha256:[0-9a-f]{64}))$/m);
 if(!baseMatch)throw new Error('ACTUAL runtime Dockerfile does not pin the expected Node base by digest.');
 return {
  runtime:{...EXPECTED_RUNTIME_IMAGE},
  source:{
   dockerfile:{path:RUNTIME_DOCKERFILE_PATH,sha256:sha256(dockerfileBytes)},
   builder_workflow:{path:RUNTIME_BUILDER_WORKFLOW_PATH,sha256:sha256(builderBytes)}
  },
  reproducibility:{
   source_date_epoch:0,
   provenance:false,
   sbom:false,
   double_build_digest_equality:true
  },
  observed:{
   dockerfile_base_ref:baseMatch[1],
   dockerfile_base_digest:baseMatch[2],
   builder_pins_base_digest:builder.includes(EXPECTED_RUNTIME_IMAGE.base_digest),
   builder_double_build_gate:builder.includes('test "$DIGEST_A" = "$DIGEST_B"'),
   builder_disables_provenance:builder.includes('--provenance=false'),
   builder_disables_sbom:builder.includes('--sbom=false'),
   builder_sets_source_date_epoch:builder.includes('SOURCE_DATE_EPOCH=0'),
   builder_verifies_runtime:builder.includes('docker run --rm "$IMAGE@$DIGEST"')
  }
 };
}

export function buildRuntimeImageManifest(inspected){
 const draft={
  schema_version:1,
  mode:'ACTUAL_OCI_RUNTIME',
  runtime_fingerprint_algorithm:RUNTIME_IMAGE_ALGORITHM,
  policy:'Exact ACTUAL OCI runtime identity. The upstream Node base, final GHCR image digest, Dockerfile bytes and builder workflow bytes are pinned; the builder must produce the same digest twice from identical inputs.',
  runtime:inspected.runtime,
  source:inspected.source,
  reproducibility:inspected.reproducibility
 };
 const fingerprint=runtimeImageFingerprint(draft);
 return {...draft,runtime_fingerprint_sha256:fingerprint.sha256};
}

export async function validateRuntimeImageManifest(manifest,{readFileFn=readFile}={}){
 const checks=[],failures=[];
 const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 let inspected=null,error=null;
 try{inspected=await inspectRuntimeImageDefinition({readFileFn});}catch(err){error=err;}
 check('runtime_schema_and_mode',manifest?.schema_version===1&&manifest?.mode==='ACTUAL_OCI_RUNTIME',{schema_version:manifest?.schema_version??null,mode:manifest?.mode??null});
 if(error){
  check('runtime_definition_readable',false,{error:error.message});
 }else{
  check('runtime_identity_exact',JSON.stringify(canonicalizeRuntime(manifest?.runtime??null))===JSON.stringify(canonicalizeRuntime(EXPECTED_RUNTIME_IMAGE)),{expected:EXPECTED_RUNTIME_IMAGE,actual:manifest?.runtime??null});
  check('runtime_source_bytes_exact',JSON.stringify(canonicalizeRuntime(manifest?.source??null))===JSON.stringify(canonicalizeRuntime(inspected.source)),{expected:inspected.source,actual:manifest?.source??null});
  check('dockerfile_base_digest_exact',inspected.observed.dockerfile_base_ref===EXPECTED_RUNTIME_IMAGE.base_ref,{expected:EXPECTED_RUNTIME_IMAGE.base_ref,actual:inspected.observed.dockerfile_base_ref});
  check('builder_reproducibility_contract',Object.values(inspected.observed).every(Boolean),inspected.observed);
 }
 const fingerprint=runtimeImageFingerprint(manifest);
 check('runtime_fingerprint_recomputes',manifest?.runtime_fingerprint_algorithm===fingerprint.algorithm&&manifest?.runtime_fingerprint_sha256===fingerprint.sha256,{algorithm:fingerprint.algorithm,expected:fingerprint.sha256,actual:manifest?.runtime_fingerprint_sha256??null});
 return {status:failures.length?'FAIL':'PASS',checks,failures,inspected,fingerprint};
}
