import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const m=JSON.parse(fs.readFileSync('docs/audits/rt-adm2-13/alternative-source-manifest.json','utf8'));
assert.equal(m.per_sector.length,6);
const result={schema:'rt-adm2-13-live-extraction-v1',timestamp:new Date().toISOString(),sources:[],per_sector:[],exhaustive:false,ACTUAL_edited:false};
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const strip=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&[a-z]+;/gi,' ').replace(/\s+/g,' ');
for(const s of m.sources){
 let record={id:s.id,url:s.url,status:'UNAVAILABLE',sha256:null,length:0,sections:{}};
 try{const c=new AbortController();const t=setTimeout(()=>c.abort(),20000);let response;try{response=await fetch(s.url,{signal:c.signal,headers:{'User-Agent':'RT-ADM-2.13-public-document-audit/1.0'}})}finally{clearTimeout(t)}
 if(!response.ok)throw Error('HTTP '+response.status);
 const html=await response.text();record.sha256=crypto.createHash('sha256').update(html).digest('hex');record.length=html.length;
 const body=normalize(strip(html));if(body.length<1000)throw Error('BODY_TOO_SHORT');
 if(s.id!=='L2_CONSOLIDATED'){
  const marker=body.lastIndexOf('delimitarea sectoarelor municipiului bucuresti');
  if(marker<0)throw Error('BOUNDARY_MARKER_MISSING');
  const annex=body.slice(marker);const matches=[...annex.matchAll(/(?:^|\s)(?:-|–)?\s*sectorul\s+([1-6])\b/g)].filter(x=>x.index<180000);
  for(let i=0;i<matches.length;i++){const n=Number(matches[i][1]);if(record.sections[n])continue;const end=i+1<matches.length?matches[i+1].index:Math.min(annex.length,matches[i].index+35000);const part=annex.slice(matches[i].index,end).trim();if(part.length>120)record.sections[n]={sha256:crypto.createHash('sha256').update(part).digest('hex'),length:part.length,text:part};}
  record.status=Object.keys(record.sections).length===6?'SIX_SECTIONS_EXTRACTED':'PARTIAL_SECTOR_EXTRACTION';
 }else record.status='TEXT_RETRIEVED_NO_ANNEX_ASSUMED';
 }catch(e){record.status='EXCEPTION_'+String(e.message).slice(0,100);record.network_cause=e.cause?String(e.cause.code||e.cause.message||e.cause):null}result.sources.push(record);
}
for(let sector=1;sector<=6;sector++){
 const x=result.sources[0].sections[sector],y=result.sources[1].sections[sector];
 result.per_sector.push({sector,comparison_status:x&&y?'TEXT_COMPARISON_AVAILABLE':'NOT_COMPARABLE_SOURCE_OR_SECTION_MISSING',normalized_text_equal:x&&y?x.text===y.text:null,legal_boundary_equal:null,missing_sources:[...(!x?['D284_1979']:[]),...(!y?['L2_1981_REPUBLICATION']:[])]});
}
result.evidence_status=result.per_sector.every(x=>x.comparison_status==='TEXT_COMPARISON_AVAILABLE')?'ALL_SIX_TEXT_PAIRS_AVAILABLE':result.sources.every(s=>s.status.startsWith('EXCEPTION_'))?'ALL_OFFICIAL_FETCHES_FAILED':'PARTIAL_OR_INCOMPLETE_EVIDENCE';
fs.mkdirSync('outputs/RT-ADM.2.13',{recursive:true});fs.writeFileSync('outputs/RT-ADM.2.13/extraction-and-comparison.json',JSON.stringify(result,null,2)+'\n');
console.log('EVIDENCE STATUS: '+result.evidence_status);console.log(JSON.stringify({sources:result.sources.map(s=>({id:s.id,status:s.status,sha256:s.sha256})),sectors:result.per_sector.map(x=>({sector:x.sector,status:x.comparison_status,text_equal:x.normalized_text_equal}))},null,2));
assert(result.per_sector.every(x=>x.legal_boundary_equal===null));assert.equal(result.exhaustive,false);
