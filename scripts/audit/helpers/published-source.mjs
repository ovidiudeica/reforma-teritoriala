import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

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
