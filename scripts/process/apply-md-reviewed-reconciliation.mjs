#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const CATALOG='data/current/entities.json';
const GEO='public/geo/current/md-administrative.geojson';
const RECON='data/current/md-cuatm-reconciliation.json';
const SEMANTIC='data/current/md-cuatm-semantic-bridge.json';
const OVERRIDES='data/sources/md-cuatm-reviewed-overrides.json';
const REVIEW='data/sources/md-cuatm-individual-review.json';
const OUTPUT='data/current/md-reviewed-official-application.json';
const read=async p=>JSON.parse(await readFile(p,'utf8'));

const [catalog,geo,recon,semantic,overrides,review]=await Promise.all([
 read(CATALOG),read(GEO),read(RECON),read(SEMANTIC),read(OVERRIDES),read(REVIEW)
]);
if(semantic.status!=='PASS')throw new Error('MD semantic bridge is not PASS');

const entities=catalog.entities||[];
const entityByRelation=new Map(entities.filter(e=>e.jurisdiction==='MD'&&e.osm?.relation_id!=null).map(e=>[String(e.osm.relation_id),e]));
const featureById=new Map((geo.features||[]).map(f=>[f.properties?.catalog_id,f]));
const matchById=new Map((recon.matches||[]).map(m=>[m.id,m]));
const semanticByLegalId=new Map((semantic.classifications||[]).map(x=>[String(x.legal_id),x]));
const reviewByRelation=new Map((review.cases||[]).map(x=>[String(x.osm_relation_id),x]));
const selected=(overrides.overrides||[]).filter(x=>x.identity_scope==='legal_identity_only');

const failures=[],applied=[];
const fail=(issue,detail={})=>failures.push({issue,...detail});
for(const o of selected){
 const relationId=String(o.osm_relation_id);
 const e=entityByRelation.get(relationId);
 if(!e){fail('override_entity_missing',{osm_relation_id:o.osm_relation_id});continue;}
 const m=matchById.get(e.id);
 if(!m?.legal_id){fail('override_not_present_in_reconciliation',{entity_id:e.id,osm_relation_id:o.osm_relation_id});continue;}
 if(String(m.legal_id)!==String(o.cuatm_legal_id)){fail('override_reconciliation_id_mismatch',{entity_id:e.id,expected:String(o.cuatm_legal_id),actual:String(m.legal_id)});continue;}
 if(m.match_method!=='reviewed_override'){fail('override_reconciliation_method_mismatch',{entity_id:e.id,actual:m.match_method});continue;}
 const r=reviewByRelation.get(relationId);
 if(!r||r.review_status!=='resolved_positive_identity'||String(r.official_legal_id)!==String(o.cuatm_legal_id)){
  fail('positive_identity_review_missing_or_mismatched',{entity_id:e.id,review_status:r?.review_status??null,review_legal_id:r?.official_legal_id??null});continue;
 }
 if(o.geometry_equivalence_asserted!==false||r.geometry_equivalence_asserted!==false){
  fail('geometry_equivalence_must_remain_false',{entity_id:e.id});continue;
 }
 const s=semanticByLegalId.get(String(m.legal_id))||null;
 const legal={
  registry:'CUATM',
  id:String(m.legal_id),
  name:m.legal_name||null,
  type:s?.semantic_type||null,
  status_code:m.status_code||null,
  parent_id:m.legal_parent_id==null?null:String(m.legal_parent_id),
  parent_name:m.legal_parent_name||null,
  match_method:'reviewed_override',
  match_confidence:'high',
  source:'data/sources/cuatm-current.json',
  reconciliation:RECON,
  review:REVIEW,
  geometry_equivalence_asserted:false
 };
 e.legal=legal;
 e.review_required=false;
 e.classification={
  ...(e.classification||{}),
  confidence:'high',
  reason:'Reviewed positive CUATM identity; OSM geometry remains a de-facto representation and is not asserted to be authoritative legal geometry.',
  evidence:REVIEW,
  official_registry:'CUATM',
  official_legal_id:legal.id,
  representation_class:o.representation_class||r.classification_action||null
 };
 const f=featureById.get(e.id);
 if(!f){fail('geojson_feature_missing',{entity_id:e.id});continue;}
 f.properties=f.properties||{};
 f.properties.legal_registry='CUATM';
 f.properties.legal_id=legal.id;
 f.properties.legal_name=legal.name;
 f.properties.legal_type=legal.type;
 f.properties.legal_parent_id=legal.parent_id;
 f.properties.legal_parent_name=legal.parent_name;
 f.properties.legal_match_method='reviewed_override';
 f.properties.legal_geometry_equivalence_asserted=false;
 f.properties.representation_class=o.representation_class||r.classification_action||null;
 applied.push({entity_id:e.id,osm_relation_id:Number(relationId),legal_id:legal.id,legal_type:legal.type,representation_class:f.properties.representation_class});
}
if(selected.length!==1||Number(selected[0]?.osm_relation_id)!==6879649||String(selected[0]?.cuatm_legal_id)!=='7612'){
 fail('reviewed_identity_override_scope_changed',{selected:selected.map(x=>({osm_relation_id:x.osm_relation_id,cuatm_legal_id:x.cuatm_legal_id}))});
}
if(applied.length!==1)fail('reviewed_identity_application_cardinality',{expected:1,actual:applied.length});

const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 jurisdiction:'MD',
 status:failures.length?'FAIL':'PASS',
 policy:'Apply only explicitly reviewed positive legal-identity overrides to the master catalog and GeoJSON metadata. Geometry coordinates and OSM hierarchy are never rewritten; geometry equivalence remains explicitly false.',
 selected_override_count:selected.length,
 applied_count:applied.length,
 applied,
 failures
};
await writeFile(CATALOG,JSON.stringify(catalog,null,2)+'\n');
await writeFile(GEO,JSON.stringify(geo));
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
