// P9.0.9 — read-only, virtual OSM geographical grouping, not a legal ACTUAL jurisdiction.
const groups=Object.freeze([
 ['osm-r1702216','Camenca',13],['osm-r1702217','Rîbnița',23],
 ['osm-r1702215','Dubăsari',10],['osm-r1702214','Grigoriopol',16],
 ['osm-r1702219','Tiraspol',3],['osm-r1702218','Slobozia',16],
 ['osm-r944727','Bender',4]
]);
const error=message=>{throw Error('P9.0.9 Nistrenia OSM: '+message);};
export function validateNistreniaOsmNavigation(menu,roles){
 if(!(roles instanceof Map)||roles.size!==85)error('rolurile OSM verificate lipsesc');
 if(!menu||menu.schema!=='p909-nistrenia-osm-navigation-v1'||menu.mode!=='VIRTUAL_OSM_CARTOGRAPHIC_GROUPS_EXISTING_ACTUAL_ONLY')error('contract invalid');
 if(menu.source!=='docs/p9.0.7.2.15-osm-semantic-reconciliation.json'||!(/^[a-f0-9]{64}$/).test(menu.source_ledger_sha256))error('sursă neevidențiată');
 if(menu.source_osm_snapshot_at!=='2026-10-12T20:21:35Z'||menu.root_label!=='Nistrenia'||menu.root_osm_relation_id!==65335||menu.root_osm_url!=='https://www.openstreetmap.org/relation/65335')error('sursa OSM rădăcină nevalidă');
 if(menu.root_has_actual_geometry!==false||menu.root_is_legal_jurisdiction!==false||menu.legal_semantic_acceptance!=='BLOCKED_INCOMPLETE'||menu.p91_import_allowed!==false||menu.actual_mutation_allowed!==false)error('atribuire juridică ori geometrie nouă interzisă');
 if(menu.role_catalog_contract!=='p907216-osm-role-ui-overlay-v1'||menu.group_count!==7||menu.entity_count!==85||menu.groups?.length!==7)error('cardinalitate nevalidă');
 const seen=new Set();
 for(let i=0;i<groups.length;i++){
  const [id,label,count]=groups[i],group=menu.groups[i];
  if(!group||group.group_id!==id||group.label!==label||group.osm_relation_id!==Number(id.slice(5))||group.osm_url!=='https://www.openstreetmap.org/relation/'+group.osm_relation_id||group.relation_kind!=='OSM_GEOMETRIC_GROUP_ONLY')error('grup geometric invalid');
  if(group.role_count!==count||group.role_ids?.length!==count)error('număr diferit pentru '+id);
  for(const roleId of group.role_ids){
   if(seen.has(roleId)||!roles.has(roleId)||roles.get(roleId)?.existing_actual_entity_id!==roleId)error('rol OSM repetat, lipsă sau necertificat');
   seen.add(roleId);
  }
 }
 if(seen.size!==85||[...roles.keys()].some(id=>!seen.has(id)))error('gruparea nu acoperă exact cele 85 de relații');
 return menu.groups.map(group=>({...group,role_ids:[...group.role_ids]}));
}
