#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const review=await read('data/current/admin-review.json');
const allowed=await read('data/sources/ro-release-gate-exceptions.json');
const geo=await read('public/geo/current/ro-administrative.geojson');
const catalog=await read('data/current/entities.json');
const semanticEvidence=await read('data/sources/ro-level9-exception-evidence.json');
const failures=[],checks=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)failures.push({name,detail})};
const ro=(review.items||[]).filter(x=>x.jurisdiction==='RO');
const key=x=>String(x.osm_relation_id)+'|'+x.issue;
const expected=new Map((allowed.allowed_review_items||[]).map(x=>[key(x),x]));
const actual=new Map(ro.map(x=>[key(x),x]));
check('no_new_ro_review_exceptions',[...actual.keys()].every(k=>expected.has(k)),{actual:[...actual.keys()]});
check('documented_ro_exception_set_is_stable',[...expected.keys()].every(k=>actual.has(k)),{expected:[...expected.keys()]});
check('documented_exception_classifications_are_stable',ro.every(x=>!expected.has(key(x))||expected.get(key(x)).classification===x.entity_type),{});
const roByRelation=new Map((catalog.entities||[]).filter(x=>x.jurisdiction==='RO').map(x=>[Number(x.osm?.relation_id),x]));
const unresolvedSemantic=(semanticEvidence.items||[]).flatMap(ev=>{
 const entity=roByRelation.get(Number(ev.osm_relation_id));
 const expectedParent=ev.osm_parent_relation_id?`osm-r${ev.osm_parent_relation_id}`:null;
 const ok=entity
  && entity.type===ev.semantic_classification
  && entity.parent_id===expectedParent
  && entity.review_required===false
  && entity.classification?.evidence==='data/sources/ro-level9-exception-evidence.json';
 return ok?[]:[{
  osm_relation_id:ev.osm_relation_id,
  expected_classification:ev.semantic_classification,
  expected_parent_id:expectedParent,
  actual_classification:entity?.type||null,
  actual_parent_id:entity?.parent_id||null,
  review_required:entity?.review_required??null,
  evidence:entity?.classification?.evidence||null
 }];
});
check('audited_ro_level9_semantics_are_encoded',unresolvedSemantic.length===0,{unresolved:unresolvedSemantic});
const bad=(geo.features||[]).filter(f=>!f.geometry||!['Polygon','MultiPolygon'].includes(f.geometry.type)||!Array.isArray(f.geometry.coordinates)||!f.geometry.coordinates.length);
check('all_ro_features_have_polygonal_geometry',bad.length===0,{count:bad.length});
const ungheni=(geo.features||[]).filter(f=>Number(f.properties?.osm_relation_id)===18967922||f.properties?.catalog_id==='osm-r18967922');
check('known_cross_jurisdiction_ungheni_removed',ungheni.length===0,{present:ungheni.length});
const report={schema_version:1,generated_at:new Date().toISOString(),jurisdiction:'RO',status:failures.length?'FAIL':'PASS',policy:'No unresolved RO review exceptions are allowed; audited level-9 semantic classifications must be encoded in the catalog, and known cross-jurisdiction Ungheni contamination is a hard blocker.',checks,failures};
await writeFile('data/current/ro-release-gate.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
