#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {osmManifestPath,osmSnapshotPath} from '../lib/osm-source-paths.mjs';

const MANIFEST=osmManifestPath(process.env.OSM_CURRENT_SOURCE_MANIFEST||'data/sources/osm-source-current.json');
const OUT='outputs/osm-source-candidate';
const sha256=value=>createHash('sha256').update(value).digest('hex');

const manifestBytes=await readFile(MANIFEST);
const manifest=JSON.parse(manifestBytes.toString('utf8'));
await mkdir(OUT+'/snapshots',{recursive:true});
const staged=[];
for(const code of ['RO','MD']){
 const entry=manifest.countries?.[code];
 if(!entry?.snapshot_path)throw new Error('Missing '+code+' snapshot path');
 const path=osmSnapshotPath(entry,code);
 const bytes=await readFile(path);
 if(sha256(bytes)!==entry.compressed_sha256)throw new Error(code+' staged compressed SHA-256 mismatch');
 const canonical=gunzipSync(bytes);
 if(sha256(canonical)!==entry.semantic_sha256)throw new Error(code+' staged semantic SHA-256 mismatch');
 const target=OUT+'/snapshots/'+basename(entry.snapshot_path);
 await copyFile(path,target);
 staged.push({code,source_path:entry.snapshot_path,artifact_path:target,size_bytes:bytes.length,
  compressed_sha256:entry.compressed_sha256,semantic_sha256:entry.semantic_sha256});
}
await copyFile(MANIFEST,OUT+'/osm-source-current.json');
for(const path of ['outputs/osm-source-continuity.json','outputs/osm-fix2-source-transition.json','outputs/osm-fix2-per-id-forensics.json']){
 try{await copyFile(path,OUT+'/'+basename(path));}
 catch(error){if(error?.code!=='ENOENT')throw error;}
}
const receipt={
 schema:'osm-source-candidate-artifact-v1',
 manifest_path:MANIFEST,
 manifest_sha256:sha256(manifestBytes),
 snapshot_at:manifest.snapshot_at,
 staged_snapshots:staged
};
await writeFile(OUT+'/artifact-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
