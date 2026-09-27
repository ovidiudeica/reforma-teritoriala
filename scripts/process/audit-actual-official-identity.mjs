#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const P={
 catalog:'data/current/entities.json',
 ro:'public/geo/current/ro-administrative.geojson',
 md:'public/geo/current/md-administrative.geojson',
 recon:'data/current/md-cuatm-reconciliation.json',
 semantic:'data/current/md-cuatm-semantic-bridge.json',
 public:'public/data/actual-entities.json',
 tiers:['public/geo/actual/ro-overview.geojson','public/geo/actual/ro-local.geojson','public/geo/actual/ro-detail.geojson','public/geo/actual/md-overview.geojson','public/geo/actual/md-local.geojson','public/geo/actual/md-detail.geojson']
};
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [catalog,ro,md,recon,semantic,pub,...tiers]=await Promise.all([read(P.catalog),read(P.ro),read(P.md),read(P.recon),read(P.semantic),read(P.public),...P.tiers.map(read)]);
if(semantic.status!=='PASS')throw new Error('MD CUATM semantic bridge is not PASS');
const entities=catalog.entities||[], publicEntities=pub.entities||[];
const master=new Map([...ro.features,...md.features].map(f=>[f.properties?.catalog_id,f]));
const publicById=new Map(publicEntities.map(e=>[e.id,e]));
const tier=new Map();
const duplicateTier=[];
for(const g of tiers)for(const f of g.features||[]){const id=f.properties?.entity_id;if(tier.has(id))duplicateTier.push(id);else tier.set(id,f);}
const mdRecon=new Map((recon.matches||[]).map(x=>[x.id,x]));
const mdSemantic=new Map((semantic.classifications||[]).map(x=>[String(x.legal_id),x]));
const issues=[], rows=[];
const issue=(e,kind,detail={})=>issues.push({entity_id:e?.id??detail.entity_id??null,jurisdiction:e?.jurisdiction??null,name:e?.name??null,issue:kind,...detail});
for(const e of entities){
 const m=master.get(e.id), p=publicById.get(e.id), t=tier.get(e.id);
 let expected=null;
 if(e.jurisdiction==='RO'&&e.legal?.registry==='SIRUTA'&&e.legal?.id)expected={registry:'SIRUTA',id:String(e.legal.id)};
 if(e.jurisdiction==='MD'){const r=mdRecon.get(e.id);if(r?.legal_id){const s=mdSemantic.get(String(r.legal_id));expected={registry:'CUATM',id:String(r.legal_id),type:s?.semantic_type||null};}}
 if(!m)issue(e,'master_geometry_missing');
 if(!p)issue(e,'public_entity_missing');
 if(!t)issue(e,'public_tier_geometry_missing');
 if(expected){
  if(!p?.legal)issue(e,'positive_official_identity_lost_in_public_contract',{expected});
  else if(p.legal.registry!==expected.registry||String(p.legal.id)!==expected.id)issue(e,'public_legal_identity_mismatch',{expected,actual:p.legal});
  if(expected.type&&p?.legal?.type!==expected.type)issue(e,'public_legal_semantic_type_mismatch',{expected_type:expected.type,actual_type:p?.legal?.type??null});
  if(p?.validation?.legal_identity_status!=='reconciled')issue(e,'positive_identity_has_non_reconciled_status',{expected,status:p?.validation?.legal_identity_status??null});
  if(t&&(t.properties?.legal_registry!==expected.registry||String(t.properties?.legal_id)!==expected.id))issue(e,'positive_identity_lost_or_changed_in_public_geometry',{expected,actual:{registry:t.properties?.legal_registry??null,id:t.properties?.legal_id??null}});
  if(t&&expected.type&&t.properties?.legal_type!==expected.type)issue(e,'semantic_type_lost_or_changed_in_public_geometry',{expected_type:expected.type,actual_type:t.properties?.legal_type??null});
 }else if(p?.legal)issue(e,'public_contract_invents_official_identity',{actual:p.legal});
 if(p&&t&&p.validation?.legal_identity_status!==t.properties?.legal_identity_status)issue(e,'public_status_differs_between_index_and_geometry',{index:p.validation?.legal_identity_status??null,geometry:t.properties?.legal_identity_status??null});
 rows.push({entity_id:e.id,jurisdiction:e.jurisdiction,name:e.name,expected_official_registry:expected?.registry??null,expected_official_id:expected?.id??null,expected_semantic_type:expected?.type??null,public_official_registry:p?.legal?.registry??null,public_official_id:p?.legal?.id??null,public_semantic_type:p?.legal?.type??null,legal_identity_status:p?.validation?.legal_identity_status??null,master_geometry:Boolean(m),public_entity:Boolean(p),public_geometry:Boolean(t)});
}
for(const id of duplicateTier)issue(null,'duplicate_entity_across_public_geometry_tiers',{entity_id:id});
for(const p of publicEntities)if(!entities.some(e=>e.id===p.id))issue(null,'unexpected_public_entity',{entity_id:p.id});
for(const [id] of tier)if(!entities.some(e=>e.id===id))issue(null,'unexpected_public_geometry',{entity_id:id});
const byIssue=issues.reduce((a,x)=>(a[x.issue]=(a[x.issue]||0)+1,a),{});
const byStatus=rows.reduce((a,x)=>(a[x.legal_identity_status||'MISSING']=(a[x.legal_identity_status||'MISSING']||0)+1,a),{});
const expectedPositive=rows.filter(x=>x.expected_official_id).length;
const report={schema_version:1,mode:'ACTUAL',scope:['RO','MD'],policy:'Fail closed on any loss, invention, contradiction or propagation drift of positive SIRUTA/CUATM identity and bridged MD semantic subtype across catalog/reconciliation, public index and public geometry. Geometry coordinates are not modified.',entity_count:entities.length,expected_positive_official_identity_count:expectedPositive,legal_identity_status_counts:byStatus,status:issues.length?'FAIL':'PASS',blocking_issue_count:issues.length,blocking_issue_summary:byIssue,blocking_issues:issues,entities:rows};
await writeFile('data/current/actual-official-identity-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,entity_count:report.entity_count,expected_positive_official_identity_count:expectedPositive,legal_identity_status_counts:byStatus,blocking_issue_count:issues.length,blocking_issue_summary:byIssue,blocking_issues:issues.slice(0,50)},null,2));
if(issues.length)process.exitCode=1;
