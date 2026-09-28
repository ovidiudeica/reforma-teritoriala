#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

const packageJson=JSON.parse(await readFile('package.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const expectedNode=packageJson.engines?.node??null;
const expectedNpm=packageJson.engines?.npm??null;
const npmCommand=process.platform==='win32'?'npm.cmd':'npm';
const actualNpm=execFileSync(npmCommand,['--version'],{encoding:'utf8'}).trim();
const failures=[];
const check=(name,ok,detail={})=>{if(!ok)failures.push({name,detail});};

check('node_version_exact',Boolean(expectedNode)&&process.version===`v${expectedNode}`,{expected:expectedNode,actual:process.version});
check('npm_version_exact',Boolean(expectedNpm)&&actualNpm===expectedNpm,{expected:expectedNpm,actual:actualNpm});
check('package_manager_exact',packageJson.packageManager===`npm@${expectedNpm}`,{expected:`npm@${expectedNpm}`,actual:packageJson.packageManager??null});
check('lockfile_v3',lock.lockfileVersion===3,{actual:lock.lockfileVersion??null});

const packageDeps=packageJson.dependencies??{};
const lockRootDeps=lock.packages?.['']?.dependencies??{};
check('lockfile_root_dependencies_match_package_json',JSON.stringify(lockRootDeps)===JSON.stringify(packageDeps),{package_json:packageDeps,lockfile:lockRootDeps});

const nonExact=Object.entries(packageDeps).filter(([,spec])=>!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(spec));
check('direct_dependencies_are_exact',nonExact.length===0,{non_exact:nonExact});

for(const [name,spec] of Object.entries(packageDeps)){
 const installed=lock.packages?.[`node_modules/${name}`]?.version??null;
 check(`locked_direct_dependency_${name}`,installed===spec,{expected:spec,actual:installed});
}

const report={
 schema_version:1,
 mode:'NODE_NPM_TOOLCHAIN_AUDIT',
 status:failures.length?'FAIL':'PASS',
 node:{expected:expectedNode,actual:process.version},
 npm:{expected:expectedNpm,actual:actualNpm},
 package_manager:packageJson.packageManager??null,
 lockfile_version:lock.lockfileVersion??null,
 direct_dependency_count:Object.keys(packageDeps).length,
 failures
};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
