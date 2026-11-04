// Deterministic RT-VA1 WEB-CARD.1 derivative from the immutable 5848-row evidence.
// Validate every original byte and every reviewed deletion BEFORE writing any output.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cardAuditBucket,approvedCardAuditBindings} from '../../atlas-card-audit.mjs';
const read=path=>readFile(path),json=async path=>JSON.parse(await read(path));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const base=approvedCardAuditBindings[0],variant=approvedCardAuditBindings[1];
const [manifest,index,release,scope,archive]=await Promise.all([
 json('assets/web-card-audit/manifest.json'),json('public/data/actual-entities.json'),json('data/current/actual-release-manifest.json'),
 json('docs/evidence/rt-va1-semantic-exclusion/actual-variant-a-exclusions.json'),
 read('docs/evidence/rt-va1-semantic-exclusion/original-allotments-123.json')
]);
if(scope.expected_exclusion_count!==123||scope.structural_rule_count!==122||scope.reviewed_override_count!==1||
 scope.exclusions?.length!==123||digest(archive)!==scope.source_evidence?.sha256)throw Error('RT-VA1 unverified exclusion evidence');
const excluded=new Set(scope.exclusions.map(r=>r.id));
if(excluded.size!==123||!excluded.has('osm-r12104738')||scope.exclusions.filter(x=>x.classification_method==='structural_rule').length!==122||
 scope.exclusions.filter(x=>x.classification_method==='reviewed_override').length!==1)throw Error('RT-VA1 unreviewed exclusion');
if(index.entity_count!==index.entities.length||new Set(index.entities.map(x=>x.id)).size!==index.entity_count||
 release.public_contract?.entity_count!==index.entity_count)throw Error('RT-VA1 public release/index cardinality mismatch');
const profile=approvedCardAuditBindings.find(x=>x.snapshot===release.snapshot_id&&x.fingerprint===release.release_fingerprint_sha256);
if(!profile)throw Error('RT-VA1 unknown/uncertified release identity');
const oldAlreadyBound=profile===base&&manifest.snapshot===base.snapshot&&manifest.fingerprint===base.fingerprint&&manifest.record_count===5848;
if(oldAlreadyBound){
 if(index.entity_count!==5848||manifest.files.length!==64||manifest.files.reduce((n,x)=>n+x.records,0)!==5848)throw Error('RT-VA1 unexpected historical WEB-CARD manifest');
 console.log(JSON.stringify({status:'PASS_HISTORICAL_UNCHANGED',records:5848,files:64}));process.exit(0);
}
if(profile!==variant||index.entity_count!==5725)throw Error('RT-VA1 exact 5725 release required');
if(manifest.snapshot!==base.snapshot||manifest.fingerprint!==base.fingerprint||manifest.record_count!==5848||manifest.files.length!==64||
 manifest.files.reduce((n,x)=>n+x.records,0)!==5848)throw Error('RT-VA1 base card proof not authentic');
const ids=new Map(index.entities.map(x=>[x.id,x])),seen=new Set(),rowsRemoved=new Set(),ready=[];
for(const entry of manifest.files){
 if(!/^(?:ro|md)-[0-3][0-9]\.json$/.test(entry.path)||Number(entry.path.slice(3,5))>=32)throw Error('RT-VA1 unsafe card bucket path');
 const source=await read('assets/web-card-audit/'+entry.path);
 if(source.length!==entry.bytes||digest(source)!==entry.sha256)throw Error('RT-VA1 source card hash mismatch '+entry.path);
 const doc=JSON.parse(source);
 if(doc.schema!=='web-card-audit-v1'||doc.snapshot!==base.snapshot||doc.fingerprint!==base.fingerprint||
 Object.keys(doc.records||{}).length!==entry.records)throw Error('RT-VA1 base card bucket mismatch');
 const retained={};
 for(const [id,row]of Object.entries(doc.records)){
  if(seen.has(id))throw Error('RT-VA1 duplicate source card '+id);seen.add(id);
  if(id!==row.id||row.jurisdiction.toLowerCase()!==entry.path.slice(0,2)||cardAuditBucket(id)!==entry.path.slice(3,5))throw Error('RT-VA1 source card key mismatch '+id);
  if(!ids.has(id)){
   if(!excluded.has(id)||row.jurisdiction!=='MD')throw Error('RT-VA1 unauthorized historical card exclusion '+id);
   rowsRemoved.add(id);continue;
  }
  const e=ids.get(id);
  if(e.jurisdiction!==row.jurisdiction||row.legal_id!==(e.legal?.id??null)||row.legal_registry!==(e.legal?.registry??null))throw Error('RT-VA1 retained card binding mismatch '+id);
  retained[id]=row;
 }
 const updated=JSON.stringify({...doc,snapshot:variant.snapshot,fingerprint:variant.fingerprint,records:retained})+'\n';
 ready.push({path:entry.path,records:Object.keys(retained).length,bytes:Buffer.byteLength(updated),sha256:digest(updated),content:updated});
}
if(seen.size!==5848||rowsRemoved.size!==123||[...excluded].some(id=>!rowsRemoved.has(id))||
 ready.reduce((n,r)=>n+r.records,0)!==5725||ids.size!==5725)throw Error('RT-VA1 exact 123-card proof failed');
const original=await read('assets/web-card-audit/manifest.json');
const result={...manifest,snapshot:variant.snapshot,fingerprint:variant.fingerprint,record_count:5725,
 derivation:{schema:'rt-va1-card-filter-v1',source_snapshot:base.snapshot,source_fingerprint:base.fingerprint,
 source_manifest_sha256:digest(original),source_record_count:5848,removed_reviewed_ids:123,
 exclusions_sha256:scope.source_evidence.sha256},files:ready.map(({content,...entry})=>entry)};
for(const x of ready)await writeFile('assets/web-card-audit/'+x.path,x.content);
await writeFile('assets/web-card-audit/manifest.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',snapshot:variant.snapshot,record_count:5725,archived:123,files:ready.length}));
