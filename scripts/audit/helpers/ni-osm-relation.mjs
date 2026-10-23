import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,e)=>e[0]==='#'?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[e]);
export const osmAttributes=s=>Object.fromEntries([...s.matchAll(/([\w:.-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
export const osmMembersHash=members=>createHash('sha256').update(JSON.stringify(members)).digest('hex');
export function parseOsmRelation(xml,id){
 assert.match(String(id),/^[1-9]\d*$/);const matches=[...xml.matchAll(/<relation\b([^>]*?)>([\s\S]*?)<\/relation>/g)].filter(m=>osmAttributes(m[1]).id===String(id));assert.equal(matches.length,1,'Expected exactly one requested OSM relation');
 const a=osmAttributes(matches[0][1]),body=matches[0][2],tags={};assert.notEqual(a.visible,'false');assert.ok(Number.isSafeInteger(Number(a.version))&&Number(a.version)>0);assert.match(a.timestamp,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);assert.ok(Number.isFinite(Date.parse(a.timestamp)),'Invalid OSM timestamp');
 for(const m of body.matchAll(/<tag\s+([^>]*?)\/>/g)){const tag=osmAttributes(m[1]);assert.equal(typeof tag.k,'string');assert.equal(typeof tag.v,'string');assert.ok(!Object.hasOwn(tags,tag.k),'Duplicate OSM tag');Object.defineProperty(tags,tag.k,{value:tag.v,enumerable:true,writable:true,configurable:true});}
 const members=[...body.matchAll(/<member\s+([^>]*?)\/>/g)].map(m=>{const member=osmAttributes(m[1]);assert.ok(['way','node','relation'].includes(member.type));assert.match(member.ref,/^[1-9]\d*$/);return {type:member.type,ref:member.ref,role:member.role||''};});
 return {id:Number(id),version:Number(a.version),timestamp:a.timestamp,tags,members};
}
