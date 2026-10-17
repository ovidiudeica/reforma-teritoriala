// P9.0.9.5: eight independent SOURCE-ONLY OSM outlines; never ACTUAL geometries or legal parents.
import {NISTR_EN_ROOT,NISTR_EN_GROUP_PREFIX} from './atlas-nistrenia-jurisdiction.mjs';
export const NI_OUTLINE_CONTRACT='p9095-osm-independent-outlines-v1';
export const niOutlineIds=Object.freeze([NISTR_EN_ROOT,...[1702216,1702217,1702215,1702214,1702219,1702218,944727].map(id=>NISTR_EN_GROUP_PREFIX+'osm-r'+id)]);
const expectedOsmIds=Object.freeze([65335,1702216,1702217,1702215,1702214,1702219,1702218,944727]);
const fail=message=>{throw Error('P9.0.9.5 OSM outline: '+message);};
function rings(g){
 if(g?.type==='Polygon')return g.coordinates?.map(r=>r);
 if(g?.type==='MultiPolygon')return g.coordinates?.flatMap(p=>p);
 return null;
}
function coordinatesValid(g){
 const rs=rings(g);if(!Array.isArray(rs)||!rs.length)return false;
 let total=0;
 for(const ring of rs){
  if(!Array.isArray(ring)||ring.length<4||++total>10000)return false;
  const a=ring[0],b=ring.at(-1);
  if(!Array.isArray(a)||!Array.isArray(b)||a[0]!==b[0]||a[1]!==b[1])return false;
  for(const p of ring)if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<25||p[0]>32||p[1]<45||p[1]>50)return false;
 }
 return true;
}
export function validateNistreniaOutlinePackage(geo,proof,navigation){
 if(!geo||geo.type!=='FeatureCollection'||geo.metadata?.contract!==NI_OUTLINE_CONTRACT||geo.metadata?.actual_mutation!==false||
  geo.metadata?.p91_import_allowed!==false||geo.metadata?.semantic_acceptance!=='BLOCKED_INCOMPLETE')fail('untrusted geometry contract');
 if(!proof||proof.schema!=='p9095-osm-independent-outlines-proof-v1'||proof.relation_count!==8||proof.relations?.length!==8||
  proof.actual_catalog_untouched!==true||proof.actual_geometry_untouched!==true||
  proof.p91_import_allowed!==false||proof.semantic_acceptance!=='BLOCKED_INCOMPLETE'||!/^[a-f0-9]{64}$/.test(proof.file_sha256))fail('untrusted source manifest');
 if(!navigation||navigation.root_osm_relation_id!==65335||navigation.groups?.length!==7||navigation.p91_import_allowed!==false)fail('untrusted navigation contract');
 if(geo.features?.length!==8||new Set(geo.features.map(f=>f.id)).size!==8)fail('missing or duplicated independent outlines');
 const byId=new Map();
 for(let i=0;i<8;i++){
  const f=geo.features[i],p=proof.relations[i],osmId=expectedOsmIds[i],id=niOutlineIds[i];
  if(!f||f.type!=='Feature'||f.id!==id||f.properties?.entity_id!==id||f.properties?.osm_relation_id!==osmId||
   f.properties?.view_only!==true||f.properties?.legal_certified!==false||p?.id!==id||p.osm_relation_id!==osmId||
   p.relation_version!==f.properties.osm_version||p.relation_timestamp!==f.properties.osm_timestamp||
   !/^[a-f0-9]{64}$/.test(p.source_xml_sha256)||!/^[a-f0-9]{64}$/.test(p.edges_sha256)||
   !coordinatesValid(f.geometry)||!Array.isArray(p.bbox)||p.bbox.length!==4||p.vertices<4)fail('unverified relation '+osmId);
  if(i&&navigation.groups[i-1].osm_relation_id!==osmId)fail('OSM navigation changed '+osmId);
  byId.set(id,f);
 }
 return byId;
}
export async function fetchVerifiedNistreniaOutlines(fetcher,subtle,navigation){
 const [raw,manifestResponse]=await Promise.all([
  fetcher('public/data/p9095-osm-outlines.json',{cache:'no-cache'}),
  fetcher('public/data/p9095-osm-outlines-manifest.json',{cache:'no-cache'})
 ]);
 if(!raw.ok||!manifestResponse.ok)fail('source file unavailable');
 const [body,proof]=await Promise.all([raw.text(),manifestResponse.json()]);
 if(!subtle?.digest)fail('WebCrypto provenance validator unavailable');
 const digest=await subtle.digest('SHA-256',new TextEncoder().encode(body));
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==proof.file_sha256)fail('geometry bundle SHA-256 mismatch');
 return {features:validateNistreniaOutlinePackage(JSON.parse(body),proof,navigation),proof};
}
export function createNistreniaOutlineLayers({L,map,features,onSelect=()=>{}}){
 if(!(features instanceof Map)||features.size!==8)fail('uncertified source outlines');
 const pane=map.createPane?.('nistrenia-osm-outlines');
 if(pane?.style){pane.style.zIndex='455';pane.style.pointerEvents='auto';}
 map.attributionControl?.addAttribution?.('&copy; OpenStreetMap contributors · ODbL');
 const layers=new Map();
 for(const [id,feature] of features){
  const layer=L.geoJSON(feature,{
   pane:'nistrenia-osm-outlines',smoothFactor:0,
   // Stroke-only: Nistrenia is independently selectable without intercepting clicks on ACTUAL MD polygons.
   style:{color:id===NISTR_EN_ROOT?'#8a3e9e':'#7d368d',weight:id===NISTR_EN_ROOT?3:2,opacity:0.95,fill:false,dashArray:id===NISTR_EN_ROOT?'7 4':'4 3'},
   onEachFeature:(_,shape)=>shape.on?.('click',()=>onSelect(id))
  });
  if(!layer.getBounds?.().isValid?.())fail('empty outline for '+id);
  layers.set(id,layer);
 }
 function sync(checked,niFilter){
  for(const [id,layer] of layers){
   if(niFilter&&checked.has(id)){if(!map.hasLayer(layer))layer.addTo(map);}
   else if(map.hasLayer(layer))map.removeLayer(layer);
  }
 }
 function bounds(id){if(!layers.has(id))fail('unknown outline '+id);return layers.get(id).getBounds();}
 return {layers,sync,bounds,has:id=>layers.has(id)};
}
