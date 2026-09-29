import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

export const HOST_TRUST_PATH='data/current/actual-host-trust-manifest.json';
export const HOST_TRUST_ALGORITHM='actual-host-trust-v1';

export const EXPECTED_HOST_TRUST={
 runner:{
  label:'ubuntu-24.04',
  image_os:'ubuntu24',
  image_version:'20260927.320.1',
  os:'Linux',
  arch:'X64'
 },
 kernel:{
  release:'6.17.0-1022-azure',
  version:'#22-Ubuntu SMP Mon Jul 27 17:24:03 UTC 2026',
  machine:'x86_64'
 },
 docker:{
  client_version:'28.0.4',
  server_version:'28.0.4',
  api_version:'1.48',
  min_api_version:'1.24',
  git_commit:'6430e49',
  components:{
   Engine:{version:'28.0.4',git_commit:'6430e49'},
   containerd:{version:'v2.3.6',git_commit:'ee2735368117d2eb259779949d5e75cdafec9761'},
   runc:{version:'1.5.1',git_commit:'v1.5.1-0-g8f2685a4'},
   'docker-init':{version:'0.19.0',git_commit:'de40ad0'}
  }
 },
 engine:{
  storage_driver:'overlay2',
  cgroup_driver:'systemd',
  cgroup_version:'2',
  operating_system:'Ubuntu 24.04.5 LTS',
  os_type:'linux',
  architecture:'x86_64',
  kernel_version:'6.17.0-1022-azure'
 },
 cpu_contract:{
  architecture:'x86_64',
  op_modes:'32-bit, 64-bit',
  hypervisor:'Microsoft',
  virtualization:'full',
  accepted_vendors:['AuthenticAMD','GenuineIntel'],
  required_flags:[
   'aes','avx','avx2','bmi1','bmi2','cx16','f16c','fma','fpu','fxsr',
   'lahf_lm','lm','mmx','movbe','pclmulqdq','popcnt','rdseed','rdtscp',
   'sse','sse2','sse4_1','sse4_2','ssse3','xsave','xsaveopt'
  ],
  execution_profile:{
   platform:'linux/amd64',
   cpuset_cpus:'0',
   node_options:'--jitless',
   uv_threadpool_size:'1',
   timezone:'UTC',
   locale:'C.UTF-8'
  }
 }
};

export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function canonicalizeHostTrust(value){
 if(Array.isArray(value))return value.map(canonicalizeHostTrust);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalizeHostTrust(value[key])]));
 return value;
}

export function hostTrustFingerprint(manifest){
 const payload=canonicalizeHostTrust({
  algorithm:HOST_TRUST_ALGORITHM,
  contract:manifest?.contract??null
 });
 return {
  algorithm:HOST_TRUST_ALGORITHM,
  sha256:sha256(Buffer.from(JSON.stringify(payload),'utf8')),
  payload
 };
}

export function buildHostTrustManifest(){
 const draft={
  schema_version:1,
  mode:'ACTUAL_HOST_TRUST',
  host_trust_fingerprint_algorithm:HOST_TRUST_ALGORITHM,
  policy:'Fail-closed host trust contract for deterministic ACTUAL execution. GitHub runner image, kernel, Docker Engine, containerd, runc, cgroup/storage stack and an x86_64 CPU compatibility floor are pinned. CPU vendor/model are observed evidence only; Node computation is forced through the JIT-less single-CPU execution profile so hardware model drift cannot silently select different V8 JIT code paths.',
  contract:EXPECTED_HOST_TRUST
 };
 const fingerprint=hostTrustFingerprint(draft);
 return {...draft,host_trust_fingerprint_sha256:fingerprint.sha256};
}

export function validateHostTrustManifest(manifest){
 const checks=[],failures=[];
 const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 check('schema_and_mode',manifest?.schema_version===1&&manifest?.mode==='ACTUAL_HOST_TRUST',{schema_version:manifest?.schema_version??null,mode:manifest?.mode??null});
 check('contract_is_exact',JSON.stringify(canonicalizeHostTrust(manifest?.contract??null))===JSON.stringify(canonicalizeHostTrust(EXPECTED_HOST_TRUST)),{expected:EXPECTED_HOST_TRUST,actual:manifest?.contract??null});
 const fp=hostTrustFingerprint(manifest);
 check('fingerprint_recomputes',manifest?.host_trust_fingerprint_algorithm===fp.algorithm&&manifest?.host_trust_fingerprint_sha256===fp.sha256,{expected:fp.sha256,actual:manifest?.host_trust_fingerprint_sha256??null});
 return {status:failures.length?'FAIL':'PASS',checks,failures,fingerprint:fp};
}

const run=(cmd,args=[])=>execFileSync(cmd,args,{encoding:'utf8'}).trim();

