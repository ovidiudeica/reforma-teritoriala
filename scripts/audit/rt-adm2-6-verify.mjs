import fs from 'node:fs';import assert from 'node:assert/strict';
const d=JSON.parse(fs.readFileSync('docs/audits/rt-adm2-6/legal-exceptions-resumption.json','utf8'));
assert.equal(d.cases.length,14);assert.deepEqual(d.counts,{total:14,MD:3,RO_localities:5,RO_bucharest_sectors:6});
assert.equal(new Set(d.cases.map(c=>c.id)).size,14);
assert.equal(d.cases.filter(c=>c.cartographic_status==='CLOSED_OSMB_AS_IS_PR471').length,3);
assert(d.cases.every(c=>c.administrative_status==='OPEN_PRIMARY_LEGAL_EVIDENCE'&&!c.legal_boundary_certified&&!c.administrative_change_authorized));
assert(d.no_external_requests_emails_payments&&d.no_actual_edits&&d.p9_1_blocked);
console.log('RT-ADM.2.6 PASS: 14 legal exceptions open; 3 OSMB cartographic closures retained');
