import {replayNiGeometry} from '../lib/ni-evidence-replay.mjs';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {performanceSource} from './helpers/performance-source.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='docs/evidence/ni-jur-independent-20261020';
const sha=x=>createHash('sha256').update(x).digest('hex');
function safeProjectPath(p){assert.equal(typeof p,'string');assert.match(p,/^[A-Za-z0-9_./-]+$/);assert.ok(p.split('/').every(s=>s&&s!=='.'&&s!=='..'));const absolute=path.resolve(root,p);assert.ok(absolute.startsWith(path.resolve(root)+path.sep));assert.ok(lstatSync(absolute).isFile()&&!lstatSync(absolute).isSymbolicLink());assert.equal(realpathSync(absolute),absolute);return absolute;}
const json=p=>JSON.parse(readFileSync(safeProjectPath(p),'utf8'));
function safeEvidencePath(p){
 assert.equal(typeof p,'string');assert.ok(p.startsWith(base+'/'));assert.match(p,/^[A-Za-z0-9_./-]+$/);assert.ok(p.split('/').every(s=>s&&s!=='.'&&s!=='..'));
 const absolute=path.resolve(root,p);assert.ok(absolute.startsWith(path.resolve(root,base)+path.sep));assert.ok(lstatSync(absolute).isFile()&&!lstatSync(absolute).isSymbolicLink());assert.equal(realpathSync(absolute),absolute);return absolute;
}
const readEvidence=p=>readFileSync(safeEvidencePath(base+'/'+p));
const data=p=>JSON.parse(readEvidence(p));
const manifest=data('sha256-manifest.json');
assert.equal(manifest.status,'PRESERVED_NOT_STAGE_ACCEPTANCE');assert.equal(manifest.actual_mutation_allowed,false);assert.equal(manifest.p91_import_allowed,false);assert.equal(manifest.semantic_acceptance,'BLOCKED_INCOMPLETE');
const actual=json('public/data/actual-entities.json'),release=json('data/current/actual-release-manifest.json'),byActual=new Map(actual.entities.map(e=>[e.id,e]));
assert.equal(actual.entities.length,5848);assert.equal(byActual.size,5848);assert.deepEqual(['RO','MD'].map(j=>actual.entities.filter(e=>e.jurisdiction===j).length),[3246,2602]);assert.equal(release.snapshot_id,'actual-a9e5a4ddcb5277ef');assert.equal(release.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
assert.equal(sha(readFileSync(new URL('../../public/data/actual-entities.json',import.meta.url))),release.public_contract.sha256);
for(const c of Object.values(release.components))if(c.path&&c.sha256)assert.equal(sha(readFileSync(safeProjectPath(c.path))),c.sha256,c.path);
function verifyManifest(){
 const listed=new Set();for(const file of manifest.files){assert.ok(!listed.has(file.path));listed.add(file.path);const bytes=readFileSync(safeEvidencePath(file.path));assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256,file.path);}
 const actualPaths=[];const walk=p=>{for(const e of readdirSync(path.join(root,p),{withFileTypes:true})){assert.ok(!e.isSymbolicLink());const next=p+'/'+e.name;if(e.isDirectory())walk(next);else if(next!==base+'/sha256-manifest.json')actualPaths.push(next);}};walk(base);assert.deepEqual(actualPaths.sort(),[...listed].sort());
}
export function validateDossier(d){
 assert.equal(d.status,'PREPARED_NOT_FORMAL_NI_JUR_ACCEPTANCE');assert.equal(d.ordered_stage_gates_satisfied,false);assert.equal(d.formal_NI_JUR4_completed,false);assert.equal(d.actual_mutation_allowed,false);assert.equal(d.p91_import_allowed,false);assert.equal(d.semantic_acceptance,'BLOCKED_INCOMPLETE');assert.equal(d.source_register_exhaustiveness_certified,false);
 const wanted=json('public/data/p907216-osm-roles.json').rows.map(r=>r.id).sort();assert.deepEqual(d.rows.map(r=>r.actual_id).sort(),wanted);assert.equal(new Set(d.rows.map(r=>r.actual_id)).size,85);
 for(const r of d.rows){const a=byActual.get(r.actual_id);assert.ok(a);assert.equal(r.osm_relation_id,a.representation.osm_relation_id);assert.deepEqual(r.protected_legal_md.actual_legal,a.legal);assert.deepEqual(r.protected_legal_md.actual_hierarchy,a.hierarchy);assert.equal(r.actual_mutation_allowed,false);assert.equal(r.p91_import_allowed,false);assert.deepEqual(r.axes,{cartographic_identity:'PASS',geometric_fidelity:'PASS',operational_administrative_organization:'UNRESOLVED',legal_membership_and_full_polygon_control:'BLOCKED_EVIDENCE',contemporary_documentary_certification:'BLOCKED_EVIDENCE'});assert.equal(r.historical_claim.parent_identifier_authority,'HISTORICAL_PROJECT_CROSSWALK_NOT_PRIMARY_SOURCE_IDENTIFIER');assert.equal(r.historical_claim.primary_source_parent_osm_id,null);const {row_sha256,...body}=r;assert.equal(row_sha256,sha(JSON.stringify(body)));}
 assert.equal(d.rows.filter(r=>r.label==='Bender').length,2);assert.equal(d.rows.filter(r=>r.label==='Hlinaia').length,2);assert.deepEqual(d.security_zone_exceptions.map(r=>r.requested_name),['Roghi','Mahala','Pohrebea','Vasilievca']);assert.equal(d.security_zone_exceptions.find(r=>r.requested_name==='Vasilievca').cuatm_snapshot_candidates.length,2);
}
function replayGeometry(){return replayNiGeometry({data,json,readEvidence,safeEvidencePath});}

