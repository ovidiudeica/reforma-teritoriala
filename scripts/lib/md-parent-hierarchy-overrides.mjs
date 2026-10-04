const CHISINAU_CITY_RELATION_ID=1748490;
const CHISINAU_MUNICIPALITY_RELATION_ID=1691801;
const CHISINAU_SECTORS=new Map([
 [1813306,'0110'],
 [1813297,'0120'],
 [58512,'0130'],
 [1813315,'0140'],
 [1813316,'0150']
]);

const relationId=e=>Number(e?.osm?.relation_id);
const cuatm=e=>String(e?.osm?.cuatm_unique_id||e?.osm?.cuatm_code||'');

export const MD_REVIEWED_PARENT_HIERARCHY_OVERRIDES=Object.freeze([
 Object.freeze({
  child_relation_id:CHISINAU_CITY_RELATION_ID,
  canonical_parent_relation_id:CHISINAU_MUNICIPALITY_RELATION_ID,
  legal_id:'0100',
  reason:'Reviewed special-municipality hierarchy: the Chișinău city representation shares CUATM 0100 with the municipality/UAT and must never be parented to one of its CUATM sectors 0110–0150.'
 })
]);

export function applyMdReviewedParentHierarchyOverrides(entities,warnings=[]){
 const byRelation=new Map((entities||[]).filter(e=>e?.jurisdiction==='MD'&&Number.isFinite(relationId(e))).map(e=>[relationId(e),e]));
 for(const rule of MD_REVIEWED_PARENT_HIERARCHY_OVERRIDES){
  const child=byRelation.get(rule.child_relation_id);
  const canonicalParent=byRelation.get(rule.canonical_parent_relation_id);
  if(!child)throw new Error('Reviewed MD parent override child missing: '+rule.child_relation_id);
  if(!canonicalParent)throw new Error('Reviewed MD parent override canonical parent missing: '+rule.canonical_parent_relation_id);
  if(child.id!=='osm-r'+rule.child_relation_id||child.jurisdiction!=='MD'||child.osm?.admin_level!==8||child.osm?.place!=='city'||cuatm(child)!==rule.legal_id){
   throw new Error('Reviewed MD parent override child contract drift: '+rule.child_relation_id);
  }
  if(canonicalParent.id!=='osm-r'+rule.canonical_parent_relation_id||canonicalParent.jurisdiction!=='MD'||canonicalParent.osm?.admin_level!==4||canonicalParent.osm?.place!=='municipality'||cuatm(canonicalParent)!==rule.legal_id){
   throw new Error('Reviewed MD parent override canonical parent contract drift: '+rule.canonical_parent_relation_id);
  }

  const priorParent=child.parent_id?byRelation.get(Number(String(child.parent_id).replace(/^osm-r/,''))):null;
  if(child.parent_id!==canonicalParent.id){
   const expectedSectorCode=priorParent?CHISINAU_SECTORS.get(relationId(priorParent)):null;
   if(!priorParent||priorParent.jurisdiction!=='MD'||priorParent.osm?.admin_level!==7||!expectedSectorCode||cuatm(priorParent)!==expectedSectorCode){
    throw new Error('Reviewed MD parent override encountered unexpected geometric parent for '+child.id+': '+String(child.parent_id));
   }
   child.parent_id=canonicalParent.id;
   warnings.push({
    type:'reviewed_parent_hierarchy_override',
    jurisdiction:'MD',
    child_id:child.id,
    child_relation_id:rule.child_relation_id,
    previous_parent_id:priorParent.id,
    previous_parent_relation_id:relationId(priorParent),
    canonical_parent_id:canonicalParent.id,
    canonical_parent_relation_id:rule.canonical_parent_relation_id,
    legal_id:rule.legal_id,
    geometry_mutation:false,
    reason:rule.reason
   });
  }
 }
 return entities;
}
