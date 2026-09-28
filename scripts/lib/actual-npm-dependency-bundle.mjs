import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const NPM_BUNDLE_MANIFEST='vendor/npm/manifest.json';
export const NPM_BUNDLE_ARCHIVE='vendor/npm/npm-dependency-bundle.tar';
export const NPM_BUNDLE_ALGORITHM='actual-npm-dependency-bundle-v1';
export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function verifyIntegrity(bytes,integrity){
 for(const token of String(integrity||'').trim().split(/\s+/).filter(Boolean)){
  const match=/^(sha512|sha256|sha1)-(.+)$/.exec(token);
  if(!match)continue;
  const actual=createHash(match[1]).update(bytes).digest('base64');
  if(actual===match[2])return true;
 }
 return false;
}

export function parseCanonicalTar(bytes){
 const entries=new Map();
 let offset=0;
 const field=(buf,start,length)=>buf.subarray(start,start+length).toString('utf8').replace(/\0.*$/s,'').trim();
 while(offset+512<=bytes.length){
  const header=bytes.subarray(offset,offset+512);
  if(header.every(byte=>byte===0))break;
  const name=field(header,0,100);
  const size=parseInt(field(header,124,12)||'0',8);
  const type=header[156];
  if(!name||!(type===0||type===48))throw new Error('Unsupported TAR entry');
  offset+=512;
  if(offset+size>bytes.length)throw new Error('Truncated TAR entry '+name);
  if(entries.has(name))throw new Error('Duplicate TAR entry '+name);
  entries.set(name,bytes.subarray(offset,offset+size));
  offset+=Math.ceil(size/512)*512;
 }
 return entries;
}

export function bundleFingerprint(packages){
 const facts=packages.map(({lock_path,version,integrity,tarball_sha256,bytes})=>({
  lock_path,version,integrity,tarball_sha256,bytes
 })).sort((a,b)=>a.lock_path.localeCompare(b.lock_path));
 return sha256(Buffer.from(JSON.stringify({algorithm:NPM_BUNDLE_ALGORITHM,packages:facts}),'utf8'));
}

export function buildOfflineLockfile(lock,manifest,tarballPrefix='../tarballs'){
 const copy=structuredClone(lock);
 const byPath=new Map(manifest.packages.map(item=>[item.lock_path,item]));
 for(const [lockPath,pkg] of Object.entries(copy.packages||{})){
  if(!lockPath||!pkg.resolved)continue;
  const item=byPath.get(lockPath);
  if(!item)throw new Error('Missing vendored package '+lockPath);
  pkg.resolved='file:'+tarballPrefix.replace(/\\/g,'/')+'/'+item.tarball_sha256+'.tgz';
 }
 return copy;
}

export async function validateNpmDependencyBundle({readFileFn=readFile}={}){
 const checks=[],failures=[];
 const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 let lockBytes,manifestBytes,archiveBytes,lock,manifest,entries;
 try{
  [lockBytes,manifestBytes,archiveBytes]=await Promise.all([
   readFileFn('package-lock.json'),readFileFn(NPM_BUNDLE_MANIFEST),readFileFn(NPM_BUNDLE_ARCHIVE)
  ]);
  lock=JSON.parse(lockBytes.toString('utf8'));
  manifest=JSON.parse(manifestBytes.toString('utf8'));
  entries=parseCanonicalTar(archiveBytes);
 }catch(error){
  return {status:'FAIL',checks,failures:[{name:'bundle_readable',detail:{error:error.message}}]};
 }
 check('bundle_schema_and_mode',manifest.schema_version===1&&manifest.mode==='ACTUAL_NPM_DEPENDENCY_BUNDLE'&&manifest.algorithm===NPM_BUNDLE_ALGORITHM,{schema_version:manifest.schema_version,mode:manifest.mode,algorithm:manifest.algorithm});
 check('package_lock_sha256_matches',manifest.package_lock_sha256===sha256(lockBytes),{expected:manifest.package_lock_sha256,actual:sha256(lockBytes)});
 check('archive_sha256_matches',manifest.archive?.path===NPM_BUNDLE_ARCHIVE&&manifest.archive?.sha256===sha256(archiveBytes)&&manifest.archive?.bytes===archiveBytes.length,{declared:manifest.archive,actual:{sha256:sha256(archiveBytes),bytes:archiveBytes.length}});
 const locked=Object.entries(lock.packages||{}).filter(([path,pkg])=>path&&pkg.resolved);
 const byPath=new Map(manifest.packages.map(item=>[item.lock_path,item]));
 check('package_entry_count_matches',manifest.package_entry_count===locked.length&&manifest.packages.length===locked.length,{locked:locked.length,manifest:manifest.packages.length,declared:manifest.package_entry_count});
 let packageFactsOk=true;
 for(const [path,pkg] of locked){
  const item=byPath.get(path);
  if(!item||item.version!==(pkg.version??null)||item.resolved!==pkg.resolved||item.integrity!==pkg.integrity){packageFactsOk=false;break;}
 }
 check('package_facts_match_lockfile',packageFactsOk,{locked:locked.length});
 const expectedNames=new Set(manifest.packages.map(item=>item.tarball_sha256+'.tgz'));
 check('archive_entry_set_matches',entries.size===expectedNames.size&&[...entries.keys()].every(name=>expectedNames.has(name)),{archive_entries:entries.size,expected_unique:expectedNames.size});
 let bytesOk=true,integrityOk=true;
 for(const item of manifest.packages){
  const bytes=entries.get(item.tarball_sha256+'.tgz');
  if(!bytes||sha256(bytes)!==item.tarball_sha256||bytes.length!==item.bytes){bytesOk=false;break;}
  if(!verifyIntegrity(bytes,item.integrity)){integrityOk=false;break;}
 }
 check('vendored_tarball_bytes_match',bytesOk,{package_count:manifest.packages.length});
 check('vendored_tarball_integrity_matches',integrityOk,{package_count:manifest.packages.length});
 const fingerprint=bundleFingerprint(manifest.packages);
 check('bundle_fingerprint_recomputes',manifest.bundle_fingerprint_sha256===fingerprint,{expected:manifest.bundle_fingerprint_sha256,actual:fingerprint});
 return {status:failures.length?'FAIL':'PASS',checks,failures,manifest,archive_sha256:sha256(archiveBytes),manifest_sha256:sha256(manifestBytes),entries};
}
