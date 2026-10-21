import assert from 'node:assert/strict';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {replayNiGeometry} from './ni-evidence-replay.mjs';
import {commonFrontier} from './p82-topology.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const key=(a,b)=>[a,b].sort((x,y)=>x-y).join('/');
function safe(p){assert.match(p,/^[A-Za-z0-9_./-]+$/);assert.ok(p.split('/').every(s=>s&&s!=='.'&&s!=='..'));const f=path.resolve(root,p);assert.ok(f.startsWith(path.resolve(root)+path.sep));assert.ok(lstatSync(f).isFile()&&!lstatSync(f).isSymbolicLink());assert.equal(realpathSync(f),f);return f;}
const json=p=>JSON.parse(readFileSync(safe(p)));
function capture(base,manifestFile){
 const m=json(base+'/'+manifestFile);for(const f of m.files){const p=f.path.startsWith(base+'/')?f.path:base+'/'+f.path,b=readFileSync(safe(p));assert.equal(b.length,f.bytes,p);assert.equal(digest(b),f.sha256,p);}
 const readEvidence=p=>readFileSync(safe(base+'/'+p)),data=p=>JSON.parse(readEvidence(p));let shapes;
 const replay=replayNiGeometry({data,json,readEvidence,safeEvidencePath:p=>{assert.ok(p.startsWith(base+'/'));return safe(p);},onValidatedGeometries:rows=>{shapes=new Map(rows.map(r=>[r.id,r.geometry]));}});
 const indexed=new Map(replay.topology_pairs.map(p=>[key(p.a,p.b),p]));assert.equal(indexed.size,replay.topology_pairs.length);
 const ids=replay.records.map(r=>r.osm_relation_id).sort((a,b)=>a-b),pairs=[],frontiers=[];
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=ids[i],b=ids[j],p=indexed.get(key(a,b));if(!p){assert.equal(shapes.get(a).getEnvelopeInternal().intersects(shapes.get(b).getEnvelopeInternal()),false);pairs.push({a,b,relation:'disjoint_envelopes',de9im:null});continue;}pairs.push({a,b,relation:p.relation,de9im:p.de9im});if(p.de9im[4]==='1'){const f=commonFrontier(shapes.get(a),shapes.get(b));frontiers.push({a,b,source:'DIRECT_BOUNDARY_INTERSECTION_NO_SNAPPING',segment_count:f.lines.length,lines_sha256:digest(JSON.stringify(f.lines)),metres:f.metres});}}
 return {evidence_base:base,manifest_sha256:digest(readFileSync(safe(base+'/'+manifestFile))),dependency_counts:replay.dependency_counts,records:replay.records.slice().sort((a,b)=>a.osm_relation_id-b.osm_relation_id),topology_counts:replay.topology_counts,pairs,frontiers};
}
export function generateDossier(){
 const historical=capture('docs/evidence/ni-jur-independent-20261020','sha256-manifest.json'),current=capture('docs/evidence/ni-jur-current-preparation-20261021','files-sha256.json');
 const rows=historical.records.map((a,i)=>{const b=current.records[i];assert.equal(a.id,b.id);assert.equal(a.osm_relation_id,b.osm_relation_id);return {actual_or_outline_id:a.id,osm_relation_id:a.osm_relation_id,historical_version:a.relation_version,current_version:b.relation_version,historical_original_sha256:a.raw_source_sha256,current_original_sha256:b.raw_source_sha256,historical_edges_sha256:a.edges_sha256,current_edges_sha256:b.edges_sha256,version_equal:a.relation_version===b.relation_version,geometry_equal:a.edges_sha256===b.edges_sha256,original_bytes_equal:a.raw_source_sha256===b.raw_source_sha256,dependency_versions_equal:a.dependencies.versions_sha256===b.dependencies.versions_sha256,cartographic_identity:'PASS',geometric_fidelity:'PASS',legal_or_effective_control_inference:false};});
 const d={schema:'ni-jur1-geometry-dossier-v1',status:'PREPARED_BLOCKED_DEPENDENCIES',formal_stage_accepted:false,required_prior_stages:['OSM-FIX.2','NI-JUR.0'],historical_reference:{snapshot_at:'2026-10-12T20:21:35Z',sha256:'4ebd791fb953a22961e40ef7921914251c7b7292c33ed1e90e919488f1a397b8'},capture_semantics:'Preserved non-atomic read-only captures; no new source promotion or current freshness certification.',edge_comparison_precision:'Existing accepted orientation-independent segment contract at seven decimal places; original bytes retained.',captures:{historical,current},rows,exceptions:[],actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'};
 validateDossier(d);return d;
}
export function validateDossier(d){
 assert.equal(d.schema,'ni-jur1-geometry-dossier-v1');assert.equal(d.status,'PREPARED_BLOCKED_DEPENDENCIES');assert.equal(d.formal_stage_accepted,false);assert.equal(d.actual_mutation_allowed,false);assert.equal(d.p91_import_allowed,false);assert.equal(d.semantic_acceptance,'BLOCKED_INCOMPLETE');assert.equal(d.exceptions.length,0);
 const expected=[...json('public/data/p907216-osm-roles.json').rows.map(r=>Number(r.osm_relation_id)),...json('public/data/p9095-osm-outlines.json').features.map(f=>Number(f.properties?.osm_relation_id||f.properties?.relation_id))].sort((a,b)=>a-b);
 assert.equal(d.rows.length,93);assert.equal(new Set(d.rows.map(r=>r.osm_relation_id)).size,93);assert.deepEqual(d.rows.map(r=>r.osm_relation_id).sort((a,b)=>a-b),expected);
 for(const r of d.rows){assert.equal(r.geometry_equal,true);assert.equal(r.version_equal,true);assert.equal(r.dependency_versions_equal,true);assert.equal(r.historical_edges_sha256,r.current_edges_sha256);assert.equal(r.historical_version,r.current_version);assert.equal(r.legal_or_effective_control_inference,false);assert.equal(r.geometric_fidelity,'PASS');assert.equal(r.cartographic_identity,'PASS');}
 for(const c of Object.values(d.captures)){assert.equal(c.records.length,93);for(const r of c.records){assert.equal(r.dependencies.closure,'PASS');assert.match(r.dependencies.versions_sha256,/^[a-f0-9]{64}$/);for(const type of ['relation','way','node'])assert.ok(r.dependencies.counts[type]>0);}assert.equal(c.pairs.length,4278);const seen=new Set(),counts={};for(const p of c.pairs){assert.ok(p.a<p.b);assert.ok(expected.includes(p.a)&&expected.includes(p.b));assert.ok(!seen.has(key(p.a,p.b)));seen.add(key(p.a,p.b));assert.ok(!['equal','overlap'].includes(p.relation));if(p.relation==='disjoint_envelopes')assert.equal(p.de9im,null);else assert.match(p.de9im,/^[F012T*]{9}$/);counts[p.relation]=(counts[p.relation]||0)+1;}assert.deepEqual(counts,c.topology_counts);const required=c.pairs.filter(p=>p.de9im?.[4]==='1').map(p=>key(p.a,p.b)).sort();assert.deepEqual(c.frontiers.map(f=>key(f.a,f.b)).sort(),required);for(const f of c.frontiers){assert.ok(f.segment_count>0&&f.metres>0&&Number.isFinite(f.metres));assert.match(f.lines_sha256,/^[a-f0-9]{64}$/);assert.equal(f.source,'DIRECT_BOUNDARY_INTERSECTION_NO_SNAPPING');}}
 assert.deepEqual(d.captures.historical.pairs,d.captures.current.pairs);assert.deepEqual(d.captures.historical.frontiers,d.captures.current.frontiers);
}
