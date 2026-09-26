#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const DATASET_IDS=['siruta_s1-2026','721c9059-5f87-4c79-9854-a1d5c18f58d5'];
const CKAN_BASES=['https://data.gov.ro/api/3/action','https://data.gov.ro/ro/api/3/action'];
const SNAPSHOT='data/sources/ro-siruta-current.json';
const EXPECTED_YEAR=2026;

async function fetchJson(url){
 const r=await fetch(url,{headers:{'user-agent':'reforma-teritoriala-siruta/1.0','accept':'application/json'}});
 if(!r.ok)throw new Error(url+' HTTP '+r.status);
 const j=await r.json();
 if(!j?.success||!j.result)throw new Error('Invalid CKAN response from '+url);
 return j.result;
}
async function discoverPackage(){
 const errors=[];
 for(const base of CKAN_BASES){
  for(const id of DATASET_IDS){
   const url=base+'/package_show?id='+encodeURIComponent(id);
   try{return {pkg:await fetchJson(url),package_api_url:url};}
   catch(e){errors.push(e.message);}
  }
 }
 throw new Error('Unable to resolve official SIRUTA package: '+errors.join(' | '));
}
function parseCsv(text){
 const firstLine=(text.split(/\r?\n/,1)[0]||'').replace(/^\uFEFF/,'');
 const candidates=[';',',','\t'];
 const delimiter=candidates.sort((a,b)=>firstLine.split(b).length-firstLine.split(a).length)[0];
 const rows=[]; let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){
   if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}
   else if(ch==='"')quoted=false;
   else field+=ch;
  }else{
   if(ch==='"')quoted=true;
   else if(ch===delimiter){row.push(field);field='';}
   else if(ch==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
   else field+=ch;
  }
 }
 if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
 return {delimiter,rows};
}
function decode(buf){
 const utf8=new TextDecoder('utf-8').decode(buf);
 const bad=(utf8.match(/\uFFFD/g)||[]).length;
 if(bad<5)return {text:utf8,encoding:'utf-8'};
 try{
  const win=new TextDecoder('windows-1250').decode(buf);
  return {text:win,encoding:'windows-1250'};
 }catch{return {text:utf8,encoding:'utf-8'};}
}
const clean=v=>String(v??'').replace(/^\uFEFF/,'').trim();
const digits=v=>clean(v).replace(/\.0$/,'').replace(/\s+/g,'');
const nullable=v=>{const s=clean(v);return s===''?null:s;};

const {pkg,package_api_url}=await discoverPackage();
const resources=pkg.resources||[];
const resource=resources.find(r=>String(r.format||'').toLowerCase()==='csv'&&/siruta.*2026/i.test(String(r.name||r.url||'')))
 ||resources.find(r=>String(r.format||'').toLowerCase()==='csv');
if(!resource?.url)throw new Error('Official SIRUTA package has no CSV resource');
const resourceUrl=new URL(resource.url,'https://data.gov.ro').href;
const response=await fetch(resourceUrl,{headers:{'user-agent':'reforma-teritoriala-siruta/1.0'}});
if(!response.ok)throw new Error('SIRUTA CSV download failed: HTTP '+response.status);
const buffer=Buffer.from(await response.arrayBuffer());
if(buffer.length<100000)throw new Error('SIRUTA CSV unexpectedly small: '+buffer.length);
const sha256=createHash('sha256').update(buffer).digest('hex');
const {text,encoding}=decode(buffer);
const {delimiter,rows}=parseCsv(text);
if(rows.length<3000)throw new Error('SIRUTA CSV parse produced too few rows: '+rows.length);
const headers=(rows[0]||[]).map(x=>clean(x).toUpperCase());
const index=name=>headers.indexOf(name);
const required=['SIRUTA','DENLOC','JUD','SIRSUP','TIP','NIV'];
const missing=required.filter(x=>index(x)<0);
if(missing.length)throw new Error('SIRUTA schema missing columns: '+missing.join(', ')+'; headers='+headers.join('|'));

const records=[];
for(let i=1;i<rows.length;i++){
 const row=rows[i]||[];
 const siruta=digits(row[index('SIRUTA')]),name=clean(row[index('DENLOC')]);
 if(!/^\d+$/.test(siruta)||!name)continue;
 records.push({
  siruta,
  name,
  parent_siruta:digits(row[index('SIRSUP')])||null,
  type_code:digits(row[index('TIP')])||null,
  level:Number(digits(row[index('NIV')])||0)||null,
  county_code:digits(row[index('JUD')])||null,
  postal_code:index('CODP')>=0?digits(row[index('CODP')])||null:null,
  environment:index('MED')>=0?digits(row[index('MED')])||null:null,
  region:index('REGIUNE')>=0?digits(row[index('REGIUNE')])||null:null,
  nuts:index('NUTS')>=0?nullable(row[index('NUTS')]):null
 });
}
const byCode=new Map();
for(const r of records){
 if(byCode.has(r.siruta))throw new Error('Duplicate SIRUTA code in official snapshot: '+r.siruta);
 byCode.set(r.siruta,r);
}
for(const r of records)r.parent_name=r.parent_siruta?byCode.get(r.parent_siruta)?.name||null:null;
const levelCounts=records.reduce((a,x)=>(a[String(x.level)]=(a[String(x.level)]||0)+1,a),{});
if((levelCounts['1']||0)<40||(levelCounts['2']||0)<3100)throw new Error('Unexpected SIRUTA hierarchy counts: '+JSON.stringify(levelCounts));

let previous=null;
try{previous=JSON.parse(await readFile(SNAPSHOT,'utf8'));}catch{}
if(previous?.source?.csv_sha256===sha256&&previous?.source?.resource_id===resource.id){
 console.log(JSON.stringify({status:'UNCHANGED',record_count:previous.record_count,level_counts:previous.level_counts,csv_sha256:sha256},null,2));
 process.exit(0);
}
const snapshot={
 schema_version:1,
 jurisdiction:'RO',
 registry:'SIRUTA',
 reference_year:EXPECTED_YEAR,
 fetched_at:new Date().toISOString(),
 source:{
  publisher:pkg.organization?.title||'Institutul Național de Statistică',
  dataset_title:pkg.title||'SIRUTA_s1 2026',
  dataset_id:pkg.id||DATASET_IDS[1],
  dataset_url:'https://data.gov.ro/ro/dataset/siruta_s1-2026',
  package_api_url,
  resource_id:resource.id||null,
  resource_name:resource.name||null,
  resource_url:resourceUrl,
  resource_last_modified:resource.last_modified||resource.created||null,
  license:pkg.license_title||pkg.license_id||null,
  csv_sha256:sha256,
  csv_bytes:buffer.length,
  csv_encoding:encoding,
  csv_delimiter:delimiter
 },
 schema:{
  siruta:'SIRUTA',name:'DENLOC',parent_siruta:'SIRSUP',type_code:'TIP',level:'NIV',county_code:'JUD',
  postal_code:index('CODP')>=0?'CODP':null,environment:index('MED')>=0?'MED':null,region:index('REGIUNE')>=0?'REGIUNE':null,nuts:index('NUTS')>=0?'NUTS':null
 },
 record_count:records.length,
 level_counts:levelCounts,
 records
};
await mkdir('data/sources',{recursive:true});
await writeFile(SNAPSHOT,JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({status:'UPDATED',record_count:records.length,level_counts:levelCounts,resource:resource.name,csv_sha256:sha256},null,2));
