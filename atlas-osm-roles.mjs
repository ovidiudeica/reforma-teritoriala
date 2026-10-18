// P9.0.7.2.16 — UI metadata only; no extra geometry, parent assignment or legal promotion.
export const osmRoleLabels=Object.freeze({
 OSM_RURAL_COUNCIL_AREA:'Perimetru de consiliu sătesc (OSM)',
 OSM_SETTLEMENT_COUNCIL_AREA:'Perimetru de consiliu al așezării (OSM)',
 OSM_CITY_COUNCIL_AREA:'Perimetru de consiliu orășenesc (OSM)',
 OSM_LEVEL8_MUNICIPALITY_AREA_UNSPECIFIED:'Zonă administrativă locală, tip nespecificat (OSM)',
 OSM_CITY_BOUNDARY:'Limită de oraș (OSM)',
 OSM_TOWN_BOUNDARY:'Limită de localitate urbană (OSM)',
 OSM_VILLAGE_BOUNDARY:'Limită de sat (OSM)',
 OSM_LEVEL4_MUNICIPALITY_BOUNDARY:'Limită de municipiu, nivel 4 (OSM)'
});
const validId=id=>typeof id==='string'&&/^osm-r[1-9]\d*$/.test(id);
const positiveInt=value=>Number.isSafeInteger(value)&&value>0;
const fail=message=>{throw Error('P9 OSM cartografic: '+message)};
const expectedStatus='SOURCE_VERIFIED_OSM_TAGS_LEGAL_UNCERTIFIED';
export function validateOsmRolesCatalog(catalog,entityById,{snapshotId,releaseFingerprint}={}){
 if(!catalog||catalog.contract!=='p907216-osm-role-ui-overlay-v1'||catalog.mode!=='DESCRIPTIVE_EXISTING_ACTUAL_GEOMETRY'||catalog.ui_status!==expectedStatus)fail('contract absent/invalid');
 if(!(entityById instanceof Map)||entityById.size<85)fail('catalog ACTUAL indisponibil');
 if(catalog.existing_actual_snapshot_id!==snapshotId||catalog.existing_actual_release_fingerprint_sha256!==releaseFingerprint)fail('release ACTUAL diferit de catalogul OSM');
 if(catalog.existing_actual_entity_count!==entityById.size||catalog.indexed_actual_entities!==85||catalog.relation_count!==85||catalog.rows?.length!==85)fail('număr entități diferit');
 if(catalog.legal_de_facto_certified!==0||catalog.no_new_geometries!==true||catalog.no_new_jurisdictions!==true||catalog.existing_actual_legal_parent_unchanged!==true||catalog.no_new_OSM_API_calls_at_runtime!==true||catalog.source_geometry_byte_equivalence_to_osm_2026_10_12_claimed!==false)fail('asertare juridică sau geometrie nouă nepermisă');
 if(catalog.osm_attribution!=='© OpenStreetMap contributors, ODbL'||catalog.osm_source_date!=='2026-10-12T20:21:35Z'||!(/^[a-f0-9]{64}$/).test(catalog.osm_evidence_sha256))fail('proveniență incompletă');
 const out=new Map();
 for(const row of catalog.rows){
  if(!validId(row.id)||out.has(row.id)||row.existing_actual_entity_id!==row.id||!positiveInt(row.osm_relation_id)||row.id!=='osm-r'+row.osm_relation_id)fail('ID duplicat sau nevalid');
  const entity=entityById.get(row.id);
  if(!entity||entity.id!==row.id||entity.jurisdiction!=='MD'||entity.representation?.source!=='OpenStreetMap'||entity.representation.osm_relation_id!==row.osm_relation_id||String(entity.representation.admin_level)!==String(row.osm_admin_level)||(entity.representation.place??null)!==row.osm_place)fail('relația OSM nu corespunde entității ACTUAL '+row.id);
  if(!Array.isArray(entity.map?.bbox)||entity.map.bbox.length!==4||!entity.map.bbox.every(Number.isFinite))fail('geometria ACTUAL existentă lipsește');
  if(!(row.role in osmRoleLabels)||row.role_label!==osmRoleLabels[row.role]||!positiveInt(row.osm_relation_version)||!Number.isFinite(Date.parse(row.osm_relation_timestamp))||!row.osm_name)fail('rol OSM insuficient');
  if(row.osm_url!=='https://www.openstreetmap.org/relation/'+row.osm_relation_id||row.geometry_source!=='EXISTING_ACTUAL_PUBLIC_GEOJSON_ONLY'||row.source_snapshot_osm!==catalog.osm_source_date||row.osm_to_actual_geometry_byte_identity_claimed!==false||row.legal_de_facto_certified!==false||!Array.isArray(row.context_flags))fail('atribuirile de proveniență nu sunt valide');
  out.set(row.id,Object.freeze({...row}));
 }
 return out;
}
const add=(document,parent,tag,content,className)=>{
 const el=document.createElement(tag);
 if(content!==undefined&&content!==null)el.textContent=String(content);
 if(className)el.className=className;
 parent.appendChild(el);return el;
};
const importantFlags=Object.freeze({
 GEOMETRIC_PARENT_DIFFERS_FROM_HISTORIC_DE_FACTO_CLAIM:'Apartenența geometrică și revendicarea istorică de facto diferă.',
 DISPLAY_NAME_COLLISION_USE_OSM_ID_AND_ROLE:'Există un alt poligon cu același nume; identificatorii OSM diferă.',
 COUNCIL_BOUNDARY_NOT_EQUIVALENT_TO_SETTLEMENT_FOOTPRINT:'Perimetrul consiliului nu reprezintă automat limita localității.',
 LUNGA_MICRODISTRICT_VS_OSM_MUNICIPALITY_TAG_UNRESOLVED:'Lunga: diferența dintre microdistrict și eticheta OSM nu este certificată juridic.',
 URBAN_LINE_VS_CADASTRAL_ZONE_NOT_LEGALLY_RECONCILED:'Limita orașului nu este certificată ca limită cadastrală.'
});
export function renderOsmRoleDetails({container,document,row}){
 if(!row||!container)return null;
 const section=add(document,container,'section',null,'details-section osm-role-evidence');
 section.dataset.osmRoleId=row.id;
 add(document,section,'h3','Rol cartografic OpenStreetMap');
 add(document,section,'p','Aceasta este o interpretare descriptivă a relației OSM. Geometria afișată este cea existentă în ACTUAL; nu afirmăm identitatea coordonatelor ACTUAL cu snapshotul OSM din 12.10.2026 și nici apartenența juridică de facto.','hint');
 const dl=add(document,section,'dl',null,'kv');
 for(const [label,value] of [
  ['Rol conform etichetelor OSM',row.role_label],
  ['Nume în OSM',row.osm_name],
  ['Relație OSM',row.id],
  ['Versiune OSM',row.osm_relation_version],
  ['Modificată în OSM',row.osm_relation_timestamp],
  ['Nivel OSM',row.osm_admin_level],
  ['Etichetă place',row.osm_place||'neprecizată'],
  ['Sursă', '© OpenStreetMap contributors, ODbL'],
  ['Certificare juridică de facto','Neacordată — nu reprezintă o limită administrativă aprobată']
 ]){add(document,dl,'dt',label);add(document,dl,'dd',value);}
 for(const flag of row.context_flags||[]){
  if(!Object.hasOwn(importantFlags,flag))continue;
  add(document,section,'p',importantFlags[flag],'hint');
 }
 const link=add(document,section,'a','Deschide relația în OpenStreetMap');
 link.href=row.osm_url;link.target='_blank';link.rel='noopener noreferrer';
 return section;
}
