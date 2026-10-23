import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOsmRelation,osmMembersHash} from '../audit/helpers/ni-osm-relation.mjs';
const xml=body=>'<osm><relation id="1" version="2" timestamp="2026-10-12T20:21:35Z">'+body+'</relation></osm>';
test('OSM aliases decode XML entities exactly once and retain ordered typed members',()=>{
 const r=parseOsmRelation(xml('<tag k="name" v="Rîbnița &amp; &quot;alias&quot; &#x42; &#67; &amp;amp;"/><member type="way" ref="9" role="outer"/><member type="relation" ref="10" role="subarea"/>'),1);
 assert.equal(r.tags.name,'Rîbnița & "alias" B C &amp;');assert.deepEqual(r.members,[{type:'way',ref:'9',role:'outer'},{type:'relation',ref:'10',role:'subarea'}]);assert.notEqual(osmMembersHash(r.members),osmMembersHash([...r.members].reverse()));
});
test('missing, duplicate, deleted and malformed relation identities fail closed',()=>{
 for(const s of [xml('') .replace('id="1"','id="2"'),xml('')+xml(''),xml('').replace('version="2"','version="0"'),xml('').replace('timestamp="2026-10-12T20:21:35Z"','timestamp="2026-99-99T20:21:35Z"'),xml('').replace('version="2"','visible="false" version="2"')])assert.throws(()=>parseOsmRelation(s,1));
});
test('duplicate tags and invalid member references cannot be silently overwritten',()=>{
 for(const body of ['<tag k="name" v="one"/><tag k="name" v="two"/>','<member type="way" ref="../9" role="outer"/>','<member type="invalid" ref="9"/>'])assert.throws(()=>parseOsmRelation(xml(body),1));
});
test('OSM tag names cannot mutate the parser object prototype',()=>{
 const r=parseOsmRelation(xml('<tag k="__proto__" v="literal"/>'),1);assert.equal(Object.getPrototypeOf(r.tags),Object.prototype);assert.equal(r.tags.__proto__,'literal');assert.equal(Object.hasOwn(r.tags,'__proto__'),true);
});