export async function captureObservedHost({env=process.env,readFileFn=readFile,execFileSyncFn=execFileSync}={}){
 const exec=(cmd,args=[])=>execFileSyncFn(cmd,args,{encoding:'utf8'}).trim();
 const docker=JSON.parse(exec('docker',['version','--format','{{json .}}']));
 const info=JSON.parse(exec('docker',['info','--format','{{json .}}']));
 const lscpu=JSON.parse(exec('lscpu',['--json'])).lscpu;
 const cpu=Object.fromEntries(lscpu.map(x=>[x.field.replace(/:$/,''),x.data]));
 const cpuinfo=(await readFileFn('/proc/cpuinfo','utf8')).split('\n\n')[0].split('\n').map(x=>x.split(/\s*:\s*/,2)).filter(x=>x.length===2);
 const firstCpu=Object.fromEntries(cpuinfo);
 const components=Object.fromEntries((docker.Server?.Components||[]).map(x=>[x.Name,{version:x.Version??null,git_commit:x.Details?.GitCommit??null}]));
 return {
  runner:{image_os:env.ImageOS??null,image_version:env.ImageVersion??null,arch:env.RUNNER_ARCH??null,os:env.RUNNER_OS??null},
  kernel:{release:exec('uname',['-r']),version:exec('uname',['-v']),machine:exec('uname',['-m'])},
  docker:{
   client_version:docker.Client?.Version??null,
   server_version:docker.Server?.Version??null,
   api_version:docker.Server?.ApiVersion??null,
   min_api_version:docker.Server?.MinAPIVersion??null,
   git_commit:docker.Server?.GitCommit??null,
   components
  },
  engine:{
   storage_driver:info.Driver??null,
   cgroup_driver:info.CgroupDriver??null,
   cgroup_version:String(info.CgroupVersion??''),
   operating_system:info.OperatingSystem??null,
   os_type:info.OSType??null,
   architecture:info.Architecture??null,
   kernel_version:info.KernelVersion??null
  },
  cpu:{
   architecture:cpu.Architecture??null,
   op_modes:cpu['CPU op-mode(s)']??null,
   vendor:cpu['Vendor ID']??null,
   model_name:cpu['Model name']??null,
   hypervisor:cpu['Hypervisor vendor']??null,
   virtualization:cpu['Virtualization type']??null,
   flags:(firstCpu.flags??'').split(/\s+/).filter(Boolean).sort()
  }
 };
}

export function validateObservedHost(manifest,observed){
 const staticValidation=validateHostTrustManifest(manifest);
 const checks=[...staticValidation.checks],failures=[...staticValidation.failures];
 const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 const expected=manifest?.contract??{};
 const exact=(name,actual,wanted)=>check(name,JSON.stringify(canonicalizeHostTrust(actual))===JSON.stringify(canonicalizeHostTrust(wanted)),{expected:wanted,actual});
 const expectedObservedRunner={
  image_os:expected.runner?.image_os??null,
  image_version:expected.runner?.image_version??null,
  arch:expected.runner?.arch??null,
  os:expected.runner?.os??null
 };
 exact('runner_observable_identity_exact',observed?.runner,expectedObservedRunner);
 exact('kernel_exact',observed?.kernel,expected.kernel);
 exact('docker_exact',observed?.docker,expected.docker);
 exact('engine_exact',observed?.engine,expected.engine);
 const cpu=observed?.cpu??{};
 const contract=expected.cpu_contract??{};
 check('cpu_architecture_exact',cpu.architecture===contract.architecture,{expected:contract.architecture,actual:cpu.architecture??null});
 check('cpu_op_modes_exact',cpu.op_modes===contract.op_modes,{expected:contract.op_modes,actual:cpu.op_modes??null});
 check('cpu_hypervisor_exact',cpu.hypervisor===contract.hypervisor,{expected:contract.hypervisor,actual:cpu.hypervisor??null});
 check('cpu_virtualization_exact',cpu.virtualization===contract.virtualization,{expected:contract.virtualization,actual:cpu.virtualization??null});
 check('cpu_vendor_allowed',contract.accepted_vendors?.includes(cpu.vendor),{accepted:contract.accepted_vendors??[],actual:cpu.vendor??null,model_name:cpu.model_name??null});
 const flags=new Set(cpu.flags||[]);
 const missing=(contract.required_flags||[]).filter(flag=>!flags.has(flag));
 check('cpu_required_flags_present',missing.length===0,{required:contract.required_flags??[],missing,actual_vendor:cpu.vendor??null,actual_model_name:cpu.model_name??null});
 return {status:failures.length?'FAIL':'PASS',checks,failures,fingerprint:staticValidation.fingerprint,observed};
}
