#!/usr/bin/env node
// RT-ADM.2 independent decision-register consistency guard; read-only.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const p=path.join(root,'docs/audits/rt-adm2/identity-decision-register.json');
const doc=JSON.parse(readFileSync(p,'utf8'));
const fail=x=>{throw new Error('RT-ADM.2: '+x)};
if(doc.audit!=='RT-ADM.2'||doc.records.length!==14||new Set(doc.records.map(x=>x.id)).size!==14)fail('case count or duplicate');
const classes={RO:0,MD:0},statuses={};
for(const c of doc.records){
  if(!/^osm-r\d+$/.test(c.id))fail('invalid OSM ID');
  classes[c.jurisdiction]++;
  statuses[c.status]=(statuses[c.status]||0)+1;
  if(c.automatic_action_allowed!==false||c.decision!=='NO_CHANGE_PENDING_PRIMARY_EVIDENCE'||c.legal_footprint_certified!==false)fail('unsafe automatic decision '+c.id);
  if(!c.legal_role_evidence_status||!Array.isArray(c.required_evidence)||!c.required_evidence.length)fail('incomplete dossier '+c.id);
}
if(classes.RO!==11||classes.MD!==3)fail('jurisdiction count drift');
if(statuses.CODE_PARENT_CONFLICT_FOOTPRINT_ID_UNCERTIFIED!==2||
   statuses.POSITIVE_IDENTITY_NOT_ESTABLISHED!==1||
   statuses.OSM_FOOTPRINT_IDENTITY_NOT_CERTIFIED!==5||
   statuses.OFFICIAL_SECTOR_EXISTS_OSM_BOUNDARY_NOT_CERTIFIED!==6)fail('status distribution drift');
const observedRoleCount=doc.records.filter(x=>x.legal_role_evidence_status!=='NO_POSITIVE_IDENTITY').length;
if(observedRoleCount!==13||doc.records.filter(x=>x.legal_footprint_certified===true).length!==0)fail('case evidence drift');
if(doc.validation_summary.total!==doc.records.length||doc.validation_summary.unique_ids!==new Set(doc.records.map(x=>x.id)).size||
   doc.validation_summary.verified_legal_roles_or_parent_codes!==observedRoleCount||
   doc.validation_summary.certified_osm_footprints!==0||doc.validation_summary.proposed_tree_edits!==0||doc.validation_summary.all_no_change!==true)fail('certification summary drift');
if(doc.records.filter(x=>x.status==='POSITIVE_IDENTITY_NOT_ESTABLISHED').some(x=>x.legal_role_evidence_status!=='NO_POSITIVE_IDENTITY'))fail('unresolved identity silently promoted');
console.log(JSON.stringify({status:'RT_ADM2_DECISION_REGISTER_VERIFIED',cases:14,legal_role_or_parent_evidence:13,positive_identity_missing:1,certified_osm_footprints:0,automatic_actions:0}));
