#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';

const BASE='073a1ee2a2098392df5891fb6b15e69b0eef2d9c';
const SNAPSHOT='actual-a9e5a4ddcb5277ef';
const FINGERPRINT='a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446';
const INPUTS=[
 'public/data/actual-entities.json',
 'public/data/actual-consolidated-tree.json',
 'public/data/p907216-osm-roles.json',
 'public/data/p909-nistrenia-osm-navigation.json',
 'public/data/p9095-osm-outlines.json',
 'public/data/p9095-osm-outlines-manifest.json',
 'data/current/actual-release-manifest.json',
 'data/current/actual-release-gate.json',
 'data/current/actual-release-persisted.json',
 'docs/p9.0.4.3-promotion-policy.json',
 'docs/p9.0.7.2.15-osm-semantic-reconciliation.json'
];
const argv=process.argv.slice(2);
const arg=(name,def=null)=>{const i=argv.indexOf(name);return i<0?def:argv[i+1];};
const OUT=arg('--out-dir','outputs/web-r2a1');
const VERIFY=arg('--verify-dir');
const sha=b=>createHash('sha256').update(b).digest('hex');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o??{},k);
const die=m=>{throw Error('WEB-R2a.1: '+m);};
const raw={};
for(const p of INPUTS)raw[p]=await readFile(p);
const parse=p=>JSON.parse(raw[p].toString('utf8'));
const actual=parse(INPUTS[0]),tree=parse(INPUTS[1]),roles=parse(INPUTS[2]),nav=parse(INPUTS[3]);
const outlines=parse(INPUTS[4]),outlineManifest=parse(INPUTS[5]),release=parse(INPUTS[6]);
const releaseGate=parse(INPUTS[7]),persisted=parse(INPUTS[8]),promotion=parse(INPUTS[9]),reconciliation=parse(INPUTS[10]);

function binding(v,target,seen=new Set()){
 if(!v||typeof v!=='object'||seen.has(v))return null;
 seen.add(v);
 if(v.path===target&&typeof v.sha256==='string')return v;
 for(const x of Object.values(v)){const hit=binding(x,target,seen);if(hit)return hit;}
 return null;
}
function level(rawValue,present=true){
 if(!present)return {state:'missing',raw:null,normalized:null};
 if(rawValue===null)return {state:'null',raw:null,normalized:null};
 if(Array.isArray(rawValue))return {state:'multiple',raw:rawValue,normalized:null};
 if(typeof rawValue==='string'&&/[;,|/]/.test(rawValue)){
  const v=rawValue.split(/[;,|/]/).map(x=>x.trim()).filter(Boolean);
  if(v.length>1)return {state:'multiple',raw:rawValue,normalized:null};
 }
 const s=String(rawValue).trim();
 if(!/^\d+$/.test(s))return {state:'invalid',raw:rawValue,normalized:null};
 const n=Number(s);
 return Number.isSafeInteger(n)&&n>0?{state:'valid',raw:rawValue,normalized:n}:{state:'invalid',raw:rawValue,normalized:null};
}
const bbox=v=>Array.isArray(v)&&v.length===4&&v.every(Number.isFinite);
const polygon=g=>g&&['Polygon','MultiPolygon'].includes(g.type)&&Array.isArray(g.coordinates)&&g.coordinates.length>0;
const exceptions=[];
const ex=(id,category,severity,source,evidence,recommendation)=>exceptions.push({id,category,severity,source,evidence,recommendation});
const dist=rows=>{
 const by_level={},states={valid:0,missing:0,null:0,multiple:0,invalid:0,conflict:0};
 for(const r of rows){
  states[r.admin_level_state]=(states[r.admin_level_state]||0)+1;
  if(r.admin_level_state==='valid')by_level[r.admin_level_normalized]=(by_level[r.admin_level_normalized]||0)+1;
 }
 return {total:rows.length,by_level:Object.fromEntries(Object.entries(by_level).sort((a,b)=>Number(a[0])-Number(b[0]))),states};
};

