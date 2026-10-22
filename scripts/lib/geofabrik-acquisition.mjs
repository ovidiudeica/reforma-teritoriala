// Read-only acquisition evidence. A complete extract is not an accepted source:
// binary epoch, spatial selection, continuity and topology remain separate gates.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,rename,open} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
const hash=(b,a='sha256')=>createHash(a).update(b).digest('hex');
export async function verifyExtractFile(file,receipt){
 assert.match(receipt.sha256,/^[a-f0-9]{64}$/);assert.match(receipt.header_sha256,/^[a-f0-9]{64}$/);assert.match(receipt.published_md5,/^[a-f0-9]{32}$/);assert.ok(Number.isSafeInteger(receipt.bytes)&&receipt.bytes>=65536);
 const sha=createHash('sha256'),md5=createHash('md5');let bytes=0;
 for await(const b of createReadStream(file)){sha.update(b);md5.update(b);bytes+=b.length;assert.ok(bytes<=receipt.bytes,'File exceeds receipt size');}
 assert.equal(bytes,receipt.bytes,'File size mismatch');assert.equal(sha.digest('hex'),receipt.sha256,'File SHA-256 mismatch');assert.equal(md5.digest('hex'),receipt.published_md5,'Published checksum mismatch');
 const fd=await open(file,'r'),header=Buffer.alloc(65536);try{await fd.read(header,0,header.length,0);}finally{await fd.close();}assert.equal(hash(header),receipt.header_sha256,'Header SHA-256 mismatch');
 return {status:'ORIGINAL_FILE_HASHES_VERIFIED_ONLY',bytes,source_promoted:false};
}
export function datedExtractIdentity(country,date){
 const name={RO:'romania',MD:'moldova'}[country];assert.ok(name,'Unsupported country');
 assert.match(date,/^20\d{6}$/,'Explicit YYYYMMDD required');
 const iso=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8);assert.equal(new Date(iso).toISOString().slice(0,10),iso,'Invalid calendar date');
 const file=name+'-'+date.slice(2)+'.osm.pbf';return {country,date,file,url:'https://download.geofabrik.de/europe/'+file};
}
async function boundedBody(response,max){
 const parts=[];let bytes=0;for await(const b of Readable.fromWeb(response.body)){bytes+=b.length;assert.ok(bytes<=max,'Response exceeds bounded metadata size');parts.push(b);}return Buffer.concat(parts);
}
export async function downloadDatedExtract({country,date,output,fetchImpl=fetch,now=()=>new Date().toISOString(),timeoutMs=180000,onProgress=()=>{}}){
 const id=datedExtractIdentity(country,date),root=path.resolve(output);assert.ok(root.startsWith(path.resolve('outputs')+path.sep),'Only evidence output directories may be written');await mkdir(root,{recursive:true});
 const receipt={...id,started_at:now(),source_promoted:false,timestamp_acceptance:'UNVERIFIED_UNTIL_BINARY_HEADER_REPLAY',scope_acceptance:'UNVERIFIED_SPATIAL_SELECTION',status:'INCOMPLETE_NOT_SOURCE_ACCEPTED'};
 let firstReceipt=true;const save=async()=>{await writeFile(path.join(root,id.file+'.receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:firstReceipt?'wx':'w'});firstReceipt=false;};
 const request=(url,headers={})=>fetchImpl(url,{headers:{'user-agent':'reforma-teritoriala-source-qualification/1.0',...headers},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
 await save();try{
  const c=await request(id.url+'.md5');assert.equal(c.status,200,'Checksum HTTP status');const cb=await boundedBody(c,1024),match=/^([a-f0-9]{32})\s+\*?([^\r\n]+)\s*$/i.exec(cb.toString());assert.ok(match,'Invalid published checksum');assert.equal(match[2],id.file,'Checksum filename mismatch');
  await writeFile(path.join(root,id.file+'.md5.original'),cb,{flag:'wx'});receipt.checksum_body_sha256=hash(cb);receipt.published_md5=match[1].toLowerCase();await save();
  const hr=await request(id.url,{range:'bytes=0-65535'});if(hr.status!==206){await hr.body?.cancel();throw Error('Range request must return HTTP 206');}
  const range=/^bytes 0-65535\/(\d+)$/.exec(hr.headers.get('content-range')||'');assert.ok(range,'Invalid Content-Range');const expected=Number(range[1]);assert.ok(Number.isSafeInteger(expected)&&expected>=65536&&expected<=2*1024**3,'Invalid extract size');const etag=hr.headers.get('etag');assert.ok(etag&&!etag.startsWith('W/'),'Strong ETag required');
  const header=await boundedBody(hr,65536);assert.equal(header.length,65536,'Partial header');assert.ok(header.readUInt32BE(0)>0&&header.readUInt32BE(0)<=65536,'Not an OSM PBF framing prefix');
  await writeFile(path.join(root,id.file+'.header'),header,{flag:'wx'});Object.assign(receipt,{expected_bytes:expected,etag,last_modified:hr.headers.get('last-modified'),header_sha256:hash(header)});await save();
  const response=await request(id.url,{'if-match':etag});assert.equal(response.status,200,'Full extract HTTP status');assert.equal(response.headers.get('etag'),etag,'ETag changed during capture');assert.equal(Number(response.headers.get('content-length')),expected,'Full content-length mismatch');
  let bytes=0;const sha=createHash('sha256'),md5=createHash('md5'),partial=path.join(root,id.file+'.partial');
  const meter=new Transform({transform(b,encoding,done){bytes+=b.length;if(bytes>expected){done(Error('Extract exceeds advertised size'));return;}sha.update(b);md5.update(b);onProgress(bytes,expected);done(null,b);}});
  await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(partial,{flags:'wx'}));receipt.bytes=bytes;receipt.sha256=sha.digest('hex');receipt.md5=md5.digest('hex');assert.equal(bytes,expected,'Truncated full extract');assert.equal(receipt.md5,receipt.published_md5,'Published checksum mismatch');
  const fd=await open(partial,'r');const prefix=Buffer.alloc(65536);try{await fd.read(prefix,0,prefix.length,0);}finally{await fd.close();}assert.equal(hash(prefix),receipt.header_sha256,'Header changed during capture');await rename(partial,path.join(root,id.file));receipt.status='COMPLETE_ORIGINAL_EXTRACT_HASH_VERIFIED_NOT_SOURCE_ACCEPTED';
 }catch(e){receipt.status='BLOCKED_ACQUISITION';receipt.error=String(e);throw e;}finally{receipt.completed_at=now();await save();}
 return receipt;
}
