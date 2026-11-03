// Extensie descriptivă separată de ACTUAL; intrare: contractul RT-CANON verificat.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {cardAuditBucket,cardAuditBinding,publicOsmTags} from '../../atlas-card-audit.mjs';
const root=new URL('../../',import.meta.url);
// Restrict the CLI to one pinned, repository-local evidence input. Untrusted path
// arguments must never become filesystem paths (CodeQL js/path-injection).
const verifiedInput='docs/evidence/web-card-audit-input/web-card-data.jsonl';
if(process.argv.length!==3||process.argv[2]!==verifiedInput)throw Error('RT-CANON: stage the verified source at '+verifiedInput+' and pass that exact literal path');
const bytes=await readFile(new URL('docs/evidence/web-card-audit-input/web-card-data.jsonl',root));
const expectedInputSha256='0a94d3e913593c213fbc2631893915bf4a14ecb2c8b296f690740d79cf8ec3ae';
if(createHash('sha256').update(bytes).digest('hex')!==expectedInputSha256)throw Error('RT-CANON: exact archived source SHA-256 mismatch');
const originalRecords=bytes.toString('utf8').trim().split('\n').map(JSON.parse);
const catalog=JSON.parse(await readFile(new URL('public/data/actual-entities.json',root),'utf8'));
const entities=new Map(catalog.entities.map(e=>[e.id,e]));
const expected=catalog.entity_count;
if(![5848,5725].includes(expected)||catalog.entities.length!==expected||entities.size!==expected)throw Error('RT-VA1 invalid public entity count');
const records=originalRecords.filter(r=>entities.has(r.id));
const archived=originalRecords.filter(r=>!entities.has(r.id));
if(records.length!==expected)throw Error('RT-VA1 original card evidence coverage incomplete');
if(expected===5848&&archived.length)throw Error('RT-VA1 unexpected historical card IDs');
if(expected===5725){
 const scope=JSON.parse(await readFile(new URL('docs/evidence/rt-va1-semantic-exclusion/actual-variant-a-exclusions.json',root),'utf8'));
 const ids=new Set(scope.exclusions.map(x=>x.id));
 if(scope.expected_exclusion_count!==123||ids.size!==123||(archived.length!==123&&archived.length!==0)||archived.some(x=>!ids.has(x.id)))throw Error('RT-VA1 historical card rows not exact 123 reviewed exclusions');
}
const groups=new Map(),seen=new Set();
for(const r of records){
 const e=entities.get(r.id);if(!e||seen.has(r.id)||r.jurisdiction!==e.jurisdiction)throw Error('Identitate duplicată/incompatibilă');seen.add(r.id);
 if((r.legal_identity?.id||null)!==(e.legal?.id||null)||(r.legal_identity?.registry||null)!==(e.legal?.registry||null))throw Error('Binding diferit');
 const key=e.jurisdiction.toLowerCase()+'-'+cardAuditBucket(r.id);if(!groups.has(key))groups.set(key,{});
 const m=r.geometry_metrics;groups.get(key)[r.id]={id:r.id,jurisdiction:e.jurisdiction,legal_registry:e.legal?.registry||null,legal_id:e.legal?.id||null,geometry:{geometry_type:m.geometry_type,area_m2:m.area_m2_equal_area_epsg6933,perimeter_m:m.perimeter_m_geodesic_wgs84,components:m.components,holes:m.holes,valid:m.valid},geometric_parent_id:r.representation_parent,skips_official_intermediate:r.skips_official_intermediate,parent_conflict:r.parent_conflict,osmb_tags:publicOsmTags(r.osmb_original_tags),osmb_present:r.osmb_original_tags!==null,osm_relation_id:r.osm_relation_id,osm_metadata:r.actual_osm_metadata?{version:r.actual_osm_metadata.version??null,timestamp:r.actual_osm_metadata.timestamp??null}:null,osmb_version:r.osmb_version??null,osmb_timestamp:r.osmb_timestamp??null,geometry_sha256:r.sources.actual_geometry_sha256,baseline:r.sources.git_sha,osmb_archive_sha256:e.jurisdiction==='RO'?'cc4fd15940550054d90fcadf907ed98352b68882735680093f77a624e3e04897':'d29b600daa2857bacf8ec7d13369db8fc95353e89f62fe1c762dbc692c216dad',classifier:e.legal?.registry==='SIRUTA'?'SIRUTA S1 2026 · original verificat 01.11.2026':e.legal?.registry==='CUATM'?'CUATM · snapshot BNS 27.09.2026 · original verificat 01.11.2026':'Fără binding administrativ pozitiv / rol separat'};
}
const dest=new URL('assets/web-card-audit/',root);await mkdir(dest,{recursive:true});const files=[];
for(const [key,rows] of [...groups].sort(([a],[b])=>a.localeCompare(b))){const content=JSON.stringify({schema:'web-card-audit-v1',snapshot:cardAuditBinding.snapshot,fingerprint:cardAuditBinding.fingerprint,records:rows})+'\n';const name=key+'.json';await writeFile(new URL(name,dest),content);files.push({path:name,records:Object.keys(rows).length,bytes:Buffer.byteLength(content),sha256:createHash('sha256').update(content).digest('hex')});}
await writeFile(new URL('manifest.json',dest),JSON.stringify({schema:'web-card-audit-manifest-v1',snapshot:cardAuditBinding.snapshot,fingerprint:cardAuditBinding.fingerprint,input_sha256:createHash('sha256').update(bytes).digest('hex'),record_count:seen.size,privacy:'Liste publice de taguri; fără user/uid, contact, adrese, IDNO sau câmpuri de operator/proprietar.',files},null,2)+'\n');
console.log(JSON.stringify({records:seen.size,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0)}));
