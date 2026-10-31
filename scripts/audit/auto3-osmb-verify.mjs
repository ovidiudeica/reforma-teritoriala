// AUTO-3: fail-closed evidence guard. No ACTUAL writes or legal inference.
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=new URL('../../docs/audits/auto3-osmb/',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const j=async p=>JSON.parse(await readFile(new URL(p,dir)));
const fail=m=>{throw Error('AUTO-3: '+m)};
const check=(v,m)=>{if(!v)fail(m)};
const manifest=await j('sha256-manifest.json');
const staged=process.argv.includes('--staged');
const indexBlob=p=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'-C',root,'show',`:docs/audits/auto3-osmb/${p}`],{maxBuffer:200*1024*1024});
if(staged)check(sha(indexBlob('sha256-manifest.json'))===sha(await readFile(new URL('sha256-manifest.json',dir))),'manifest differs from staged bytes');
const files=(await readdir(dir,{recursive:true,withFileTypes:true})).filter(x=>x.isFile()).map(x=>`${x.parentPath??x.path}/${x.name}`);
check(Object.keys(manifest).length+1===files.length,'unmanifested or missing evidence file');
for(const [p,spec] of Object.entries(manifest)){
 check(!p.startsWith('/')&&!p.includes('..')&&!p.includes('\\'),'unsafe evidence path');
 const b=await readFile(new URL(p,dir));check(sha(b)===spec.sha256&&b.length===spec.bytes,'artifact integrity '+p);
 if(staged){const committed=indexBlob(p);check(sha(committed)===spec.sha256&&committed.length===spec.bytes,'staged artifact integrity '+p);}
}
const register=await j('register.json'),baseline=await j('baseline-exceptions.json'),stats=await j('statistics.json');
const records=register.records,ids=new Set(records.map(x=>x.case_id));
const geometries=JSON.parse(gunzipSync(await readFile(new URL('geometry-cases.json.gz',dir))));
check(records.length===298&&ids.size===298,'exact fixed exception coverage');
check(baseline.exception_ids.length===298&&baseline.exception_ids.every(x=>ids.has(x)),'fixed baseline ID drift');
check(register.source_commit===baseline.base_commit,'source commit drift');
check(stats.total===298&&stats.by_jurisdiction.RO.total===154&&stats.by_jurisdiction.MD.total===144,'jurisdiction census');
for(const country of ['RO','MD']){
 const observed={};for(const row of records.filter(x=>x.jurisdiction===country))observed[row.cartographic_status]=(observed[row.cartographic_status]??0)+1;
 for(const [status,n] of Object.entries(stats.by_jurisdiction[country].cartographic_status))check(observed[status]===n,'cartographic statistics drift '+country+' '+status);
}
check(records.filter(x=>x.cartographic_status==='REVIEW_REQUIRED').length===116,'unresolved case coverage after four demonstrated OSM history causes');
for(const [kind,n] of Object.entries({GEOMETRY_DIFFERENCE:13,OSMB_ONLY:283,ACTUAL_ONLY:2}))check(records.filter(x=>x.exception_kind===kind).length===n,'exception kind '+kind);
check(register.policy.actual_mutation_allowed===false&&register.policy.p91_import_allowed===false,'global protection');
const postmerge=await j('auto1-postmerge-ci.json'),postchecks=await j('auto1-postmerge-checks.json');
check(postmerge.runs.length===11&&postmerge.runs.every(x=>x.event==='push'&&x.head_branch==='main'&&x.head_sha===baseline.base_commit&&x.status==='completed'&&x.conclusion==='success'),'AUTO-1 push evidence incomplete');
check(postchecks.total_count===postchecks.checks.length&&postchecks.checks.every(x=>x.head_sha===baseline.base_commit&&x.status==='completed'&&x.conclusion==='success'),'AUTO-1 exact-commit checks incomplete');
for(const name of ['verify-persisted-release','actual-change-reproducibility','actual-release-trust-chain','p2-statistical-foundation','frontend-geometry-taxonomy','frontend-browser-qa'])check(postchecks.checks.some(x=>x.name===name&&x.conclusion==='success'),'AUTO-1 required '+name);
for(const r of records){
 check(r.actual_mutation_allowed===false&&r.p91_import_allowed===false&&r.resolved_globally===false,'protection '+r.case_id);
 check(r.legal_verdict==='NO_NEW_LEGAL_CERTIFICATION','legal overclaim '+r.case_id);
 check(r.category&&r.cause_status&&r.decision&&r.demonstrated_findings.length&&r.hierarchy,'incomplete individual record '+r.case_id);
 if(r.cartographic_status==='REVIEW_REQUIRED')check(r.remaining_evidence.length>0,'unresolved without next evidence '+r.case_id);
 check(r.geometry_bundle==='geometry-cases.json.gz','unrecognized geometry bundle');
 const g=geometries[r.geometry_key];check(g,'missing geometry case '+r.case_id);
 if(r.exception_kind!=='ACTUAL_ONLY')check(g.source.properties.osm_id===r.osm.signed_osmb_id,'source identity '+r.case_id);
 if(r.exception_kind==='GEOMETRY_DIFFERENCE')check(g.actual.properties.entity_id===r.actual_id&&r.geometry.symmetric_difference_m2>0&&g.source_minus_actual&&g.actual_minus_source,'difference evidence '+r.case_id);
 if(r.category==='ALTERNATE_OSM_OBJECT_SAME_CARTOGRAPHIC_FOOTPRINT')check(r.geometry.equal_actual_ids.length>0,'unproven geometry equivalence');
}
const inputs=await j('input-sha256.json');
const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'-C',root,...args],{maxBuffer:200*1024*1024});
for(const [p,spec] of Object.entries(inputs))check(sha(git('show',`HEAD:${p}`))===spec.sha256,'committed source drift '+p);
const protectedDiff=git('diff',baseline.base_commit,'HEAD','--name-only','--','public','data','views','schemas').toString().trim();
check(!protectedDiff,'protected ACTUAL changes in PR: '+protectedDiff);
check(records.find(x=>x.actual_id==='osm-r12104636'&&x.exception_kind==='ACTUAL_ONLY').administrative_verdict==='POSITIVE_IDENTITY_UNRESOLVED','RT-ADM unresolved identity must stay open');
console.log(JSON.stringify({status:'PASS',cases:298,RO:154,MD:144,geometry_differences:13,osmb_only:283,actual_only:2,manifest_files:Object.keys(manifest).length,committed_sources:Object.keys(inputs).length,actual_modified:false,p91_authorized:false}));
