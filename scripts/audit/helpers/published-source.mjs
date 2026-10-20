import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {performanceSource} from './performance-source.mjs';

export function publishedSourceContext(root,{eventName=process.env.GITHUB_EVENT_NAME,baseSha=process.env.ATLAS_PUBLISHED_BASE_SHA,readSource=performanceSource}={}){
 const auditor=readSource(root);
 if(eventName!=='pull_request')return {auditor,published:auditor,sourceRoot:root,coverage:'PUBLISHED_EXACT_CHECKOUT'};
 assert.match(baseSha??'',/^[a-f0-9]{40}$/,'PR live audit requires an exact published base SHA');
 const sourceRoot=path.join(root,'published-baseline'),published=readSource(sourceRoot);
 assert.equal(published.sha,baseSha,'Published baseline checkout differs from PR base');
 return {auditor,published,sourceRoot,coverage:'PR_PUBLISHED_BASELINE_ONLY'};
}

const files=['index.html','app.js','atlas-panels.mjs','atlas-tree.mjs','atlas-osm-roles.mjs','atlas-nistrenia-outlines.mjs','scripts/audit/web-r2b-final-pages-browser.mjs','data/current/actual-release-manifest.json'];
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyPublishedSource(root,{fetcher=fetch}={}){
 const result=[];
 for(const file of files){
  const published=file.startsWith('public/')?file.slice(7):file;
  const url='https://ovidiudeica.github.io/reforma-teritoriala/'+published;
  const response=await fetcher(url,{cache:'no-store'});assert.equal(response.status,200,'Published source HTTP '+file);
  const remote=Buffer.from(await response.arrayBuffer()),local=await readFile(path.join(root,file));
  const expected=sha256(local),actual=sha256(remote);assert.equal(actual,expected,'Published source differs from checked-out SHA: '+file);
  result.push({file,url,bytes:remote.length,sha256:actual,status:'PASS'});
 }
 return result;
}
