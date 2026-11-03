// RT-VA1 current-release audit, deliberately separate from the immutable WEB-R2a.1 historic census.
// Read-only for all tracked files; the generated report goes to a caller-provided output directory.
import {readFileSync} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {trustedActualRelease,VARIANT_A_ACTUAL,HISTORICAL_ACTUAL,assertExactVariantARemovals} from '../lib/rt-va1-release-identity.mjs';
const baseSha='b005f2cf2e5842eae33fc575c84617fac960e507';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:300*1024*1024}).trim();
const historic=p=>execFileSync('git',['show',baseSha+':'+p],{maxBuffer:300*1024*1024});
const requireExact=(test,msg)=>{if(!test)throw Error('RT-VA1 current census: '+msg);};
const BOUNDARY_ALLOW=[
 /^data\/current\/[A-Za-z0-9._/-]+$/,
 /^data\/sources\/actual-statistical-policy\.json$/,
 /^public\/data\/(?:actual-entities|actual-geometry-chunks|actual-consolidated-tree|actual-topology-index|p907216-osm-roles)\.json$/,
 /^public\/data\/topology(?:-frontiers)?\/[A-Za-z0-9._/-]+\.json$/,
 /^public\/geo\/(?:current|actual)\/[A-Za-z0-9._/-]+\.geojson$/,
 /^assets\/web-card-audit\/(?:manifest|(?:ro|md)-(?:0[0-9]|[12][0-9]|3[01]))\.json$/
];
export function validateRtVa1Candidate(){
 const release=json('data/current/actual-release-manifest.json'),index=json('public/data/actual-entities.json'),
 persisted=json('data/current/actual-release-persisted.json'),gate=json('data/current/actual-release-gate.json');
 const profile=trustedActualRelease(release,index,persisted);
 requireExact(profile===VARIANT_A_ACTUAL,'only exact promoted RT-VA1 accepted');
 requireExact(gate.status==='PASS'&&gate.snapshot_id===profile.snapshot,'release gate mismatch');
 const source=json('docs/evidence/rt-va1-semantic-exclusion/actual-variant-a-exclusions.json'),
 archive=readFileSync('docs/evidence/rt-va1-semantic-exclusion/original-allotments-123.json');
 requireExact(sha(archive)===source.source_evidence?.sha256&&source.source_evidence?.sha256==='20a03333a9485218da6b552ce9af77b929f6163826c4af4f3936eb374f150c63','source evidence changed');
 const original=JSON.parse(historic('public/data/actual-entities.json'));
 const roster=assertExactVariantARemovals(original,index,source);
 const old=JSON.parse(historic('data/current/actual-release-manifest.json'));
 requireExact(old.snapshot_id===HISTORICAL_ACTUAL.snapshot&&old.release_fingerprint_sha256===HISTORICAL_ACTUAL.fingerprint,'old release not exact');
 const roles=json('public/data/p907216-osm-roles.json');
 requireExact(roles.contract==='p907216-osm-role-ui-overlay-v1'&&roles.relation_count===85&&roles.rows?.length===85&&
 roles.existing_actual_snapshot_id===profile.snapshot&&roles.existing_actual_release_fingerprint_sha256===profile.fingerprint&&
 roles.existing_actual_entity_count===profile.entityCount&&roles.legal_de_facto_certified===0&&roles.no_new_geometries===true,'NI role binding changed');
 const currentIds=new Set(index.entities.map(e=>e.id));
 requireExact(roles.rows.every(r=>currentIds.has(r.id)&&r.legal_de_facto_certified===false),'NI 85 IDs not retained');
 const nav=json('public/data/p909-nistrenia-osm-navigation.json');
 requireExact(nav.entity_count===85&&nav.group_count===7&&nav.groups?.length===7,'NI navigation changed');
 const topology=json('public/data/actual-topology-index.json');
 requireExact(topology.snapshot_id===profile.snapshot&&topology.entityCount===profile.entityCount&&topology.geometryCount===123&&
 topology.catalogSha256===sha(readFileSync('public/data/actual-entities.json'))&&topology.errors?.length===0,'topology not rebound');
 const cards=json('assets/web-card-audit/manifest.json');
 requireExact(cards.record_count===profile.entityCount&&cards.snapshot===profile.snapshot&&cards.fingerprint===profile.fingerprint&&
 cards.files?.length===64&&cards.derivation?.source_record_count===5848&&cards.derivation?.removed_reviewed_ids===123,'WEB-CARD not rebound');
 const marker=persisted.promoted_from_candidate;
 const candidateBase=marker?.base_commit_sha;
 requireExact(/^[0-9a-f]{40}$/.test(candidateBase??'')&&/^[0-9a-f]{40}$/.test(marker?.candidate_commit_sha??'')&&
 marker.base_snapshot_id===HISTORICAL_ACTUAL.snapshot,'unapproved promotion marker/base');
 // Pipeline/provenance upgrades may move main, but the old semantic publication is immutable.
 requireExact(git('merge-base',baseSha,candidateBase)===baseSha,'candidate base not descended from RT-VA1 admitted main');
 const candidateBaseManifest=JSON.parse(execFileSync('git',['show',candidateBase+':data/current/actual-release-manifest.json']));
 requireExact(candidateBaseManifest.snapshot_id===HISTORICAL_ACTUAL.snapshot&&
 candidateBaseManifest.release_fingerprint_sha256===HISTORICAL_ACTUAL.fingerprint,'candidate base not the historical semantic release');
 for(const path of ['public/data/actual-entities.json','data/current/entities.json',
  'public/geo/current/md-administrative.geojson','public/geo/current/ro-administrative.geojson'])
  requireExact(sha(execFileSync('git',['show',candidateBase+':'+path],{maxBuffer:300*1024*1024}))===sha(historic(path)),
  'candidate base mutated the retained historical publication '+path);
 const head=git('rev-parse','HEAD');
 const parents=git('rev-list','--parents','-n','1',head).split(' ');
 const candidate=marker.candidate_commit_sha;
 requireExact(parents.length===2&&parents[1]===candidate,'promotion must be direct child of exact candidate');
 requireExact(git('rev-list','--parents','-n','1',candidate).split(' ')[1]===candidateBase,'candidate not a direct child of its exact base');
 const changed=git('diff','--name-only',candidateBase,head).split(/\r?\n/).filter(Boolean);
 requireExact(changed.length>0&&changed.every(p=>BOUNDARY_ALLOW.some(rx=>rx.test(p))),'unapproved promoted file paths');
 const history=json('docs/evidence/ni-fin31-web-r2a1/sha256-manifest.json');
 requireExact(sha(historic('docs/evidence/ni-fin31-web-r2a1/sha256-manifest.json'))===
  sha(readFileSync('docs/evidence/ni-fin31-web-r2a1/sha256-manifest.json')),'historical census hash altered');
 for(const [p,v]of Object.entries(history.persisted_registries??{})){
  const bytes=readFileSync(p);
  requireExact(bytes.length===v.bytes&&sha(bytes)===v.sha256,'historical persisted census registry altered: '+p);
 }
 const policy=json('docs/p9.0.4.3-promotion-policy.json');
 requireExact(policy.semantic_acceptance==='BLOCKED_INCOMPLETE'&&policy.p91_import_allowed===false,'P9.1 unblocked');
 return {status:'PASS_RT_VA1_CURRENT_ONLY',historic_anchor_sha:baseSha,base_sha:candidateBase,head_sha:head,snapshot:profile.snapshot,semantic_fingerprint:profile.fingerprint,
 removed_exact:roster.excluded,retained:roster.retained,counts:{RO:profile.RO,MD:profile.MD,total:profile.entityCount},
 ni_roles:roles.rows.length,ni_nav_groups:nav.groups.length,topology_resources:Object.keys(topology.resources).length,
 card_fragments:cards.files.length,historical_registry_count:Object.keys(history.persisted_registries??{}).length,
 changed_files:changed.length,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'};
}
export async function runRtVa1Census({outDir,verifyManifest}){
 const report=validateRtVa1Candidate();
 if(verifyManifest){
  requireExact(verifyManifest==='docs/evidence/ni-fin31-web-r2a1/sha256-manifest.json','unapproved historical evidence manifest');
  requireExact(sha(readFileSync(verifyManifest))===sha(historic(verifyManifest)),'historical evidence manifest changed');
 }
 await mkdir(outDir,{recursive:true});
 const output=JSON.stringify(report,null,2)+'\n';
 await writeFile(join(outDir,'rt-va1-current-census.json'),output);
 await writeFile(join(outDir,'sha256-manifest.json'),JSON.stringify({schema:'rt-va1-current-census-v1',baseline:baseSha,
 output_sha256:sha(output),historical_evidence_manifest_sha256:sha(readFileSync('docs/evidence/ni-fin31-web-r2a1/sha256-manifest.json'))},null,2)+'\n');
 console.log('WEB_R2A1_CURRENT_RT_VA1 '+JSON.stringify(report));
}
