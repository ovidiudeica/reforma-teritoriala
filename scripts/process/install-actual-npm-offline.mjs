#!/usr/bin/env node
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildOfflineLockfile,validateNpmDependencyBundle} from '../lib/actual-npm-dependency-bundle.mjs';

const validation=await validateNpmDependencyBundle();
if(validation.status!=='PASS')throw new Error('Vendored npm bundle failed validation: '+JSON.stringify(validation.failures));

const root=process.cwd();
const temp=resolve(root,'.actual-npm-offline');
const tarballs=join(temp,'tarballs');
const workspace=join(temp,'workspace');
await rm(temp,{recursive:true,force:true});
await mkdir(tarballs,{recursive:true});
await mkdir(workspace,{recursive:true});

for(const [name,bytes] of validation.entries)await writeFile(join(tarballs,name),bytes);
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const offlineLock=buildOfflineLockfile(lock,validation.manifest,'../tarballs');
await writeFile(join(workspace,'package.json'),await readFile('package.json'));
await writeFile(join(workspace,'package-lock.json'),JSON.stringify(offlineLock,null,2)+'\n');

const denied='http://127.0.0.1:9/';
const env={
 ...process.env,
 npm_config_offline:'true',
 npm_config_registry:denied,
 npm_config_cache:join(temp,'empty-cache'),
 npm_config_audit:'false',
 npm_config_fund:'false',
 npm_config_ignore_scripts:'true',
 npm_config_proxy:denied,
 npm_config_https_proxy:denied,
 npm_config_fetch_retries:'0',
 npm_config_fetch_timeout:'1000',
 HTTP_PROXY:denied,HTTPS_PROXY:denied,ALL_PROXY:denied,NO_PROXY:''
};
const args=['ci','--offline','--ignore-scripts','--no-audit','--no-fund'];
const command=process.platform==='win32'?'cmd.exe':'npm';
const commandArgs=process.platform==='win32'?['/d','/s','/c','npm.cmd '+args.join(' ')]:args;
const result=spawnSync(command,commandArgs,{cwd:workspace,env,encoding:'utf8'});
if(result.status!==0){
 console.error(result.stdout||'');
 console.error(result.stderr||'');
 process.exit(result.status||1);
}
await rm(resolve(root,'node_modules'),{recursive:true,force:true});
await rename(join(workspace,'node_modules'),resolve(root,'node_modules'));
await rm(temp,{recursive:true,force:true});
console.log(JSON.stringify({
 status:'PASS',
 mode:'ACTUAL_NPM_OFFLINE_INSTALL',
 package_entry_count:validation.manifest.package_entry_count,
 bundle_fingerprint_sha256:validation.manifest.bundle_fingerprint_sha256,
 network_denial:{npm_offline:true,registry:denied,npm_proxy:denied,npm_https_proxy:denied,http_proxy:denied,https_proxy:denied,all_proxy:denied,fetch_retries:0,lifecycle_scripts:false},
 install_command:'npm ci --offline --ignore-scripts --no-audit --no-fund'
},null,2));
