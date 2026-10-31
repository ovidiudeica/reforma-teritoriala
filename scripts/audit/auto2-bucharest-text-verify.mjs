import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('../../docs/audits/auto2-bucharest-text-20261031/',import.meta.url);
const j=async p=>JSON.parse(await readFile(new URL(p,dir)));
const check=(v,m)=>{if(!v)throw Error('AUTO-2: '+m)};
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=await j('sha256-manifest.json');
check((await readdir(dir)).length===Object.keys(manifest).length+1,'coverage');
for(const [p,spec] of Object.entries(manifest)){
 check(!p.includes('..')&&!p.includes('/')&&!p.includes('\\'),'unsafe path');
 const b=await readFile(new URL(p,dir));check(sha(b)===spec.sha256&&b.length===spec.bytes,'integrity '+p);
}
const historical=await j('six-historical-routes.json'),comparison=await j('six-route-text-comparison.json');
check(historical.official_original_binary_acquired===false,'binary original must remain uncertified');
check(comparison.actual_modified===false&&comparison.p91_authorized===false,'protected state');
check(historical.records.length===6&&comparison.sectors.length===6,'all six routes');
for(let i=0;i<6;i++){
 const h=historical.records[i],c=comparison.sectors[i];
 check(h.sector===i+1&&c.sector===i+1,'sector identity');
 check(h.full_historical_route_transcription.length>1000&&sha(Buffer.from(h.full_historical_route_transcription))===h.route_transcription_sha256,'historical transcription');
 check(sha(Buffer.from(c.other_form_route_text))===c.other_form_route_sha256,'other transcription');
 check(h.osm_legal_equivalence_certified===false&&h.full_applicable_modifier_chain_certified===false,'legal certification forbidden');
 check(c.legal_effect_of_differences==='NOT_ADJUDICATED'&&c.source_effective_version==='NOT_CERTIFIED','version/effects must stay open');
}
check(comparison.directional_clause_index.length===24,'directional clause coverage');
check(comparison.directional_clause_index.every(x=>x.historical_landmarks_modern_ids.length===0&&x.legal_osmb_match==='NOT_CERTIFIED'),'invented geocoding/certification');
console.log(JSON.stringify({status:'PASS',sectors:6,directional_clauses:24,lexical_difference_groups:comparison.sectors.reduce((n,x)=>n+x.lexical_differences.length,0),legal_certifications:0,actual_modified:false,p91_authorized:false}));
