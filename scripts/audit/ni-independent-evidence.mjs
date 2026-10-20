import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parseFull,polygon,segments} from './p907218-osm-live-85.mjs';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import {readTopologyGeometry,classifyMatrix} from '../lib/p82-topology.mjs';
import {assertRelationClosure} from '../lib/osm-adaptive-transport.mjs';
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
function replayGeometry(){
 const source=readFileSync(new URL('../../scripts/audit/p907218-osm-live-85.mjs',import.meta.url),'utf8');
 const pure=source.slice(source.indexOf('const attr='),source.indexOf('async function full('));assert.equal(sha(pure),'68f5cfdc6136e0658af99db94ffad123494d6d71941957bc3d61817613a85cf3','Historical geometry functions changed');const api={parseFull,polygon,segments};
 const report=data('roles/live-source-85.json'),outlines=data('outlines/index.json'),provenance=data('provenance.json'),roles=json('public/data/p907216-osm-roles.json'),wanted=new Set(roles.rows.map(r=>r.id)),actualGeometry=new Map(),all=new Map(),shapes=[];
 for(const file of ['public/geo/actual/md-overview.geojson','public/geo/actual/md-local.geojson','public/geo/actual/md-detail.geojson'])for(const f of json(file).features)if(wanted.has(f.properties?.entity_id)){assert.ok(!actualGeometry.has(f.properties.entity_id));actualGeometry.set(f.properties.entity_id,f.geometry);}assert.equal(actualGeometry.size,85);
 const add=e=>{const key=e.type+'/'+e.id,p=all.get(key);if(p?.version&&e.version)assert.equal(p.version,e.version,'Concurrent version drift '+key);if(e.type==='node'){assert.ok(Number.isFinite(e.lon)&&Number.isFinite(e.lat));if(p){assert.equal(p.lon,e.lon);assert.equal(p.lat,e.lat);}}all.set(key,{...p,...e});};
 assert.equal(report.rows.length,85);assert.equal(report.counts.unresolved,0);assert.equal(report.verdict,'COMPLETE_85_UNCHANGED');
 for(const row of report.rows){assert.ok(wanted.has(row.id));const compressed=readEvidence('roles/raw-osm-full/relation-'+Number(row.osm_relation_id)+'.osm.xml.gz'),xml=gunzipSync(compressed).toString('utf8');assert.equal(sha(xml),row.capture.raw_xml_sha256);assert.equal(row.capture.http_status,200);const full=api.parseFull(xml),rel=full.relations.get(String(row.osm_relation_id)),shape=api.polygon(rel,full.ways,full.nodes),edges=api.segments(shape);assert.equal(edges.digest,row.live_edge_sha256);assert.equal(edges.digest,api.segments(actualGeometry.get(row.id)).digest);assert.equal(rel.version,row.baseline_version);assert.equal(row.relation_members_equal,true);assert.equal(row.tags_equal,true);
  for(const n of full.nodes.values())add({...n,type:'node',id:Number(n.id)});for(const w of full.ways.values())add({...w,type:'way',id:Number(w.id),nodes:w.nodes.map(Number)});for(const r of full.relations.values())add({...r,type:'relation',id:Number(r.id),members:r.members.map(m=>({...m,ref:Number(m.ref)}))});shapes.push({id:Number(row.osm_relation_id),shape});}
 const reference=json('public/data/p9095-osm-outlines.json');assert.equal(outlines.rows.length,8);
 for(const row of outlines.rows){const f=provenance.outline_files.find(f=>f.relation_id===row.osm_relation_id);assert.ok(f);const bytes=gunzipSync(readFileSync(safeEvidencePath(f.path)));assert.equal(sha(bytes),f.body_sha256);const raw=JSON.parse(bytes),nodes=new Map(),ways=new Map(),seen=new Set();let rel;for(const e of raw.elements){const key=e.type+'/'+e.id;assert.ok(!seen.has(key));seen.add(key);add(e);if(e.type==='node')nodes.set(String(e.id),{...e,id:String(e.id)});if(e.type==='way')ways.set(String(e.id),{...e,id:String(e.id),nodes:e.nodes.map(String)});if(e.type==='relation'&&e.id===row.osm_relation_id)rel={...e,id:String(e.id),members:e.members.map(m=>({...m,ref:String(m.ref)}))};}assert.ok(rel);assert.equal(rel.version,row.pinned.relation_version);const shape=api.polygon(rel,ways,nodes),ref=reference.features.find(f=>f.id===row.id);assert.ok(ref);assert.equal(api.segments(shape).digest,api.segments(ref.geometry).digest);shapes.push({id:row.osm_relation_id,shape});}
 assert.equal(shapes.length,93);assert.equal(new Set(shapes.map(s=>s.id)).size,93);assertRelationClosure({elements:[...all.values()]},shapes.map(s=>s.id));
 const valid=shapes.map(s=>({...s,geometry:readTopologyGeometry(s.shape)}));let pairs=0,overlaps=0,equalities=0;for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++){const a=valid[i].geometry,b=valid[j].geometry;pairs++;if(!a.getEnvelopeInternal().intersects(b.getEnvelopeInternal()))continue;const relation=classifyMatrix(RelateOp.relate(a,b));if(relation==='equal')equalities++;if(relation==='overlap')overlaps++;}assert.equal(overlaps,0);assert.equal(equalities,0);return {roles:85,outlines:8,valid:93,pairs,overlaps,equalities,missing_dependencies:0};
}
verifyManifest();const dossier=data('individual-85.json');validateDossier(dossier);
if(process.argv.includes('--self-test')){
 for(const [name,mutate] of [['duplicate identity',d=>{d.rows[1].actual_id=d.rows[0].actual_id;}],['MD reparent',d=>{d.rows[0].protected_legal_md.actual_legal.parent_id='9999';}],['false juridical promotion',d=>{d.rows[0].axes.legal_membership_and_full_polygon_control='PASS';}],['false stage closure',d=>{d.formal_NI_JUR4_completed=true;}],['false primary OSM identifier',d=>{d.rows[0].historical_claim.primary_source_parent_osm_id='1702218';}],['name coalescence',d=>{d.rows.splice(d.rows.findIndex(r=>r.label==='Bender'),1);}]] ){
  const changed=structuredClone(dossier);mutate(changed);for(const r of changed.rows){const {row_sha256,...body}=r;r.row_sha256=sha(JSON.stringify(body));}assert.throws(()=>validateDossier(changed),name);console.log('PASS reject '+name);
 }
 console.log('NI_INDEPENDENT_NEGATIVE_TESTS_PASS');
}else if(process.argv.includes('--audit')){
 const geometry=replayGeometry(),source=performanceSource(root);assert.equal(source.trackedSourcesClean,true);const folder=new URL('../../outputs/NI-INDEPENDENT-EVIDENCE/',import.meta.url);mkdirSync(folder,{recursive:true});writeFileSync(new URL('verdict.json',folder),JSON.stringify({status:'PASS_EVIDENCE_PRESERVATION_ONLY',sourceSha:source.sha,trackedSourcesClean:true,geometry,documentary_certification:'BLOCKED_INCOMPLETE',formal_NI_JUR4_completed:false,actual_counts:{RO:3246,MD:2602,total:5848},actual_snapshot:release.snapshot_id,actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'},null,2)+'\n');console.log('NI_INDEPENDENT_EVIDENCE_REPLAY_PASS '+JSON.stringify(geometry));
}else throw Error('Use --self-test or --audit');