verifyManifest();const dossier=data('individual-85.json');validateDossier(dossier);
if(process.argv.includes('--self-test')){
 for(const [name,mutate] of [['duplicate identity',d=>{d.rows[1].actual_id=d.rows[0].actual_id;}],['MD reparent',d=>{d.rows[0].protected_legal_md.actual_legal.parent_id='9999';}],['false juridical promotion',d=>{d.rows[0].axes.legal_membership_and_full_polygon_control='PASS';}],['false stage closure',d=>{d.formal_NI_JUR4_completed=true;}],['false primary OSM identifier',d=>{d.rows[0].historical_claim.primary_source_parent_osm_id='1702218';}],['name coalescence',d=>{d.rows.splice(d.rows.findIndex(r=>r.label==='Bender'),1);}]] ){
  const changed=structuredClone(dossier);mutate(changed);for(const r of changed.rows){const {row_sha256,...body}=r;r.row_sha256=sha(JSON.stringify(body));}assert.throws(()=>validateDossier(changed),name);console.log('PASS reject '+name);
 }
 console.log('NI_INDEPENDENT_NEGATIVE_TESTS_PASS');
}else if(process.argv.includes('--audit')){
 const geometry=replayGeometry(),source=performanceSource(root);assert.equal(source.trackedSourcesClean,true);const folder=new URL('../../outputs/NI-INDEPENDENT-EVIDENCE/',import.meta.url);mkdirSync(folder,{recursive:true});writeFileSync(new URL('verdict.json',folder),JSON.stringify({status:'PASS_EVIDENCE_PRESERVATION_ONLY',sourceSha:source.sha,trackedSourcesClean:true,geometry,documentary_certification:'BLOCKED_INCOMPLETE',formal_NI_JUR4_completed:false,actual_counts:{RO:3246,MD:2602,total:5848},actual_snapshot:release.snapshot_id,actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'},null,2)+'\n');console.log('NI_INDEPENDENT_EVIDENCE_REPLAY_PASS '+JSON.stringify(geometry));
}else throw Error('Use --self-test or --audit');
