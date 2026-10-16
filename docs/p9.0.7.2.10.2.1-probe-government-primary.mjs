import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

const uri='https://government.gospmr.org/wp-content/uploads/2026/01/rasp.-%E2%84%96-1r-ot-12.01.2026g.pdf';
const regFile='docs/p9.0.7.2.10.1-individual-issuers.json.gz';
const regHash='bedc19ec49d0d22bc737299e14d9b2f7d0761ca8743a51491e73bbcb46ae0e0c';
const hash=b=>createHash('sha256').update(b).digest('hex');
const regBytes=readFileSync(regFile);
assert.equal(hash(regBytes),regHash);
const reg=JSON.parse(gunzipSync(regBytes).toString('utf8'));
const publication=reg.records.find(x=>x.publication_id==='2026000001');
assert(publication&&publication.issuer_legal_name===null);
const expected={
 publication_id:'2026000001',
 act_number:'1р',
 signed_date:'12.01.2026',
 issuing_institution_from_primary_header:'Правительство Приднестровской Молдавской Республики',
 expected_title:'Об утверждении состава организационного комитета для проведения республиканского этапа конкурса «Наш город для всех»'
};
assert.deepEqual(new URL(uri).hostname,'government.gospmr.org');
if(process.argv[2]==='--self-test'){
 assert.equal(reg.records.length,9254);
 assert.equal(publication.issuer_authentication_status,'PENDING_OFFICIAL_DETAIL_OR_PRIMARY');
 console.log('P90721021_GOV_PRIMARY_TEST_PASS: official government PDF URL pinned to 2026000001; proof must be byte captured, cannot auto-promote');
 process.exit(0);
}
assert.equal(process.argv[2],'--probe','Usage: --self-test or --probe');
const out='/tmp/p90721021-official-probe';
mkdirSync(out,{recursive:true});
const receipt={
 schema_version:'p90721021-government-primary-binary-capture-v1',
 fetched_at_utc:new Date().toISOString(),
 official_original_url:uri,
 registry_sha256:regHash,
 source_official_publication_url:publication.official_detail_url,
 ...expected,
 raw_original_pdf_sha256:null,
 binary_pdf_available:false,
 verified_against_explicit_primary_header:false,
 issuer_certification_promoted:false,
 issuer_census_complete:false,
 status:'FETCH_NOT_ATTEMPTED',
 semantic_acceptance:'BLOCKED_INCOMPLETE',
 p91_import_allowed:false,
 actual_mutation_allowed:false
};
try{
 const result=await fetch(uri,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'accept':'application/pdf','user-agent':'reforma-teritoriala-P9-legal-primary-probe/1.0'}});
 receipt.http_status=result.status;
 if(result.status===200){
  const bytes=Buffer.from(await result.arrayBuffer());
  if(bytes.length>15_000_000||bytes.subarray(0,5).toString('ascii')!=='%PDF-')receipt.status='NOT_VALID_PDF';
  else{
   receipt.raw_original_pdf_sha256=hash(bytes);
   receipt.raw_original_pdf_bytes=bytes.length;
   receipt.binary_pdf_available=true;
   receipt.archived_file='2026000001-government-original.pdf';
   writeFileSync(join(out,'2026000001-government-original.pdf'),bytes,{flag:'wx'});
   const parsed=spawnSync('pdftotext',['-layout',join(out,'2026000001-government-original.pdf'),'-'],{encoding:'utf8',timeout:5000});
   receipt.pdf_text_extract_success=parsed.status===0;
   if(parsed.status===0){
    const text=parsed.stdout.replace(/\s+/g,' ').trim();
    const title=expected.expected_title.replace(/\s+/g,' ').trim();
    receipt.header_has_government=/ПРАВИТЕЛЬСТВО ПРИДНЕСТРОВСКОЙ МОЛДАВСКОЙ РЕСПУБЛИКИ/i.test(text);
    receipt.header_has_order=/РАСПОРЯЖЕНИЕ/i.test(text);
    receipt.header_has_number=/№\s*1р/i.test(text);
    receipt.header_has_2026_date=/12\s+января\s+2026/i.test(text);
    receipt.header_has_matching_title=text.includes(title);
    receipt.verified_against_explicit_primary_header=receipt.header_has_government&&receipt.header_has_order&&receipt.header_has_number&&receipt.header_has_2026_date&&receipt.header_has_matching_title;
   }
   receipt.status=receipt.verified_against_explicit_primary_header?'RAW_PDF_CAPTURED_HEADER_MATCHED_PENDING_REVIEW':'RAW_PDF_CAPTURED_HEADER_UNCONFIRMED';
  }
 }else receipt.status='HTTP_NON_200';
}catch(e){
 receipt.status='NETWORK_ERROR';
 receipt.error_class=e?.name??'UnknownError';
}
writeFileSync(join(out,'government-primary-report.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log('P90721021_GOV_PRIMARY_REPORT '+JSON.stringify({
 status:receipt.status,http_status:receipt.http_status??null,
 bytes:receipt.raw_original_pdf_bytes??null,
 sha256:receipt.raw_original_pdf_sha256,
 header_verified:receipt.verified_against_explicit_primary_header,
 promoted:receipt.issuer_certification_promoted
}));
