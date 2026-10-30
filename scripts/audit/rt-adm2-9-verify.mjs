import fs from 'node:fs';import assert from 'node:assert/strict';
const d=JSON.parse(fs.readFileSync('docs/audits/rt-adm2-9/public-source-recovery.json','utf8'));
assert.equal(d.localities.length,5);assert.equal(d.sectors.length,6);
assert.equal(new Set([...d.localities,...d.sectors].map(x=>x.id)).size,11);
assert(d.localities.every(x=>x.raw_record_checked&&!x.direct_official_binary_certified&&!x.osm_legal_boundary_certified));
assert(d.sectors.every(x=>x.raw_record_checked&&x.siruta_parent_2026==='179132'&&!x.current_official_geometry_identified&&!x.osm_boundary_legal_equivalence_certified));
assert.equal(d.summary.raw_2026_rows_checked,11);assert.equal(d.summary.legal_OSM_boundary_matches,0);
assert(Object.values(d.restrictions).every(x=>x===false));
console.log('RT-ADM.2.9 PASS — 11 raw SIRUTA rows, 6 sector legal descriptions, no legal boundary equivalence');
