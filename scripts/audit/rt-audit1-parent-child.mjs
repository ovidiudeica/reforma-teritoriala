#!/usr/bin/env node
// RT-AUDIT.1: derived, read-only parent–child geometry audit. Never writes ACTUAL.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=new URL('../../',import.meta.url);
const read=async p=>readFile(new URL(p,root));
const json=async p=>JSON.parse(await read(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const sort=(a,b)=>a<b?-1:a>b?1:0;
const base='913145398bea5861935cd4b3b89a88638d80fd9c';
const prefix='docs/rt-audit-1/';
const index=await json('public/data/actual-topology-index.json');
const tree=await json('public/data/actual-consolidated-tree.json');
const catalogBytes=await read('public/data/actual-entities.json');
const catalog=JSON.parse(catalogBytes);
assert.equal(index.contract,'actual-topology-index-v1');
assert.equal(tree.contract,'actual-consolidated-hierarchy-v1');
assert.equal(catalog.contract,'actual-public-entity-v3');
assert.equal(index.entityCount,5848);
assert.equal(tree.node_count,5848);
assert.equal(catalog.entities.length,5848);
assert.equal(sha(catalogBytes),index.catalogSha256,'P8.2 catalog binding');
const nodes=new Map(tree.nodes.map(n=>[n.id,n]));
const entities=new Map(catalog.entities.map(e=>[e.id,e]));
assert.equal(nodes.size,5848);assert.equal(entities.size,5848);
const shardPaths=[...new Set(Object.values(index.addresses))].sort(sort);
const resourcePaths=Object.keys(index.resources).sort(sort);
const frontiers=resourcePaths.filter(p=>p.startsWith('public/data/topology-frontiers/'));
assert.equal(shardPaths.length,119);assert.equal(frontiers.length,118);
assert.equal(resourcePaths.length,237);
for(const p of resourcePaths){
 const bytes=await read(p),expected=index.resources[p];
 assert.equal(bytes.length,expected.bytes,'resource length '+p);
 assert.equal(sha(bytes),expected.sha256,'resource SHA-256 '+p);
}
const geometry=new Map(),owners=new Map();
for(const p of shardPaths){
 const shard=await json(p);
 assert.equal(shard.contract,'actual-topology-shard-v1');
 for(const [id,g] of Object.entries(shard.entities)){
  assert(!geometry.has(id),'duplicate geometry shard '+id);
  assert.equal(index.addresses[id],p,'wrong index address '+id);
  geometry.set(id,g);owners.set(id,p);
 }
}
assert.equal(geometry.size,5848);
assert.equal(Object.keys(index.addresses).length,5848);
for(const n of tree.nodes){
 assert(geometry.has(n.id)&&entities.has(n.id),'uncovered node '+n.id);
 for(const child of n.child_ids??[])assert.equal(nodes.get(child)?.parent_id,n.id,'reciprocal child '+child);
 if(n.parent_id!==null){
  const p=nodes.get(n.parent_id);
  assert(p,'missing parent '+n.id);
  assert(p.child_ids.includes(n.id),'reciprocal parent '+n.id);
 }
}
const roots=tree.nodes.filter(n=>n.parent_id===null);
assert.equal(roots.length,2);
const reached=new Set(),queue=roots.map(n=>n.id);
while(queue.length){const id=queue.pop();assert(!reached.has(id),'cycle or duplicate reachable '+id);reached.add(id);queue.push(...nodes.get(id).child_ids);}
assert.equal(reached.size,5848,'unreachable nodes');
const gstatus={
 within:'WITHIN',equal:'EQUAL_EXTENT',
 contains:'CHILD_CONTAINS_PARENT',overlap:'PARTIAL_OVERLAP',
 boundary:'BOUNDARY_ONLY',point:'POINT_ONLY',absent:'DISJOINT',
 uncertain:'UNCERTAIN_GEOMETRY'
};
const records=[],GEO=[],ADM=[],DOC=[],relations={};
for(const n of tree.nodes.filter(n=>n.parent_id!==null).sort((a,b)=>sort(a.id,b.id))){
 const e=entities.get(n.id),h=e.hierarchy??{},v=e.validation??{},legal=e.legal??{};
 assert.equal(h.consolidated_parent_id,n.parent_id,'tree/catalog parent '+n.id);
 const same=geometry.get(n.id).relations.filter(x=>x.other===n.parent_id);
 assert(same.length<=1,'duplicate relation '+n.id);
 const reciprocal=geometry.get(n.parent_id).relations.filter(x=>x.other===n.id);
 assert.equal(reciprocal.length,same.length,'missing reciprocal '+n.id);
 const relation=same[0]?.relation??'absent';
 assert(Object.hasOwn(gstatus,relation),'unknown relation '+n.id+':'+relation);
 relations[relation]=(relations[relation]??0)+1;
 const geo=['contains','overlap','boundary','point','absent'].includes(relation)?[gstatus[relation]]:[];
 const doc=[];
 if(['unresolved','not_bound_to_official_registry','outside_current_legal_registry'].includes(v.legal_identity_status))doc.push('LEGAL_IDENTITY_REVIEW');
 if(v.review_required)doc.push('CATALOG_REVIEW_REQUIRED');
 if(!legal.source&&!(e.roles??[]).includes('statistical'))doc.push('PRIMARY_LEGAL_SOURCE_NOT_LINKED');
 if(h.administrative_parent_id&&h.administrative_parent_id!==n.parent_id)doc.push('STATISTICAL_VS_ADMIN_PARENT_REVIEW');
 if(relation==='uncertain')doc.push('GEOMETRY_UNCERTAIN');
 if(geo.length)doc.push('GEOMETRIC_EXCEPTION_NEEDS_ADMIN_DOCUMENTARY_REVIEW');
 const r={
  id:n.id,parent_id:n.parent_id,jurisdiction:n.jurisdiction,depth:n.depth,roles:n.roles,
  geometry:{relation,status:gstatus[relation],matrix:same[0]?.matrix??null,shard:owners.get(n.id)},
  administrative:{evidence_status:'NOT_ADJUDICATED',legal_identity_status:v.legal_identity_status??null,
   legal_id:legal.id??null,legal_source:legal.source??null,
   legal_parent_id:h.legal_parent_id??null,administrative_parent_id:h.administrative_parent_id??null},
  GEO:geo,ADM:[],DOC:doc
 };
 records.push(r);if(geo.length)GEO.push(r);if(doc.length)DOC.push(r);
 // A genuine ADM finding requires a case-specific document establishing a contradictory parent.
 // No geometric pattern or statistical-consolidation parent is legally sufficient on its own.
}
assert.equal(records.length,5846);
assert.equal(new Set(records.map(r=>r.id)).size,5846);
const summary={
 schema:'rt-audit-1-parent-child-v1',base_commit:base,
 scope:{total_nodes:5848,roots:2,parent_child_relations:5846,topology_shards:119,frontier_resources:118,verified_resources:237},
 relation_counts:Object.fromEntries(Object.entries(relations).sort(([a],[b])=>sort(a,b))),
 independent_registers:{GEO:GEO.length,ADM:ADM.length,DOC:DOC.length},
 policy:{no_auto_reparent:true,no_ACTUAL_write:true,no_legal_conclusion_from_geometry:true,
  absent_relation:'disjoint by exhaustive P8.2 derivation, whose non-disjoint relations are stored',
  equal_extent:'same geometry is not by itself an error',
  administrative_differences:'no primary-document adjudication in this tool: ADM=0 does not imply all legal parents certified',
  categories:'GEO and DOC can coexist; ADM requires individually certified contradictory primary legal evidence'}
};
const wrap=rows=>JSON.stringify({schema:summary.schema,base_commit:base,rows},null,2)+'\n';
const files={
 [prefix+'parent-child-register.json']:wrap(records),
 [prefix+'geometric-exceptions.json']:wrap(GEO),
 [prefix+'administrative-exceptions.json']:wrap(ADM),
 [prefix+'insufficient-evidence.json']:wrap(DOC),
 [prefix+'reconciliation-summary.json']:JSON.stringify(summary,null,2)+'\n'
};
files[prefix+'reconciliation-summary.md']='# RT-AUDIT.1 — audit read-only al relațiilor părinte–copil\n\n'
 +'Baseline: \`'+base+'\`.\n\n'
 +'- 5.846/5.846 relații; 5.848 noduri, două rădăcini.\n'
 +'- 119/119 sharduri + 118/118 fragmente de frontieră; 237 resurse SHA-256 și octeți validați.\n'
 +'- Excepții GEO: '+GEO.length+'; diferențe ADM demonstrate juridic aici: '+ADM.length
 +'; cazuri DOC pentru revizuire: '+DOC.length+'. Registrele nu sunt exclusive.\n'
 +'- Relații P8.2: \`'+JSON.stringify(summary.relation_counts)+'\`.\n\n'
 +'ADM=0 nu înseamnă că toate apartenențele juridice sunt certificate. O observație topologică, '
 +'un părinte statistic și un catalog cu revizuire necesară nu sunt dovezi ale unei reparentări legale. '
 +'ACTUAL și datele cartografice nu sunt modificate.\n';
files[prefix+'checksums.sha256']=Object.entries(files).map(([p,s])=>sha(Buffer.from(s))+'  '+p).join('\n')+'\n';
const check=process.argv.includes('--check');
if(!check&&!process.argv.includes('--write'))throw Error('Specify --check or --write. Default is no writes.');
for(const [p,s] of Object.entries(files)){
 if(check)assert.equal(await read(p).then(b=>b.toString('utf8')),s,'derived artifact drift '+p);
 else{await mkdir(new URL(prefix,root),{recursive:true});await writeFile(new URL(p,root),s);}
}
console.log(JSON.stringify({mode:check?'check':'write',...summary}));
