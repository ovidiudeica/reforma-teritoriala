// Current-release acceptance is distinct from immutable historical evidence.
// No unrecognized semantic fingerprint or unreviewed population can be accepted.
export const HISTORICAL_ACTUAL=Object.freeze({
 snapshot:'actual-a9e5a4ddcb5277ef',
 fingerprint:'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446',
 entityCount:5848,RO:3246,MD:2602,administrative:5830
});
export const VARIANT_A_ACTUAL=Object.freeze({
 snapshot:'actual-903b934850711dc7',
 fingerprint:'903b934850711dc7418e25087cb151a2c8d68f4746fdf761d0749ae63c52fd2e',
 entityCount:5725,RO:3246,MD:2479,administrative:5707,exclusions:123
});
export const EXACT_ACTUAL_RELEASES=Object.freeze([HISTORICAL_ACTUAL,VARIANT_A_ACTUAL]);
export function trustedActualRelease(release,publicIndex=null,persisted=null){
 const exact=EXACT_ACTUAL_RELEASES.find(p=>release?.snapshot_id===p.snapshot&&release?.release_fingerprint_sha256===p.fingerprint);
 if(!exact)throw Error('RT-VA1 unauthorized current semantic release');
 if(release?.public_contract?.entity_count!==exact.entityCount)throw Error('RT-VA1 release population mismatch');
 const r=release.public_contract?.entity_count_by_jurisdiction;
 if(r?.RO!==exact.RO||r?.MD!==exact.MD)throw Error('RT-VA1 release jurisdiction mismatch');
 if(publicIndex){
  if(publicIndex.entity_count!==exact.entityCount||!Array.isArray(publicIndex.entities)||publicIndex.entities.length!==exact.entityCount||
  new Set(publicIndex.entities.map(x=>x.id)).size!==exact.entityCount)throw Error('RT-VA1 public entity roster cardinality mismatch');
  const counts=Object.fromEntries(['RO','MD'].map(j=>[j,publicIndex.entities.filter(x=>x.jurisdiction===j).length]));
  if(counts.RO!==exact.RO||counts.MD!==exact.MD)throw Error('RT-VA1 public jurisdiction roster mismatch');
  if(publicIndex.entities.filter(x=>String(x.id||'').startsWith('stat-')).length!==18||
   publicIndex.entities.filter(x=>x.roles?.includes('statistical')).length!==63)throw Error('RT-VA1 statistical roles changed');
 }
 if(persisted&&(persisted.snapshot_id!==exact.snapshot||persisted.release_fingerprint_sha256!==exact.fingerprint||
 persisted.validated_release_gate_status!=='PASS'))throw Error('RT-VA1 persisted release binding mismatch');
 return exact;
}
export function assertExactVariantARemovals(before,after,roster){
 const expected=new Set(roster?.exclusions?.map(x=>x.id));
 if(roster?.expected_exclusion_count!==123||expected.size!==123||!expected.has('osm-r12104738'))throw Error('RT-VA1 exclusion roster invalid');
 const original=new Map(before?.entities?.map(e=>[e.id,e]));
 const updated=new Map(after?.entities?.map(e=>[e.id,e]));
 if(original.size!==5848||updated.size!==5725)throw Error('RT-VA1 before/after roster invalid');
 const removed=[...original.keys()].filter(id=>!updated.has(id));
 if(removed.length!==123||removed.some(id=>!expected.has(id)))throw Error('RT-VA1 unreviewed entity exclusion');
 for(const [id,e]of updated)if(JSON.stringify(original.get(id))!==JSON.stringify(e))throw Error('RT-VA1 retained entity mutated '+id);
 if(removed.some(id=>original.get(id)?.jurisdiction!=='MD'))throw Error('RT-VA1 non-MD exclusion');
 return {status:'PASS',retained:5725,excluded:123,removed};
}
