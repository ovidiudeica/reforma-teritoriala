import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {
 geometryClass, geometrySubtype, geometryVisible, statisticalLevel, geometryLabels
} from '../../geometry-taxonomy.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=async file=>readFile(join(root,file));
const json=async file=>JSON.parse(await read(file));
const index=await json('public/data/actual-entities.json');
const entities=index.entities;
const byId=new Map(entities.map(entity=>[entity.id,entity]));
const allClasses=Object.keys(geometryLabels).filter(cls=>cls!=='statistical_only');
const allSubtypes=[...new Set(entities.map(geometrySubtype).filter(Boolean))].sort();
const roles=entities.filter(entity=>entity.roles?.includes('statistical'));

function matrixStates(){
 const result=[];
 const allJurisdictions=[[],['RO'],['MD'],['RO','MD']];
 for(const jurisdictions of allJurisdictions)
  for(const administrative of [false,true])
   for(let levelMask=0;levelMask<8;levelMask++)
    for(const separate of [false,true])
     result.push({
      id:'jurisdiction='+jurisdictions.join('+')+';admin='+Number(administrative)+';levels='+levelMask+';separate='+Number(separate),
      jurisdictions,classes:administrative?allClasses:[],subtypes:administrative?allSubtypes:[],
      levels:[1,2,3].filter(level=>levelMask&(1<<(level-1))),separate
     });
 for(const jurisdiction of ['RO','MD'])
  for(const subtype of allSubtypes)
   result.push({
    id:'jurisdiction='+jurisdiction+';subtype='+subtype,
    jurisdictions:[jurisdiction],classes:allClasses,subtypes:[subtype],
    levels:[],separate:false
   });
 return result;
}

// Independent boolean oracle for the policy, rather than calling geometryVisible().
function policyExpected(entity,state,cls,sub,level){
 if(!state.jurisdictions.includes(entity.jurisdiction))return false;
 const statistical=level!==null&&state.levels.includes(level);
 if(entity.category==='statistical')return state.separate&&statistical;
 return (state.classes.includes(cls)&&state.subtypes.includes(sub))||statistical;
}

test('P4.1 per-ID visibility matrix: 5848 identities × 170 filter states, independent policy oracle',()=>{
 assert.equal(index.contract,'actual-public-entity-v3');
 assert.equal(index.entity_count,5848);
 assert.equal(entities.length,5848);
 assert.equal(byId.size,5848,'duplicate public identity');
 assert.deepEqual(index.entity_count_by_jurisdiction,{RO:3246,MD:2602});
 assert.equal(roles.length,63);
 assert.equal(roles.filter(e=>e.category!=='statistical').length,45);
 assert.equal(roles.filter(e=>e.category==='statistical').length,18);
 assert.deepEqual([1,2,3].map(level=>roles.filter(e=>statisticalLevel(e)===level).length),[5,10,48]);
 assert.equal(allSubtypes.length,21,'review matrix coverage for changed taxonomy');
 const states=matrixStates();
 assert.equal(states.length,170,'P4.0 filter-state contract drift');
 const seenVisible=new Map(entities.map(e=>[e.id,0]));
 const classified=entities.map(entity=>({
  entity,cls:geometryClass(entity),sub:geometrySubtype(entity),level:statisticalLevel(entity)
 }));
 let comparisons=0;
 for(const state of states){
  const args={
   geometryClasses:new Set(state.classes),
   geometrySubtypes:new Set(state.subtypes),
   statisticalLevels:new Set(state.levels),
   separateStatisticalGeometry:state.separate
  };
  for(const {entity,cls,sub,level} of classified){
   const expected=policyExpected(entity,state,cls,sub,level);
   const actual=state.jurisdictions.includes(entity.jurisdiction)&&geometryVisible(entity,args);
   assert.equal(actual,expected,entity.id+' @ '+state.id);
   if(actual)seenVisible.set(entity.id,seenVisible.get(entity.id)+1);
   comparisons++;
  }
 }
 assert.equal(comparisons,994160);
 assert.equal([...seenVisible.values()].filter(count=>count===0).length,0,'identity never eligible');
 console.log('P4.1 matrix PASS: '+entities.length+' IDs × '+states.length+' states = '+comparisons+' checks; zero mismatches');
});

