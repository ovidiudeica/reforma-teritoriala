import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const folder=new URL('./',import.meta.url),load=n=>JSON.parse(readFileSync(new URL(n,folder),'utf8'));
const b=load('all-9275-title-screen.json'),l=load('late-19-title-review.json'),s=load('local-register-sources.json');
const p=new URL('../ni-jur-documentary-supplement-20261021/contemporary-months/census.json.gz',folder);
const original=JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
assert.equal(original.rows.length,9275);
assert.equal(b.checks.unique,9275);assert.equal(b.matches_count,57);
for(const [year,total] of Object.entries({2023:2390,2024:2659,2025:2479,2026:1747})){
 const ids=new Set(original.rows.filter(x=>String(x.year)===year).map(x=>x.publication_id));
 assert.equal(ids.size,total);for(let i=1;i<=total;i++)assert.ok(ids.has(year+String(i).padStart(6,'0')));
}
const filters=Object.entries(b.classification_method.patterns).map(([k,v])=>[k,new RegExp(v,'i')]);
const matches=original.rows.map(x=>({r:x,c:filters.filter(([,p])=>p.test(x.text)).map(([k])=>k)})).filter(x=>x.c.length);
assert.equal(matches.length,b.matches_count);
assert.deepEqual(matches.map(x=>x.r.publication_id),b.role_matches.map(x=>x.id));
assert.deepEqual(matches.map(x=>x.c),b.role_matches.map(x=>x.category_hits));
assert.deepEqual(b.direct_law_phrase_ids,['2026000856','2023000446','2023000445']);
assert.equal(l.publication_ids.length,19);
assert.deepEqual(l.publication_ids.map(x=>x.publication_id),Array.from({length:19},(_,i)=>'202600'+String(1766-i).padStart(4,'0')));
assert.equal(l.observations.direct_ATU_155_amendments_observed_by_title,0);
assert.equal(s.portals.length,7);assert.equal(s.local_grigoriopol.rural_council_document_links_observed,13);
assert.equal(s.verdict,'DISCOVERED_NONEXHAUSTIVE_LOCAL_REGISTERS');
assert.equal(b.verdict,'PASS_FULL_9275_CENTRAL_TITLE_REPLAY_ONLY__CURRENT_NORMATIVE_EXHAUSTIVENESS_BLOCKED');
console.log('PASS NI-ADM.1.1 central title replay, 19 late titles and local registry discovery; normative close remains BLOCKED');
