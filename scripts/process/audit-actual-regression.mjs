#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const OUTPUT='data/current/actual-regression-audit.json';
const EXPECTED={RO:3232,MD:2595};
const EXPECTED_TOTAL=5827;
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const blockers=[];
const counts=Object.fromEntries(['RO','MD'].map(j=>[j,(catalog.entities||[]).filter(e=>e.jurisdiction===j).length]));
for(const j of ['RO','MD'])if(counts[j]!==EXPECTED[j])blockers.push({issue:'entity_count_drift',jurisdiction:j,expected:EXPECTED[j],actual:counts[j]});
for(const [j,path] of Object.entries({RO:'public/geo/current/ro-administrative.geojson',MD:'public/geo/current/md-administrative.geojson'})){const doc=JSON.parse(await readFile(path,'utf8'));if((doc.features||[]).length!==EXPECTED[j])blockers.push({issue:'master_feature_count_drift',jurisdiction:j,expected:EXPECTED[j],actual:(doc.features||[]).length});}
const total=counts.RO+counts.MD;if(total!==EXPECTED_TOTAL)blockers.push({issue:'total_entity_count_drift',expected:EXPECTED_TOTAL,actual:total});
const report={schema_version:1,generated_at:new Date().toISOString(),mode:'ACTUAL',status:blockers.length?'FAIL':'PASS',expected_entity_count:EXPECTED_TOTAL,entity_count:total,entity_count_by_jurisdiction:counts,reviewed_topology_normalization_entity_ids:['osm-r12463200'],policy:'Entity and master-feature counts are fail-closed against the reviewed ACTUAL baseline RO=3232, MD=2595, total=5827. The MD baseline includes the five explicitly imported Chișinău sector representations. Exact master-coordinate fidelity and unintended geometry drift are enforced separately by the ACTUAL release gate; osm-r12463200 is the sole reviewed topology normalization currently under validation.',blocking_issue_count:blockers.length,blocking_issues:blockers};
await mkdir('data/current',{recursive:true});await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(blockers.length)process.exit(1);
