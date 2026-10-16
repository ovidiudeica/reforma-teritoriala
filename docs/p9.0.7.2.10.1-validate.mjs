import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const gitBlobSha1=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const m=read('docs/p9.0.7.2.10.1-individual-issuers-manifest.json');
const old=read('docs/p9.0.7.2.9-issuer-parity-evidence.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');
assert.equal(m.schema_version,'p9072101-individual-issuer-registry-manifest-v1');
assert.equal(m.source_archive_sha256,'8acc0d75a35f65fdac3e5fa88e04f6ef494f5f89822efa85b8467f2108f0a3ad');
assert.equal(m.source_issuer_evidence_sha256,sha256(readFileSync(m.source_issuer_evidence)));
const raw=readFileSync(m.registry_path);
assert.equal(raw.length,m.registry_gzip_bytes);
assert.equal(sha256(raw),m.registry_gzip_sha256);
assert.equal(gitBlobSha1(raw),m.registry_gzip_git_blob_sha1);
const plain=gunzipSync(raw);
assert.equal(plain.length,m.registry_plain_bytes);
assert.equal(sha256(plain),m.registry_plain_sha256);
const registry=JSON.parse(plain.toString('utf8'));
assert.equal(registry.schema_version,'p9072101-individual-issuer-registry-v1');
assert.equal(registry.source_census,m.source_census);
assert.equal(registry.source_archive_sha256,m.source_archive_sha256);
assert.equal(registry.act_type_must_not_be_interpreted_as_juridical_issuer,true);
assert.equal(registry.issuer_name_must_have_explicit_official_evidence,true);

const census=JSON.parse(gunzipSync(readFileSync(m.source_census)).toString('utf8'));
const source=new Map(census.years.flatMap(y=>y.publications.map(r=>[r.publication_id,r])));
assert.equal(source.size,9254);
assert.equal(registry.records.length,9254);
const proof=new Map(old.directly_verified_official_detail_samples.map(s=>[s.publication_id,s]));
assert.equal(proof.size,6);
const unid=u=>{
 const x=new URL(u);
 assert(['www.minjust.gospmr.org','minjust.gospmr.org','minjust.org','www.minjust.org'].includes(x.hostname));
 const match=x.pathname.toLowerCase().match(/^\/oo\/publication\.nsf\/[a-f0-9]{32}\/([a-f0-9]{32})!opendocument$/);
 assert(match);
 return match[1];
};
const validateRecord=(r,ids)=>{
 assert(!ids.has(r.publication_id),'duplicate registry ID');
 ids.add(r.publication_id);
 const s=source.get(r.publication_id);
 assert(s,'registry ID missing from certified source census');
 assert.equal(r.year,s.year);
 assert.equal(r.publication_date,s.publication_date);
 assert.equal(r.official_detail_url,s.source_url);
 const e=proof.get(r.publication_id);
 if(e){
   assert.equal(unid(e.source_url),unid(r.official_detail_url),'issuer evidence UNID conflict');
   assert.equal(r.issuer_legal_name,e.issuer);
   assert.equal(r.issuer_evidence_url,e.source_url);
   assert.equal(r.issuer_authentication_status,'OFFICIAL_DETAIL_CARD_EXPLICIT_ISSUER');
 }else{
   assert.equal(r.issuer_legal_name,null,'issuer inferred without direct evidence');
   assert.equal(r.issuer_evidence_url,null,'unverified issuer has spurious provenance');
   assert.equal(r.issuer_authentication_status,'PENDING_OFFICIAL_DETAIL_OR_PRIMARY');
 }
};
const seen=new Set();
for(const r of registry.records)validateRecord(r,seen);
assert.equal(seen.size,source.size);
assert.deepEqual([...seen].sort(),[...source.keys()].sort());
const verified=registry.records.filter(r=>r.issuer_legal_name!==null);
assert.equal(verified.length,6);
assert.equal(registry.records.length-verified.length,9248);
assert.deepEqual(Object.fromEntries([...new Set(registry.records.map(r=>r.year))].sort().map(y=>[
 String(y),{
   rows:registry.records.filter(r=>r.year===y).length,
   issuer_verified:verified.filter(r=>r.year===y).length,
   issuer_pending:registry.records.filter(r=>r.year===y).length-verified.filter(r=>r.year===y).length
 }
])),m.year_counts);
assert.equal(m.record_count,9254);
assert.equal(m.issuer_evidence_verified_count,6);
assert.equal(m.issuer_pending_count,9248);
assert.equal(m.duplicate_publication_ids,0);
assert.equal(m.source_row_url_join_verified,true);
for(const key of ['full_record_level_issuer_attribution_certified','cross_registry_parity_certified','global_normative_exhaustiveness_certified','p91_import_allowed','actual_mutation_allowed'])assert.equal(m[key],false,key);
assert.equal(m.identities_not_adjudicated,85);
assert.equal(m.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(old.attribution_contract.infer_issuer_from_act_type_allowed,false);
assert.equal(old.parity_result.cross_registry_omissions,null);
assert.equal(old.parity_result.cross_registry_contradictions,null);
assert.equal(old.parity_result.cross_registry_duplicates,null);
assert.throws(()=>validateRecord({...registry.records.find(x=>!proof.has(x.publication_id)),issuer_legal_name:'INFERRED'},new Set()),/inferred without direct evidence/);
assert.throws(()=>validateRecord(registry.records[0],new Set([registry.records[0].publication_id])),/duplicate registry ID/);
const reproducer=spawnSync(process.execPath,['docs/p9.0.7.2.10.1-build-issuer-registry.mjs','--check'],{encoding:'utf8'});
assert.equal(reproducer.status,0,reproducer.stderr||reproducer.stdout);
assert(reproducer.stdout.includes('P9072101_REGISTRY_REPRODUCIBILITY_PASS'));
console.log('P9072101_INDIVIDUAL_ISSUER_REGISTER_FAIL_CLOSED_PASS: 9254 source-joined rows, 6 verified official issuers, 9248 pending, no inferred issuers; binary reproducibility certified; 85 NOT_ADJUDICATED; P9.1 and ACTUAL mutations denied');
