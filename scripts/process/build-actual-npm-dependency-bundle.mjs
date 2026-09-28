#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {NPM_BUNDLE_ALGORITHM,NPM_BUNDLE_ARCHIVE,NPM_BUNDLE_MANIFEST,bundleFingerprint,sha256,verifyIntegrity} from '../lib/actual-npm-dependency-bundle.mjs';

if(process.env.ACTUAL_ALLOW_NPM_VENDOR_REFRESH!=='1')throw new Error('Set ACTUAL_ALLOW_NPM_VENDOR_REFRESH=1 for an intentional networked npm vendor refresh.');

const lockBytes=await readFile('package-lock.json');
const lock=JSON.parse(lockBytes.toString('utf8'));
const packages=[];
const blobs=new Map();

for(const [lockPath,pkg] of Object.entries(lock.packages||{})){
 if(!lockPath||!pkg.resolved)continue;
 if(!pkg.integrity)throw new Error('Missing integrity for '+lockPath);
 const response=await fetch(pkg.resolved);
 if(!response.ok)throw new Error('Failed '+pkg.resolved+': '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!verifyIntegrity(bytes,pkg.integrity))throw new Error('Integrity mismatch for '+lockPath);
 const tarballSha256=sha256(bytes);
 blobs.set(tarballSha256,bytes);
 packages.push({lock_path:lockPath,version:pkg.version??null,resolved:pkg.resolved,integrity:pkg.integrity,tarball_sha256:tarballSha256,bytes:bytes.length});
}

const oct=(number,length)=>number.toString(8).padStart(length-1,'0')+'\0';
const header=(name,size)=>{
 const out=Buffer.alloc(512,0);
 const put=(value,offset,length)=>Buffer.from(value).copy(out,offset,0,length);
 put(name,0,100);put(oct(0o644,8),100,8);put(oct(0,8),108,8);put(oct(0,8),116,8);put(oct(size,12),124,12);put(oct(0,12),136,12);
 Buffer.from('        ').copy(out,148);out[156]=48;put('ustar\0',257,6);put('00',263,2);
 let sum=0;for(const byte of out)sum+=byte;
 put(sum.toString(8).padStart(6,'0')+'\0 ',148,8);
 return out;
};
const chunks=[];
for(const hash of [...blobs.keys()].sort()){
 const bytes=blobs.get(hash);
 chunks.push(header(hash+'.tgz',bytes.length),bytes);
 const padding=(512-(bytes.length%512))%512;
 if(padding)chunks.push(Buffer.alloc(padding));
}
chunks.push(Buffer.alloc(1024));
const archive=Buffer.concat(chunks);
packages.sort((a,b)=>a.lock_path.localeCompare(b.lock_path));
const manifest={
 schema_version:1,
 mode:'ACTUAL_NPM_DEPENDENCY_BUNDLE',
 algorithm:NPM_BUNDLE_ALGORITHM,
 package_lock_sha256:sha256(lockBytes),
 package_entry_count:packages.length,
 unique_tarball_count:blobs.size,
 bundle_fingerprint_sha256:bundleFingerprint(packages),
 archive:{path:NPM_BUNDLE_ARCHIVE,sha256:sha256(archive),bytes:archive.length},
 packages
};
await mkdir('vendor/npm',{recursive:true});
await writeFile(NPM_BUNDLE_ARCHIVE,archive);
await writeFile(NPM_BUNDLE_MANIFEST,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',package_entry_count:packages.length,unique_tarball_count:blobs.size,bundle_fingerprint_sha256:manifest.bundle_fingerprint_sha256,archive:manifest.archive},null,2));