test('P4.1 all identities resolve uniquely into SHA-bound geometry tiers and partitioned chunks',async()=>{
 const manifest=await json('data/current/actual-release-manifest.json');
 const publicContract=manifest.public_contract;
 assert.equal(publicContract.entity_count,5848);
 assert.equal(publicContract.geometry_chunks.chunk_count,115);
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const tierDescriptors=Object.values(publicContract.geometry_tiers).flatMap(byTier=>Object.values(byTier));
 const statisticalDescriptors=Object.values(publicContract.statistical_geometry);
 assert.equal(tierDescriptors.length,6);
 assert.equal(statisticalDescriptors.length,2);
 const publicCount=new Map();
 const masterByTier=new Map();
 for(const descriptor of [...tierDescriptors,...statisticalDescriptors]){
  const bytes=await read(descriptor.path);
  assert.equal(sha(bytes),descriptor.sha256,descriptor.path+' SHA-256');
  const features=JSON.parse(bytes).features;
  assert.equal(features.length,descriptor.feature_count,descriptor.path+' count');
  for(const feature of features){
   const id=feature.properties?.entity_id;
   assert.ok(byId.has(id),descriptor.path+' foreign/missing entity ID '+id);
   publicCount.set(id,(publicCount.get(id)||0)+1);
   if(tierDescriptors.includes(descriptor)){
    assert.equal(byId.get(id).category==='statistical',false,'separate statistical entity in admin tier');
    assert.equal(descriptor.path.endsWith('/'+byId.get(id).jurisdiction.toLowerCase()+'-'+byId.get(id).map.tier+'.geojson'),true,'tier mismatch '+id);
    masterByTier.set(id,feature);
   }else{
    assert.equal(byId.get(id).category,'statistical',id+' absent statistical role');
   }
  }
 }
 assert.equal(publicCount.size,5848,'missing public geometry');
 for(const entity of entities)assert.equal(publicCount.get(entity.id),1,'duplicate/missing geometry '+entity.id);
 const chunks=await json(publicContract.geometry_chunks.path);
 assert.equal(chunks.chunk_count,115);
 assert.equal(chunks.chunks.length,115);
 const chunkCount=new Map();
 let totalFeatures=0;
 for(const descriptor of chunks.chunks){
  const bytes=await read(descriptor.path);
  assert.equal(sha(bytes),descriptor.sha256,descriptor.path+' SHA-256');
  assert.equal(bytes.length,descriptor.bytes,descriptor.path+' bytes');
  const features=JSON.parse(bytes).features;
  assert.equal(features.length,descriptor.feature_count,descriptor.path+' count');
  totalFeatures+=features.length;
  for(const feature of features){
   const id=feature.properties?.entity_id;
   const entity=byId.get(id);
   assert.ok(entity,descriptor.path+' foreign/missing entity ID '+id);
   assert.equal(entity.jurisdiction,descriptor.jurisdiction,descriptor.path+' jurisdiction '+id);
   assert.equal(entity.map.tier,descriptor.tier,descriptor.path+' tier '+id);
   assert.ok(masterByTier.has(id),descriptor.path+' not in public tier '+id);
   assert.deepEqual(feature.geometry,masterByTier.get(id).geometry,descriptor.path+' geometry drift '+id);
   chunkCount.set(id,(chunkCount.get(id)||0)+1);
  }
 }
 assert.equal(totalFeatures,5749,'P4.0 chunk population drift');
 assert.equal(chunkCount.size,5749,'duplicate chunk feature and missing chunk identity');
 for(const entity of entities){
  assert.equal(chunkCount.get(entity.id)||0,['local','detail'].includes(entity.map.tier)?1:0,'chunk binding '+entity.id);
 }
 assert.equal(entities.length-chunkCount.size,99,'overview/statistical complement drift');
 console.log('P4.1 geometry PASS: 5848 unique bindings; 115/115 chunk SHA, bytes and feature counts; 8/8 layers');
});
