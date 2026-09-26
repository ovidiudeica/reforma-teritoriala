#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [individual,consistency,edge,unmatched,geo]=await Promise.all([
 read('data/sources/md-cuatm-individual-review.json'),
 read('data/current/md-cuatm-consistency-audit.json'),
 read('data/current/md-cuatm-edge-case-audit.json'),
 read('data/current/md-cuatm-unmatched-review.json'),
 read('public/geo/current/md-administrative.geojson')
]);
const failures=[],checks=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)failures.push({name,detail})};
const queue=individual.identity_review_queue||[];
check('exactly_one_documented_unresolved_identity',queue.length===1&&queue[0].osm_relation_id===12104636,{queue});
const chitcani=individual.cases?.find(x=>x.osm_relation_id===6879649);
check('chitcani_semantic_classification',chitcani?.review_status==='resolved_semantic_classification'&&chitcani?.classification_action==='chitcani_de_facto_administrative_representation',{review_status:chitcani?.review_status,classification_action:chitcani?.classification_action});
const unknownClasses=Object.keys(consistency.duplicate_identity_summary?.by_class||{}).filter(x=>!['mixed_parallel_and_chain_representations','uat_and_component_locality_with_parallel_uat_boundary','component_locality_with_parallel_uat_boundaries_same_changeset','parallel_boundaries_same_identity_same_changeset','later_duplicate_same_identity','same_identity_parent_child_chain'].includes(x));
check('no_new_duplicate_identity_classes',unknownClasses.length===0,{unknownClasses});
const allowedIssues=new Set(['chisinau_sector_geometry_gap','cross_legal_parent_conflict','verified_legal_parent_geometry_conflict']);
const issueClasses=Object.keys(consistency.unique_legal_identity_issue_summary?.by_class||{});
check('no_new_unique_identity_issue_classes',issueClasses.every(x=>allowedIssues.has(x)),{issueClasses});
const unresolved=(unmatched.items||unmatched.unmatched||unmatched.records||[]).filter(x=>!['non_cuatm','reviewed_non_cuatm','resolved'].includes(x.classification||x.review_status||''));
check('unmatched_does_not_introduce_unknown_ids',unresolved.every(x=>[6879649,12104636].includes(Number(x.osm_relation_id||String(x.id||'').replace(/^osm-r/,'')))),{unresolved_ids:unresolved.map(x=>x.osm_relation_id||x.id)});
const badGeom=(geo.features||[]).filter(f=>!f.geometry||!['Polygon','MultiPolygon'].includes(f.geometry.type)||!Array.isArray(f.geometry.coordinates)||f.geometry.coordinates.length===0).map(f=>f.properties?.catalog_id||f.properties?.id||null);
check('all_md_features_have_polygonal_geometry',badGeom.length===0,{bad_geometry_ids:badGeom});
const edgeUnreviewed=edge.unresolved||edge.unreviewed||edge.review_queue||[];
check('no_unreviewed_edge_cases',Array.isArray(edgeUnreviewed)&&edgeUnreviewed.length===0,{count:Array.isArray(edgeUnreviewed)?edgeUnreviewed.length:null});
const report={schema_version:1,generated_at:new Date().toISOString(),jurisdiction:'MD',status:failures.length?'FAIL':'PASS',policy:'Release gate permits only explicitly documented exception classes and the sole unresolved identity relation 12104636. New exception classes or identities fail the gate.',checks,failures};
await writeFile('data/current/md-release-gate.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
