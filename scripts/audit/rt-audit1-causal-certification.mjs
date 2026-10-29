#!/usr/bin/env node
// RT-AUDIT.1.2: per-ID legal/semantic provenance joined to quantified geometric evidence.
// Diagnostic-only. No ACTUAL changes, no presumed official geometry.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),dir='outputs/RT-AUDIT.1/';
const load=async p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await load(p));
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=s=>{throw Error('RT-AUDIT.1.2: '+s)};
const summary=await json(dir+'overlap-investigation-summary.json');
const overlapBytes=await load(dir+'overlap-254-per-id.json');
const overlaps=JSON.parse(overlapBytes),equality=await json(dir+'semantic-equalities-3.json');
const pubBytes=await load('public/data/actual-entities.json');
const pub=JSON.parse(pubBytes),entityById=new Map(pub.entities.map(e=>[e.id,e]));
const manifest=await json('data/current/actual-release-manifest.json');
if(sha(pubBytes)!==summary.baseline.public_entities_sha256||manifest.snapshot_id!==summary.baseline.snapshot_id)fail('snapshot mismatch');
if(overlaps.length!==254||equality.length!==3||summary.counts.errors!==0)fail('incomplete prior investigation');
const recon=await json('data/current/md-cuatm-reconciliation.json');
const reconciled=new Map((recon.matches||[]).map(e=>[e.id,e]));
const cuatm=await json('data/sources/cuatm-current.json');
const legal=new Map(cuatm.records.map(x=>[String(x.code),x]));
const review=await json('data/sources/md-cuatm-individual-review.json');
const reviewed=new Map((review.cases||[]).map(x=>[x.osm_id,x]));
const nonCuatm=await json('data/current/md-cuatm-non-cuatm-allotments.json');
const special=new Map((nonCuatm.items||[]).map(x=>[x.id,x]));
const notes={
 'data/current/md-cuatm-reconciliation.json':sha(await load('data/current/md-cuatm-reconciliation.json')),
 'data/sources/cuatm-current.json':sha(await load('data/sources/cuatm-current.json')),
 'data/sources/md-cuatm-individual-review.json':sha(await load('data/sources/md-cuatm-individual-review.json')),
 'data/current/md-cuatm-non-cuatm-allotments.json':sha(await load('data/current/md-cuatm-non-cuatm-allotments.json')),
 'data/sources/md-nuts-2017.json':sha(await load('data/sources/md-nuts-2017.json'))
};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function identity(id){
 const e=entityById.get(id);if(!e)fail('missing identity '+id);
 const l=e.legal?.registry==='CUATM'?e.legal:null;
 const m=reconciled.get(id);
 if(l?.id&&m?.legal_id&&String(l.id)!==String(m.legal_id))fail('public vs reconciliation legal ID contradiction '+id);
 const code=l?.id?String(l.id):m?.legal_id?String(m.legal_id):null;
 const official=code?legal.get(code):null;
 if(code&&!official)fail('missing official CUATM '+id+' / '+code);
 return {id,name:e.display_name,type:e.display_type,category:e.category,roles:e.roles||[],
  official_code:code,official_name:official?.name??null,official_parent_code:official?.parent_code??null,
  official_status_code:official?.status_code??null,
  legal_match_method:l?.match_method??m?.match_method??null,
  public_legal_status:e.validation?.legal_identity_status??null,
  source:code?'data/sources/cuatm-current.json':null,
  legal_role_evidence:code?'POSITIVE_CUATM_IDENTITY_NO_GEOMETRY_CERTIFICATION':'NOT_AVAILABLE',
  reviewed:reviewed.get(id)?{status:reviewed.get(id).review_status,finding:reviewed.get(id).finding}:null,
  non_cuatm_review:special.get(id)?{classification:special.get(id).classification??null}:null
 };
}
const causeCounts={},statusCounts={},rows=[];
function incr(obj,k){obj[k]=(obj[k]||0)+1}
for(const x of overlaps){
 if(x.geometry_relation!=='overlap')fail('non overlap in 254');
 const c=identity(x.child_id),p=identity(x.parent_id);
 let role='UNRESOLVED_OFFICIAL_RELATION',provenance='GEOMETRIC_ONLY',reason='Cauza istorica sau tehnica a contururilor nu este dovedita';
 if(c.official_code&&p.official_code&&c.official_code===p.official_code){
  role='TWO_OSM_FOOTPRINTS_SAME_CERTIFIED_CUATM_IDENTITY';
  provenance='OFFICIAL_IDENTITY_WITH_GEOMETRIC_DIFFERENCE';
  reason='Codul oficial CUATM comun este demonstrat; poligoanele distincte OSM nu se contin reciproc. Cauza editarii OSM ramane necertificata';
 } else if(c.official_code&&p.official_code&&c.official_parent_code===p.official_code){
  role='OFFICIAL_CHILD_PARENT_MATCH_WITH_OSM_BOUNDARY_CROSSING';
  provenance='OFFICIAL_HIERARCHY_WITH_GEOMETRIC_DIFFERENCE';
  reason='Apartenenta copilului la parinte este confirmata in CUATM; intersectia fara continere indica dezaliniere intre contururile OSM, fara atribuirea unei cauze istorice';
 } else if(c.official_code&&p.official_code&&c.official_parent_code!==p.official_code){
  role='OFFICIAL_DIRECT_PARENT_DIFFERENT_FROM_TREE_PARENT';
  provenance='OFFICIAL_CODE_HIERARCHY_DIFFERENCE_NEEDS_INTERMEDIATE_LEVEL_REVIEW';
  reason='ParentCodUnic oficial nu corespunde direct parent_id din arbore; posibil nivel intermediar. Nu se afirma contradictie juridica fara analiza lantului';
 } else if(p.category==='statistical'||c.category==='statistical'){
  role='STATISTICAL_VS_ADMINISTRATIVE_COVERAGE';
  provenance='BNS_CLASSIFICATION_ROLE_NOT_OFFICIAL_BOUNDARY';
  reason='Relatii intre poligon administrativ si nivel statistic; roluri diferite fara identitate juridica comuna de geometrie';
 } else if(c.reviewed?.status==='unresolved_identity'){
  role='EXPLICIT_UNRESOLVED_SOURCE_IDENTITY';
  provenance='RECORDED_INDIVIDUAL_REVIEW';
  reason='Revizuirea primara nu certifica identitatea; abaterea spatiala nu justifica reclasificare';
 }
 const status=['TWO_OSM_FOOTPRINTS_SAME_CERTIFIED_CUATM_IDENTITY','OFFICIAL_CHILD_PARENT_MATCH_WITH_OSM_BOUNDARY_CROSSING'].includes(role)?'OFFICIAL_IDENTITY_OR_HIERARCHY_PROVEN_GEOMETRIC_CAUSE_NOT_PROVEN':'REQUIRES_ADDITIONAL_EVIDENCE';
 const row={
  child_id:x.child_id,parent_id:x.parent_id,child_name:x.child_name,parent_name:x.parent_name,
  child_area_km2:Number((x.computed_child_area_m2/1e6).toFixed(9)),
  intersection_area_km2:x.intersection_km2,
  child_outside_parent_km2:x.child_outside_parent_km2,
  percent_child_outside_parent:x.percent_child_outside_parent,
  observed_pattern:x.observed_pattern,
  geometry_status:'DE_9IM_OVERLAP_PROVEN',
  official_child:c,official_parent:p,
  evidence_class:role,evidence_strength:provenance,reason,
  root_cause_certified:false,
  historic_osm_member_diffs_examined:false,
  next_evidence:['OSM exact relation/member history at matched timestamp','Official legal/cadastral boundary where obtainable','Human per-ID evaluation of alternative OSM representations'],
  change_authorized:false
 };
 rows.push(row);incr(causeCounts,role);incr(statusCounts,status);
}
if(new Set(rows.map(r=>r.child_id)).size!==254)fail('duplicates');
const nuts=await json('data/sources/md-nuts-2017.json');
const units=new Map(nuts.units.map(x=>[x.code,x]));
const equalReview=[];
for(const x of equality){
 const c=identity(x.child_id),p=identity(x.parent_id);
 let verdict='REQUIRES_INDIVIDUAL_OSM_ROLE_AND_CUATM_REVIEW',evidence='OSM_GEOMETRY_EQUAL_ONLY';
 if(x.child_id==='stat-MD120'&&x.parent_id==='stat-MD12'){
  const child=units.get('MD120'),parent=units.get('MD12');
  if(child?.parent_code!=='MD12'||!parent||nuts.units.filter(x=>x.parent_code==='MD12').length!==1)fail('BNS statistical lineage changed');
  verdict='OFFICIAL_STATISTICAL_HIERARCHY_EXPLAINS_COEXTENSIVE_ROLES';
  evidence='BNS_NUTS2017_PARENT_AND_ONLY_CHILD';
 } else if(c.official_code&&p.official_code&&c.official_code===p.official_code){
  verdict='SAME_CERTIFIED_CUATM_ID_DIFFERENT_OSM_RELATIONS';
  evidence='OFFICIAL_IDENTITY_ONLY';
 } else if(c.official_code&&p.official_code&&c.official_parent_code===p.official_code){
  verdict='OFFICIAL_DIRECT_CHILD_PARENT_WITH_EQUAL_OSM_GEOMETRY';
  evidence='OFFICIAL_PARENT_AND_OSM_EQUAL';
 }
 equalReview.push({child_id:x.child_id,parent_id:x.parent_id,child_name:c.name,parent_name:p.name,
  geometric_equality_proven:x.measured?.symmetric_difference_m2===0,
  measured_area_km2:x.measured?.child_area_km2??null,
  child:c,parent:p,semantic_verdict:verdict,authority:evidence,source_paths:notes,
  legal_geometry_equivalence_certified:false,root_cause_certified:verdict==='OFFICIAL_STATISTICAL_HIERARCHY_EXPLAINS_COEXTENSIVE_ROLES',
  change_authorized:false});
}
const out={contract:'rt-audit-1-2-causal-evidence-v1',
 snapshot_id:manifest.snapshot_id,
 status:'GEOMETRY_AND_OFFICIAL_IDENTITY_JOIN_COMPLETE_OSM_HISTORY_AND_LEGAL_GEOMETRY_OPEN',
 total_overlap:rows.length,equalities:equalReview.length,
 evidence_class_counts:causeCounts,record_status_counts:statusCounts,
 certified_historical_osm_causes:0,
 source_sha256:notes,
 limitations:[
  'A positive official CUATM identity confirms the administrative identity, not the OSM polygon boundary.',
  'Direct ParentCodUnic differences can reflect intermediate levels and are never automatically reclassified.',
  'Individual OSM member/way/node versions and authoritative legal polygons have not been compared in this audit.',
  'Geometry equality at adjacent statistical tiers is supported by BNS classification, not legal administrative identity.',
  'No changes to ACTUAL or automatic reparenting.'
 ]};
