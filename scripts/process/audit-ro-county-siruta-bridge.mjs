#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
const CATALOG='data/current/entities.json', SIRUTA='data/sources/ro-siruta-current.json', OUTPUT='data/current/ro-county-siruta-bridge.json';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^judetul\s+/,'').replace(/municipiul\s+bucuresti/,'bucuresti').replace(/[^a-z0-9]+/g,' ').trim();
const [catalog,snapshot]=await Promise.all([read(CATALOG),read(SIRUTA)]);
const counties=(catalog.entities||[]).filter(e=>e.jurisdiction==='RO'&&Number(e.osm?.admin_level)===4);
const roUat=(snapshot.records||[]).filter(r=>Number(r.level)===2&&r.county_code);
const official=[...new Map(roUat.map(r=>[String(r.county_code),{code:String(r.county_code),name:r.county_name||null}])).values()];
const byName=new Map(); for(const r of official){const k=norm(r.name);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(r);}
const matches=[],issues=[],used=new Set();
for(const e of counties){const candidates=byName.get(norm(e.name))||[];if(candidates.length!==1){issues.push({entity_id:e.id,name:e.name,issue:candidates.length?'ambiguous_official_name':'official_county_missing',candidate_codes:candidates.map(x=>x.code)});continue;}const o=candidates[0];if(used.has(o.code)){issues.push({entity_id:e.id,name:e.name,issue:'duplicate_official_county_code',county_code:o.code});continue;}used.add(o.code);matches.push({entity_id:e.id,osm_relation_id:e.osm.relation_id,osm_name:e.name,county_code:o.code,official_name:o.name,match_method:'exact_normalized_county_name'});}
for(const o of official)if(!used.has(o.code))issues.push({county_code:o.code,name:o.name,issue:'official_county_unmatched'});
if(counties.length!==42)issues.push({issue:'osm_level4_cardinality',expected:42,actual:counties.length}); if(official.length!==42)issues.push({issue:'official_county_cardinality',expected:42,actual:official.length});
const report={schema_version:1,generated_at:new Date().toISOString(),jurisdiction:'RO',registry:'SIRUTA',status:issues.length?'FAIL':'PASS',policy:'Fail-closed 1:1 bridge between current RO admin_level=4 OSM representations and unique SIRUTA county codes using exact normalized county names only; no fuzzy matching.',summary:{osm_level4_count:counties.length,official_county_count:official.length,matched_count:matches.length,issue_count:issues.length},matches,issues};
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(issues.length)process.exit(1);
