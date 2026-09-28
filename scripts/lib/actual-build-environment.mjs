import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {NPM_BUNDLE_ARCHIVE,NPM_BUNDLE_MANIFEST,validateNpmDependencyBundle} from './actual-npm-dependency-bundle.mjs';
import {EXPECTED_RUNTIME_IMAGE,RUNTIME_IMAGE_PATH,validateRuntimeImageManifest} from './actual-runtime-image.mjs';

export const BUILD_ENVIRONMENT_PATH='data/current/actual-build-environment-manifest.json';
export const BUILD_ENVIRONMENT_GATE_PATH='data/current/actual-build-environment-gate.json';
export const BUILD_ENVIRONMENT_ALGORITHM='actual-build-environment-v1';
export const EXPECTED_BUILD_ENVIRONMENT={
 runner:{
  label:'ubuntu-24.04',
  image_os:'ubuntu24',
  image_version:'20260920.314.1'
 },
 toolchain:{
  node:'24.21.0',
  npm:'11.19.0',
  package_manager:'npm@11.19.0'
 },
 actions:{
  'actions/checkout':'fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09',
  'actions/upload-artifact':'ea165f8d65b6e75b540449e92b4886f43607fa02'
 }
};
export const BUILD_WORKFLOWS={
 candidate:'.github/workflows/actual-candidate.yml',
 topology:'.github/workflows/actual-topology-audit.yml',
 promotion:'.github/workflows/actual-promote-candidate.yml',
 verify:'.github/workflows/verify-persisted-actual-release.yml'
};
export const BUILD_SUPPORT_FILES=[
 'scripts/lib/actual-build-environment.mjs',
 'scripts/lib/actual-npm-dependency-bundle.mjs',
 'scripts/process/build-actual-build-environment-manifest.mjs',
 'scripts/process/audit-actual-build-environment-gate.mjs',
 'scripts/process/audit-actual-npm-dependency-bundle.mjs',
 'scripts/process/install-actual-npm-offline.mjs',
 'scripts/process/audit-node-toolchain.mjs',
 'scripts/lib/actual-runtime-image.mjs',
 'scripts/process/build-actual-runtime-image-manifest.mjs',
 'scripts/process/audit-actual-runtime-image.mjs',
 'scripts/lib/actual-review-evidence-bundle.mjs',
 'scripts/process/build-actual-review-evidence-bundle.mjs',
 'scripts/process/audit-actual-review-evidence-bundle-gate.mjs'
];
export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function canonicalizeBuildEnvironment(value){
 if(Array.isArray(value))return value.map(canonicalizeBuildEnvironment);
 if(value&&typeof value==='object'){
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalizeBuildEnvironment(value[key])]));
 }
 return value;
}

const npmVersion=()=>{
 const cmd=process.platform==='win32'?'npm.cmd':'npm';
 return execFileSync(cmd,['--version'],{encoding:'utf8'}).trim();
};

