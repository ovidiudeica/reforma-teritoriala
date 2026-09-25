#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const md=(catalog.entities||[]).filter(e=>e.jurisdiction==='MD');
const norm=v=>(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();

const candidates=md.map(e=>{
 const explicit=e.osm?.cuatm_unique_id||e.osm?.cuatm_code||null;
 return {
  id:e.id,name:e.name,parent_id:e.parent_id,admin_level:e.osm?.admin_level??null,
  osm_relation_id:e.osm?.relation_id??null,name_prefix:e.osm?.name_prefix??null,
  full_name:e.osm?.full_name??null,cuatm_code:e.osm?.cuatm_code??null,
  cuatm_unique_id:e.osm?.cuatm_unique_id??null,
  normalized_name:norm(e.name),
  match_status:explicit?'explicit_osm_cuatm_key':'unmatched',
  match_method:explicit?'osm_cuatm_key':null,
  legal_match_confidence:explicit?'candidate':null
 };
});
const out={
 generated_at:new Date().toISOString(),
 classifier_version:catalog.classifier_version||null,
 jurisdiction:'MD',
 official_source:'BNS CUATM',
 policy:'Explicit OSM CUATM identifiers are reconciliation candidates until verified against the official CUATM snapshot. Name-only or fuzzy matches must never assign legal type automatically.',
 entity_count:candidates.length,
 explicit_key_candidates:candidates.filter(x=>x.match_status==='explicit_osm_cuatm_key').length,
 candidates
};
await writeFile('data/current/md-cuatm-reconciliation.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({entity_count:out.entity_count,explicit_key_candidates:out.explicit_key_candidates},null,2));
