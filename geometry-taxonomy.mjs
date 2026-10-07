// Geometry taxonomy: representation is authoritative; legal identity never assigns a map class.
export const administrativeClasses=['regional','local_uat','sector','component_locality'];
export const geometryLabels={
 regional:'Nivel regional',local_uat:'UAT locale',sector:'Sectoare',
 component_locality:'Localități / subdiviziuni componente',context:'Context național',
 auxiliary:'Reprezentări auxiliare / non-administrative',unclassified:'Reprezentări neclasificate'
};
const groups={
 context:['state'],
 regional:['county','district','level_2_municipality','special_territorial_unit','level_2_or_special_unit'],
 local_uat:['municipality','town','commune','level_1_uat','commune_or_independent_village_uat','municipality_or_city_uat','town_uat','local_uat'],
 sector:['sector','chisinau_sector'],
 component_locality:['component_locality','subdivision_or_component_area','component_village_boundary_representation','municipality_component_locality_boundary_representation'],
 auxiliary:['non_administrative_or_auxiliary_area']
};
const classByType=new Map(Object.entries(groups).flatMap(([key,types])=>types.map(type=>[type,key])));
export function geometryClass(entity){
 if(entity?.category==='statistical')return 'statistical_only';
 return classByType.get(entity?.representation?.inferred_type)||'unclassified';
}
export function statisticalLevel(entity){
 if(!entity?.roles?.includes('statistical'))return null;
 const level=Number(entity.statistical?.level);
 return [1,2,3].includes(level)?level:'unclassified';
}
// Statistical levels filter the role of an entity, including a reused master geometry.
// Separate boundaries additionally require the independent geometry switch.
export function geometryVisible(entity,{geometryClasses,statisticalLevels,separateStatisticalGeometry}){
 const group=geometryClass(entity),level=statisticalLevel(entity);
 if(group==='statistical_only'&&!separateStatisticalGeometry)return false;
 if(group!=='statistical_only'&&!geometryClasses.has(group))return false;
 return level===null||statisticalLevels.has(level);
}