const outputs={'causal-evidence-254-per-id.json':rows,'semantic-equalities-3-certified.json':equalReview,'causal-evidence-summary.json':out};
await mkdir(new URL(dir,root),{recursive:true});
const checks=[];
for(const [name,data] of Object.entries(outputs)){const buf=Buffer.from(JSON.stringify(data,null,2)+'\n');await writeFile(new URL(dir+name,root),buf);checks.push(sha(buf)+'  '+name)}
const csvKeys=['child_id','parent_id','child_name','parent_name','child_outside_parent_km2','percent_child_outside_parent','evidence_class','evidence_strength','root_cause_certified'];
const quoted=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const csv=csvKeys.join(',')+'\n'+rows.map(r=>csvKeys.map(k=>quoted(r[k])).join(',')).join('\n')+'\n';
await writeFile(new URL(dir+'causal-evidence-254-per-id.csv',root),csv);checks.push(sha(csv)+'  causal-evidence-254-per-id.csv');
await writeFile(new URL(dir+'checksums-rt-audit1-2.sha256',root),checks.join('\n')+'\n');
await writeFile(new URL(dir+'rt-audit1-2-report.md',root),
 '# RT-AUDIT.1.2 — provenienta cauzala per-ID\n\nSnapshot: '+out.snapshot_id+
 '\n\n254 perechi geometrice cuantificate si reconciliate cu identitatea CUATM; 3 egalitati evaluate.\n\nClase probatorii: '+JSON.stringify(causeCounts)+
 '\n\n**0 cauze istorice ale diferentelor OSM certificate.** Nu se confunda identitatea CUATM cu geometria legala.\n\n' +
 'Fisierele OSM versionate way/node si geometria oficiala nu au fost confruntate sistematic. Fara modificari ACTUAL.\n');
console.log(JSON.stringify({status:out.status,counts:out.evidence_class_counts,equalities:equalReview.map(x=>({id:x.child_id,verdict:x.semantic_verdict}))}));
