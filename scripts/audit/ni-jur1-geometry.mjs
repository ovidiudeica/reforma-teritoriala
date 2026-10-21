import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {generateDossier,validateDossier,digest} from '../lib/ni-jur1-dossier.mjs';
import {performanceSource} from './helpers/performance-source.mjs';
import {fileURLToPath} from 'node:url';
const base=new URL('../../docs/evidence/ni-jur1-geometry-20261021/',import.meta.url),file=new URL('dossier.json',base),manifest=new URL('sha256-manifest.json',base);
if(process.argv.includes('--self-test')){
 const original=JSON.parse(readFileSync(file));validateDossier(original);
 for(const [name,mutate] of [ ['duplicate identity',d=>{d.rows[1]=d.rows[0];}],['missing topology pair',d=>{d.captures.current.pairs.pop();}],['duplicate topology pair',d=>{d.captures.current.pairs[1]=d.captures.current.pairs[0];}],['missing shared frontier',d=>{d.captures.current.frontiers.pop();}],['fabricated frontier',d=>{d.captures.current.frontiers[0].metres=0;}],['geometry drift',d=>{d.rows[0].current_edges_sha256='0'.repeat(64);}],['legal inference',d=>{d.rows[0].legal_or_effective_control_inference=true;}],['false stage acceptance',d=>{d.formal_stage_accepted=true;}],['P9.1 promotion',d=>{d.p91_import_allowed=true;}] ]){const changed=structuredClone(original);mutate(changed);assert.throws(()=>validateDossier(changed),name);console.log('PASS reject '+name);}
}else{
 assert.ok(process.argv.includes('--write')||process.argv.includes('--check'),'Use --write, --check or --self-test');const dossier=generateDossier(),body=JSON.stringify(dossier,null,2)+'\n',m=JSON.stringify({schema:'ni-jur1-derived-manifest-v1',status:'PREPARED_BLOCKED_DEPENDENCIES',file:'dossier.json',bytes:Buffer.byteLength(body),sha256:digest(body),source_manifests:Object.fromEntries(Object.entries(dossier.captures).map(([k,c])=>[k,{path:c.evidence_base,sha256:c.manifest_sha256}])),actual_mutation_allowed:false,p91_import_allowed:false},null,2)+'\n';
 if(process.argv.includes('--write')){mkdirSync(base,{recursive:true});writeFileSync(file,body);writeFileSync(manifest,m);}else{assert.equal(readFileSync(file,'utf8'),body,'Dossier is not byte-reproducible');assert.equal(readFileSync(manifest,'utf8'),m,'Manifest is not byte-reproducible');}
 const verdict={status:'PASS_PREPARATION_ONLY',roles:85,outlines:8,pairs_per_capture:4278,frontiers_per_capture:dossier.captures.current.frontiers.length,dependencies:dossier.captures.current.dependency_counts,dossier_sha256:digest(body),formal_stage_accepted:false};
 if(process.argv.includes('--check')){const source=performanceSource(fileURLToPath(new URL('../../',import.meta.url)));assert.equal(source.trackedSourcesClean,true);const out=new URL('../../outputs/NI-JUR1/',import.meta.url);mkdirSync(out,{recursive:true});writeFileSync(new URL('verdict.json',out),JSON.stringify({...verdict,sourceSha:source.sha,trackedSourcesClean:true,actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'},null,2)+'\n');}
 console.log(JSON.stringify(verdict));
}