if(release.snapshot_id!==SNAPSHOT||release.release_fingerprint_sha256!==FINGERPRINT)die('ACTUAL release identity mismatch');
if(releaseGate.snapshot_id!==SNAPSHOT||releaseGate.status!=='PASS')die('ACTUAL release gate not PASS');
if(persisted.snapshot_id!==SNAPSHOT||persisted.release_fingerprint_sha256!==FINGERPRINT||persisted.validated_release_gate_status!=='PASS')die('persisted ACTUAL marker mismatch');
if(promotion.p91_import_allowed!==false||promotion.semantic_acceptance!=='BLOCKED_INCOMPLETE')die('P9.1 protection changed');
if(actual.entity_count!==5848||!Array.isArray(actual.entities)||actual.entities.length!==5848)die('ACTUAL public cardinality != 5848');
if(!Array.isArray(tree.root_ids))die('consolidated hierarchy missing root_ids');

const actualBind=binding(release,'public/data/actual-entities.json');
if(!actualBind)die('release manifest does not bind public ACTUAL index');
if(sha(raw[INPUTS[0]])!==actualBind.sha256)die('ACTUAL public index SHA-256 mismatch');
if(actualBind.bytes!=null&&raw[INPUTS[0]].length!==actualBind.bytes)die('ACTUAL public index byte length mismatch');
if(sha(raw[INPUTS[4]])!==outlineManifest.file_sha256)die('NI outline package SHA-256 mismatch');
if(nav.source!=='docs/p9.0.7.2.15-osm-semantic-reconciliation.json'||nav.source_ledger_sha256!==reconciliation.upstream_verified_geometry_ledger_sha256)die('NI navigation upstream verified geometry ledger mismatch');
if(reconciliation.total!==85)die('semantic reconciliation total != 85');

