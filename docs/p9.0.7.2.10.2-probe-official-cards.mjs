import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {gunzipSync} from 'node:zlib';

const REGISTRY='docs/p9.0.7.2.10.1-individual-issuers.json.gz';
const EXPECTED_SHA256='bedc19ec49d0d22bc737299e14d9b2f7d0761ca8743a51491e73bbcb46ae0e0c';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const args=new Map(process.argv.slice(2).map(x=>{
  const m=x.match(/^--([a-z-]+)(?:=(.*))?$/);
  assert(m,'Options must be --key=value: '+x);
  return [m[1],m[2]??true];
}));
const allow=new Set(['out','year','offset','limit','timeout-ms','external','self-test']);
assert([...args.keys()].every(k=>allow.has(k)),'Unsupported CLI option');
const docUnid=url=>{
  const u=new URL(url);
  assert(['www.minjust.gospmr.org','minjust.gospmr.org','www.minjust.org','minjust.org'].includes(u.hostname),'Only official Ministry publication URLs');
  const m=u.pathname.match(/^\/oo\/Publication\.nsf\/[a-f0-9]{32}\/([a-f0-9]{32})!OpenDocument$/i);
  assert(m,'Malformed official Lotus document URL');
  return m[1].toLowerCase();
};
const officialEndpoints=url=>{
  docUnid(url);
  const first=new URL(url);
  // Domain mirrors are probes, never evidence of identical content without UNID+ID checks.
  const hosts=[first.hostname,'www.minjust.gospmr.org','www.minjust.org'];
  const result=[];
  for(const host of [...new Set(hosts)]){
    const u=new URL(first.href);
    u.protocol='https:';
    u.hostname=host;
    result.push(u.href);
  }
  return result;
};
const number=(key,def,min,max)=>{
  const x=Number(args.get(key)??def);
  assert(Number.isInteger(x)&&x>=min&&x<=max,'Invalid '+key);
  return x;
};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url,timeoutMs) {
  const start=Date.now();
  try {
    const res=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeoutMs),headers:{'user-agent':'reforma-teritoriala-evidence-audit/1.0 (bounded; no automated attribution)','accept':'text/html'}});
    const type=res.headers.get('content-type')??'';
    if(!res.ok)return {url,status:'HTTP_NON_2XX',http_status:res.status,elapsed_ms:Date.now()-start};
    if(!/^text\/html/i.test(type))return {url,status:'NOT_HTML',http_status:res.status,content_type:type,elapsed_ms:Date.now()-start};
    const limit=1024*1024;
    const length=Number(res.headers.get('content-length')??0);
    if(length>limit)return {url,status:'CONTENT_TOO_LARGE',http_status:res.status,bytes_claimed:length};
    const bin=Buffer.from(await res.arrayBuffer());
    if(bin.length>limit)return {url,status:'CONTENT_TOO_LARGE',http_status:res.status,bytes_claimed:bin.length};
    return {url,status:'HTTP_200_HTML',http_status:res.status,content_type:type,elapsed_ms:Date.now()-start,bytes:bin.length,sha256:sha256(bin),raw:bin};
  }catch(e){
    return {url,status:'NETWORK_ERROR',reason:String(e?.name??'network_error'),elapsed_ms:Date.now()-start};
  }
}
async function main(){
  const raw=readFileSync(REGISTRY);
  assert.equal(sha256(raw),EXPECTED_SHA256,'Frozen registry hash drifted');
  const registry=JSON.parse(gunzipSync(raw).toString('utf8'));
  assert.equal(registry.records.length,9254);
  assert.equal(registry.records.filter(r=>r.issuer_legal_name===null).length,9248);
  if(args.has('self-test')){
    assert.equal(docUnid(registry.records[0].official_detail_url).length,32);
    assert(officialEndpoints(registry.records[0].official_detail_url).length>=2);
    assert.throws(()=>docUnid('https://pravopmr.ru/View.aspx?id=abc'));
    console.log('P9072102_PROBE_LOCAL_SELF_TEST_PASS: sources pinned, official-only endpoints, registry 9254, pending 9248');
    return;
  }
  assert(typeof args.get('out')==='string','Provide explicit --out=directory; never write to source checkout by default');
  const folder=resolve(args.get('out'));mkdirSync(folder,{recursive:true});
  const year=number('year',2026,2023,2026);
  const offset=number('offset',0,0,3000);
  const limit=number('limit',6,1,25);
  const timeout=number('timeout-ms',8000,2000,15000);
  const pending=registry.records.filter(r=>r.year===year&&r.issuer_legal_name===null).slice(offset,offset+limit);
  assert(pending.length>0,'Empty selected batch');
  const session={
    schema_version:'p9072102-bounded-official-card-probe-v1',
    provenance:REGISTRY,source_sha256:EXPECTED_SHA256,
    generated_at_utc:new Date().toISOString(),
    year,offset,limit:pending.length,timeout_ms:timeout,
    attribution_promoted:false,certified_issuer_count:0,
    records:[]
  };
  for(const row of pending){
    const attempts=[];
    let captured=false;
    for(const url of officialEndpoints(row.official_detail_url)){
      const resp=await request(url,timeout);
      const {raw, ...a}=resp;
      a.lotus_unid=docUnid(url);
      assert.equal(a.lotus_unid,docUnid(row.official_detail_url));
      if(raw){
        const body=raw.toString('utf8');
        // A page MUST show the exact publication number to qualify as a potential source.
        const exact=new RegExp('(?:Номер\\s+опубликования|№\\s+опубликования)\\s*:?\\s*'+row.publication_id+'(?![0-9])','i');
        a.publication_number_visible=exact.test(body.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' '));
        const leaf=row.publication_id+'-'+a.sha256.slice(0,12)+'.html';
        writeFileSync(join(folder,leaf),raw,{flag:'wx'});
        a.archived_path=leaf;
        a.status=a.publication_number_visible?'ARCHIVED_MATCHED_ID_UNCERTIFIED':'ARCHIVED_ID_NOT_MATCHED_UNCERTIFIED';
        captured=true;
      }
      attempts.push(a);
      if(captured)break;
      await delay(500);
    }
    session.records.push({publication_id:row.publication_id,original_official_url:row.official_detail_url,existing_issuer:null,new_issuer_certified:null,attempts});
    console.log('P9072102_PROBE',row.publication_id,attempts.map(x=>x.status).join(','));
    await delay(500);
  }
  if(args.has('external')){
    // External registry is NON-AUTHENTIC and no pairwise match is asserted here.
    const result=await request('https://pravopmr.ru/',timeout);
    const {raw,...summary}=result;
    if(raw){writeFileSync(join(folder,'pravopmr-external-index.html'),raw,{flag:'wx'});summary.archived_path='pravopmr-external-index.html';}
    session.external_index_probe=summary;
    session.external_pairwise_parity_certified=false;
  }
  const logfile=join(folder,'probe-report.json');
  writeFileSync(logfile,JSON.stringify(session,null,2)+'\n',{flag:'wx'});
  console.log('P9072102_PROBE_FINISHED: '+session.records.length+' attempted, 0 newly certified; report='+logfile);
}
main().catch(e=>{console.error(e);process.exitCode=1});
