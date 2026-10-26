import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateNistreniaAdministrativeModel} from '../../atlas-nistrenia-administrative.mjs';
import {compactNistreniaDocumentaryName} from '../../atlas-tree-labels.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const directory='docs/web-ni-u1/acceptance';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const encode=value=>JSON.stringify(value,null,2)+'\n';
const read=file=>{assert(!path.isAbsolute(file)&&!file.split(/[\\/]/).includes('..'),'Repository-relative evidence path required');return readFile(path.join(root,file));};
const json=async file=>JSON.parse(await read(file));
const sha=/^[a-f0-9]{40}$/;
export function validateReceipts(r){
 assert.match(r.release.application_sha,sha);
 for(const name of ['ni','cards','shared','coupled','history','pages']){
  const item=r[name];assert.equal(item.status,'PASS',name+' acceptance');
  assert.equal(item.mode,'published',name+' must exercise published website');
  assert.equal(item.trackedSourcesClean,true,name+' source must be clean');
  assert(item.publishedSource.length>=9,name+' published source hashes');
 }
 assert.equal(r.pages.expectedPublishedSha,r.release.application_sha,'Pages exact release');
 assert.equal(r.pages.sourceSha,r.release.application_sha,'Pages auditor exact release');
 assert.equal(r.coupled.applicationBaselineSha,r.release.application_sha,'Coupled application baseline');
 assert.equal(r.shared.references.length,85);
 assert.equal(new Set(r.shared.references.map(x=>x.canonical_id)).size,85,'duplicate shared ID');
 for(const row of r.shared.references){assert(row.canonical_card);assert(row.four_way_sync);}
 assert.equal(r.cards.cards.length,85);assert.equal(r.cards.outlines.length,8);
 assert.equal(r.history.viewports.length,2);
 for(const v of r.history.viewports){assert(v.back&&v.forward&&v.canonicalState);assert.deepEqual(v.errors,[]);}
 for(const name of ['ni','cards','shared','coupled'])assert.deepEqual(r[name].errors,[],name+' JavaScript errors');
 assert.deepEqual(r.coupled.console.filter(x=>x.type==='error'||x.level==='error'),[],'Coupled console');
 assert.equal(r.coupled.captures.length,4,'Visible NI desktop/tablet/portrait/landscape captures');
 assert.equal(r.release.visual_inspection.status,'PASS','captures must be inspected');
 assert.equal(r.release.visual_inspection.captures.length,4);
 assert(r.release.artifacts.length>=2,'published artifact provenance');
 for(const artifact of r.release.artifacts){assert(Number.isSafeInteger(artifact.id));assert.match(artifact.independently_verified_zip_sha256,/^[a-f0-9]{64}$/);assert.equal(artifact.digest,'sha256:'+artifact.independently_verified_zip_sha256,'Artifact ZIP digest');assert.equal(artifact.expired,false,'Original artifact available at verification');}
 assert.equal(r.pages.publishedInventory.status,'PASS');
 const inv=r.pages.publishedInventory;assert.equal(inv.checkedFiles,inv.expectedFiles);
 assert.equal(inv.records.length,inv.expectedFiles);assert.equal(new Set(inv.records.map(x=>x.file)).size,inv.records.length);
 for(const file of inv.records){assert.equal(file.status,'PASS',file.file);assert.equal(file.sha256,file.expectedSha256,file.file);}
 for(const stage of ['functional_pre_merge','functional_post_merge']){
  const ci=r.release[stage];assert.match(ci.sha,sha);assert(ci.checks.length>0,stage+' coverage');
  for(const c of ci.checks){assert.equal(c.head_sha,ci.sha,stage+' exact head');assert.equal(c.status,'completed',stage+' '+c.name);assert.equal(c.conclusion,'success',stage+' '+c.name);}
  for(const required of ['verify-persisted-release','actual-release-trust-chain','p2-statistical-foundation','frontend-geometry-taxonomy','Analyze (javascript-typescript)','Analyze (python)','Analyze (actions)','actual-change-repro-A','actual-change-repro-B','actual-change-repro-compare','actual-change-reproducibility','p82-derived-topology','p84-export-validation','frontend-browser-qa','ni-fin'])assert(ci.checks.some(c=>c.name===required),stage+' missing '+required);
  if(stage==='functional_pre_merge')assert(ci.checks.some(c=>c.name==='CodeQL'),'PR CodeQL aggregate');
 }
 assert.equal(r.release.functional_post_merge.sha,r.release.application_sha);
 return r;
}
export async function buildDossier(){
 const sourceFiles=['release.json','ni.json','cards.json','shared.json','coupled.json','history.json','pages.json'];
 const r=Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f.slice(0,-5),await json(directory+'/sources/'+f)])));
 validateReceipts(r);
 const model=await json('views/nistrenia/administration.json');
 const release=await json('data/current/actual-release-manifest.json'),catalogBytes=await read(release.public_contract.path);
 assert.equal(digest(catalogBytes),release.public_contract.sha256,'Consolidated public catalog');
 const entities=JSON.parse(catalogBytes),actual=new Set(entities.entities.map(e=>e.id));
 validateNistreniaAdministrativeModel(model,{actualIds:actual});assert.equal(actual.size,5848);
 const registry=await json('docs/web-ni-u1/ni-u1-0-u1-1-per-id-registry.json');
 const integrity=await json('docs/ni-legal-close/sources/actual-integrity-receipt.json');
 assert.equal(integrity.components.length,32);
 for(const c of integrity.components){const bytes=await read(c.path);assert.equal(bytes.length,c.bytes,c.path);assert.equal(digest(bytes),c.sha256,c.path);}
 assert.equal(integrity.semantic_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
 assert.equal(entities.entities.filter(e=>e.jurisdiction==='RO').length,3246);assert.equal(entities.entities.filter(e=>e.jurisdiction==='MD').length,2602);
 const resources=[...model.geometry_resources].sort((a,b)=>a.canonical_id.localeCompare(b.canonical_id,'en'));
 assert.equal(resources.length,93);assert.equal(new Set(resources.map(x=>x.canonical_id)).size,93);
 const geometryById=new Map();
 for(const descriptor of Object.values(release.public_contract.geometry_tiers.MD)){
  const bytes=await read(descriptor.path);assert.equal(digest(bytes),descriptor.sha256,descriptor.path);
  for(const f of JSON.parse(bytes).features){const id=f.properties.entity_id;assert(!geometryById.has(id),'Duplicate MD source feature '+id);geometryById.set(id,{source_path:descriptor.path,source_sha256:descriptor.sha256,geometry_sha256:digest(JSON.stringify(f.geometry))});}
 }
 const outlinePath='public/data/p9095-osm-outlines.json',outlineBytes=await read(outlinePath),outlines=JSON.parse(outlineBytes);
 assert.equal(outlines.features.length,8);
 for(const f of outlines.features){const id=f.properties.entity_id;assert(!geometryById.has(id));geometryById.set(id,{source_path:outlinePath,source_sha256:digest(outlineBytes),geometry_sha256:digest(JSON.stringify(f.geometry))});}
 const publishedFiles=new Map(r.pages.publishedInventory.records.map(x=>[x.file,x]));
 for(const resource of resources){const geometry=geometryById.get(resource.canonical_id);assert(geometry,'Missing canonical source '+resource.canonical_id);assert.equal(publishedFiles.get(geometry.source_path)?.sha256,geometry.source_sha256,'Published canonical geometry '+resource.canonical_id);}
 const shared=new Map(r.shared.references.map(x=>[x.canonical_id,x]));
 const counts={};for(const n of model.nodes)counts[n.kind]=(counts[n.kind]||0)+1;
 assert.deepEqual(counts,{root:1,raion:5,upper_city:4,council:74,place:158});
 assert.equal(model.nodes.filter(n=>!n.geometry_ref).length,234);
 const common={schema:'web-ni-u1-final-acceptance-v1',application_sha:r.release.application_sha,scope:'Functional presentation, not legal certification or OSM source promotion'};
 const output={
  'pr-integration-register.json':r.release.integrations,
  'canonical-geometry-audit.json':{...common,counts:{canonical_resources:93,actual_md_references:85,ni_outlines:8,duplicated_ni_geojson_payloads:0},resources:resources.map(x=>({...x,...geometryById.get(x.canonical_id),canonical_reference_only:x.kind==='ACTUAL',published_card:shared.get(x.canonical_id)||null})),limitations:['Archival NI evidence_polygon_sha256 is distinct from the protected ACTUAL source geometry digest. Canonical uniqueness does not deny existing derived ACTUAL geometry tiers.']},
  'shared-checkbox-audit.json':{...common,status:'PASS',directions_per_id:4,direction_assertions:340,references:r.shared.references,filter_and_history_checks:r.coupled.checks,history_focus_regression:r.history,canonical_export:r.coupled.geojson,comparison:r.coupled.comparison,vector_export:r.coupled.vector},
  'tree-and-card-audit.json':{...common,counts:{...counts,nodes:242,without_own_geometry:234,candidate:97,without_geometry_evidence:137,auxiliary_references:85,documentary_root_units:9},documentary_nodes:registry.node_to_geometry.map(n=>({...n,source_display_name:n.display_name,display_name:compactNistreniaDocumentaryName(model.nodes.find(x=>x.id===n.administrative_node_id))})),geometry_roles:registry.geometry_to_administrative_roles,common_cards:r.cards.cards,exclusive_cards:r.cards.outlines,homonym_context:r.cards.labels,cartographic_folder:r.shared.catalog,documentary_and_navigation_roots_separate:true},
  'chromium-acceptance.json':{...common,status:'PASS',browser:r.coupled.browser,checks:r.coupled.checks,captures:r.release.visual_inspection,source_receipts:r.release.artifacts,limitations:r.coupled.limitations,errors:r.coupled.errors,networkFailures:r.coupled.networkFailures,externalTileWarnings:r.coupled.externalTileWarnings},
  'pages-acceptance.json':{...common,status:'PASS',run:r.release.pages_run,inventory:r.pages.publishedInventory,source:r.pages.publishedSource,virtual_assets:r.ni.virtualAssets},
  'ci-final-register.json':{...common,functional_pre_merge:r.release.functional_pre_merge,functional_post_merge:r.release.functional_post_merge,closure_pr_post_merge:'Required after dossier merge; record exact SHA, checks, deployment and manifest digest in the immutable final PR acceptance comment. No future result is asserted here.',actual_integrity:{...integrity,checked_application_sha:r.release.application_sha}},
  'remaining-exceptions.json':{...common,NI_LEGAL_CERTIFICATION_COMPLETE:false,OSM_FRESHNESS_PASS:false,P91_IMPORT_ALLOWED:false,READY_FOR_UA_CV0:false,issue_396:'OPEN; OSM stale source and #398 remain separate',issue_442:'Administratively CLOSED/not_planned; legal certification is not obtained',exceptions:registry.exceptions,global_osm:{formal_unknown_relations:242,lacunary_histories:159,missing_versions:641},scope_limits:['7 versus 9 classification remains documented; no speculative reparenting.','No public OSM edits, source promotion, ACTUAL/CUATM or MD parent changes.','234 documentary nodes do not gain a polygon through a nominal match.']}
 };
 return output;
}
export async function manifest(){
 const files=[];
 async function walk(dir){for(const item of await readdir(path.join(root,dir),{withFileTypes:true})){assert(!item.isSymbolicLink(),'Dossier symlinks are not evidence');const file=dir+'/'+item.name;if(item.isDirectory())await walk(file);else if(file!==directory+'/sha256-manifest.json'){const b=await read(file);files.push({path:file,bytes:b.length,sha256:digest(b)});}}}
 await walk(directory);files.sort((a,b)=>a.path.localeCompare(b.path,'en'));return {schema:'web-ni-u1-acceptance-sha256-v1',self_excluded:true,files};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const check=process.argv.slice(2);assert(check.length===0||(check.length===1&&check[0]==='--check'),'Only --check is supported');
 for(const [name,value] of Object.entries(await buildDossier())){const file=directory+'/'+name,bytes=encode(value);if(check.length)assert.equal((await read(file)).toString('utf8'),bytes,'Non-deterministic dossier '+file);else await writeFile(path.join(root,file),bytes);}
 const bytes=encode(await manifest()),file=directory+'/sha256-manifest.json';if(check.length)assert.equal((await read(file)).toString('utf8'),bytes,'Dossier manifest mismatch');else await writeFile(path.join(root,file),bytes);
 console.log('WEB-NI-U1 dossier: 93 resources, 242 nodes, 85 x 4 synchronization assertions, 32 protected hashes verified.');
}
