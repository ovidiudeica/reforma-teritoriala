// P9.0.4.2 deterministic, read-only acceptance audit; neither source names nor geometry prove 2026 jurisdiction.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const base=new URL('../../',import.meta.url),out=new URL('../../outputs/P9.0.4.2/',import.meta.url);
const j=async f=>JSON.parse(await readFile(new URL(f,base),'utf8'));
const prior=await j('docs/p9.0.4.1-individual-candidates.json');
const matrix=await j('docs/p9.0.4.2-contemporary-matrix.json');
const local=await j('docs/p9.0.4.1-local-identity-bindings.json');
const actual=await j('public/data/actual-entities.json');
const gate=(ok,msg)=>{if(!ok)throw Error('P9042 gate: '+msg)};
gate(prior.records.length===85&&matrix.records.length===85,'individual cardinality');
gate(matrix.schema_version==='p9042-contemporary-reconciliation-v1','matrix schema');
gate(matrix.date==='2026-10-13','review date');
const pm=new Map(prior.records.map(r=>[r.actual_id,r]));
const ids=new Set(),counts={},blocks=[];
for(const r of matrix.records){
 gate(!ids.has(r.actual_id)&&pm.has(r.actual_id),'unknown/duplicate ID '+r.actual_id);
 ids.add(r.actual_id);
 const old=pm.get(r.actual_id);
 gate(old.geometric_parent_osm_id===r.geometric_parent_id&&old.name_ro===r.name,'geometric parent drift '+r.actual_id);
 gate(old.historical_de_facto_register.disposition===r.historical_disposition,'historical provenance drift '+r.actual_id);
 gate(r.current_membership_certified===false&&r.exact_polygon_control_certified===false&&r.keep_legal_parent===true&&r.keep_geometry===true,'impermissible promotion '+r.actual_id);
 gate(Array.isArray(r.source_ids)&&r.source_ids.every(x=>!!matrix.sources[x]),'unresolved source '+r.actual_id);
 if(r.documented_claim_parent){
  gate(r.actual_id==='osm-r1216706'&&r.documented_claim_parent==='1702219'&&r.geometric_parent_id==='1702218','unverified parent contradiction');
 }
 counts[r.status]=(counts[r.status]||0)+1;
 blocks.push({id:r.actual_id,status:r.status,needs:r.required_resolution});
}
gate(counts.CONTEMPORARY_CLAIM_CONFLICT_WITH_GEOMETRY===1&&counts.NAME_AND_ROLE_AMBIGUITY===2&&counts.CONTEMPORARY_PARENT_NOT_INDEPENDENTLY_VERIFIED===2&&counts.HISTORICAL_CLAIM_ONLY_NO_CURRENT_ID_SPECIFIC_CERTIFICATION===80,'85 disposition counts');
gate(local.records.length===4,'four legal localities');
const idMap=new Map(actual.entities.map(x=>[x.id,x]));
const identity=[];
for(const l of local.records){
 const e=l.actual_polygon_id?idMap.get(l.actual_polygon_id):null;
 if(l.locality==='Pohrebea')gate(e&&e.legal?.id==='3819'&&e.hierarchy.parent_catalog_id==='osm-r19013515','existing Pohrebea ACTUAL master not verified');
 else gate(!l.actual_polygon_id,'new polygon must not be invented '+l.locality);
 identity.push({locality:l.locality,cuatm:l.cuatm_code,legal_parent:l.official_parent,
  actual_polygon_id:l.actual_polygon_id,identity_validated:true,geometry_reused:!!e,contemporary_polygon_control:'UNPROVEN',p91_eligible:false});
}
gate(matrix.conclusions.positive_current_osm_identity_parent_bindings===0&&matrix.conclusions.p91_import_allowed===false&&
 matrix.conclusions.legal_parent_overrides===0&&matrix.conclusions.new_polygons===0,'final acceptance must fail closed');
const blockers=[
 {id:'contemporary-identity-evidence',count:85,reason:'No complete 2026 identity-to-parent authoritative source and OSM member reconciliation'},
 {id:'cremenciug-parent-mismatch',count:1,reason:'Tiraspol 2025 institutional administration vs Slobozia OSM geometric containment'},
 {id:'bender-role-alias',count:2,reason:'Two ACTUAL Bender relations not reconciled by semantic identity and boundary role'},
 {id:'plopi-ofatinti',count:2,reason:'No sufficiently certain current external parent for these identities'},
 {id:'locality-polygons',count:3,reason:'Roghi, Mahala, Vasilievca do not have separate published ACTUAL master polygons'},
 {id:'snapshot-alignment',count:1,reason:'Live OSM and Geofabrik snapshot version-by-version alignment unproven'}
];
const summary={schema_version:'p9042-final-acceptance-v1',audit:'PASS',semantic_acceptance:'BLOCKED',p91_import_allowed:false,
 scope_count:85,dispositions:counts,localities_checked:4,pohrebea_master_reused:1,
 no_new_polygons:true,no_legal_parent_rewrites:true,contemporary_identity_parent_certified:0,
 blockers:blocks.map(x=>x.id),blocker_categories:blockers.length,
 basis:'Contemporary primary sources characterize particular local administrations; they do not authenticate 85 full administrative parent + exact OSM polygon bindings.'};
await mkdir(out,{recursive:true});
for(const [name,val]of [['summary.json',summary],['per-identity-findings.json',matrix.records],
 ['locality-review.json',identity],['semantic-blockers.json',blockers]]){
 await writeFile(new URL(name,out),JSON.stringify(val,null,2)+'\n');
}
console.log('P9042_SUMMARY '+JSON.stringify(summary));
gate(summary.semantic_acceptance==='BLOCKED'&&summary.p91_import_allowed===false,'promotion unexpectedly authorized');
