import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {gunzipSync} from 'node:zlib';

const sha256=b=>createHash('sha256').update(b).digest('hex');
const registryPath='docs/p9.0.7.2.10.1-individual-issuers.json.gz';
const expectedSha='bedc19ec49d0d22bc737299e14d9b2f7d0761ca8743a51491e73bbcb46ae0e0c';
const allowHosts=new Set([
 'www.minjust.gospmr.org','minjust.gospmr.org',
 'www.minjust.org','minjust.org',
 'www.justice.idknet.com','justice.idknet.com'
]);
const pilotHosts=['www.justice.idknet.com','www.minjust.gospmr.org','www.minjust.org'];
const pilots=['2023000001','2024000001','2025000001','2026000001','2026000043'];
const UNID=/^\/oo\/Publication\.nsf\/[a-f0-9]{32}\/([a-f0-9]{32})!OpenDocument$/i;
function docId(url){
 const u=new URL(url);
 assert(allowHosts.has(u.hostname),'Unapproved host');
 const m=u.pathname.match(UNID);
 assert(m,'Not an official Lotus publication detail');
 return m[1].toLowerCase();
}
function redirectUrl(url, loc){
 const target=new URL(loc,url);
 assert(target.protocol==='https:'&&allowHosts.has(target.hostname),'Redirect outside allowlisted HTTPS official mirrors');
 return target.href;
}
function asUrl(url,host){
 docId(url);
 const u=new URL(url);
 u.hostname=host;
 u.protocol='https:';
 return u.href;
}
function chosenRows(reg){
 const records=new Map(reg.records.map(x=>[x.publication_id,x]));
 assert.equal(records.size,9254);
 const out=pilots.map(id=>{
  const r=records.get(id);
  assert(r&&r.issuer_legal_name===null,'Pilot must use a pending issuer: '+id);
  return r;
 });
 for(const r of out)assert.equal(docId(r.official_detail_url).length,32);
 return out;
}
async function probe(url,timeoutMs,contentDir=null,id=null){
 const began=Date.now();
 let current=url;
 try {
  for(let hop=0;hop<2;hop++){
   const res=await fetch(current,{
    signal:AbortSignal.timeout(timeoutMs),
    redirect:'manual',
    headers:{'user-agent':'reforma-teritoriala-P9-official-access-pilot/1.0','accept':'text/html'}
   });
   if([301,302,303,307,308].includes(res.status)){
    const loc=res.headers.get('location');
    if(!loc)return {url,status:'REDIRECT_NO_LOCATION',http_status:res.status,elapsed_ms:Date.now()-began};
    current=redirectUrl(current,loc);
    continue;
   }
   if(res.status!==200)return {url,status:'HTTP_NON_200',http_status:res.status,elapsed_ms:Date.now()-began};
   const type=res.headers.get('content-type')??'';
   if(!/text\/html/i.test(type))return {url,status:'NOT_HTML',content_type:type,http_status:res.status};
   if(Number(res.headers.get('content-length')??0)>1200000)return {url,status:'RESPONSE_TOO_LARGE',http_status:res.status};
   const bin=Buffer.from(await res.arrayBuffer());
   if(bin.length>1200000)return {url,status:'RESPONSE_TOO_LARGE',http_status:res.status};
   const result={url,status:'HTML_CAPTURED_UNCERTIFIED',http_status:res.status,
    final_url:current,bytes:bin.length,sha256:sha256(bin),elapsed_ms:Date.now()-began};
   if(id){
    const plaintext=bin.toString('utf8').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ');
    result.exact_publication_id_visible=new RegExp('(?:^|[^0-9])'+id+'(?![0-9])').test(plaintext);
    result.has_issuer_field_label=/Принявший\s+орган|Орган\s*,?\s*принявший|Издавший\s+орган|Орган\s+издания/i.test(plaintext);
    result.pilot_unid=docId(url);
   }
   if(contentDir){
    const file=(id??'index')+'-'+new URL(current).hostname+'-'+result.sha256.slice(0,12)+'.html';
    writeFileSync(join(contentDir,file),bin,{flag:'wx'});
    result.archived_bytes=file;
   }
   return result;
  }
  return {url,status:'TOO_MANY_REDIRECTS',elapsed_ms:Date.now()-began};
 }catch(e){
  return {url,status:'NETWORK_ERROR',error_class:e?.name??'UnknownError',elapsed_ms:Date.now()-began};
 }
}
async function main(){
 assert(['--self-test','--probe'].includes(process.argv[2]),'Use --self-test or --probe');
 const source=readFileSync(registryPath);
 assert.equal(sha256(source),expectedSha);
 const reg=JSON.parse(gunzipSync(source).toString('utf8'));
 const rows=chosenRows(reg);
 if(process.argv[2]==='--self-test'){
  assert.equal(rows.length,5);
  assert.equal(docId(asUrl(rows[0].official_detail_url,'www.justice.idknet.com')),docId(rows[0].official_detail_url));
  assert.throws(()=>redirectUrl('https://www.minjust.org/a','https://evil.example/x'));
  assert.throws(()=>docId('https://pravopmr.ru/'));
  console.log('P90721021_OFFICIAL_MIRROR_POLICY_PASS: 9254 source-joined, 5 pending pilot identities, allowlisted official URLs, no cross-host redirects');
  return;
 }
 const timeoutMs=3500;
 const output=resolve(process.env.P90721021_PROBE_OUT||'/tmp/p90721021-official-probe');
 mkdirSync(output,{recursive:true});
 const report={
  schema_version:'p90721021-ci-official-source-access-probe-v1',
  generated_utc:new Date().toISOString(),
  source_sha256:expectedSha,source_records:9254,previously_verified_issuer_count:6,pending_issuers:9248,
  hypotheses:[
   {host:'www.justice.idknet.com',source:'Ministry legacy domain indexed with publication2 2023-2026, not yet confirmed for individual cards'},
   {host:'www.minjust.gospmr.org',source:'Current Ministry listed domain'},
   {host:'www.minjust.org',source:'Ministry alternative domain'}
  ],
  timeout_per_request_ms:timeoutMs,
  probes:[],
  newly_certified_issuers:0,
  certified_official_card_access:false,
  full_issuer_census_certified:false,
  cross_registry_parity_certified:false,
  semantic_acceptance:'BLOCKED_INCOMPLETE',
  p91_import_allowed:false,actual_mutation_allowed:false
 };
 for(const host of pilotHosts){
  const url='https://'+host+'/web.nsf/all/publication';
  const result=await probe(url,timeoutMs,output);
  report.probes.push({kind:'INDEX_REACHABILITY_ONLY',host,...result});
  console.log('P90721021_INDEX',host,result.status,result.http_status??'',result.sha256??'');
 }
 for(const row of rows){
  for(const host of pilotHosts){
   const url=asUrl(row.official_detail_url,host);
   const result=await probe(url,timeoutMs,output,row.publication_id);
   report.probes.push({kind:'OFFICIAL_DETAIL',publication_id:row.publication_id,expected_unid:docId(row.official_detail_url),host,...result});
   console.log('P90721021_DETAIL',row.publication_id,host,result.status,result.http_status??'',result.sha256??'');
   if(result.status==='HTML_CAPTURED_UNCERTIFIED'&&result.exact_publication_id_visible===true)report.certified_official_card_access=true;
  }
 }
 report.probe_count=report.probes.length;
 report.index_http_200_count=report.probes.filter(x=>x.kind==='INDEX_REACHABILITY_ONLY'&&x.http_status===200).length;
 report.detail_html_recovered_count=report.probes.filter(x=>x.kind==='OFFICIAL_DETAIL'&&x.status==='HTML_CAPTURED_UNCERTIFIED').length;
 report.detail_id_matched_count=report.probes.filter(x=>x.kind==='OFFICIAL_DETAIL'&&x.exact_publication_id_visible===true).length;
 writeFileSync(join(output,'access-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('P90721021_ACCESS_REPORT '+JSON.stringify({
  count:report.probe_count,
  index200:report.index_http_200_count,
  detail_html:report.detail_html_recovered_count,
  exact_id_matches:report.detail_id_matched_count,
  authenticated_issuers:report.newly_certified_issuers,
  stable_access_proven:report.certified_official_card_access
 }));
}
main().catch(e=>{console.error(e);process.exitCode=1});
