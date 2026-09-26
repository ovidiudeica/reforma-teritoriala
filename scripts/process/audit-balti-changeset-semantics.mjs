#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const relationIds=[12207955,18967626],sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchText(url){let last;for(let i=1;i<=3;i++)try{const r=await fetch(url,{headers:{'user-agent':'reforma-teritoriala-balti-semantics-audit/0.1'}});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}catch(e){last=e;if(i<3)await sleep(1500*i)}throw last}
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2].replaceAll('&quot;','"').replaceAll('&amp;','&')]));
function changeset(xml,id){const m=xml.match(/<changeset\b([^>]*)>([\s\S]*?)<\/changeset>/);if(!m)throw new Error('No changeset '+id);const a=attrs(m[1]),tags={};for(const t of m[2].matchAll(/<tag\b([^>]*)\/>/g)){const x=attrs(t[1]);tags[x.k]=x.v}return {changeset_id:id,created_at:a.created_at||null,closed_at:a.closed_at||null,user:a.user||null,uid:a.uid?Number(a.uid):null,changes_count:a.changes_count?Number(a.changes_count):null,tags}}
const history=JSON.parse(await readFile('data/sources/md-osm-multiple-representation-history.json','utf8'));
const ways=JSON.parse(await readFile('data/sources/md-balti-city-boundary-way-history.json','utf8'));
const group=(history.groups||[]).find(g=>g.legal_id==='0300');if(!group)throw new Error('Missing Bălți history group');
const rels=Object.fromEntries(group.relations.filter(r=>relationIds.includes(r.relation_id)).map(r=>[r.relation_id,r]));
const changesetIds=new Set();
for(const id of relationIds){const r=rels[id];changesetIds.add(r.created_changeset);changesetIds.add(r.last_changeset);for(const v of r.versions||[])changesetIds.add(v.changeset)}
for(const id of relationIds)for(const v of ways.relation_history?.[id]||[])changesetIds.add(v.changeset);
for(const wh of Object.values(ways.way_history||{})){changesetIds.add(wh.created_changeset);changesetIds.add(wh.last_changeset)}
changesetIds.delete(null);changesetIds.delete(undefined);
const metadata={};for(const id of [...changesetIds].sort((a,b)=>a-b)){metadata[id]=changeset(await fetchText('https://api.openstreetmap.org/api/0.6/changeset/'+id),id);await sleep(80)}
const semanticKeys=['source','source:geometry','source:date','description','comment','hashtags','locale','created_by'];
const selected=Object.values(metadata).filter(c=>semanticKeys.some(k=>c.tags?.[k])).map(c=>({changeset_id:c.changeset_id,created_at:c.created_at,user:c.user,changes_count:c.changes_count,semantic_tags:Object.fromEntries(semanticKeys.filter(k=>c.tags?.[k]!=null).map(k=>[k,c.tags[k]]))}));
const relSummary=relationIds.map(id=>{const r=rels[id];return {relation_id:id,current_tags:r.current_tags,created_changeset:r.created_changeset,created_changeset_metadata:metadata[r.created_changeset]||null,relation_versions:(r.versions||[]).map(v=>({version:v.version,timestamp:v.timestamp,changeset:v.changeset,changeset_metadata:metadata[v.changeset]||null,tag_changes:v.tag_changes,members:v.members}))}});
const out={schema_version:1,generated_at:new Date().toISOString(),source:'OpenStreetMap API 0.6 relation history, way history and changeset metadata',policy:'Diagnostic only. Changeset comments/source tags are mapper-provided metadata and are evidence of editing intent, not authoritative legal evidence.',relations:relSummary,semantic_changesets:selected,all_changesets:metadata};
await mkdir('data/sources',{recursive:true});await writeFile('data/sources/md-balti-city-boundary-changeset-semantics.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({relations:relSummary.map(r=>({relation_id:r.relation_id,created_changeset:r.created_changeset,current_tags:r.current_tags})),semantic_changeset_count:selected.length,semantic_changesets:selected},null,2));
