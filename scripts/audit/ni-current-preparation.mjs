import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,lstatSync,realpathSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {replayNiGeometry} from '../lib/ni-evidence-replay.mjs';
import {performanceSource} from './helpers/performance-source.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='docs/evidence/ni-jur-current-preparation-20261021',sha=b=>createHash('sha256').update(b).digest('hex');
function safePath(p){assert.equal(typeof p,'string');assert.match(p,/^[A-Za-z0-9_./-]+$/);assert.ok(p.split('/').every(s=>s&&s!=='.'&&s!=='..'));const absolute=path.resolve(root,p);assert.ok(absolute.startsWith(path.resolve(root)+path.sep));assert.ok(lstatSync(absolute).isFile()&&!lstatSync(absolute).isSymbolicLink());assert.equal(realpathSync(absolute),absolute);return absolute;}
const json=p=>JSON.parse(readFileSync(safePath(p)));
const safeEvidencePath=p=>{assert.ok(p.startsWith(base+'/'));return safePath(p);};
const readEvidence=p=>readFileSync(safeEvidencePath(base+'/'+p)),data=p=>JSON.parse(readEvidence(p));
function manifest(){const m=data('files-sha256.json');assert.equal(m.status,'PREPARED_NOT_STAGE_ACCEPTANCE');assert.equal(m.actual_mutation_allowed,false);assert.equal(m.p91_import_allowed,false);const listed=new Set();for(const f of m.files){assert.ok(!listed.has(f.path));listed.add(f.path);const bytes=readEvidence(f.path);assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256,f.path);}const actual=[];function walk(folder,relative=''){for(const e of readdirSync(folder,{withFileTypes:true})){assert.ok(!e.isSymbolicLink());const name=relative+e.name,next=path.join(folder,e.name);if(e.isDirectory())walk(next,name+'/');else if(name!=='files-sha256.json')actual.push(name);}}walk(path.resolve(root,base));assert.deepEqual(actual.sort(),[...listed].sort());}
manifest();const generator=fileURLToPath(new URL('../../docs/evidence/ni-jur-current-preparation-20261021/generate.mjs',import.meta.url));
const child=flag=>execFileSync(process.execPath,[generator,flag],{cwd:root,encoding:'utf8'}).trim();
if(process.argv.includes('--self-test'))console.log(child('--self-test'));
else if(process.argv.includes('--audit')){
 const source=performanceSource(root);assert.equal(source.trackedSourcesClean,true);console.log(child('--write'));console.log(child('--check'));manifest();
 const geometry=replayNiGeometry({data,json,readEvidence,safeEvidencePath}),recorded=data('inputs/current-93-geometry.json'),topology=data('inputs/current-93-topology.json');assert.equal(geometry.records.length,93);assert.equal(geometry.pairs,4278);assert.deepEqual(geometry.topology_counts,topology.counts);assert.deepEqual(geometry.topology_pairs,topology.pairs);
 for(const row of geometry.records){const reference=recorded.results.find(r=>(r.actual_id||r.id)===row.id);assert.ok(reference);assert.equal(row.osm_relation_id,reference.osm_relation_id);assert.equal(row.relation_version,reference.relation_version);assert.equal(row.raw_source_sha256,reference.raw_source_sha256);assert.equal(row.edges_sha256,reference.edges_sha256);}
 const dossier=data('individual-85.json'),actual=json('public/data/actual-entities.json'),byId=new Map(actual.entities.map(e=>[e.id,e]));assert.equal(actual.entities.length,5848);assert.equal(dossier.rows.length,85);for(const r of dossier.rows){assert.deepEqual(r.protected_legal_md.actual_legal,byId.get(r.actual_id).legal);assert.deepEqual(r.protected_legal_md.actual_hierarchy,byId.get(r.actual_id).hierarchy);assert.equal(r.axes.de_jure_administrative_membership,'BLOCKED_EVIDENCE');assert.equal(r.effective_control.verdict,'BLOCKED_EVIDENCE');assert.equal(r.effective_control.independent_of_de_jure_membership,true);}
 assert.equal(performanceSource(root).trackedSourcesClean,true);const folder=new URL('../../outputs/NI-CURRENT-PREPARATION/',import.meta.url);mkdirSync(folder,{recursive:true});writeFileSync(new URL('verdict.json',folder),JSON.stringify({status:'PASS_CURRENT_PREPARATION_ONLY',sourceSha:source.sha,trackedSourcesClean:true,geometry,roles:85,outlines:8,formal_NI_JUR4_completed:false,ordered_stage_gates_satisfied:false,source_promoted:false,actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'},null,2)+'\n');console.log('NI_CURRENT_PREPARATION_PASS_85_8_4278_NO_STAGE_ACCEPTANCE');
}else throw Error('Use --self-test or --audit');