const parseWorkflow=content=>{
 const runsOn=[...content.matchAll(/^\s*runs-on:\s*([^\s#]+).*$/gm)].map(m=>m[1]);
 const uses=[...content.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)].map(m=>m[1]);
 const nodeVersions=[...content.matchAll(/^\s*node-version:\s*['"]?([^'"\s#]+).*$/gm)].map(m=>m[1]);
 const containerImages=[...content.matchAll(/^\s*image:\s*([^\s#]+).*$/gm)].map(m=>m[1]);
 return {runs_on:runsOn,uses,node_versions:nodeVersions,container_images:containerImages};
};

export function buildEnvironmentFingerprint(manifest){
 const payload=canonicalizeBuildEnvironment({
  algorithm:BUILD_ENVIRONMENT_ALGORITHM,
  environment:manifest?.environment??null
 });
 return {
  algorithm:BUILD_ENVIRONMENT_ALGORITHM,
  sha256:sha256(Buffer.from(JSON.stringify(payload),'utf8')),
  payload
 };
}

export async function inspectCurrentBuildEnvironment({readFileFn=readFile}={}){
 const [packageBytes,lockBytes,npmBundleManifestBytes,npmBundleArchiveBytes,runtimeManifestBytes]=await Promise.all([
  readFileFn('package.json'),
  readFileFn('package-lock.json'),
  readFileFn(NPM_BUNDLE_MANIFEST),
  readFileFn(NPM_BUNDLE_ARCHIVE),
  readFileFn(RUNTIME_IMAGE_PATH)
 ]);
 const packageJson=JSON.parse(packageBytes.toString('utf8'));
 const lock=JSON.parse(lockBytes.toString('utf8'));
 const npmBundleManifest=JSON.parse(npmBundleManifestBytes.toString('utf8'));
 const runtimeManifest=JSON.parse(runtimeManifestBytes.toString('utf8'));
 const supportFiles=Object.fromEntries(await Promise.all(BUILD_SUPPORT_FILES.map(async path=>{
  const bytes=await readFileFn(path);
  return [path,sha256(bytes)];
 })));
 const workflows={};
 const actionUses=new Map();
 for(const [id,path] of Object.entries(BUILD_WORKFLOWS)){
  const bytes=await readFileFn(path);
  const content=bytes.toString('utf8');
  const parsed=parseWorkflow(content);
  workflows[id]={
   path,
   sha256:sha256(bytes),
   runs_on:parsed.runs_on,
   node_versions:parsed.node_versions,
   container_images:parsed.container_images,
   actions:parsed.uses.filter(value=>value.startsWith('actions/')).sort()
  };
  for(const value of workflows[id].actions){
   const at=value.lastIndexOf('@');
   if(at>0)actionUses.set(value.slice(0,at),value.slice(at+1));
  }
 }
 return {
  runner:{...EXPECTED_BUILD_ENVIRONMENT.runner},
  runtime_image:{
   manifest_path:RUNTIME_IMAGE_PATH,
   manifest_sha256:sha256(runtimeManifestBytes),
   runtime_fingerprint_sha256:runtimeManifest.runtime_fingerprint_sha256??null,
   ref:runtimeManifest.runtime?.ref??null,
   digest:runtimeManifest.runtime?.digest??null,
   platform:runtimeManifest.runtime?.platform??null,
   base_ref:runtimeManifest.runtime?.base_ref??null,
   base_digest:runtimeManifest.runtime?.base_digest??null
  },
  toolchain:{
   node:packageJson.engines?.node??null,
   npm:packageJson.engines?.npm??null,
   package_manager:packageJson.packageManager??null,
   package_json:{path:'package.json',sha256:sha256(packageBytes)},
   package_lock:{path:'package-lock.json',sha256:sha256(lockBytes),lockfile_version:lock.lockfileVersion??null},
   dependency_bundle:{
    manifest_path:NPM_BUNDLE_MANIFEST,
    manifest_sha256:sha256(npmBundleManifestBytes),
    archive_path:NPM_BUNDLE_ARCHIVE,
    archive_sha256:sha256(npmBundleArchiveBytes),
    bundle_fingerprint_sha256:npmBundleManifest.bundle_fingerprint_sha256??null,
    package_entry_count:npmBundleManifest.package_entry_count??null
   }
  },
  actions:Object.fromEntries([...actionUses.entries()].sort(([a],[b])=>a.localeCompare(b))),
  support_files:supportFiles,
  workflows
 };
}

export function buildBuildEnvironmentManifest(inspected){
 const draft={
  schema_version:1,
  mode:'ACTUAL_BUILD_ENVIRONMENT',
  environment_fingerprint_algorithm:BUILD_ENVIRONMENT_ALGORITHM,
  policy:'Exact ACTUAL execution-environment binding. GitHub-hosted runner family/image, the digest-pinned ACTUAL OCI runtime, Node/npm, package files, vendored offline npm dependencies, workflow bytes and GitHub Action commit SHAs are pinned. Any silent environment drift fails closed.',
  environment:inspected
 };
 const fingerprint=buildEnvironmentFingerprint(draft);
 return {
  schema_version:draft.schema_version,
  mode:draft.mode,
  environment_fingerprint_algorithm:fingerprint.algorithm,
  environment_fingerprint_sha256:fingerprint.sha256,
  policy:draft.policy,
  environment:draft.environment
 };
}

export async function validateBuildEnvironmentManifest(manifest,{readFileFn=readFile,checkRuntime=false}={}){
 const checks=[],failures=[];
 const check=(name,ok,detail={})=>{
  checks.push({name,ok:Boolean(ok),detail});
  if(!ok)failures.push({name,detail});
 };
 let current=null,error=null,npmBundleValidation=null,runtimeValidation=null;
 try{
  current=await inspectCurrentBuildEnvironment({readFileFn});
  npmBundleValidation=await validateNpmDependencyBundle({readFileFn});
  const runtimeBytes=await readFileFn(RUNTIME_IMAGE_PATH);
  runtimeValidation=await validateRuntimeImageManifest(JSON.parse(runtimeBytes.toString('utf8')),{readFileFn});
 }
 catch(err){error=err;}

 check('manifest_schema_and_mode',
  manifest?.schema_version===1&&manifest?.mode==='ACTUAL_BUILD_ENVIRONMENT',
  {schema_version:manifest?.schema_version??null,mode:manifest?.mode??null});

 if(error){
  check('manifest_matches_repository_environment',false,{error:error.message});
 }else{
  check('manifest_matches_repository_environment',
   JSON.stringify(canonicalizeBuildEnvironment(manifest?.environment??null))===JSON.stringify(canonicalizeBuildEnvironment(current)),
   {workflow_count:Object.keys(current.workflows).length,action_count:Object.keys(current.actions).length,support_file_count:Object.keys(current.support_files).length});

  check('runner_label_is_exact',
   Object.values(current.workflows).every(item=>item.runs_on.length===1&&item.runs_on[0]===EXPECTED_BUILD_ENVIRONMENT.runner.label),
   {expected:EXPECTED_BUILD_ENVIRONMENT.runner.label,actual:Object.fromEntries(Object.entries(current.workflows).map(([id,item])=>[id,item.runs_on]))});

  check('runtime_container_is_exact',
   Object.values(current.workflows).every(item=>item.container_images.length===1&&item.container_images[0]===EXPECTED_RUNTIME_IMAGE.ref)
   && current.runtime_image.ref===EXPECTED_RUNTIME_IMAGE.ref
   && current.runtime_image.digest===EXPECTED_RUNTIME_IMAGE.digest,
   {expected:EXPECTED_RUNTIME_IMAGE.ref,actual:Object.fromEntries(Object.entries(current.workflows).map(([id,item])=>[id,item.container_images])),manifest:current.runtime_image});

  check('dynamic_node_setup_is_absent',
   Object.values(current.workflows).every(item=>item.node_versions.length===0)
   && !Object.prototype.hasOwnProperty.call(current.actions,'actions/setup-node'),
   {node_versions:Object.fromEntries(Object.entries(current.workflows).map(([id,item])=>[id,item.node_versions])),actions:current.actions});

  check('runtime_image_manifest_valid',
   runtimeValidation?.status==='PASS'
   && current.runtime_image.runtime_fingerprint_sha256===runtimeValidation?.fingerprint?.sha256,
   {status:runtimeValidation?.status??null,fingerprint:runtimeValidation?.fingerprint?.sha256??null,failures:runtimeValidation?.failures??[]});

  check('github_actions_are_exact_commit_shas',
   JSON.stringify(canonicalizeBuildEnvironment(current.actions))===JSON.stringify(canonicalizeBuildEnvironment(EXPECTED_BUILD_ENVIRONMENT.actions))
   && Object.values(current.actions).every(ref=>/^[0-9a-f]{40}$/.test(ref)),
   {expected:EXPECTED_BUILD_ENVIRONMENT.actions,actual:current.actions});

  check('package_toolchain_matches_expected',
   current.toolchain.node===EXPECTED_BUILD_ENVIRONMENT.toolchain.node
   && current.toolchain.npm===EXPECTED_BUILD_ENVIRONMENT.toolchain.npm
   && current.toolchain.package_manager===EXPECTED_BUILD_ENVIRONMENT.toolchain.package_manager
   && current.toolchain.package_lock.lockfile_version===3,
   {expected:EXPECTED_BUILD_ENVIRONMENT.toolchain,actual:current.toolchain});
  check('npm_dependency_bundle_valid',
   npmBundleValidation?.status==='PASS'
   && current.toolchain.dependency_bundle.bundle_fingerprint_sha256===npmBundleValidation?.manifest?.bundle_fingerprint_sha256
   && current.toolchain.dependency_bundle.archive_sha256===npmBundleValidation?.archive_sha256
   && current.toolchain.dependency_bundle.manifest_sha256===npmBundleValidation?.manifest_sha256,
   {status:npmBundleValidation?.status??null,fingerprint:npmBundleValidation?.manifest?.bundle_fingerprint_sha256??null,failures:npmBundleValidation?.failures??[]});
 }

 const fingerprint=buildEnvironmentFingerprint(manifest);
 check('environment_fingerprint_recomputes',
  manifest?.environment_fingerprint_algorithm===fingerprint.algorithm
  && manifest?.environment_fingerprint_sha256===fingerprint.sha256,
  {algorithm:fingerprint.algorithm,expected:fingerprint.sha256,actual:manifest?.environment_fingerprint_sha256??null});

 if(checkRuntime){
  const actualNpm=npmVersion();
  const actual={
   node:process.version.replace(/^v/,''),
   npm:actualNpm,
   runner_os:process.env.RUNNER_OS??null,
   host_image_os:process.env.ImageOS??null,
   host_image_version:process.env.ImageVersion??null
  };
  check('runtime_node_exact',actual.node===EXPECTED_BUILD_ENVIRONMENT.toolchain.node,{expected:EXPECTED_BUILD_ENVIRONMENT.toolchain.node,actual:actual.node});
  check('runtime_npm_exact',actual.npm===EXPECTED_BUILD_ENVIRONMENT.toolchain.npm,{expected:EXPECTED_BUILD_ENVIRONMENT.toolchain.npm,actual:actual.npm});
  check('runtime_runner_os_linux',actual.runner_os==='Linux',{expected:'Linux',actual:actual.runner_os});
  check('host_runner_identity_is_static_provenance',
   actual.host_image_os===null&&actual.host_image_version===null
   || actual.host_image_os===EXPECTED_BUILD_ENVIRONMENT.runner.image_os&&actual.host_image_version===EXPECTED_BUILD_ENVIRONMENT.runner.image_version,
   {policy:'GitHub does not propagate ImageOS/ImageVersion into jobs.container. Host runner family is enforced by exact runs-on workflow bytes; when host image variables are available they must match the pinned provenance.',expected:{image_os:EXPECTED_BUILD_ENVIRONMENT.runner.image_os,image_version:EXPECTED_BUILD_ENVIRONMENT.runner.image_version},actual:{image_os:actual.host_image_os,image_version:actual.host_image_version}});
 }

 return {status:failures.length?'FAIL':'PASS',checks,failures,current,fingerprint};
}
