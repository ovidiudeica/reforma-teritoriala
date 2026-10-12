import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await read(p));
const index=await json('public/data/actual-topology-index.json');
const files=(await readdir(new URL('public/geo/actual/',root),{recursive:true})).filter(p=>p.endsWith('.geojson')).map(p=>'public/geo/actual/'+p.replaceAll('\\','/')).sort();
const mismatches=[],sources={};let bytes=0;
for(const path of files){const raw=await read(path),sha256=createHash('sha256').update(raw).digest('hex');sources[path]={bytes:raw.length,sha256};bytes+=raw.length;if(index.sources[path]!==sha256)mismatches.push(path);}
for(const [path,descriptor]of Object.entries(index.resources)){const raw=await read(path);if(raw.length!==descriptor.bytes||createHash('sha256').update(raw).digest('hex')!==descriptor.sha256)mismatches.push(path);}
const report={baseSha:'1b0a0c583657274f84cb9cd05bb308250889361a',snapshotId:index.snapshot_id,geometryCount:files.length,geometryBytes:bytes,entityCount:index.entityCount,topologyResources:Object.keys(index.resources).length,topologyBytes:Object.values(index.resources).reduce((n,d)=>n+d.bytes,0),topologyCounts:index.counts,topologyErrors:index.errors,status:files.length===123&&!mismatches.length?'PASS':'FAIL',mismatches,sources};
await mkdir(new URL('outputs/P8.3/',root),{recursive:true});await writeFile(new URL('outputs/P8.3/source-audit.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,sources:undefined}));if(report.status!=='PASS')process.exitCode=1;
