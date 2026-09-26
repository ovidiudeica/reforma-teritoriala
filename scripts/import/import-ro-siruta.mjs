#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const DATASET_IDS=['721c9059-5f87-4c79-9854-a1d5c18f58d5','siruta_s1-2026'];
const CKAN_BASES=['https://data.gov.ro/api/3/action','https://data.gov.ro/ro/api/3/action'];
const INS_ARCGIS='https://webgis.insse.ro/servicii/rest/services/Operational/Localitati/MapServer/0/query';
const SNAPSHOT='data/sources/ro-siruta-current.json';
const EXPECTED_YEAR=2026;

async function fetchCkan(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'user-agent':'reforma-teritoriala-siruta/1.1','accept':'application/json'}});
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
   try{return {pkg:await fetchCkan(url),package_api_url:url};}
   catch(e){errors.push(e.message);}
  }
 }
 throw new Error(errors.join(' | '));
}
function parseCsv(text){
 const firstLine=(text.split(/\r?\n/,1)[0]||'').replace(/^\uFEFF/,'');
 const delimiter=[';',',','\t'].sort((a,b)=>firstLine.split(b).length-firstLine.split(a).length)[0];
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
 if((utf8.match(/\uFFFD/g)||[]).length<5)return {text:utf8,encoding:'utf-8'};
 return {text:new TextDecoder('windows-1250').decode(buf),encoding:'windows-1250'};
}
const clean=v=>String(v??'').replace(/^\uFEFF/,'').trim();
const digits=v=>clean(v).replace(/\.0$/,'').replace(/\s+/g,'');
const normalizeRomanian=v=>clean(v).replaceAll('Ş','Ș').replaceAll('Ţ','Ț').replaceAll('ş','ș').replaceAll('ţ','ț');
const legalTypeFromName=v=>{
 const n=normalizeRomanian(v).toLocaleUpperCase('ro');
 if(/^MUNICIPIUL\s+/.test(n))return 'municipality';
 if(/^ORAȘ(?:UL)?\s+/.test(n))return 'town';
 if(/^(?:BUCUREȘTI\s+)?SECTORUL\s+[1-6]$/.test(n))return 'sector';
 return 'commune';
};
const stripLegalPrefix=v=>normalizeRomanian(v)
 .replace(/^MUNICIPIUL\s+/iu,'')
 .replace(/^ORAȘ(?:UL)?\s+/iu,'')
 .replace(/^BUCUREȘTI\s+(SECTORUL\s+[1-6])$/iu,'$1')
 .trim();

