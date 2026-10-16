import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';

const SOURCE='docs/p9.0.7.2.9-annual-census.json.gz';
const EVIDENCE='docs/p9.0.7.2.9-issuer-parity-evidence.json';
const OUT='docs/p9.0.7.2.10.1-individual-issuers.json.gz';
const MANIFEST='docs/p9.0.7.2.10.1-individual-issuers-manifest.json';
const SOURCE_SHA256='8acc0d75a35f65fdac3e5fa88e04f6ef494f5f89822efa85b8467f2108f0a3ad';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const gitSha1=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const canon=b=>JSON.stringify(b,null,2)+'\n';
const officialPath=u=>{
  const x=new URL(u);
  assert(['www.minjust.gospmr.org','minjust.gospmr.org','minjust.org','www.minjust.org'].includes(x.hostname),'Unexpected official source host');
  const match=x.pathname.toLowerCase().match(/^\/oo\/publication\.nsf\/[a-f0-9]{32}\/([a-f0-9]{32})!opendocument$/);
  assert(match,'Not an official Lotus publication detail URL');
  // Distinct Lotus database replica IDs can refer to the same document UNID.
  return match[1];
};

export function build() {
  const raw=readFileSync(SOURCE);
  assert.equal(sha256(raw),SOURCE_SHA256,'Source archive changed');
  const census=JSON.parse(gunzipSync(raw).toString('utf8'));
  const issuerRaw=readFileSync(EVIDENCE);
  const evidence=JSON.parse(issuerRaw.toString('utf8'));
  assert.equal(evidence.attribution_contract.infer_issuer_from_act_type_allowed,false);
  assert.equal(evidence.directly_verified_official_detail_samples.length,6);
  const samples=new Map();
  for(const s of evidence.directly_verified_official_detail_samples){
    assert(!samples.has(s.publication_id),'Duplicate issuer evidence');
    assert.equal(s.verification,'OFFICIAL_DETAIL_CARD_EXPLICIT_ISSUER');
    assert(s.issuer?.length>3);
    samples.set(s.publication_id,s);
  }
  const records=[];const years={};let verified=0;
  for(const y of [...census.years].sort((a,b)=>a.year-b.year)){
    assert([2023,2024,2025,2026].includes(y.year));
    let n=0,confirmed=0;
    for(const p of [...y.publications].sort((a,b)=>a.publication_id.localeCompare(b.publication_id))){
      assert.equal(p.year,y.year);
      assert(p.publication_id.startsWith(String(y.year)));
      const detail=officialPath(p.source_url);
      const s=samples.get(p.publication_id);
      if(s){
        assert.equal(officialPath(s.source_url),detail,'Issuer proof links to a different official detail');
        confirmed++;verified++;
      }
      records.push({
        publication_id:p.publication_id,
        year:y.year,
        publication_date:p.publication_date,
        official_detail_url:p.source_url,
        issuer_legal_name:s?.issuer??null,
        issuer_authentication_status:s?'OFFICIAL_DETAIL_CARD_EXPLICIT_ISSUER':'PENDING_OFFICIAL_DETAIL_OR_PRIMARY',
        issuer_evidence_url:s?.source_url??null
      });
      n++;
    }
    years[String(y.year)]={rows:n,issuer_verified:confirmed,issuer_pending:n-confirmed};
    assert.equal(n,y.official_year_header_count);
  }
  assert.equal(records.length,9254);
  assert.equal(new Set(records.map(r=>r.publication_id)).size,9254);
  assert.equal(verified,samples.size);
  assert.equal(verified,6);
  assert.equal(records.filter(r=>r.issuer_legal_name===null).length,9248);
  const registry={
    schema_version:'p9072101-individual-issuer-registry-v1',
    source_census:SOURCE,
    source_archive_sha256:SOURCE_SHA256,
    snapshot_cutoff:'2026-10-15',
    issuer_name_must_have_explicit_official_evidence:true,
    act_type_must_not_be_interpreted_as_juridical_issuer:true,
    records
  };
  const plain=Buffer.from(canon(registry),'utf8');
  const compressed=gzipSync(plain,{level:9,mtime:0});
  assert.equal(compressed.subarray(0,3).toString('hex'),'1f8b08');
  // RFC 1952 OS=255 (unknown) is our cross-platform canonical header.
  // Node/zlib otherwise writes OS=10 on Windows and OS=3 on Linux.
  compressed[9]=255;
  const manifest={
    schema_version:'p9072101-individual-issuer-registry-manifest-v1',
    source_census:SOURCE,
    source_archive_sha256:SOURCE_SHA256,
    source_issuer_evidence:EVIDENCE,
    source_issuer_evidence_sha256:sha256(issuerRaw),
    registry_path:OUT,
    registry_gzip_bytes:compressed.length,
    registry_gzip_sha256:sha256(compressed),
    registry_gzip_git_blob_sha1:gitSha1(compressed),
    registry_plain_bytes:plain.length,
    registry_plain_sha256:sha256(plain),
    snapshot_cutoff:'2026-10-15',
    year_counts:years,
    record_count:records.length,
    issuer_evidence_verified_count:verified,
    issuer_pending_count:records.length-verified,
    duplicate_publication_ids:0,
    source_row_url_join_verified:true,
    full_record_level_issuer_attribution_certified:false,
    cross_registry_parity_certified:false,
    global_normative_exhaustiveness_certified:false,
    identities_not_adjudicated:85,
    semantic_acceptance:'BLOCKED_INCOMPLETE',
    p91_import_allowed:false,
    actual_mutation_allowed:false
  };
  return {compressed,manifest,plain};
}

const {compressed,manifest}=build();
if(process.argv.includes('--check')){
  assert.deepEqual(readFileSync(OUT),compressed,'Committed registry gzip is not reproducible from source evidence');
  assert.deepEqual(JSON.parse(readFileSync(MANIFEST,'utf8')),manifest,'Committed manifest is not reproducible');
  console.log('P9072101_REGISTRY_REPRODUCIBILITY_PASS: 9254 unique individual rows; 6 explicit issuer proofs, 9248 pending; fail-closed');
}else{
  writeFileSync(OUT,compressed);
  writeFileSync(MANIFEST,canon(manifest));
  console.log('P9072101_REGISTRY_BUILT: 9254 unique individual rows, 6 authenticated and 9248 pending; gzip '+compressed.length+' bytes; SHA256 '+manifest.registry_gzip_sha256);
}
