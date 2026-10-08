// One declarative taxonomy: representation describes the geometry, never legal/display identity.
export const administrativeClasses=['regional','local_uat','sector','component_locality'];
export const geometryLabels={regional:'Unități regionale',local_uat:'UAT locale',sector:'Sectoare',component_locality:'Localități / subdiviziuni componente',context:'Context național',auxiliary:'Reprezentări auxiliare',statistical_only:'Limite statistice separate',unclassified:'Reprezentări neclasificate'};
const subtype=(id,label,...types)=>({id,label,types});
const jurisdiction=(id,subtypes)=>({id,label:id==='RO'?'România':'Republica Moldova',subtypes});
const group=(id,section,ro,md)=>({id,section,label:geometryLabels[id],jurisdictions:[jurisdiction('RO',ro),jurisdiction('MD',md)]});
export const geometryFilterTree=[
 group('regional','administrative',[
  subtype('ro.counties','Județe / Municipiul București','county')
 ],[
  subtype('md.districts','Raioane','district'),
  subtype('md.level2_municipalities','Municipii de nivelul II','level_2_municipality'),
  subtype('md.special_units','Unități teritoriale speciale','special_territorial_unit'),
  subtype('md.regional_unspecified','Unități regionale — tip nespecificat','level_2_or_special_unit')
 ]),
 group('local_uat','administrative',[
  subtype('ro.municipalities','Municipii','municipality'),
  subtype('ro.towns','Orașe','town'),
  subtype('ro.communes','Comune','commune'),
  subtype('ro.local_unspecified','UAT locale — tip nespecificat','local_uat')
 ],[
  subtype('md.municipalities','Municipii / UAT urbane','level_1_municipality','municipality_or_city_uat','municipality'),
  subtype('md.towns','Orașe','town_uat','town'),
  subtype('md.rural_uat','Comune / sate independente','commune_or_independent_village_uat','commune'),
  subtype('md.level1_unspecified','UAT de nivelul I — tip nespecificat','level_1_uat'),
  subtype('md.local_unspecified','UAT locale — tip nespecificat','local_uat')
 ]),
 group('sector','administrative',[
  subtype('ro.bucharest_sectors','Sectoarele Municipiului București','sector')
 ],[
  subtype('md.chisinau_sectors','Sectoarele Municipiului Chișinău','chisinau_sector')
 ]),
 group('component_locality','administrative',[
  subtype('ro.component_localities','Localități componente','component_locality'),
  subtype('ro.component_villages','Sate componente — limite reprezentate','component_village_boundary_representation'),
  subtype('ro.municipality_components','Localități componente de municipii','municipality_component_locality_boundary_representation'),
  subtype('ro.component_areas','Subdiviziuni / zone componente','subdivision_or_component_area')
 ],[
  subtype('md.component_localities','Localități componente','component_locality'),
  subtype('md.component_areas','Subdiviziuni / zone componente','subdivision_or_component_area')
 ]),
 group('context','other',[subtype('ro.context','Stat / context național','state')],[subtype('md.context','Stat / context național','state')]),
 group('auxiliary','other',[subtype('ro.auxiliary','Reprezentări auxiliare','non_administrative_or_auxiliary_area')],[subtype('md.auxiliary','Reprezentări auxiliare','non_administrative_or_auxiliary_area')]),
 group('unclassified','other',[],[])
];
const classByType=new Map(),subtypeByType=new Map();
export const geometrySubtypeLabels={};
for(const item of geometryFilterTree)for(const j of item.jurisdictions)for(const sub of j.subtypes){
 geometrySubtypeLabels[sub.id]=sub.label;
 for(const type of sub.types){
  if(classByType.has(type)&&classByType.get(type)!==item.id)throw new Error('Contradictory geometry class '+type);
  classByType.set(type,item.id);subtypeByType.set(j.id+':'+type,sub.id);
 }
}
export function geometryClass(entity){
 if(entity?.category==='statistical')return 'statistical_only';
 return classByType.get(entity?.representation?.inferred_type)||'unclassified';
}
export function geometrySubtype(entity){
 // Separate statistical geometry is governed by statistical levels and its own switch.
 if(entity?.category==='statistical')return null;
 const type=entity?.representation?.inferred_type??'missing';
 return subtypeByType.get(entity?.jurisdiction+':'+type)||'unclassified:'+String(entity?.jurisdiction??'missing')+':'+type;
}
export function statisticalLevel(entity){
 if(!entity?.roles?.includes('statistical'))return null;
 const level=Number(entity.statistical?.level);
 return [1,2,3].includes(level)?level:'unclassified';
}
export function geometryVisible(entity,{geometryClasses,geometrySubtypes,statisticalLevels,separateStatisticalGeometry}){
 const group=geometryClass(entity),level=statisticalLevel(entity),sub=geometrySubtype(entity);
 const statisticalVisible=level!==null&&statisticalLevels.has(level);
 // Statistical levels are a complete logical layer over all 63 statistical entities.
 // The 45 coalesced entities reuse their existing administrative polygon; visibility is OR,
 // so no geometry is duplicated and either role can keep the shared polygon visible.
 if(group==='statistical_only')return separateStatisticalGeometry&&statisticalVisible;
 const administrativeVisible=geometryClasses.has(group)&&(!geometrySubtypes||geometrySubtypes.has(sub));
 return administrativeVisible||statisticalVisible;
}

