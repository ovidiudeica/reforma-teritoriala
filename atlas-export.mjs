import {sharePayload} from './atlas-share.mjs';
import {areaMeasurement,distanceMeasurement,geographicMetrics} from './atlas-geographic-measurement.mjs';
export const schema='atlas-export-v1';
export const model={name:'IUGG sphere',radiusMetres:6371008.8,areaEdges:'straight longitude/latitude',lengthEdges:'great circle',units:{area:'m²',length:'m',overlap:'percent'},crs:'EPSG:4326',coordinateOrder:'longitude,latitude'};
export const limits='Geometria OSM nu reprezintă certificare cadastrală. Identitatea oficială și rolul statistic sunt distincte de reprezentarea geometrică. Zecimalele nu exprimă precizia sursei.';
export const attribution={geometry:'© OpenStreetMap contributors',geometryLicense:'ODbL-1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',copyrightUrl:'https://www.openstreetmap.org/copyright',official:'INS SIRUTA / BNS CUATM; termenii furnizorului',statistical:'Eurostat/GISCO / BNS; termenii furnizorului'};
const clean=v=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ');
export function fileName(entity,extension){
 if(!/^(?:geojson|json|csv|svg)$/.test(extension))throw Error('Format indisponibil');
 const safe=v=>clean(v).normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^a-zA-Z0-9_-]/g,'_');
 const id=safe(entity.id);if(!id||id!==entity.id||!['RO','MD'].includes(entity.jurisdiction))throw Error('Identitate export invalidă');
 return entity.jurisdiction+'_'+id+'_'+(safe(entity.display_name||entity.name).slice(0,80)||'entitate')+'.'+extension;
}
export function provenance(manifest,source=null){
 if(!manifest?.snapshot_id||!manifest.release_fingerprint_sha256||manifest.public_contract?.contract!=='actual-public-entity-v3')throw Error('Snapshot incompatibil');
 return {atlasVersion:'P8.4',snapshotId:manifest.snapshot_id,releaseFingerprintSha256:manifest.release_fingerprint_sha256,catalog:manifest.public_contract.path,catalogSha256:manifest.public_contract.sha256,sourceBundle:manifest.source_bundle??null,statisticalSourceBundle:manifest.public_contract.statistical_source_bundle??null,geometryResource:source,attribution,limits};
}
export function entityMetadata(entity,manifest,source=null){
 const legal=entity.validation?.legal_identity_status==='reconciled'&&entity.legal?.id!=null&&entity.legal.id!==''?entity.legal:null;
 const r=entity.representation||{},s=entity.statistical;
 return {schemaVersion:schema,kind:'entity-metadata',coordinateReferenceSystem:{name:'EPSG:4326',coordinateOrder:'longitude,latitude'},entity:{id:entity.id,name:entity.name??null,displayName:entity.display_name??null,officialName:entity.official_name??null,jurisdiction:entity.jurisdiction,category:entity.category??null,unitType:entity.display_type??null,roles:entity.roles??[],officialIdentity:legal?{registry:legal.registry,id:String(legal.id),name:legal.name??null,source:legal.source??null}:null,officialIdentityStatus:entity.validation?.legal_identity_status??null,osmRepresentation:{relationId:r.osm_relation_id==null?null:String(r.osm_relation_id),adminLevel:r.admin_level??null,source:r.source??null,sourceUrl:r.source_url??null,geometryRole:r.geometry_role??null,precision:r.public_geometry_precision??null,masterGeometryPath:r.master_geometry_path??null},statisticalIdentity:s?{classification:s.classification??null,version:s.version??null,code:s.code??null,level:s.level??null,source:s.source??s.membership_source??null,identityAuthority:s.identity_authority??null}:null,hierarchy:entity.hierarchy?{parentCatalogId:entity.hierarchy.parent_catalog_id??null,legalParentId:entity.hierarchy.legal_parent_id??null,statisticalParentId:entity.hierarchy.statistical_parent_id??null,administrativeParentId:entity.hierarchy.administrative_parent_id??null}:null,geometryStatus:source?'verified-resource':'not-read'},calculated:null,provenance:provenance(manifest,source)};
}
export function geometryExport(entity,feature,manifest,source){
 if(!source||source.bytes!=null&&(!Number.isSafeInteger(source.bytes)||source.bytes<=0||source.bytes>128*1024*1024)||!/^[a-f0-9]{64}$/.test(source.sha256)||feature?.type!=='Feature'||feature.properties?.entity_id!==entity.id)throw Error('Geometrie absentă sau identitate neconfirmată');
 geographicMetrics(feature.geometry);
 const meta=entityMetadata(entity,manifest,source);
 return {type:'Feature',id:entity.id,geometry:feature.geometry,properties:{sourceProperties:feature.properties,atlas:meta}};
}
export const csvCell=value=>{
 let s=value==null?'':String(value);if(typeof value==='string'&&(/^[\s\uFEFF]*[=+\-@]/u.test(s)||/^0\d+$/.test(s)||/^\d{15,}$/.test(s)))s="'"+s;
 s=s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ');
 return '"'+s.replaceAll('"','""')+'"';
};
export function csvRows(columns,rows){return '\uFEFF'+[columns,...rows.map(row=>columns.map(c=>row[c]??null))].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';}
export const entityColumns=['schema_version','id','name','official_name','jurisdiction','category','unit_type','official_registry','official_id','official_identity_status','osm_relation_id','osm_admin_level','statistical_classification','statistical_code','statistical_level','parent_catalog_id','geometry_status','area_m2','perimeter_m','snapshot_id','release_fingerprint_sha256','geometry_source','geometry_license','official_source','statistical_source','geometry_attribution','official_terms','statistical_terms','limits'];
export function metadataRow(data){const e=data.entity,s=e.statisticalIdentity,r=e.osmRepresentation;return {schema_version:schema,id:e.id,name:e.displayName,official_name:e.officialName,jurisdiction:e.jurisdiction,category:e.category,unit_type:e.unitType,official_registry:e.officialIdentity?.registry,official_id:e.officialIdentity?.id,official_identity_status:e.officialIdentityStatus,osm_relation_id:r.relationId,osm_admin_level:r.adminLevel,statistical_classification:s?.classification,statistical_code:s?.code,statistical_level:s?.level,parent_catalog_id:e.hierarchy?.parentCatalogId,geometry_status:e.geometryStatus,area_m2:data.calculated?.areaM2,perimeter_m:data.calculated?.perimeterMetres,snapshot_id:data.provenance.snapshotId,release_fingerprint_sha256:data.provenance.releaseFingerprintSha256,geometry_source:r.sourceUrl,geometry_license:'ODbL-1.0',official_source:e.officialIdentity?.source,statistical_source:s?.source,geometry_attribution:attribution.geometry,official_terms:attribution.official,statistical_terms:attribution.statistical,limits};}
export function measurementExport(state){
 if(!state?.finished||state.armed||!['distance','area'].includes(state.mode))throw Error('Încheie și validează măsurarea înainte de export');
 const points=state.points.map(p=>[...p]);if(points.length>1000||points.length<(state.mode==='area'?3:2))throw Error('Număr invalid de puncte');
 const calculated=state.mode==='area'?areaMeasurement(points):distanceMeasurement(points);
 const geometry=state.mode==='area'?{type:'Polygon',coordinates:[[...points,[...points[0]]]]}:{type:'LineString',coordinates:points};
 return {schemaVersion:schema,kind:'user-drawn-measurement',mode:state.mode,points,geometry,calculated,model,provenance:{source:'user-drawn',osmData:false,limits:'Geometrie desenată de utilizator; nu date OSM și nu document cadastral.'}};
}
export function comparisonExport(report,entities,manifest,sources){
 const keys=['areaDifferenceM2','intersectionM2','unionM2','exclusiveAM2','exclusiveBM2','overlapA','overlapB'];
 if(!report?.validation||!Number.isFinite(report.validation.toleranceM2)||!report.validation.residuals||Object.values(report.validation.residuals).some(v=>!Number.isFinite(v)||Math.abs(v)>report.validation.toleranceM2)||!Array.isArray(report.features)||report.features.length!==2||!report.a||!report.b||keys.some(k=>!Number.isFinite(report[k]))||!['disjoint','boundary','point','overlap','contains','within','equal'].includes(report.relation))throw Error('Comparație incompletă sau nevalidată');
 for(let i=0;i<2;i++)if(!sources[i]?.sha256||!Number.isFinite(report[i===0?'a':'b'].areaM2)||!Number.isFinite(report[i===0?'a':'b'].perimeterMetres)||report.features[i].properties?.entity_id!==entities[i].id)throw Error('Identitatea comparației diferă');
 const metrics=Object.fromEntries(keys.map(k=>[k,report[k]]));
 return {schemaVersion:schema,kind:'geometric-comparison',a:entityMetadata(entities[0],manifest,sources[0]),b:entityMetadata(entities[1],manifest,sources[1]),calculated:{a:report.a,b:report.b,...metrics,areaRatio:report.areaRatio??null,relation:report.relation,matrix:report.matrix,commonFrontierMetres:report.commonFrontierMetres??null,commonFrontierUnavailableReason:report.commonFrontierMetres==null?'Indicator indisponibil din relația P8.2 verificată':null},model,validation:report.validation,limits};
}
export function comparisonRow(d){return {schema_version:schema,id_a:d.a.entity.id,id_b:d.b.entity.id,area_a_m2:d.calculated.a.areaM2,area_b_m2:d.calculated.b.areaM2,area_difference_m2:d.calculated.areaDifferenceM2,area_ratio:d.calculated.areaRatio,intersection_m2:d.calculated.intersectionM2,union_m2:d.calculated.unionM2,exclusive_a_m2:d.calculated.exclusiveAM2,exclusive_b_m2:d.calculated.exclusiveBM2,overlap_a_percent:d.calculated.overlapA,overlap_b_percent:d.calculated.overlapB,relation:d.calculated.relation,common_frontier_m:d.calculated.commonFrontierMetres,common_frontier_unavailable_reason:d.calculated.commonFrontierUnavailableReason,radius_m:model.radiusMetres,snapshot_id:d.a.provenance.snapshotId,source_a:d.a.provenance.geometryResource?.path,source_b:d.b.provenance.geometryResource?.path,source_a_sha256:d.a.provenance.geometryResource?.sha256,source_b_sha256:d.b.provenance.geometryResource?.sha256,limits};}
export const issueCategories=['geometrie','denumire','identitate SIRUTA/CUATM','clasificare administrativă','clasificare statistică','vecinătăți și topologie','calcule geometrice','date sau afișare','altă problemă'];
export function issueReport(entity,manifest,category,currentUrl){
 if(!issueCategories.includes(category))throw Error('Categorie invalidă');
 const text=['## Entitate',`ID: ${clean(entity.id)}`,`Denumire: ${clean(entity.display_name)}`,`Jurisdicție: ${clean(entity.jurisdiction)}`,`Link: ${sharePayload(currentUrl,entity).url}`,`OSM: ${clean(entity.representation?.osm_relation_id)||'indisponibil'}`,`Atlas: P8.4`, `Snapshot: ${clean(manifest.snapshot_id)}`,`Fingerprint: ${clean(manifest.release_fingerprint_sha256)}`,`Categorie: ${category}`,'','## Descrierea problemei','Completează aici descrierea, rezultatul așteptat și sursele verificabile.','','Nu include date personale sau locația GPS decât dacă decizi explicit.'].join('\n');
 const url=new URL('https://github.com/ovidiudeica/reforma-teritoriala/issues/new');url.searchParams.set('template','territorial-entity.md');url.searchParams.set('title',('[Atlas] '+clean(entity.id)+' — '+category).slice(0,180));url.searchParams.set('body',text);
 return {text,url:url.href};
}
export function downloadFile(document,name,content,type,{URL:urls=globalThis.URL,Blob:BlobClass=globalThis.Blob,schedule=globalThis.setTimeout}={}){
 if(!urls?.createObjectURL||!urls?.revokeObjectURL||!BlobClass)throw Error('Descărcarea nu este disponibilă în acest browser');
 const blob=new BlobClass([content],{type});if(blob.size>128*1024*1024)throw Error('Exportul depășește limita de 128 MiB');
 const url=urls.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;
 try{document.body.appendChild(a);a.click();}finally{a.remove();schedule(()=>urls.revokeObjectURL(url),30000);}
 return blob.size;
}
