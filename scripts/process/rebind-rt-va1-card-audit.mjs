// RT-VA1 WEB-CARD.1: exact reviewed 123-ID filter, or authenticated CUATM A/B fixture.
// An unrecognized semantic release is never accepted for production publication.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cardAuditBucket,approvedCardAuditBindings} from '../../atlas-card-audit.mjs';
const read=p=>readFile(p),json=async p=>JSON.parse(await read(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const historical=approvedCardAuditBindings[0],variant=approvedCardAuditBindings[1];
const [manifest,index,release,scope,archive]=await Promise.all([
 json('assets/web-card-audit/manifest.json'),
 json('public/data/actual-entities.json'),
 json('data/current/actual-release-manifest.json'),
 json('docs/evidence/rt-va1-semantic-exclusion/actual-variant-a-exclusions.json'),
 read('docs/evidence/rt-va1-semantic-exclusion/original-allotments-123.json')
]);
const requireProof=(ok,msg)=>{if(!ok)throw Error('RT-VA1 WEB-CARD blocked: '+msg);};
requireProof(scope.expected_exclusion_count===123&&scope.structural_rule_count===122&&scope.reviewed_override_count===1&&
 scope.exclusions?.length===123&&sha(archive)===scope.source_evidence?.sha256,'unverified exclusion evidence');
const excluded=new Set(scope.exclusions.map(x=>x.id));
requireProof(excluded.size===123&&excluded.has('osm-r12104738')&&
 scope.exclusions.filter(x=>x.classification_method==='structural_rule').length===122&&
 scope.exclusions.filter(x=>x.classification_method==='reviewed_override').length===1,'unreviewed exclusions');
requireProof(Array.isArray(index.entities)&&index.entity_count===index.entities.length&&
 new Set(index.entities.map(x=>x.id)).size===index.entity_count&&release.public_contract?.entity_count===index.entity_count,
 'public release/index cardinality mismatch');
const counts=Object.fromEntries(['RO','MD'].map(k=>[k,index.entities.filter(e=>e.jurisdiction===k).length]));
requireProof((index.entity_count===5848&&counts.RO===3246&&counts.MD===2602)||
 (index.entity_count===5725&&counts.RO===3246&&counts.MD===2479),'unexpected RO/MD population');
const releaseProfile=approvedCardAuditBindings.find(x=>x.snapshot===release.snapshot_id&&x.fingerprint===release.release_fingerprint_sha256);
const sourceProfile=approvedCardAuditBindings.find(x=>x.snapshot===manifest.snapshot&&x.fingerprint===manifest.fingerprint);
requireProof(Boolean(sourceProfile),'source WEB-CARD manifest is not a certified release');
requireProof(Array.isArray(manifest.files)&&manifest.files.length===64&&
 manifest.record_count===(sourceProfile===historical?5848:5725)&&
 manifest.files.reduce((n,f)=>n+f.records,0)===manifest.record_count,'source card manifest cardinality');
async function verifySyntheticAbFixture(){
 // Only this exact source injection in the network-denied A/B workflow is admissible.
 requireProof(process.env.ACTUAL_AB_CUATM_FIXTURE==='one-record-v1'&&
  process.env.GITHUB_ACTIONS==='true'&&process.env.ACTUAL_NETWORK_MODE==='docker-network-none',
  'unapproved A/B-only fixture marker/environment');
 const baseRef=process.env.ACTUAL_BASE_REF;
 requireProof(/^[0-9a-f]{40}$/.test(baseRef??''),'A/B fixture base is not an exact commit');
 const fromBase=p=>JSON.parse(execFileSync('git',['show',baseRef+':'+p],{maxBuffer:256*1024*1024}));
 const previous=fromBase('data/current/actual-release-manifest.json');
 requireProof(previous.snapshot_id===sourceProfile.snapshot&&previous.release_fingerprint_sha256===sourceProfile.fingerprint,
  'source card snapshot does not match exact persisted A/B base');
 const oldCu=fromBase('data/sources/cuatm-current.json');
 const liveCu=await json('data/sources/cuatm-current.json');
 requireProof(Array.isArray(liveCu.records)&&liveCu.records.length>0&&
  liveCu.records[0].reproducibility_probe==='actual-change-e2e-v1'&&
  !Object.prototype.hasOwnProperty.call(oldCu.records[0],'reproducibility_probe'),
  'missing/altered single CUATM fixture injection');
 const stripped=structuredClone(liveCu);
 delete stripped.records[0].reproducibility_probe;
 requireProof(JSON.stringify(stripped)===JSON.stringify(oldCu),'CUATM source contains unreviewed changes');
 requireProof(release.snapshot_id==='actual-'+String(release.release_fingerprint_sha256).slice(0,16)&&
 release.release_fingerprint_sha256!==previous.release_fingerprint_sha256&&
 index.entity_count===5725,'synthetic candidate must be a distinct, exact 5725 release');
 if(sourceProfile===variant){
  // Following official Variant A promotion, CUATM test metadata must not change geometry.
  requireProof(['ro_geojson','md_geojson'].every(k=>
   previous.components?.[k]?.sha256===release.components?.[k]?.sha256),
   'synthetic CUATM fixture changed retained polygons');
 }
 const gate=await json('data/current/actual-release-gate.json');
 requireProof(gate.status==='PASS'&&gate.snapshot_id===release.snapshot_id,
  'synthetic candidate release gate not PASS');
 return {mode:'CUATM_CHANGE_AB_ONLY',base_snapshot:previous.snapshot_id};
}
const synthetic=!releaseProfile?await verifySyntheticAbFixture():null;
requireProof(Boolean(releaseProfile)||Boolean(synthetic),'unknown release identity outside A/B');
const alreadyBound=releaseProfile&&sourceProfile===releaseProfile&&
 manifest.record_count===index.entity_count;
if(alreadyBound){
 // Every existing bucket remains verified by the ordinary WEB-CARD CI gate.
 console.log(JSON.stringify({status:'PASS_ALREADY_BOUND',snapshot:releaseProfile.snapshot,records:index.entity_count,files:64}));
 process.exit(0);
}
requireProof(releaseProfile===variant||Boolean(synthetic),'only exact reviewed Variant A is derivable');
requireProof(index.entity_count===5725,'reviewed target must contain 5725 identities');
requireProof(sourceProfile===historical||Boolean(synthetic),'official Variant A must derive from historical source');
const originalCount=manifest.record_count,removedExpected=originalCount-index.entity_count;
requireProof((originalCount===5848&&removedExpected===123)||
 (originalCount===5725&&removedExpected===0&&Boolean(synthetic)),
 'unapproved historical card deletion count');
const ids=new Map(index.entities.map(x=>[x.id,x])),seen=new Set(),rowsRemoved=new Set(),ready=[];
for(const entry of manifest.files){
 requireProof(/^(?:ro|md)-[0-3][0-9]\.json$/.test(entry.path)&&Number(entry.path.slice(3,5))<32,
  'unsafe card bucket path');
 const source=await read('assets/web-card-audit/'+entry.path);
 requireProof(source.length===entry.bytes&&sha(source)===entry.sha256,'source card hash mismatch '+entry.path);
 const doc=JSON.parse(source);
 requireProof(doc.schema==='web-card-audit-v1'&&doc.snapshot===sourceProfile.snapshot&&
 doc.fingerprint===sourceProfile.fingerprint&&Object.keys(doc.records||{}).length===entry.records,
 'source card bucket mismatch '+entry.path);
 const retained={};
 for(const [id,row] of Object.entries(doc.records)){
  requireProof(!seen.has(id),'duplicate archived card '+id);seen.add(id);
  requireProof(id===row.id&&row.jurisdiction.toLowerCase()===entry.path.slice(0,2)&&
   cardAuditBucket(id)===entry.path.slice(3,5),'archived card key mismatch '+id);
  if(!ids.has(id)){
   requireProof(sourceProfile===historical&&excluded.has(id)&&row.jurisdiction==='MD',
    'unreviewed card exclusion '+id);
   rowsRemoved.add(id);continue;
  }
  const entity=ids.get(id);
  requireProof(entity.jurisdiction===row.jurisdiction&&row.legal_id===(entity.legal?.id??null)&&
  row.legal_registry===(entity.legal?.registry??null),'retained legal card mismatch '+id);
  retained[id]=row;
 }
 const out=JSON.stringify({...doc,snapshot:release.snapshot_id,
  fingerprint:release.release_fingerprint_sha256,records:retained})+'\n';
 ready.push({path:entry.path,records:Object.keys(retained).length,
  bytes:Buffer.byteLength(out),sha256:sha(out),content:out});
}
requireProof(seen.size===originalCount&&rowsRemoved.size===removedExpected&&
 (removedExpected===0||[...excluded].every(id=>rowsRemoved.has(id)))&&
 ready.reduce((n,x)=>n+x.records,0)===5725&&ids.size===5725,
 'exact reviewed deletion/retention proof failed');
const original=await read('assets/web-card-audit/manifest.json');
const derived={...manifest,snapshot:release.snapshot_id,
 fingerprint:release.release_fingerprint_sha256,record_count:5725,
 derivation:{schema:'rt-va1-card-filter-v1',source_snapshot:sourceProfile.snapshot,
  source_fingerprint:sourceProfile.fingerprint,source_manifest_sha256:sha(original),
  source_record_count:originalCount,removed_reviewed_ids:removedExpected,
  exclusions_sha256:scope.source_evidence.sha256,
  ...(synthetic?{synthetic_reproducibility_fixture:synthetic.mode}: {})
 },files:ready.map(({content,...entry})=>entry)};
for(const row of ready)await writeFile('assets/web-card-audit/'+row.path,row.content);
await writeFile('assets/web-card-audit/manifest.json',JSON.stringify(derived,null,2)+'\n');
console.log(JSON.stringify({status:synthetic?'PASS_UNPUBLISHED_AB_FIXTURE':'PASS',
 snapshot:release.snapshot_id,record_count:5725,archived:removedExpected,files:ready.length}));