async function fromOfficialCsv(){
 const {pkg,package_api_url}=await discoverPackage();
 const resources=pkg.resources||[];
 const resource=resources.find(r=>String(r.format||'').toLowerCase()==='csv'&&/siruta.*2026/i.test(String(r.name||r.url||'')))
  ||resources.find(r=>String(r.format||'').toLowerCase()==='csv');
 if(!resource?.url)throw new Error('Official SIRUTA package has no CSV resource');
 const resourceUrl=new URL(resource.url,'https://data.gov.ro').href;
 const response=await fetch(resourceUrl,{signal:AbortSignal.timeout(60000),headers:{'user-agent':'reforma-teritoriala-siruta/1.1'}});
 if(!response.ok)throw new Error('SIRUTA CSV download failed: HTTP '+response.status);
 const buffer=Buffer.from(await response.arrayBuffer());
 if(buffer.length<100000)throw new Error('SIRUTA CSV unexpectedly small: '+buffer.length);
 const sha256=createHash('sha256').update(buffer).digest('hex');
 const {text,encoding}=decode(buffer),{delimiter,rows}=parseCsv(text);
 if(rows.length<3000)throw new Error('SIRUTA CSV parse produced too few rows: '+rows.length);
 const headers=(rows[0]||[]).map(x=>clean(x).toUpperCase()),index=name=>headers.indexOf(name);
 const required=['SIRUTA','DENLOC','JUD','SIRSUP','TIP','NIV'];
 const missing=required.filter(x=>index(x)<0);
 if(missing.length)throw new Error('SIRUTA schema missing columns: '+missing.join(', '));
 const records=[];
 for(let i=1;i<rows.length;i++){
  const row=rows[i]||[],siruta=digits(row[index('SIRUTA')]),name=normalizeRomanian(row[index('DENLOC')]);
  if(!/^\d+$/.test(siruta)||!name)continue;
  records.push({
   siruta,name,parent_siruta:digits(row[index('SIRSUP')])||null,type_code:digits(row[index('TIP')])||null,
   level:Number(digits(row[index('NIV')])||0)||null,county_code:digits(row[index('JUD')])||null,
   county_name:null,legal_type:null,
   postal_code:index('CODP')>=0?digits(row[index('CODP')])||null:null,
   environment:index('MED')>=0?digits(row[index('MED')])||null:null,
   region:index('REGIUNE')>=0?digits(row[index('REGIUNE')])||null:null,
   nuts:index('NUTS')>=0?clean(row[index('NUTS')])||null:null
  });
 }
 const byCode=new Map(records.map(x=>[x.siruta,x]));
 for(const r of records){
  r.parent_name=r.parent_siruta?byCode.get(r.parent_siruta)?.name||null:null;
  if(r.level===2){
   r.county_name=r.parent_name;
   r.legal_type=legalTypeFromName(r.name);
   r.name=stripLegalPrefix(r.name);
  }
 }
 return {
  records,
  source:{
   source_type:'official_csv',
   publisher:pkg.organization?.title||'Institutul Național de Statistică',
   dataset_title:pkg.title||'SIRUTA_s1 2026',dataset_id:pkg.id||DATASET_IDS[0],
   dataset_url:'https://data.gov.ro/ro/dataset/siruta_s1-2026',package_api_url,
   resource_id:resource.id||null,resource_name:resource.name||null,resource_url:resourceUrl,
   resource_last_modified:resource.last_modified||resource.created||null,
   license:pkg.license_title||pkg.license_id||'CC BY 4.0',
   content_sha256:sha256,content_bytes:buffer.length,encoding,delimiter
  }
 };
}
async function arcgisPage(offset){
 const params=new URLSearchParams({
  where:'1=1',
  outFields:'objectid,siruta,siruta_sup,denumire,den_superior,judet,cod_jud,loc,tiplocalitate',
  returnGeometry:'false',
  orderByFields:'objectid',
  resultOffset:String(offset),
  resultRecordCount:'2000',
  f:'json'
 });
 const url=INS_ARCGIS+'?'+params;
 const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'user-agent':'reforma-teritoriala-siruta/1.1','accept':'application/json'}});
 if(!r.ok)throw new Error('INS ArcGIS HTTP '+r.status);
 const j=await r.json();
 if(j.error)throw new Error('INS ArcGIS error '+JSON.stringify(j.error));
 return {url,j};
}
async function fromOfficialArcgis(){
 const features=[]; let offset=0;
 for(let page=0;page<20;page++){
  const {j}=await arcgisPage(offset);
  const batch=j.features||[]; features.push(...batch);
  if(!j.exceededTransferLimit&&batch.length<2000)break;
  if(!batch.length)break;
  offset+=batch.length;
 }
 if(features.length<10000)throw new Error('INS ArcGIS Localitati returned too few locality records: '+features.length);
 const nameKey=v=>normalizeRomanian(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro').replace(/[^a-z0-9]+/g,' ').trim();
 const groups=new Map();
 for(const f of features){
  const a=f.attributes||{},siruta=digits(a.siruta_sup),rawParent=normalizeRomanian(a.den_superior),county=normalizeRomanian(a.judet);
  if(!/^\d+$/.test(siruta)||!rawParent)continue;
  if(!groups.has(siruta))groups.set(siruta,{siruta,rawParent,county,countyCode:digits(a.cod_jud)||null,children:[]});
  const g=groups.get(siruta);
  if(g.rawParent!==rawParent||g.county!==county)throw new Error('Conflicting INS ArcGIS UAT identity for SIRUTA '+siruta);
  g.children.push({name:normalizeRomanian(a.denumire),type:normalizeRomanian(a.tiplocalitate),loc:Number(a.loc)||null});
 }
 const seatTypeCounts={};
 const records=[...groups.values()].map(g=>{
  const parentName=stripLegalPrefix(g.rawParent),parentKey=nameKey(parentName);
  const sameNameChildren=g.children.filter(x=>nameKey(x.name)===parentKey);
  const typeLabels=[...new Set(sameNameChildren.map(x=>x.type).filter(Boolean))];
  const allTypeLabels=[...new Set(g.children.map(x=>x.type).filter(Boolean))];
  for(const t of typeLabels)seatTypeCounts[t]=(seatTypeCounts[t]||0)+1;
  const locCodes=new Set(g.children.map(x=>x.loc).filter(Number.isFinite));
  const joined=allTypeLabels.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let legalType=legalTypeFromName(g.rawParent);
  if(/resedinta de municipiu|municipiu/.test(joined))legalType='municipality';
  else if(legalType!=='municipality'&&locCodes.has(1))legalType='town';
  else if(legalType!=='municipality'&&legalType!=='town')legalType='commune';
  return {
   siruta:g.siruta,name:parentName,parent_siruta:null,parent_name:g.county||null,type_code:null,level:2,
   county_code:g.countyCode,county_name:g.county||null,legal_type:legalType,official_parent_label:g.rawParent,
   seat_locality_type_labels:typeLabels,
   uat_locality_type_labels:allTypeLabels,
   uat_locality_type_codes:[...locCodes].sort((a,b)=>a-b)
  };
 }).sort((a,b)=>Number(a.siruta)-Number(b.siruta));
 if(records.length<3100)throw new Error('INS ArcGIS derived too few UAT records: '+records.length);
 const typeCounts=records.reduce((a,x)=>(a[x.legal_type]=(a[x.legal_type]||0)+1,a),{});
 if((typeCounts.commune||0)<2800||(typeCounts.municipality||0)<90||(typeCounts.town||0)<200){
  throw new Error('Unexpected INS ArcGIS UAT type counts: '+JSON.stringify(typeCounts)+'; seat types='+JSON.stringify(seatTypeCounts));
 }
 return {
  records,
  source:{
   source_type:'official_ins_arcgis_siruta_index',
   publisher:'Institutul Național de Statistică',
   dataset_title:'Operational/Localitati — SIRUTA locality registry fields',
   dataset_url:'https://webgis.insse.ro/servicii/rest/services/Operational/Localitati/MapServer/0',
   query_endpoint:INS_ARCGIS,
   query_fields:['siruta','siruta_sup','denumire','den_superior','judet','cod_jud','loc','tiplocalitate'],
   locality_record_count:features.length,
   derived_uat_count:records.length,
   derived_uat_type_counts:typeCounts,
   seat_locality_type_labels:seatTypeCounts,
   license:null,
   note:'UAT identity/type is reconstructed from unique official SIRUTA_SUP + DEN_SUPERIOR + JUDET values. TipLocalitate identifies municipalities; LOC is the official INS Urban/Rural subtype and distinguishes the remaining towns from rural communes. Locality/intravilan geometry is not imported or treated as UAT legal geometry.'
  }
 };
}
let imported,primaryError=null;
try{imported=await fromOfficialCsv();}
catch(e){
 primaryError=e.message;
 console.warn('Official data.gov.ro CSV unavailable; falling back to INS ArcGIS SIRUTA index:',e.message);
 imported=await fromOfficialArcgis();
}
const records=imported.records;
const byCode=new Map();
for(const r of records){
 if(byCode.has(r.siruta))throw new Error('Duplicate SIRUTA code in official snapshot: '+r.siruta);
 byCode.set(r.siruta,r);
}
const levelCounts=records.reduce((a,x)=>(a[String(x.level)]=(a[String(x.level)]||0)+1,a),{});
if((levelCounts['2']||0)<3100)throw new Error('Unexpected SIRUTA UAT count: '+JSON.stringify(levelCounts));
const canonical=JSON.stringify(records);
const semanticSha256=createHash('sha256').update(canonical).digest('hex');
let previous=null;
try{previous=JSON.parse(await readFile(SNAPSHOT,'utf8'));}catch{}
if(previous?.semantic_sha256===semanticSha256){
 console.log(JSON.stringify({status:'UNCHANGED',record_count:previous.record_count,level_counts:previous.level_counts,source_type:imported.source.source_type,semantic_sha256:semanticSha256,primary_error:primaryError},null,2));
 process.exit(0);
}
const snapshot={
 schema_version:1,jurisdiction:'RO',registry:'SIRUTA',reference_year:EXPECTED_YEAR,
 fetched_at:new Date().toISOString(),
 authority:'Institutul Național de Statistică',
 source:imported.source,
 preferred_source:'https://data.gov.ro/ro/dataset/siruta_s1-2026',
 fallback_reason:primaryError,
 semantic_sha256:semanticSha256,
 record_count:records.length,level_counts:levelCounts,records
};
await mkdir('data/sources',{recursive:true});
await writeFile(SNAPSHOT,JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({status:'UPDATED',record_count:records.length,level_counts:levelCounts,source_type:imported.source.source_type,semantic_sha256:semanticSha256,primary_error:primaryError},null,2));
