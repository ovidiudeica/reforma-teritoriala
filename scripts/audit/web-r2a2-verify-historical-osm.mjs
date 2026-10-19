#!/usr/bin/env node
// Read-only WEB-R2a.2: fetch the exact OSM relation version, verify tags and provenance.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync('public/data/p9095-osm-outlines-manifest.json','utf8'));
const prior = JSON.parse(readFileSync('docs/evidence/web-r2a2/osm-historical-admin-level.json','utf8'));
const byId = new Map(prior.items.map(x=>[x.relation_id,x]));
if (manifest.relations.length !== 8 || byId.size !== 8) throw Error('Expected eight independent outlines');
const results=[];
let failed=false;
for(const source of manifest.relations){
  const expected=byId.get(source.osm_relation_id);
  if(!expected || expected.version !== source.relation_version || expected.timestamp !== source.relation_timestamp || expected.id !== source.id) throw Error('Pinned identity/version/timestamp mismatch: '+source.id);
  const url=`https://api.openstreetmap.org/api/0.6/relation/${source.osm_relation_id}/${source.relation_version}`;
  const result={id:source.id, relation_id:source.osm_relation_id, version:source.relation_version, expected_admin_level:expected.admin_level_normalized, historical_version_url:url, pinned_full_xml_sha256:source.source_xml_sha256, status:'UNVERIFIED'};
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'Accept':'application/xml','User-Agent':'Reforma-Teritoriala-WEB-R2a2-audit/1.0'}});
    if(!response.ok) throw Error('HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());
    const xml=bytes.toString('utf8');
    const relationTag=xml.match(/<relation\b([^>]*)>/);
    if(!relationTag) throw Error('Missing relation root');
    const attr=(k)=>{const m=relationTag[1].match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"')); return m?.[1];};
    const level=xml.match(/<tag\s+k="admin_level"\s+v="([^"]+)"\s*\/>/)?.[1];
    const boundary=xml.match(/<tag\s+k="boundary"\s+v="([^"]+)"\s*\/>/)?.[1];
    result.xml_sha256=createHash('sha256').update(bytes).digest('hex');
    result.xml_bytes=bytes.length;
    result.observed_relation_id=Number(attr('id'));
    result.observed_version=Number(attr('version'));
    result.observed_timestamp=attr('timestamp');
    result.observed_admin_level=level??null;
    result.observed_boundary=boundary??null;
    const valid=result.observed_relation_id===source.osm_relation_id && result.observed_version===source.relation_version && result.observed_timestamp===source.relation_timestamp && level===String(expected.admin_level_normalized) && boundary==='administrative';
    result.status=valid?'HISTORIC_TAG_VERSION_VERIFIED':'MISMATCH';
    if(!valid)failed=true;
  } catch(e){result.status='FETCH_OR_PARSE_ERROR';result.error=String(e);failed=true;}
  results.push(result);
}
const output={schema:'web-r2a2-raw-historical-version-verification-v1',base_sha:prior.base_sha,note:'The pinned source_xml_sha256 binds /relation/id/full (dependent ways and nodes). A version-specific /relation/id/version XML response is not byte-equivalent to that /full response; hashes must not be compared as if they represented identical resources.',results,verified:!failed};
const dir=resolve(process.argv[2]??'/tmp/web-r2a2');
mkdirSync(dir,{recursive:true});
writeFileSync(resolve(dir,'historical-relation-validation.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({verified:!failed,results:results.map(({relation_id,status,observed_admin_level,xml_sha256})=>({relation_id,status,observed_admin_level,xml_sha256}))},null,2));
if(failed)process.exitCode=1;