// Computed once from the public entities; UI clicks never recount the population.
export function createGeometryFilterIndex(entities){
 const classCounts=new Map(),subtypeMembers=new Map(),statisticalCounts=new Map(),statisticalLevelStats=new Map();
 let statisticalOnly=0,statisticalRoles=0;
 const byClassJurisdiction=new Map();
 const emptyJurisdictionStats=()=>({roles:0,separate:0,reused:0});
 for(const entity of entities){
  const cls=geometryClass(entity),sub=geometrySubtype(entity),level=statisticalLevel(entity);
  classCounts.set(cls,(classCounts.get(cls)||0)+1);
  if(level!==null){
   statisticalRoles++;statisticalCounts.set(level,(statisticalCounts.get(level)||0)+1);
   if(!statisticalLevelStats.has(level))statisticalLevelStats.set(level,{roles:0,separate:0,reused:0,jurisdictions:{RO:emptyJurisdictionStats(),MD:emptyJurisdictionStats()}});
   const stats=statisticalLevelStats.get(level),kind=cls==='statistical_only'?'separate':'reused',jurisdiction=stats.jurisdictions[entity.jurisdiction]||emptyJurisdictionStats();
   stats.roles++;stats[kind]++;jurisdiction.roles++;jurisdiction[kind]++;stats.jurisdictions[entity.jurisdiction]=jurisdiction;
  }
  if(sub===null){statisticalOnly++;continue;}
  if(!subtypeMembers.has(sub))subtypeMembers.set(sub,new Set());
  subtypeMembers.get(sub).add(entity.id);
  const key=cls+':'+entity.jurisdiction;
  if(!byClassJurisdiction.has(key))byClassJurisdiction.set(key,new Set());
  byClassJurisdiction.get(key).add(sub);
 }
 const groups=[];
 for(const config of geometryFilterTree){
  const count=classCounts.get(config.id)||0;if(!count)continue;
  const jurisdictions=[];
  for(const j of config.jurisdictions){
   const keys=byClassJurisdiction.get(config.id+':'+j.id)||new Set();
   const known=j.subtypes.filter(sub=>keys.has(sub.id)).map(sub=>({...sub,count:subtypeMembers.get(sub.id).size}));
   const missing=[...keys].filter(id=>!known.some(sub=>sub.id===id)).sort().map(id=>({id,label:'Tip geometric neclasificat',types:[],count:subtypeMembers.get(id).size}));
   const subtypes=[...known,...missing];if(!subtypes.length)continue;
   jurisdictions.push({...j,subtypes,count:subtypes.reduce((sum,sub)=>sum+sub.count,0)});
  }
  groups.push({...config,count,jurisdictions});
 }
 return {groups,classCounts,subtypeMembers,statisticalCounts,statisticalLevelStats,statisticalOnly,statisticalRoles,reusedStatistical:statisticalRoles-statisticalOnly};
}
export function geometryParentState(group,state){
 const subtypes=group.jurisdictions.flatMap(j=>j.subtypes);
 const active=state.geometryClasses.has(group.id)?subtypes.filter(sub=>state.geometrySubtypes.has(sub.id)).length:0;
 return {checked:active===subtypes.length&&active>0,indeterminate:active>0&&active<subtypes.length};
}
export function setGeometryGroup(group,state,enabled){
 if(enabled)state.geometryClasses.add(group.id);else state.geometryClasses.delete(group.id);
 for(const j of group.jurisdictions)for(const sub of j.subtypes){if(enabled)state.geometrySubtypes.add(sub.id);else state.geometrySubtypes.delete(sub.id);}
}
export function setGeometrySubtype(group,state,id,enabled){
 if(enabled){state.geometrySubtypes.add(id);state.geometryClasses.add(group.id);}else state.geometrySubtypes.delete(id);
 if(!group.jurisdictions.some(j=>j.subtypes.some(sub=>state.geometrySubtypes.has(sub.id))))state.geometryClasses.delete(group.id);
}
