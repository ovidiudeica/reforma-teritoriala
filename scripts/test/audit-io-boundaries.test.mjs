import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalOsmInteger,osmRelationFullUrl,osmRelationVersionUrl,publishedAuditUrl,historicalAuditOutput} from '../audit/helpers/audit-io-boundaries.mjs';

test('only canonical positive safe OSM integers become URL components',()=>{
 for(const value of [true,false,null,{},[],0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'01',' 9','9 ','1e3','0x20','9/../../','9?x=1','9#x','//127.0.0.1','https://evil.invalid'])assert.throws(()=>canonicalOsmInteger(value));
 assert.equal(canonicalOsmInteger('18967493'),18967493);assert.equal(canonicalOsmInteger(18967493),18967493);
});
test('OSM full endpoints keep two fixed approved origins and exact numeric paths',()=>{
 assert.equal(osmRelationFullUrl('65335'),'https://api.openstreetmap.org/api/0.6/relation/65335/full');
 assert.equal(osmRelationFullUrl('65335',true),'https://www.openstreetmap.org/api/0.6/relation/65335/full');
 assert.equal(osmRelationVersionUrl('65335',6),'https://api.openstreetmap.org/api/0.6/relation/65335/6');
 assert.throws(()=>osmRelationVersionUrl(65335,'6/../../'));
});
test('all eight frozen historical relation URLs remain byte-identical',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../public/data/p9095-osm-outlines-manifest.json',import.meta.url)));
 assert.equal(manifest.relations.length,8);
 for(const row of manifest.relations)assert.equal(osmRelationVersionUrl(row.osm_relation_id,row.relation_version),`https://api.openstreetmap.org/api/0.6/relation/${row.osm_relation_id}/${row.relation_version}`);
});
test('all85 reused OSM roles retain exact full URLs without changing identities',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../../public/data/p907216-osm-roles.json',import.meta.url)));
 assert.equal(catalog.rows.length,85);
 for(const row of catalog.rows){const id=row.osm_relation_id??row.osm_id;assert.equal(osmRelationFullUrl(id),`https://api.openstreetmap.org/api/0.6/relation/${id}/full`);}
});
test('all84 frozen exception relation URLs remain byte-identical',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../docs/p9.0.3-missing-relations.json',import.meta.url)));
 assert.equal(manifest.missing_relations.length,84);
 for(const row of manifest.missing_relations)assert.equal(osmRelationFullUrl(row.id),`https://api.openstreetmap.org/api/0.6/relation/${row.id}/full`);
});
test('published audit returns a fixed literal canonical target',()=>{
 assert.equal(publishedAuditUrl(),'https://ovidiudeica.github.io/reforma-teritoriala/');
 assert.equal(publishedAuditUrl('https://ovidiudeica.github.io:443/reforma-teritoriala/'),publishedAuditUrl());
});
test('published audit refuses alternate origins credentials routes queries and fragments',()=>{
 for(const url of ['http://ovidiudeica.github.io/reforma-teritoriala/','https://ovidiudeica.github.io.evil.invalid/reforma-teritoriala/','https://127.0.0.1/reforma-teritoriala/','https://user@ovidiudeica.github.io/reforma-teritoriala/','https://ovidiudeica.github.io/other/','https://ovidiudeica.github.io/reforma-teritoriala/?a=3','https://ovidiudeica.github.io/reforma-teritoriala/#anything'])assert.throws(()=>publishedAuditUrl(url));
});
test('historical output slots are fixed paths and preserve Linux temporary default',()=>{
 assert.equal(historicalAuditOutput(),path.join(tmpdir(),'web-r2a2'));
 assert.equal(historicalAuditOutput(['--output-slot','temporary']),path.join(tmpdir(),'web-r2a2'));
 assert.equal(historicalAuditOutput(['--output-slot','repository']),fileURLToPath(new URL('../../outputs/WEB-R2a2-historical/',import.meta.url)));
});
test('historical output rejects arbitrary paths traversal and surplus arguments',()=>{
 for(const args of [['/tmp/attacker'],['--output-slot','../..'],['--output-slot','C:\\Windows'],['--output-slot','/etc'],['--output-slot','repository','extra']])assert.throws(()=>historicalAuditOutput(args));
});
