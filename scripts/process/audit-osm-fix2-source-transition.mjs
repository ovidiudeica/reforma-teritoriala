#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {assessOsmSourceTransition} from '../lib/osm-source-transition.mjs';

const BASELINE=process.env.OSM_ACTUAL_PIN_MANIFEST||'data/sources/osm-current.json';
const CANDIDATE=process.env.OSM_CURRENT_SOURCE_MANIFEST||'data/sources/osm-source-current.json';
const POLICY=process.env.OSM_SOURCE_TRANSITION_POLICY||'data/sources/osm-source-transition-policy.json';
const CONTINUITY=process.env.OSM_SOURCE_CONTINUITY_REPORT||'outputs/osm-source-continuity.json';
const REPORT=process.env.OSM_FIX2_REPORT||'outputs/osm-fix2-source-transition.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');

const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const elementKey=(type,id)=>type+'/'+Number(id);

async function loadSnapshot(entry,code){
 const compressed=await readFile(entry.snapshot_path);
 if(sha256(compressed)!==entry.compressed_sha256)throw new Error(code+' compressed snapshot SHA-256 mismatch');
 const canonical=gunzipSync(compressed);
 if(sha256(canonical)!==entry.semantic_sha256)throw new Error(code+' semantic snapshot SHA-256 mismatch');
 const raw=JSON.parse(canonical.toString('utf8'));
 const byKey=new Map();
 for(const element of raw.elements||[]){
  const key=elementKey(element.type,element.id);
  if(byKey.has(key))throw new Error(code+' duplicate raw element '+key);
  byKey.set(key,element);
 }
 if((raw.elements||[]).length!==entry.element_count)throw new Error(code+' element count mismatch');
 return {raw,byKey};
}

function closureAudit(snapshot,entry,code){
 const selected=new Set((entry.selected_relation_ids||[]).map(Number));
 const missing=[];
 const topology=[];
 for(const relationId of selected){
  const relation=snapshot.byKey.get(elementKey('relation',relationId));
  if(!relation){missing.push({owner:'relation/'+relationId,missing:'relation/'+relationId});continue;}
  const endpoints={outer:new Map(),inner:new Map()};
  for(const member of relation.members||[]){
   const key=elementKey(member.type,member.ref);
   const child=snapshot.byKey.get(key);
   if(!child){missing.push({owner:'relation/'+relationId,missing:key,role:member.role||''});continue;}
   if(member.type!=='way')continue;
   for(const nodeId of child.nodes||[]){
    if(!snapshot.byKey.has(elementKey('node',nodeId)))missing.push({owner:key,missing:'node/'+nodeId});
   }
   if((member.role==='outer'||member.role==='inner')&&(child.nodes||[]).length>=2){
    const nodes=child.nodes;
    if(Number(nodes[0])!==Number(nodes[nodes.length-1])){
     const degrees=endpoints[member.role];
     for(const nodeId of [nodes[0],nodes[nodes.length-1]])degrees.set(Number(nodeId),(degrees.get(Number(nodeId))||0)+1);
    }
   }
  }
  const odd=Object.fromEntries(Object.entries(endpoints).map(([role,degrees])=>[
   role,[...degrees.entries()].filter(([,degree])=>degree%2!==0).map(([node_id,degree])=>({node_id,degree}))
  ]));
  if(odd.outer.length||odd.inner.length)topology.push({relation_id:relationId,odd_endpoints:odd});
 }
 return {code,selected_relation_count:selected.size,missing_reference_count:missing.length,
  missing_references:missing.slice(0,100),topology_issue_count:topology.length,topology_issues:topology.slice(0,100)};
}

const canonicalRing=coords=>{
 if(coords.length>1&&coords[0][0]===coords.at(-1)[0]&&coords[0][1]===coords.at(-1)[1])coords=coords.slice(0,-1);
 if(!coords.length)return [];
 const strings=coords.map(x=>JSON.stringify(x));
 const variants=[];
 for(const seq of [strings,[...strings].reverse()]){
  let min=0;
  for(let i=1;i<seq.length;i++)if(seq[i]<seq[min])min=i;
  variants.push([...seq.slice(min),...seq.slice(0,min)]);
 }
 variants.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return variants[0].map(JSON.parse);
};

