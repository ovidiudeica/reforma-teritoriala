#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const SETTLEMENT='data/sources/actual-settlement-policy.json';
const STAT_POLICY='data/sources/actual-statistical-policy.json';
const STAT_CONTRACT='schemas/actual-statistical-hierarchy-contract.json';
const STAT_BUNDLE='data/sources/actual-statistical-source-bundle.json';
const RO_LAYER='data/p2/actual-statistical-ro.json';
const MD_LAYER='data/p2/actual-statistical-md.json';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>{const b=await readFile(p);return {bytes:b,json:JSON.parse(b.toString('utf8'))};};

const [settlement,policy,contract,bundle,ro,md]=await Promise.all(
 [SETTLEMENT,STAT_POLICY,STAT_CONTRACT,STAT_BUNDLE,RO_LAYER,MD_LAYER].map(read)
);
if(settlement.json?.schema_version!==1||settlement.json?.mode!=='ACTUAL')throw new Error('Unexpected ACTUAL settlement policy');
if(settlement.json?.public_contract!=='actual-public-entity-v2')throw new Error('P2.3 activation requires public contract v2 baseline');
if(policy.json?.schema_version!==1||policy.json?.mode!=='ACTUAL_STATISTICAL_POLICY'||policy.json?.activated!==false)throw new Error('Statistical policy is not in inactive P2 baseline');
if(contract.json?.schema_version!==1||contract.json?.contract!=='actual-statistical-hierarchy-v1')throw new Error('Unexpected statistical hierarchy contract');
if(bundle.json?.mode!=='ACTUAL_STATISTICAL_SOURCE_BUNDLE')throw new Error('Unexpected statistical source bundle');
if(ro.json?.contract!=='actual-statistical-ro-v1'||ro.json?.counts?.statistical_only_entities!==12||ro.json?.counts?.reused_existing_nuts3_entities!==42)throw new Error('Unexpected RO P2 layer');
if(md.json?.contract!=='actual-statistical-md-v1'||md.json?.counts?.statistical_only_entities!==6||md.json?.counts?.reused_existing_statistical_entities!==3||md.json?.counts?.component_bindings!==37)throw new Error('Unexpected MD P2 layer');

const activeSettlement=structuredClone(settlement.json);
activeSettlement.public_contract='actual-public-entity-v3';
activeSettlement.statistical_hierarchy={
 activated:true,
 contract:'actual-statistical-hierarchy-v1',
 hierarchy_contract:'actual-consolidated-hierarchy-v1',
 public_contract:'actual-public-entity-v3',
 expected_public_entity_count:5848,
 expected_administrative_entity_count:5830,
 expected_statistical_only_entity_count:18,
 expected_statistical_role_entity_count:63,
 expected_entity_count_by_jurisdiction:{RO:3246,MD:2602},
 statistical_policy:{path:STAT_POLICY,sha256:sha256(policy.bytes)},
 statistical_contract:{path:STAT_CONTRACT,sha256:sha256(contract.bytes)},
 source_bundle:{path:STAT_BUNDLE,sha256:sha256(bundle.bytes),fingerprint_sha256:bundle.json.bundle_fingerprint_sha256},
 layers:{
  RO:{path:RO_LAYER,sha256:sha256(ro.bytes),fingerprint_sha256:ro.json.layer_fingerprint_sha256},
  MD:{path:MD_LAYER,sha256:sha256(md.bytes),fingerprint_sha256:md.json.layer_fingerprint_sha256}
 },
 geometry_policy:'Administrative master geometry is immutable. Reused statistical roles share the existing territorial geometry; statistical-only geometry is extracted exactly from the reviewed OSM statistical snapshots.'
};

const activePolicy=structuredClone(policy.json);
activePolicy.phase='P2_ACTIVATED';
activePolicy.activated=true;
activePolicy.activation_requested=false;
activePolicy.target_public_contract='actual-public-entity-v3';
activePolicy.p1_invariants={
 ...(activePolicy.p1_invariants||{}),
 statistical_entity_activation_allowed:true,
 administrative_parent_mutation_allowed:false,
 administrative_geometry_mutation_allowed:false
};
for(const key of ['P2_1_RO','P2_2_MD']){
 if(activePolicy.progress?.[key]){
  activePolicy.progress[key].status='active';
  activePolicy.progress[key].public_contract_activated=true;
 }
}
activePolicy.progress={
 ...(activePolicy.progress||{}),
 P2_3_PUBLIC:{
  status:'active',
  public_contract:'actual-public-entity-v3',
  public_entity_count:5848,
  administrative_entity_count:5830,
  statistical_only_entity_count:18,
  statistical_role_entity_count:63,
  entity_count_by_jurisdiction:{RO:3246,MD:2602},
  hierarchy_contract:'actual-consolidated-hierarchy-v1',
  administrative_geometry_mutation_allowed:false
 }
};

const activeContract=structuredClone(contract.json);
activeContract.phase='P2_ACTIVATED';
activeContract.entities_activated=true;

await Promise.all([
 writeFile(SETTLEMENT,JSON.stringify(activeSettlement,null,2)+'\n'),
 writeFile(STAT_POLICY,JSON.stringify(activePolicy,null,2)+'\n'),
 writeFile(STAT_CONTRACT,JSON.stringify(activeContract,null,2)+'\n')
]);
console.log(JSON.stringify({
 status:'PASS',
 phase:'P2_ACTIVATED',
 public_contract:activeSettlement.public_contract,
 public_entity_count:5848,
 administrative_entity_count:5830,
 statistical_only_entity_count:18,
 statistical_role_entity_count:63,
 hierarchy_contract:'actual-consolidated-hierarchy-v1',
 geometry_mutation:false
},null,2));
