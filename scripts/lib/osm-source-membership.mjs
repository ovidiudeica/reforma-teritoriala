// Embedded Overpass geometry is not part of an OSM member's identity or role.
export function normalizeOsmMembers(members){
 return members.map(({type,ref,role})=>({type,ref:Number(ref),role:role??''}));
}
