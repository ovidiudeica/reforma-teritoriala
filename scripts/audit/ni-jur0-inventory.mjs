// NI-JUR.0: deterministic identity/source inventory. No network, geometry or legal mutation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createNistreniaOperationalView,nistreniaSearchEntities} from '../../atlas-nistrenia-jurisdiction.mjs';
import {performanceSource} from './helpers/performance-source.mjs';
import {parseOsmRelation,osmMembersHash} from './helpers/ni-osm-relation.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const registryFile='docs/ni-jur0-individual-inventory.json',manifestFile='docs/ni-jur0-inventory-manifest.json';
const files={actual:'public/data/actual-entities.json',tree:'public/data/actual-consolidated-tree.json',release:'data/current/actual-release-manifest.json',policy:'docs/p9.0.4.3-promotion-policy.json',roles:'public/data/p907216-osm-roles.json',navigation:'public/data/p909-nistrenia-osm-navigation.json',outlineProof:'public/data/p9095-osm-outlines-manifest.json',outlineBundle:'public/data/p9095-osm-outlines.json',census:'docs/p9.0.7.2.15-osm-tag-census.json',raw:'docs/p9.0.7.2.15-raw-osm-relations.json.gz.b64',semantic:'docs/p9.0.7.2.15-osm-semantic-reconciliation.json',claims:'docs/p9.0.6.3-final-semantic-matrix.json',ledger:'docs/p9.0.6.2-verified-evidence-ledger.json',acceptance:'docs/p9.0.7.2.19-acceptance-manifest.json',levels:'docs/evidence/web-r2a2/osm-historical-admin-level.json',cuatm:'data/sources/cuatm-current.json',uiAliases:'atlas-nistrenia-jurisdiction.mjs',generator:'scripts/audit/ni-jur0-inventory.mjs'};
const bytes=file=>readFileSync(path.join(root,file)),read=file=>JSON.parse(bytes(file)),hash=value=>createHash('sha256').update(value).digest('hex'),json=value=>JSON.stringify(value,null,2)+'\n';
const groupCounts=[13,23,10,16,3,16,4],snapshot='actual-a9e5a4ddcb5277ef',fingerprint='a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446';
files.outlineMetadata='docs/ni-jur0-outline-metadata.json';files.osmParser='scripts/audit/helpers/ni-osm-relation.mjs';
const inputs=Object.fromEntries(Object.entries(files).filter(([key])=>!['raw','uiAliases','generator','osmParser'].includes(key)).map(([key,file])=>[key,read(file)]));
const {actual,tree,release,policy,roles,navigation,outlineProof,outlineBundle,census,semantic,claims,ledger,acceptance,levels,cuatm}=inputs;
const outlineMetadata=inputs.outlineMetadata,outlineMetadataById=new Map(outlineMetadata.records.map(r=>[r.view_id,r]));
const byId=rows=>new Map(rows.map(row=>[row.actual_id||row.id,row]));
const actualById=new Map(actual.entities.map(e=>[e.id,e])),roleById=new Map(roles.rows.map(e=>[e.id,e])),tagById=byId(census.rows),semanticById=byId(semantic.rows),claimById=byId(claims.rows),ledgerByOsm=new Map(ledger.rows.map(r=>[String(r.osm_id),r]));
const groupByRole=new Map();for(const group of navigation.groups)for(const id of group.role_ids){assert.ok(!groupByRole.has(id),'Duplicate geometric membership '+id);groupByRole.set(id,group);}
const sourceRecords=Object.entries(files).map(([key,file])=>({key,file,bytes:bytes(file).length,sha256:hash(bytes(file))}));
const rowHash=row=>{const {row_sha256,...body}=row;return hash(JSON.stringify(body));};
function verifySources(){
 assert.equal(release.snapshot_id,snapshot);assert.equal(release.release_fingerprint_sha256,fingerprint);assert.equal(actual.entities.length,5848);assert.equal(actualById.size,5848);assert.deepEqual(['RO','MD'].map(j=>actual.entities.filter(e=>e.jurisdiction===j).length),[3246,2602]);assert.equal(hash(bytes(files.actual)),release.public_contract.sha256);
 for(const component of Object.values(release.components))if(component.path&&component.sha256)assert.equal(hash(bytes(component.path)),component.sha256,component.path);
 assert.equal(policy.p91_import_allowed,false);assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');assert.equal(navigation.actual_mutation_allowed,false);assert.equal(navigation.p91_import_allowed,false);assert.deepEqual(navigation.groups.map(g=>g.role_count),groupCounts);assert.equal(groupByRole.size,85);assert.equal(outlineProof.relation_count,8);assert.equal(outlineProof.relations.length,8);assert.equal(hash(bytes(files.outlineBundle)),outlineProof.file_sha256);assert.equal(outlineBundle.features.length,8);assert.equal(acceptance.cartographic.relation_roles,85);assert.equal(acceptance.juridical.status,'BLOCKED_INCOMPLETE');
 const ids=roles.rows.map(r=>r.id).sort();assert.equal(ids.length,85);assert.equal(new Set(ids).size,85);for(const rows of [census.rows,semantic.rows,claims.rows])assert.deepEqual(rows.map(r=>r.actual_id).sort(),ids);assert.deepEqual([...groupByRole.keys()].sort(),ids);
 const compressed=Buffer.from(bytes(files.raw).toString().trim(),'base64');assert.equal(hash(compressed),census.raw_osm_archive.gzip_sha256);const plain=gunzipSync(compressed);assert.equal(hash(plain),census.raw_osm_archive.decompressed_sha256);const raw=JSON.parse(plain),xmlById=new Map(raw.raw_relation_xml.map(r=>[r.actual_id,r.xml]));assert.equal(xmlById.size,85);
 for(const role of roles.rows){
  const id=role.id,e=actualById.get(id),tag=tagById.get(id),s=semanticById.get(id),xml=xmlById.get(id);assert.equal(e?.jurisdiction,'MD');assert.equal(e.representation.osm_relation_id,role.osm_relation_id);assert.equal(tag.osm_relation_id,String(role.osm_relation_id));assert.equal(s.osm_relation_id,tag.osm_relation_id);assert.equal(hash(xml),tag.raw_relation_xml_sha256);assert.equal(s.original_osm_relation_xml_sha256,tag.raw_relation_xml_sha256);
  const parsed=parseOsmRelation(xml,tag.osm_relation_id);assert.equal(parsed.version,tag.relation_version);assert.equal(parsed.timestamp,tag.relation_timestamp);assert.deepEqual(parsed.tags,tag.tags,'Raw OSM tag mismatch '+id);assert.equal(parsed.members.length,tag.member_count);assert.equal(osmMembersHash(parsed.members),s.pinned_2026_10_12_ordered_members_sha256);
  assert.equal(role.osm_relation_version,tag.relation_version);assert.equal(s.osm_relation_version,tag.relation_version);assert.equal(role.osm_relation_timestamp,tag.relation_timestamp);assert.equal(Number(tag.tags.admin_level),role.osm_admin_level);assert.equal(role.role,s.osm_role_from_tags);assert.equal(s.geometric_osm_parent_id,String(groupByRole.get(id).osm_relation_id));assert.equal(claimById.get(id).geometric_parent_osm_id,s.geometric_osm_parent_id);assert.equal(s.pinned_2026_10_12_ordered_members_sha256,ledgerByOsm.get(tag.osm_relation_id).ordered_members_sha256);
 }
 assert.equal(outlineMetadataById.size,8);assert.equal(outlineMetadata.records.length,8);assert.equal(outlineMetadata.geometry_recaptured,false);assert.equal(outlineMetadata.existing_full_xml_hash_recertified,false);
 for(const outline of outlineProof.relations){const level=levels.items.find(x=>x.id===outline.id),metadata=outlineMetadataById.get(outline.id);assert.ok(level&&metadata);assert.equal(metadata.httpStatus,200);assert.equal(metadata.url,`https://api.openstreetmap.org/api/0.6/relation/${outline.osm_relation_id}/${outline.relation_version}`);assert.equal(hash(metadata.xml),metadata.response_xml_sha256);assert.equal(Buffer.byteLength(metadata.xml),metadata.response_xml_bytes);const parsed=parseOsmRelation(metadata.xml,outline.osm_relation_id);assert.deepEqual(parsed,metadata.relation);assert.equal(osmMembersHash(parsed.members),outline.members_sha256);assert.equal(parsed.members.length,outline.member_count);assert.equal(parsed.version,outline.relation_version);assert.equal(parsed.timestamp,outline.relation_timestamp);assert.equal(Number(parsed.tags.admin_level),level.admin_level_normalized);assert.equal(level.relation_id,outline.osm_relation_id);assert.equal(level.version,outline.relation_version);assert.equal(level.timestamp,outline.relation_timestamp);}
}
function nameAliases(tags,source){return Object.keys(tags).sort().filter(key=>/^(name|alt_name|old_name|official_name|short_name)(:.*)?$/.test(key)&&key!=='name:prefix').map(field=>({value:tags[field],field,source}));}
function aliasesFor(entity,tag){const result=[];for(const field of ['name','official_name','display_name'])if(entity[field])result.push({value:entity[field],field,source:files.actual});for(const value of entity.searchable_names||[])result.push({value,field:'searchable_names',source:files.actual});return [...result,...nameAliases(tag.tags,files.census)];}
function claimFor(id){const c=claimById.get(id);return {status:'HISTORICAL_CLAIM_NOT_CURRENTLY_CERTIFIED',evidence_year:2023,source:files.claims,source_type:'HISTORICAL_PROJECT_LEDGER',name_match:c.official_2023_name_match_type,nominal_entries:c.official_2023_region_claims,explicit_osm_parent_id:c.claimed_de_facto_parent_osm_id,parent_identifier_authority:'HISTORICAL_PROJECT_CROSSWALK_NOT_PRIMARY_SOURCE_IDENTIFIER',primary_source_parent_osm_id:null,explicit_parent_id_not_inferred_in_this_stage:true,microdistrict_evidence:c.lunga_city_microdistrict_evidence,alias_validation:c.alias_validation_status,amendment_chain_complete:false,current_parent_certified:false};}
function outlineRow(proof,view,search){
 const n=view.nodes.get(proof.id),metadata=outlineMetadataById.get(proof.id),r=metadata.relation;
 const row={
  id:proof.id,actual_entity_id:null,label:n.display_name,
  ui_search_aliases:search.get(proof.id).searchable_names,alias_source:files.uiAliases,
  documented_osm_names:nameAliases(r.tags,files.outlineMetadata),
  osm_relation_id:proof.osm_relation_id,
  osm_role:proof.id==='view-nistrenia'?'OPERATIONAL_ROOT_OUTLINE':'OPERATIONAL_GROUP_OUTLINE',
  osm_metadata:{version:r.version,timestamp:r.timestamp,tags:r.tags,member_count:r.members.length,ordered_members_sha256:osmMembersHash(r.members),raw_metadata_xml_sha256:metadata.response_xml_sha256,source:files.outlineMetadata,url:metadata.url,accessed_at_utc:metadata.accessed_at_utc,scope:metadata.scope},
  admin_level:{value:Number(r.tags.admin_level),status:'PINNED_HISTORICAL_METADATA_RAW_XML_RECHECKED',source:files.outlineMetadata,url:metadata.url},
  geometric_parent_view_id:n.parent_id,legal_md_parent:null,
  legal_parent_status:'VIRTUAL_OUTLINE_HAS_NO_ACTUAL_LEGAL_PARENT_ASSIGNMENT',
  claimed_administrative_parent:{status:'NOT_DERIVED_FROM_OSM',documentary_assignment:null},
  historical_osm_proof:proof,source_capture_utc:outlineProof.captured_at_utc,
  geometry_recaptured_in_this_stage:false,source_atomic:false,
  current_osm_verification:'PENDING_NI_JUR_1',documentary_acceptance:'BLOCKED_INCOMPLETE',effective_control:'UNKNOWN'
 };return {...row,row_sha256:rowHash(row)};
}
function build(){
 const view=createNistreniaOperationalView({catalog:navigation,roles:roleById,entityById:actualById,officialNodes:new Map(tree.nodes.map(n=>[n.id,n])),officialRoots:tree.root_ids}),search=new Map(nistreniaSearchEntities(view,actualById).map(n=>[n.id,n]));assert.equal(view.officialNodeCount,5848);assert.equal(view.nodes.size,5941);
 const outlines=outlineProof.relations.map(proof=>outlineRow(proof,view,search));
 const rows=roles.rows.map(role=>{const id=role.id,e=actualById.get(id),tag=tagById.get(id),s=semanticById.get(id),group=groupByRole.get(id),c=claimById.get(id),row={actual_id:id,view_alias_id:'view-nistrenia-role-'+id,label:e.display_name,aliases:aliasesFor(e,tag),osm:{relation_id:role.osm_relation_id,url:role.osm_url,role:role.role,admin_level:role.osm_admin_level,version:tag.relation_version,timestamp:tag.relation_timestamp,tags:tag.tags,raw_xml_sha256:tag.raw_relation_xml_sha256,members:tag.member_count,ordered_members_sha256:s.pinned_2026_10_12_ordered_members_sha256,tag_capture_date:census.capture_day,snapshot_at:roles.osm_source_date},geometric_parent:{osm_relation_id:group.osm_relation_id,label:group.label,view_id:'view-nistrenia-group-'+group.group_id,evidence:files.semantic,does_not_assign_administrative_parent:true},legal_md:{actual_legal:e.legal,actual_hierarchy:e.hierarchy,source:files.actual,source_snapshot:snapshot,registry_source_url:cuatm.source_url,registry_fetched_at:cuatm.fetched_at,status:'PRESERVED_ACTUAL_IDENTITY_NOT_OSM_POLYGON_LEGAL_CERTIFICATION'},claimed_administrative_parent:claimFor(id),geometry_reference:{existing_actual_id:id,master_path:e.representation.master_geometry_path,public_tier:e.map.tier,pinned_source_polygon_sha256:s.pinned_2026_10_12_polygon_sha256,source_evidence:files.semantic,no_coordinates_copied:true,no_new_polygon:true},contradiction_flags:s.context_notes,remaining_documentary_requirements:c.case_requirements,verification:{identity:'RECONCILED_WITH_PROTECTED_ACTUAL',historical_osm_tags:'RAW_XML_CENSUS_CATALOG_AGREE',geometric_group:'NAVIGATION_AND_HISTORICAL_EVIDENCE_AGREE',current_osm:'PENDING_NI_JUR_1',administrative_claim:'PENDING_NI_JUR_2_AND_3',legal_or_full_polygon_control:'BLOCKED_INCOMPLETE'},actual_mutation_allowed:false,p91_import_allowed:false};return {...row,row_sha256:rowHash(row)};});
 return {schema:'ni-jur0-individual-inventory-v1',baseline_main_sha:'54a4ed95c9c80edc7406cbb9c52fdf906a67b9cd',inventory_date_utc:'2026-10-20',attribution:'© OpenStreetMap contributors, ODbL',scope:'85_EXISTING_ACTUAL_ROLES_AND_8_SEPARATE_OPERATIONAL_OUTLINES',actual_snapshot:snapshot,actual_fingerprint:fingerprint,actual_counts:{RO:3246,MD:2602,total:5848},source_records:sourceRecords,source_atomic:false,live_osm_checked_in_this_stage:false,legal_claims_recertified_in_this_stage:false,actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE',group_counts:navigation.groups.map(g=>({osm_relation_id:g.osm_relation_id,label:g.label,roles:g.role_count})),same_display_name_groups:semantic.same_display_name_groups,outlines,rows};
}
function validate(r){
 assert.equal(r.schema,'ni-jur0-individual-inventory-v1');assert.equal(r.actual_snapshot,snapshot);assert.equal(r.actual_fingerprint,fingerprint);assert.equal(r.actual_mutation_allowed,false);assert.equal(r.p91_import_allowed,false);assert.equal(r.semantic_acceptance,'BLOCKED_INCOMPLETE');assert.equal(r.rows.length,85);assert.equal(new Set(r.rows.map(x=>x.actual_id)).size,85);assert.equal(r.outlines.length,8);assert.equal(new Set(r.outlines.map(x=>x.osm_relation_id)).size,8);assert.deepEqual(r.group_counts.map(x=>x.roles),groupCounts);
 for(const row of r.rows){const e=actualById.get(row.actual_id),role=roleById.get(row.actual_id),tag=tagById.get(row.actual_id);assert.ok(e&&role&&tag);assert.deepEqual(row.legal_md.actual_legal,e.legal);assert.deepEqual(row.legal_md.actual_hierarchy,e.hierarchy);assert.deepEqual(row.aliases,aliasesFor(e,tag));assert.deepEqual(row.claimed_administrative_parent,claimFor(row.actual_id));assert.equal(row.osm.relation_id,role.osm_relation_id);assert.equal(row.osm.version,tag.relation_version);assert.deepEqual(row.osm.tags,tag.tags);assert.equal(row.geometric_parent.osm_relation_id,groupByRole.get(row.actual_id).osm_relation_id);assert.equal(row.geometry_reference.existing_actual_id,row.actual_id);assert.equal(row.geometry_reference.no_new_polygon,true);assert.equal(row.actual_mutation_allowed,false);assert.equal(row.p91_import_allowed,false);assert.equal(row.verification.legal_or_full_polygon_control,'BLOCKED_INCOMPLETE');assert.equal(Object.hasOwn(row,'geometry'),false);assert.equal(row.row_sha256,rowHash(row));}
 assert.deepEqual(r.source_records,sourceRecords);
 assert.deepEqual(r.rows.map(x=>x.actual_id).sort(),roles.rows.map(x=>x.id).sort());
 assert.deepEqual(r.outlines.map(x=>x.id).sort(),outlineProof.relations.map(x=>x.id).sort());
 for(const row of r.outlines){
  const metadata=outlineMetadataById.get(row.id),relation=metadata.relation,proof=outlineProof.relations.find(x=>x.id===row.id);
  assert.equal(row.actual_entity_id,null);assert.equal(row.legal_md_parent,null);
  assert.equal(row.claimed_administrative_parent.documentary_assignment,null);assert.equal(row.effective_control,'UNKNOWN');
  assert.equal(row.osm_relation_id,relation.id);assert.equal(row.admin_level.value,Number(relation.tags.admin_level));
  assert.equal(row.admin_level.status,'PINNED_HISTORICAL_METADATA_RAW_XML_RECHECKED');
  assert.deepEqual(row.documented_osm_names,nameAliases(relation.tags,files.outlineMetadata));
  assert.deepEqual(row.historical_osm_proof,proof);
  assert.deepEqual(row.osm_metadata,{version:relation.version,timestamp:relation.timestamp,tags:relation.tags,member_count:relation.members.length,ordered_members_sha256:osmMembersHash(relation.members),raw_metadata_xml_sha256:metadata.response_xml_sha256,source:files.outlineMetadata,url:metadata.url,accessed_at_utc:metadata.accessed_at_utc,scope:metadata.scope});
  assert.equal(row.geometry_recaptured_in_this_stage,false);assert.equal(row.row_sha256,rowHash(row));
 }

 assert.equal(r.rows.filter(x=>x.label==='Bender').length,2);assert.equal(r.rows.filter(x=>x.label==='Hlinaia').length,2);const crem=r.rows.find(x=>x.actual_id==='osm-r1216706');assert.equal(crem.geometric_parent.osm_relation_id,1702218);assert.equal(crem.claimed_administrative_parent.explicit_osm_parent_id,'1702219');assert.equal(crem.legal_md.actual_legal.parent_id,'2700');assert.equal(r.rows.filter(x=>x.claimed_administrative_parent.nominal_entries.length>0).length,84);
}
verifySources();const generated=build();validate(generated);
const manifest={schema:'ni-jur0-inventory-manifest-v1',registry:registryFile,registry_sha256:hash(json(generated)),roles:85,outlines:8,groups:generated.group_counts,sources:sourceRecords,role_records:generated.rows.map(r=>({actual_id:r.actual_id,sha256:r.row_sha256})),outline_records:generated.outlines.map(r=>({id:r.id,sha256:r.row_sha256})),actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'};
if(process.argv.includes('--self-test')){
 const tests=[['duplicate identity',r=>{r.rows[1].actual_id=r.rows[0].actual_id;}],['legal MD reparenting',r=>{r.rows[0].legal_md.actual_legal.parent_id='9999';}],['parent inferred from geometry',r=>{r.rows[1].claimed_administrative_parent.explicit_osm_parent_id=String(r.rows[1].geometric_parent.osm_relation_id);}],['legal/control promotion',r=>{r.rows[0].verification.legal_or_full_polygon_control='CONFIRMED_DOCUMENTARY';r.p91_import_allowed=true;}],['lost documented alias',r=>{r.rows[0].aliases.pop();}],['OSM version drift',r=>{r.rows[0].osm.version++;}],['coalesced Bender roles',r=>{r.rows.splice(r.rows.findIndex(x=>x.label==='Bender'),1);}],['virtual legal parent assignment',r=>{r.outlines[0].legal_md_parent='MD';}],['outline admin level guess',r=>{r.outlines[0].admin_level.value=2;}]];
 for(const [name,mutate]of tests){const changed=structuredClone(generated);mutate(changed);for(const row of [...changed.rows,...changed.outlines])row.row_sha256=rowHash(row);assert.throws(()=>validate(changed),name);console.log('PASS reject '+name);}console.log('NI_JUR0_SELF_TEST_PASS '+tests.length);
}else if(process.argv.includes('--write')){writeFileSync(path.join(root,registryFile),json(generated));writeFileSync(path.join(root,manifestFile),json(manifest));console.log('NI_JUR0_REGISTRY_WRITTEN 85 roles / 8 outlines');}
else if(process.argv.includes('--audit')){
 const saved=read(registryFile);validate(saved);
 assert.equal(bytes(registryFile).toString(),json(generated),'Committed inventory differs from deterministic sources');
 assert.equal(bytes(manifestFile).toString(),json(manifest),'Committed inventory manifest differs');
 const source=performanceSource(root),out=path.join(root,'outputs','NI-JUR.0');
 assert.equal(source.trackedSourcesClean,true,'Acceptance requires clean tracked source files');mkdirSync(out,{recursive:true});
 writeFileSync(path.join(out,'ni-jur0-individual-inventory.json'),bytes(registryFile));
 writeFileSync(path.join(out,'ni-jur0-inventory-manifest.json'),bytes(manifestFile));
 writeFileSync(path.join(out,'inventory-verdict.json'),json({status:'PASS_IDENTITY_INVENTORY_ONLY',sourceSha:source.sha,trackedSourcesClean:source.trackedSourcesClean,roles:85,outlines:8,groupCounts,registry_sha256:manifest.registry_sha256,raw_xml_tags_individually_verified:85,historical_outline_metadata_verified:8,actual_legal_parents_preserved:85,live_osm_checked:false,historical_nominal_claims:84,current_full_polygon_control_certified:0,source_records:sourceRecords,actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'}));
 console.log('NI_JUR0_AUDIT_PASS 85 roles / 8 outlines; legal BLOCKED_INCOMPLETE');
}else throw Error('Use --self-test, --write or --audit');