function geometrySummary(snapshot,relationId){
 const relation=snapshot.byKey.get(elementKey('relation',relationId));
 if(!relation)return null;
 const rings=[];
 let coordinateCount=0;
 const bbox=[Infinity,Infinity,-Infinity,-Infinity];
 for(const member of relation.members||[]){
  if(member.type!=='way'||!['outer','inner'].includes(member.role||''))continue;
  const way=snapshot.byKey.get(elementKey('way',member.ref));
  if(!way)continue;
  const coords=[];
  for(const nodeId of way.nodes||[]){
   const node=snapshot.byKey.get(elementKey('node',nodeId));
   if(!node||!Number.isFinite(Number(node.lon))||!Number.isFinite(Number(node.lat)))continue;
   const pair=[Number(node.lon),Number(node.lat)];
   coords.push(pair);coordinateCount++;
   bbox[0]=Math.min(bbox[0],pair[0]);bbox[1]=Math.min(bbox[1],pair[1]);
   bbox[2]=Math.max(bbox[2],pair[0]);bbox[3]=Math.max(bbox[3],pair[1]);
  }
  rings.push({role:member.role,coordinates:canonicalRing(coords)});
 }
 const canonical=rings.map(x=>({role:x.role,coordinates:x.coordinates}))
  .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return {
  relation_id:Number(relationId),
  relation_version:relation.version??null,
  relation_timestamp:relation.timestamp||null,
  member_way_count:rings.length,
  coordinate_count:coordinateCount,
  bbox:bbox.every(Number.isFinite)?bbox:null,
  coordinate_geometry_sha256:sha256(Buffer.from(JSON.stringify(canonical),'utf8'))
 };
}

async function main(){
 const [baseline,candidate,policy,continuity,release,sourceBundle]=await Promise.all([
  readJson(BASELINE),readJson(CANDIDATE),readJson(POLICY),readJson(CONTINUITY),
  readJson('data/current/actual-release-manifest.json'),
  readJson('data/current/actual-source-bundle-manifest.json')
 ]);
 const baselineRaw={},candidateRaw={},closure=[];
 for(const code of ['RO','MD']){
  baselineRaw[code]=await loadSnapshot(baseline.countries[code],code+' baseline');
  candidateRaw[code]=await loadSnapshot(candidate.countries[code],code+' candidate');
  closure.push(closureAudit(candidateRaw[code],candidate.countries[code],code));
 }
 const transition=assessOsmSourceTransition({baseline,candidate,continuity,policy});
 const retiredGeometry=(policy.expected_transition.retired_relations||[]).map(row=>({
  relation_id:row.relation_id,
  previous:geometrySummary(baselineRaw.MD,row.relation_id),
  current:null,
  verdict:'RETIRED_FROM_CURRENT_OSM_NO_CURRENT_GEOMETRY'
 }));
 const successorGeometry=(policy.expected_transition.cartographic_successor_links||[]).map(link=>{
  const previous=geometrySummary(baselineRaw.MD,link.from_relation_id);
  const current=geometrySummary(candidateRaw.MD,link.to_relation_id);
  return {
   from_relation_id:link.from_relation_id,to_relation_id:link.to_relation_id,
   previous,current,
   exact_coordinate_geometry_match:Boolean(previous&&current&&previous.coordinate_geometry_sha256===current.coordinate_geometry_sha256),
   verdict:previous&&current
    ?(previous.coordinate_geometry_sha256===current.coordinate_geometry_sha256?'EXACT_COORDINATE_GEOMETRY_MATCH':'GEOMETRY_CHANGED_OR_RESEGMENTED')
    :'BLOCKED_MISSING_GEOMETRY'
  };
 });
 const invariants={
  snapshot_id:release.snapshot_id,
  release_fingerprint_sha256:release.release_fingerprint_sha256,
  source_bundle_fingerprint_sha256:sourceBundle.bundle_fingerprint_sha256,
  source_bundle_osm_manifest_path:sourceBundle.sources?.osm?.manifest_path,
  actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'
 };
 const invariantPass=
  invariants.snapshot_id==='actual-a9e5a4ddcb5277ef'
  && invariants.release_fingerprint_sha256==='a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446'
  && invariants.source_bundle_fingerprint_sha256==='af47dea86743da4fe6dc95928b5b3e311b83f392b1bc094568a47a2af27c657b'
  && invariants.source_bundle_osm_manifest_path==='data/sources/osm-current.json';
 const closurePass=closure.every(x=>x.missing_reference_count===0&&x.topology_issue_count===0);
 const geometryPass=retiredGeometry.every(x=>x.previous)&&successorGeometry.every(x=>x.previous&&x.current);
 const status=transition.status==='PASS_SOURCE_ONLY_TRANSITION'&&closurePass&&geometryPass&&invariantPass
  ?'PASS_SOURCE_ONLY_TRANSITION':'BLOCKED_SOURCE_TRANSITION';
 const report={
  schema:'osm-fix2-source-transition-v1',status,transition,
  closure,retired_geometry:retiredGeometry,cartographic_successor_geometry:successorGeometry,
  actual_invariants:{...invariants,status:invariantPass?'PASS':'FAIL'},
  policy:'Current OSM is reconciled independently. No result in this report authorizes mutation of ACTUAL, legal identity, administrative parentage or P9.1.'
 };
 await mkdir('outputs',{recursive:true});
 await writeFile(REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status,report:REPORT,closure_pass:closurePass,geometry_pass:geometryPass,
  actual_invariants:report.actual_invariants.status,transition_status:transition.status},null,2));
 if(status!=='PASS_SOURCE_ONLY_TRANSITION')process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
