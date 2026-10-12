import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
import {createPointIdentifier} from '../../atlas-point-identification.mjs';import {pointInGeometry} from '../../atlas-point-geometry.mjs';
const root=new URL('../../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
test('P8.1 verified RO MD results equal exhaustive 123-resource scan',{timeout:120000},async()=>{
 const index=await json('public/data/actual-entities.json'),chunks=await json('public/data/actual-geometry-chunks.json'),manifest=await json('data/current/actual-release-manifest.json'),cache=new Map();let requests=0;
 const read=async p=>{if(!cache.has(p)){requests++;cache.set(p,await json(p));}return cache.get(p);};const engine=createPointIdentifier({entities:index.entities,chunks:chunks.chunks,contract:manifest.public_contract,read});assert.equal(engine.unavailable.length,0);
 const probes=[{p:[23.59,46.77],ids:['osm-r3277038','osm-r90689','osm-r91733','stat-RO1','stat-RO11']},{p:[28.835,47.024],ids:['osm-r1691801','osm-r1748490','osm-r58512','osm-r58974','stat-MD11']}];
 for(const x of probes){const r=await engine.identify(...x.p);assert.equal(r.partial,false);assert.deepEqual(r.matches.map(m=>m.entity.id),x.ids);assert.ok(r.resources.length<=5);const before=requests;await engine.identify(...x.p);assert.equal(requests,before);}
 const full=probes.map(()=>new Set()),seen=new Set(),files=(await readdir(new URL('public/geo/actual/',root),{recursive:true})).filter(p=>p.endsWith('.geojson'));assert.equal(files.length,123);
 for(const p of files){const data=await json('public/geo/actual/'+p.replaceAll('\\','/'));for(const f of data.features){seen.add(f.properties.entity_id);for(let i=0;i<probes.length;i++)if(pointInGeometry(probes[i].p,f.geometry)!=='outside')full[i].add(f.properties.entity_id);}}
 assert.equal(seen.size,5848);for(let i=0;i<probes.length;i++)assert.deepEqual([...full[i]].sort(),probes[i].ids);const before=requests;assert.equal((await engine.identify(0,0)).matches.length,0);assert.equal(requests,before);
});