let changed=[];
try{changed=execFileSync('git',['diff','--name-only',BASE+'...HEAD'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);}
catch(e){die('cannot compare audit branch to base SHA: '+e.message);}
const protectedChanges=changed.filter(p=>p==='data'||p.startsWith('data/')||p==='public'||p.startsWith('public/'));
if(protectedChanges.length)die('protected data/public changed: '+protectedChanges.join(', '));

const actualRows=[],byId=new Map(),ids=new Set();
for(const e of actual.entities){
 if(!e||typeof e.id!=='string'||!e.id)die('ACTUAL entity without stable ID');
 const codes=[];
 if(ids.has(e.id)){codes.push('DUPLICATE_ACTUAL_ID');ex(e.id,'DUPLICATE_ACTUAL_ID','fatal',INPUTS[0],'stable ID repeated','Reconcile publication pipeline; do not mutate automatically.');}
 ids.add(e.id);byId.set(e.id,e);
 if(!['RO','MD'].includes(e.jurisdiction)){codes.push('AMBIGUOUS_JURISDICTION');ex(e.id,'AMBIGUOUS_JURISDICTION','fatal',INPUTS[0],String(e.jurisdiction),'Reconcile publication contract before UI use.');}
 const present=!!e.representation&&own(e.representation,'admin_level');
 const a=level(present?e.representation.admin_level:null,present);
 if(a.state!=='valid'){
  const code='ADMIN_LEVEL_'+a.state.toUpperCase();codes.push(code);
  ex(e.id,code,a.state==='null'?'info':'warning',INPUTS[0],'representation.admin_level='+JSON.stringify(a.raw),'Preserve explicit '+a.state+'; do not infer from name, parent, NUTS, SIRUTA or CUATM.');
 }
 const geom=bbox(e.map?.bbox);
 if(!geom){codes.push('GEOMETRY_METADATA_MISSING');ex(e.id,'GEOMETRY_METADATA_MISSING','error',INPUTS[0],'map.bbox absent/invalid','Verify public geometry binding without editing master geometry.');}
 actualRows.push({
  record_id:'ACTUAL:'+e.id,stable_id:e.id,name:e.display_name??e.name??null,jurisdiction:e.jurisdiction,
  record_type:'ACTUAL',osm_relation_id:e.representation?.osm_relation_id??null,
  admin_level_raw:a.raw,admin_level_normalized:a.normalized,admin_level_state:a.state,
  provenance:{source:e.representation?.source??null,source_url:e.representation?.source_url??null,master_geometry_path:e.representation?.master_geometry_path??null},
  snapshot:release.snapshot_id,version:null,timestamp:release.generated_at??null,geometry_exists:geom,
  actual_contract:true,overlay_source_only:false,actual_identity_reused:false,
  validation_state:e.validation?.legal_identity_status??null,exception_codes:codes
 });
}
if(ids.size!==5848)die('ACTUAL unique ID count != 5848');

if(roles.contract!=='p907216-osm-role-ui-overlay-v1'||roles.rows?.length!==85||roles.relation_count!==85||roles.indexed_actual_entities!==85)die('85-role catalog contract/cardinality changed');
if(roles.existing_actual_snapshot_id!==SNAPSHOT||roles.existing_actual_release_fingerprint_sha256!==FINGERPRINT)die('85-role catalog release binding mismatch');
if(nav.group_count!==7||nav.entity_count!==85||nav.groups?.length!==7)die('NI navigation cardinality changed');
if(nav.groups.some(g=>g.role_count!==(g.role_ids??[]).length))die('NI navigation role_count mismatch');
const groupByRole=new Map();
for(const g of nav.groups)for(const id of g.role_ids??[]){
 if(groupByRole.has(id))die('role appears in multiple NI groups: '+id);
 groupByRole.set(id,g.label);
}
if(groupByRole.size!==85)die('NI navigation does not partition 85 roles');

const roleRows=[],roleIds=new Set();
for(const r of roles.rows){
 const codes=[];let a=level(r.osm_admin_level,own(r,'osm_admin_level'));
 if(roleIds.has(r.id)){codes.push('DUPLICATE_OSM_ROLE_ID');ex(r.id,'DUPLICATE_OSM_ROLE_ID','fatal',INPUTS[2],'role ID repeated','Reconcile role generator; do not duplicate ACTUAL identity.');}
 roleIds.add(r.id);
 const e=byId.get(r.existing_actual_entity_id);
 if(!e){codes.push('OSM_ROLE_WITHOUT_ACTUAL_COUNTERPART');ex(r.id,'OSM_ROLE_WITHOUT_ACTUAL_COUNTERPART','fatal',INPUTS[2],String(r.existing_actual_entity_id),'Do not create a new identity automatically.');}
 else{
  const ea=level(e.representation?.admin_level,!!e.representation&&own(e.representation,'admin_level'));
  if(e.jurisdiction!=='MD'||e.representation?.osm_relation_id!==r.osm_relation_id||ea.state!=='valid'||a.state!=='valid'||ea.normalized!==a.normalized){
   a={...a,state:'conflict'};codes.push('OSM_ROLE_ACTUAL_CONFLICT');ex(r.id,'OSM_ROLE_ACTUAL_CONFLICT','fatal',INPUTS[2]+' + '+INPUTS[0],'relation/admin_level/jurisdiction mismatch','Reconcile in WEB-R2a.2; do not mutate ACTUAL.');
  }
 }
 if(!groupByRole.has(r.id)){codes.push('OSM_ROLE_UNGROUPED');ex(r.id,'OSM_ROLE_UNGROUPED','fatal',INPUTS[3],'role not assigned exactly once','Repair navigation contract without duplicating geometry.');}
 roleRows.push({
  record_id:'OSM_ROLE:'+r.id,stable_id:r.id,name:r.display_name??r.osm_name_ro??r.osm_name??null,
  jurisdiction:e?.jurisdiction??null,operational_context:'NI',record_type:'OSM_ROLE_REUSED',
  osm_relation_id:r.osm_relation_id??null,admin_level_raw:a.raw,admin_level_normalized:a.normalized,admin_level_state:a.state,
  provenance:{source:INPUTS[2],osm_url:r.osm_url??null,geometry_source:r.geometry_source??null,group:groupByRole.get(r.id)??null},
  snapshot:r.source_snapshot_osm??roles.osm_source_date??null,version:r.osm_relation_version??null,timestamp:r.osm_relation_timestamp??null,
  geometry_exists:e?bbox(e.map?.bbox):false,actual_contract:true,overlay_source_only:true,actual_identity_reused:true,
  validation_state:r.legal_de_facto_certified===false?'SOURCE_VERIFIED_OSM_TAGS_LEGAL_UNCERTIFIED':null,exception_codes:codes
 });
}
if(roleIds.size!==85)die('unique role count != 85');

if(outlineManifest.relation_count!==8||outlines.features?.length!==8)die('NI outline count != 8');
const outlineById=new Map(outlines.features.map(f=>[f.id,f]));
if(outlineById.size!==8)die('duplicate NI outline IDs');
const expectedOutlineIds=new Set(['view-nistrenia',...nav.groups.map(g=>'view-nistrenia-group-osm-r'+g.osm_relation_id)]);
if([...outlineById.keys()].some(id=>!expectedOutlineIds.has(id))||[...expectedOutlineIds].some(id=>!outlineById.has(id)))die('NI outline IDs differ from root + seven groups');
const proofById=new Map((outlineManifest.relations??[]).map(x=>[x.id,x]));
const names=new Map([['view-nistrenia',nav.root_label],...nav.groups.map(g=>['view-nistrenia-group-osm-r'+g.osm_relation_id,g.label])]);
const niRows=[];
for(const [id,f] of outlineById){
 const p=f.properties??{},proof=proofById.get(id),codes=[];
 const present=own(p,'admin_level')||own(p,'osm_admin_level');
 const rawLevel=own(p,'admin_level')?p.admin_level:p.osm_admin_level;
 const a=level(rawLevel,present);
 if(a.state!=='valid'){
  const code='ADMIN_LEVEL_'+a.state.toUpperCase();codes.push(code);
  ex(id,code,'warning',INPUTS[4],'source-only feature has no verified admin_level field','Reconcile from pinned OSM tag evidence in WEB-R2a.2; never infer from label or hierarchy.');
 }
 if(!proof){codes.push('SOURCE_ONLY_PROOF_MISSING');ex(id,'SOURCE_ONLY_PROOF_MISSING','fatal',INPUTS[5],'no proof row','Restore exact evidence binding before UI use.');}
 if(proof&&Number(proof.osm_relation_id)!==Number(p.osm_relation_id)){codes.push('SOURCE_ONLY_RELATION_CONFLICT');ex(id,'SOURCE_ONLY_RELATION_CONFLICT','fatal',INPUTS[4]+' + '+INPUTS[5],'OSM relation ID mismatch','Reconcile source-only contract without touching ACTUAL.');}
 if(proof&&p.osm_version!=null&&Number(proof.relation_version)!==Number(p.osm_version)){codes.push('SOURCE_ONLY_VERSION_CONFLICT');ex(id,'SOURCE_ONLY_VERSION_CONFLICT','fatal',INPUTS[4]+' + '+INPUTS[5],'OSM version mismatch','Reconcile source-only proof.');}
 const geom=polygon(f.geometry);
 if(!geom){codes.push('SOURCE_ONLY_GEOMETRY_MISSING');ex(id,'SOURCE_ONLY_GEOMETRY_MISSING','fatal',INPUTS[4],'Polygon/MultiPolygon absent','Restore source-only evidence; do not substitute ACTUAL geometry.');}
 niRows.push({
  record_id:'NI_OUTLINE:'+id,stable_id:id,name:names.get(id)??id,jurisdiction:'NI',operational_context:'NI',
  record_type:'NI_SOURCE_ONLY_OUTLINE',osm_relation_id:p.osm_relation_id??proof?.osm_relation_id??null,
  admin_level_raw:a.raw,admin_level_normalized:a.normalized,admin_level_state:a.state,
  provenance:{source:p.source??outlineManifest.source,source_url:proof?.source_url??null,source_xml_sha256:proof?.source_xml_sha256??null},
  snapshot:outlineManifest.captured_at_utc??null,version:p.osm_version??proof?.relation_version??null,
  timestamp:p.osm_timestamp??proof?.relation_timestamp??null,geometry_exists:geom,actual_contract:false,overlay_source_only:true,
  actual_identity_reused:false,validation_state:p.legal_certified===false?'SOURCE_ONLY_LEGAL_UNCERTIFIED':null,exception_codes:codes
 });
}

const ro=actualRows.filter(x=>x.jurisdiction==='RO'),md=actualRows.filter(x=>x.jurisdiction==='MD');
if(ro.length+md.length!==5848)die('RO+MD != 5848');
const distributions={
 schema:'web-r2a1-admin-level-distributions-v1',base_sha:BASE,snapshot:SNAPSHOT,fingerprint:FINGERPRINT,
 counting_policy:{actual_identity_count:5848,osm_roles_are_additional_actual_identities:false,ni_outlines_are_actual_identities:false,registry_records:actualRows.length+roleRows.length+niRows.length},
 ACTUAL_RO:dist(ro),ACTUAL_MD:dist(md),NI_SOURCE_ONLY_OUTLINES:dist(niRows),OSM_REUSED_ROLES:dist(roleRows)
};
const times=[...new Set([release.generated_at,roles.osm_source_date,outlineManifest.captured_at_utc].filter(Boolean))];
if(times.length>1)ex('CORPUS:SNAPSHOT_ALIGNMENT','TEMPORAL_SNAPSHOT_DIFFERENCE','info','release/roles/outline manifests',JSON.stringify({actual_release_generated_at:release.generated_at,osm_roles_snapshot:roles.osm_source_date,ni_outlines_captured_at:outlineManifest.captured_at_utc}),'Keep provenance axes separate; do not present them as one atomic snapshot.');
if(outlineManifest.source_atomic_snapshot===false)ex('NI:SOURCE_ONLY_PACKAGE','SOURCE_NOT_ATOMIC_SNAPSHOT','info',INPUTS[5],'source_atomic_snapshot=false','Preserve per-relation version/timestamp provenance.');

const fatal=exceptions.filter(x=>x.severity==='fatal').length;
const errors=exceptions.filter(x=>x.severity==='error').length;
const summary={
 schema:'web-r2a1-admin-level-census-summary-v1',base_sha:BASE,snapshot:SNAPSHOT,fingerprint:FINGERPRINT,
 status:fatal?'FAIL':'PASS_WITH_EXCEPTIONS',exhaustive:!fatal,source_data_mutated:false,
 p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE',actual_mutation_allowed:false,
 counts:{actual:actualRows.length,actual_ro:ro.length,actual_md:md.length,osm_reused_roles:roleRows.length,ni_source_only_outlines:niRows.length,
 registry_records:actualRows.length+roleRows.length+niRows.length,exceptions:exceptions.length,fatal,errors,
 warnings:exceptions.filter(x=>x.severity==='warning').length,info:exceptions.filter(x=>x.severity==='info').length},
 distributions
};

await mkdir(OUT,{recursive:true});
const line=rows=>rows.map(x=>JSON.stringify(x)).join('\n')+'\n';
const outputs={
 'registry-actual-ro.jsonl':line(ro),
 'registry-actual-md.jsonl':line(md),
 'registry-ni-source-only.jsonl':line(niRows),
 'registry-osm-reused-roles.jsonl':line(roleRows),
 'distributions.json':JSON.stringify(distributions,null,2)+'\n',
 'exceptions.json':JSON.stringify({schema:'web-r2a1-admin-level-exceptions-v1',base_sha:BASE,total:exceptions.length,exceptions},null,2)+'\n',
 'summary.json':JSON.stringify(summary,null,2)+'\n'
};
const report='# WEB-R2a.1 — recensământ exhaustiv admin_level OSM\n\n'
 +'- Base SHA: `'+BASE+'`\n- ACTUAL snapshot: `'+SNAPSHOT+'`\n- Semantic fingerprint: `'+FINGERPRINT+'`\n'
 +'- Verdict: **'+summary.status+'**; exhaustiv: **'+summary.exhaustive+'**\n'
 +'- ACTUAL: **'+summary.counts.actual+'** (RO '+summary.counts.actual_ro+'; MD '+summary.counts.actual_md+')\n'
 +'- Roluri OSM reutilizate: **'+summary.counts.osm_reused_roles+'**; contururi NI source-only: **'+summary.counts.ni_source_only_outlines+'**\n'
 +'- Excepții: **'+summary.counts.exceptions+'** (fatal '+fatal+', error '+errors+', warning '+summary.counts.warnings+', info '+summary.counts.info+')\n\n'
 +'## Metodologie\n\nValidatorul citește numai octeții din checkout-ul Git, verifică bindingurile SHA-256 ale ACTUAL și NI, cardinalitățile, unicitatea și referințele dintre contracte. Unitățile de numărare sunt separate: ACTUAL RO, ACTUAL MD, cele 8 contururi NI source-only și cele 85 roluri OSM reutilizate. Valorile admin_level nu sunt deduse din nume, tip, părinte, NUTS, SIRUTA sau CUATM.\n\n'
 +'## Rezultate și excepții\n\n`distributions.json` este sursa canonică pentru fiecare nivel și stările missing/null/multiple/invalid/conflict. `exceptions.json` este registrul exhaustiv per-ID. Excepțiile non-fatale sunt intrarea pentru WEB-R2a.2 și nu autorizează corecții automate.\n\n'
 +'## Invariante\n\n`data/` și `public/` rămân neschimbate față de base SHA. Cele 85 roluri nu cresc cardinalitatea ACTUAL; cele 8 contururi NI sunt source-only. P9.1 rămâne blocat: p91_import_allowed=false, semantic_acceptance=BLOCKED_INCOMPLETE, actual_mutation_allowed=false.\n\n'
 +'## Reproducere\n\n`node scripts/audit/web-r2a1-admin-level-census.mjs --out-dir <director>`\n';
outputs['report.md']=report;
for(const [n,c] of Object.entries(outputs))await writeFile(path.join(OUT,n),c);
const inputHashes=Object.fromEntries(INPUTS.map(p=>[p,{sha256:sha(raw[p]),bytes:raw[p].length}]));
const outputHashes=Object.fromEntries(Object.entries(outputs).map(([n,c])=>[n,{sha256:sha(Buffer.from(c)),bytes:Buffer.byteLength(c)}]));
const hashManifest={schema:'web-r2a1-sha256-manifest-v1',base_sha:BASE,inputs:inputHashes,outputs:outputHashes};
await writeFile(path.join(OUT,'sha256-manifest.json'),JSON.stringify(hashManifest,null,2)+'\n');

if(VERIFY){
 const a=(await readdir(OUT)).sort(),b=(await readdir(VERIFY)).sort();
 if(JSON.stringify(a)!==JSON.stringify(b))die('committed evidence file set differs from regenerated output');
 for(const n of a){const [x,y]=await Promise.all([readFile(path.join(OUT,n)),readFile(path.join(VERIFY,n))]);if(!x.equals(y))die('committed evidence drift: '+n);}
}
console.log('WEB_R2A1_CENSUS '+JSON.stringify({status:summary.status,exhaustive:summary.exhaustive,counts:summary.counts,distributions}));
if(fatal)process.exitCode=1;
