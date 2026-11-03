// RT-VA1: explicit semantic exclusion at the OSM canonical-import boundary.
// Preserve OSM source, historical evidence, and all non-excluded official UATs.
export const VARIANT_A_SCOPE_PATH='docs/evidence/rt-va1-semantic-exclusion/actual-variant-a-exclusions.json';

export function selectCanonicalVariantA(polygons,policy,{jurisdiction,relationId,readTags}){
 if(!policy||policy.contract!=='actual-canonical-variant-a-exclusions-v1'||policy.schema_version!==1||policy.status!=='APPROVED_SCOPE')throw Error('RT-VA1 scope contract invalid');
 if(policy.jurisdiction!=='MD'||policy.expected_exclusion_count!==123||policy.structural_rule_count!==122||policy.reviewed_override_count!==1)throw Error('RT-VA1 baseline scope drift');
 if(!Array.isArray(policy.exclusions)||policy.exclusions.length!==123)throw Error('RT-VA1 reviewed population missing');
 const byId=new Map();
 for(const record of policy.exclusions){
  const id=String(record.id||''),rid=Number(record.osm_relation_id);
  if(!/^osm-r\d+$/.test(id)||id!=='osm-r'+rid||byId.has(id)||record.admin_level!==9)throw Error('RT-VA1 invalid or duplicate roster item '+id);
  if(!['structural_rule','reviewed_override'].includes(record.classification_method))throw Error('RT-VA1 unreviewed scope item '+id);
  if(record.classification_method==='reviewed_override'&&id!=='osm-r12104738')throw Error('RT-VA1 unexpected manual exception '+id);
  byId.set(id,record);
 }
 if([...byId.values()].filter(x=>x.classification_method==='structural_rule').length!==122)throw Error('RT-VA1 structural count drift');
 const reviewed=[...byId.values()].filter(x=>x.classification_method==='reviewed_override');
 if(reviewed.length!==1||reviewed[0].id!=='osm-r12104738')throw Error('RT-VA1 Mure Dulci exception missing');
 if(jurisdiction!=='MD')return {polygons,excluded:[]};
 const selectedById=new Map(polygons.map(f=>['osm-r'+relationId(f),f]));
 const excluded=[];
 for(const [id,record] of byId){
  const feature=selectedById.get(id);
  if(!feature)throw Error('RT-VA1 reviewed relation absent from selected OSM source: '+id);
  const tags=readTags(feature);
  if(Number(tags.admin_level)!==9||tags.boundary!=='administrative')throw Error('RT-VA1 source administrative role drift '+id);
  if(record.classification_method==='structural_rule'){
   if(tags.place!=='allotments'||record.place!=='allotments')throw Error('RT-VA1 reviewed allotment classification drift '+id);
  }else{
   const name=String(tags.name||'').normalize('NFC');
   const prefix=String(tags['name:prefix']||'').normalize('NFC');
   if(tags.place||prefix!=='Întovărășirea pomicolă'||!name.includes('Mure Dulci'))throw Error('RT-VA1 reviewed Mure Dulci semantics drift');
  }
  excluded.push({id,name:record.name,classification_method:record.classification_method,parent_cuatm:record.reviewed_parent_cuatm});
 }
 const unreviewed=polygons.filter(f=>{
  const id='osm-r'+relationId(f),tags=readTags(f);
  return !byId.has(id)&&Number(tags.admin_level)===9&&tags.place==='allotments';
 });
 if(unreviewed.length)throw Error('RT-VA1 unidentified allotments need individual review: '+unreviewed.map(f=>relationId(f)).join(','));
 const scoped=polygons.filter(f=>!byId.has('osm-r'+relationId(f)));
 if(polygons.length-scoped.length!==123)throw Error('RT-VA1 excluded-count drift');
 return {polygons:scoped,excluded};
}
