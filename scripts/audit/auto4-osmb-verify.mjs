// Read-only AUTO-4 evidence guard; exactly109 IDs,189 immutable prior decisions.
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const dir=new URL('../../docs/audits/auto4-osmb-109/',import.meta.url);
const read=p=>readFile(new URL(p,dir));
const j=async p=>JSON.parse(await read(p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const check=(v,m)=>{if(!v)throw Error('AUTO-4 '+m)};
const git=(...args)=>execFileSync('git',['-c',`safe.directory=${repo.replaceAll('\\','/')}`,'-C',repo,...args],{encoding:'utf8',maxBuffer:200*1024*1024});
const manifest=await j('sha256-manifest.json');
const files=(await readdir(dir,{recursive:true,withFileTypes:true})).filter(x=>x.isFile());
check(files.length===Object.keys(manifest).length+1,'unmanifested evidence');
for(const [p,s] of Object.entries(manifest)){
 check(!p.includes('..')&&!p.includes('\\')&&!p.startsWith('/'),'unsafe evidence path');
 const b=await read(p);check(hash(b)===s.sha256&&b.length===s.bytes,'SHA256 '+p);
 if(process.argv.includes('--staged')){const b=execFileSync('git',['-c',`safe.directory=${repo.replaceAll('\\','/')}`,'-C',repo,'show',':docs/audits/auto4-osmb-109/'+p],{maxBuffer:200*1024*1024});check(hash(b)===s.sha256,'staged original hash '+p);}
}
const scope=await j('scope.json'),reg=await j('register.json'),stats=await j('statistics.json');
const baselineBytes=await readFile(new URL('../../docs/audits/auto3-osmb/register.json',import.meta.url));
check(hash(baselineBytes)===scope.baseline_register_sha256,'AUTO-3 baseline changed');
const old=JSON.parse(baselineBytes).records;
check(old.filter(r=>r.cartographic_status!=='REVIEW_REQUIRED').length===189,'prior scope');
for(const r of old.filter(r=>r.cartographic_status!=='REVIEW_REQUIRED'))check(/^[0-9a-f]{64}$/.test(scope.preserved_189_record_sha256[r.case_id]),'missing prior record hash '+r.case_id);
const ids=reg.records.map(r=>r.case_id);check(ids.length===109&&new Set(ids).size===109&&scope.target_ids.every(id=>ids.includes(id)),'fixed target scope');
check(stats.by_jurisdiction.RO===10&&stats.by_jurisdiction.MD===99&&stats.full_closures===0,'honest statistics');
for(const r of reg.records){
 check(r.status==='REVIEW_REQUIRED'&&!r.resolved_globally&&!r.legal_geometry_certified&&!r.actual_mutation_allowed&&!r.p91_authorized,'case protection '+r.case_id);
 check(r.missing_evidence.length>=4&&r.missing_evidence.every(x=>x.dimension&&x.required&&x.query),'individual missing evidence '+r.case_id);
 check(r.history.source&&r.original_hierarchy&&r.osm,'provenance '+r.case_id);
 check(manifest[`cases/${r.case_id}.md`],'case report '+r.case_id);
 for(const f of r.findings)for(const p of f.sources)check(p==='../auto3-osmb/register.json'||manifest[p],'missing source '+p);
}
const osm=await j('osm/retrieval.json');let successful=0,histories=0;
for(const r of Object.values(osm))if(r.status===200){
 const b=await read('osm/'+r.file),raw=gunzipSync(b);check(hash(b)===r.compressed_sha256&&hash(raw)===r.sha256&&raw.length===r.bytes,'original OSM response '+r.file);successful++;if(r.kind==='history')histories++;
}
check(successful===214&&histories===109,'original response coverage');
for(const [name,r] of Object.entries(await j('retrieval.json')))if(r.status===200){const b=await read('originals/'+name);check(hash(b)===r.sha256,'official original '+name);if(name.endsWith('.pdf'))check(b.subarray(0,5).toString()==='%PDF-','HTML mislabelled PDF '+name);}
const geometry=await j('geometry-results.json');check(geometry.records.length===109&&geometry.records.every(r=>ids.includes(r.case_id)&&!r.legal_geometry_certified),'geometry coverage');
check(geometry.records.filter(r=>r.current_osm_comparison.equals_archive).length===102,'exact equality statistics');
const protectedPaths=['public','data','views','schemas'];
check(!git('diff','--name-only',scope.protected_tree_baseline,'HEAD','--',...protectedPaths).trim(),'protected committed change');
check(!git('diff','--name-only','HEAD','--',...protectedPaths).trim(),'protected worktree/index change');
console.log(JSON.stringify({status:'PASS',cases:109,preserved:189,original_osm_responses:214,official_binary_hashes:true,actual_changes:0,p91_authorized:false}));
