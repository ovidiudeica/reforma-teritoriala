#!/usr/bin/env node
// RT-AUDIT.1: derived evidence only. Never writes to ACTUAL, topology or public/.
import {readFile, mkdir, writeFile, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const load=async p=>readFile(new URL(p,root));
const digest=b=>createHash('sha256').update(b).digest('hex');
const readJson=async p=>JSON.parse(await load(p));
const fail=m=>{throw Error('RT-AUDIT.1: '+m)};
const output='outputs/RT-AUDIT.1/';
const manifest=await readJson('data/current/actual-release-manifest.json');
const topBytes=await load('public/data/actual-topology-index.json');
const topology=JSON.parse(topBytes);
const entityBytes=await load('public/data/actual-entities.json');
const publicEntities=JSON.parse(entityBytes).entities;
if(topology.contract!=='actual-topology-index-v1')fail('contract topologic neacceptat');
if(digest(entityBytes)!==topology.catalogSha256)fail('SHA catalog public diferit de index');
if(publicEntities.length!==5848||topology.entityCount!==5848)fail('inventar identitati diferit de 5848');
if(topology.snapshot_id!==manifest.snapshot_id)fail('snapshot diferit');
const components=manifest.components||{};
const sourceProof=[];
for(const [name,entry] of Object.entries(components)){
 if(!entry?.path)continue;
 const raw=await load(entry.path);
 const h=digest(raw);
 const declared=entry.sha256??entry.sha_256??null;
 if(declared&&h!==declared)fail('SHA component '+name);
 sourceProof.push({name,path:entry.path,sha256:h,bytes:raw.length,declared_sha256:declared});
}
if(!sourceProof.some(x=>x.name==='ro_geojson')||!sourceProof.some(x=>x.name==='md_geojson'))fail('lipsesc fisierele ACTUAL RO/MD');
const byId=new Map();
for(const e of publicEntities){if(byId.has(e.id))fail('ID duplicat '+e.id);byId.set(e.id,e)}
const addresses=topology.addresses||{},resources=topology.resources||{};
const relationPaths=[...new Set(Object.values(addresses))].sort();
if(relationPaths.length!==119)fail('numar sharduri '+relationPaths.length+' in loc de 119');
const shards=new Map(),resourceProof=[];
for(const path of relationPaths){
 if(!path.startsWith('public/data/topology/')||!path.endsWith('.json'))fail('cale shard nepermisa '+path);
 const expected=resources[path];if(!expected)fail('resursa neindexata '+path);
 const raw=await load(path);
 if(raw.length!==expected.bytes||digest(raw)!==expected.sha256)fail('integritate shard '+path);
 const shard=JSON.parse(raw);
 if(shard.contract!=='actual-topology-shard-v1')fail('contract shard '+path);
 shards.set(path,shard.entities);
 resourceProof.push({path,bytes:raw.length,sha256:digest(raw)});
}
const unreferenced=Object.keys(resources).filter(p=>p.startsWith('public/data/topology/')&&!shards.has(p));
if(unreferenced.length)fail('sharduri neprocesate: '+unreferenced.length);
const legalEvidence=[]; // not inferred from geometric or OSM tags
const register=[],geo=[],adm=[],doc=[],counts={OK:0,GEO:0,ADM:0,DOC:0};
for(const child of [...publicEntities].sort((a,b)=>a.id.localeCompare(b.id,'en'))){
 const parentId=child.hierarchy?.consolidated_parent_id??null;
 if(parentId===null)continue;
 const parent=byId.get(parentId);
 if(!parent)fail('parinte necunoscut '+child.id);
 const p=addresses[parentId],c=addresses[child.id];
 if(!p||!c)fail('geometrie neindexata '+child.id);
 const pEntry=shards.get(p)?.[parentId],cEntry=shards.get(c)?.[child.id];
 if(!pEntry||!cEntry)fail('entitate lipsa in shard '+child.id);
 const pRel=pEntry.relations?.filter(x=>x.other===child.id)||[];
 const cRel=cEntry.relations?.filter(x=>x.other===parentId)||[];
 if(pRel.length>1||cRel.length>1)fail('relatie duplicata '+child.id);
 const relation=pRel[0]?.relation??(cRel[0]?.relation==='within'?'contains':cRel[0]?.relation==='contains'?'within':cRel[0]?.relation??'disjoint');
 if(pRel.length&&cRel.length){
  const reverse={contains:'within',within:'contains'};
  if((reverse[relation]||relation)!==cRel[0].relation)fail('asimetrie shard '+child.id);
 }
 const matrix=pRel[0]?.matrix??cRel[0]?.matrix??null;
 // Containment is geometric evidence only. Equal needs separate role review.
 const geometryStatus=relation==='contains'?'CONTAINED':relation==='equal'?'EQUAL':relation==='within'?'REVERSED_CONTAINMENT':relation==='disjoint'?'DISJOINT':relation==='uncertain'?'UNDETERMINED':relation==='boundary'?'BOUNDARY_ONLY':relation==='point'?'POINT_ONLY':relation==='overlap'?'PARTIAL_OVERLAP':'UNCLASSIFIED';
 // No source-certified administrative contradiction is asserted without a legal-evidence registry.
 const administrativeStatus='NOT_ADJUDICATED';
 const documentationStatus=geometryStatus==='CONTAINED'?'GEOMETRY_SUPPORTED_LEGAL_NOT_INFERRED':'REQUIRES_REVIEW';
 const category=geometryStatus==='CONTAINED'?'OK':geometryStatus==='UNDETERMINED'||geometryStatus==='UNCLASSIFIED'?'DOC':'GEO';
 const row={child_id:child.id,parent_id:parentId,jurisdiction:child.jurisdiction,child_name:child.display_name,parent_name:parent.display_name,child_type:child.display_type,parent_type:parent.display_type,geometry_relation:relation,geometry_status:geometryStatus,administrative_status:administrativeStatus,documentation_status:documentationStatus,category,topology_matrix:matrix,topology_shards:[p,c],legal_evidence_ids:[],notes:category==='GEO'?'Anomalie geometrica; nu constituie dovada de neconcordanta juridica':category==='DOC'?'Date insuficiente pentru verdict geometric':null};
 register.push(row);counts[category]++;if(category==='GEO')geo.push(row);if(category==='ADM')adm.push(row);if(category==='DOC')doc.push(row);
}
if(register.length!==5846)fail('acoperire relatii: '+register.length+' in loc de 5846');
if(new Set(register.map(r=>r.child_id)).size!==5846)fail('duplicat in registru');
if(Object.values(counts).reduce((a,b)=>a+b,0)!==5846)fail('suma categorii invalida');
const summary={contract:'rt-audit1-parent-child-v1',status:'GEOMETRIC_RECONCILIATION_COMPLETE_ADMINISTRATIVE_NOT_ADJUDICATED',snapshot_id:manifest.snapshot_id,topology_index_sha256:digest(topBytes),entity_index_sha256:digest(entityBytes),total_relations:register.length,total_shards:shards.size,counts,source_proof:sourceProof,shard_proof:resourceProof,limitations:['Faptul ca geometria este continuta nu certifica juridic relatia.','Nu au fost furnizate dovezi juridice individuale structurate; ADM nu este evaluat ca zero contradictii demonstrate.','Perechile disjuncte pot lipsi din sharduri deoarece indexul retine doar perechi intersectate.','Nicio geometrie sau relatie parinte-copil nu a fost modificata.']};
await mkdir(new URL(output,root),{recursive:true});
const files={'parent-child-register.json':register,'geometric-exceptions.json':geo,'administrative-exceptions.json':adm,'insufficient-evidence.json':doc,'summary.json':summary};
const checks=[];
for(const [name,data] of Object.entries(files)){const buffer=Buffer.from(JSON.stringify(data,null,2)+'\n');await writeFile(new URL(output+name,root),buffer);checks.push(digest(buffer)+'  '+name)}
await writeFile(new URL(output+'checksums.sha256',root),checks.join('\n')+'\n');
await writeFile(new URL(output+'reconciliation-summary.md',root),'# RT-AUDIT.1 — rezultat\n\nSnapshot: '+manifest.snapshot_id+'\n\nRelatii: '+register.length+'; sharduri validate: '+shards.size+'; OK: '+counts.OK+'; GEO: '+counts.GEO+'; DOC: '+counts.DOC+'; ADM certificate: **neevaluate**.\n\nClasificarea GEO nu implica diferenta administrativa. Registrul administrativ este gol deoarece nu s-a adjudecat nicio contradictie in baza unor dovezi juridice individuale. Fisierele ACTUAL au fost doar citite.\n');
console.log(JSON.stringify({status:summary.status,relations:register.length,shards:shards.size,counts}));
