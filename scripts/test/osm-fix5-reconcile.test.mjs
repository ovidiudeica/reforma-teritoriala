import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assessReuse,reconcileTransitions,connectivityWitness,indexRows,sha} from '../lib/osm-fix5-reconcile.mjs';
import {build,manifest,encode} from '../audit/osm-fix5.mjs';
const root=new URL('../../',import.meta.url),j=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const prior=await j('docs/osm-fix3/analysis.json'),base=await j('docs/osm-fix3/baseline.json'),old=(await j('docs/osm-fix4/current-observations.json')).rows,rows=[...(await j('docs/osm-fix5/sources/official-observations.json')).rows,await j('docs/osm-fix5/sources/addition-full.json')];
test('57 official observations reconcile twelve retirements plus one addition, not eleven deleted IDs',()=>{const r=reconcileTransitions(prior,rows,base);assert.equal(r.matrix.length,13);assert.equal(r.accounting.net_deficit,11);assert.equal(r.accounting.exact_oct18_candidate_replayed,false);assert(r.matrix.every(x=>x.legal_identity_status==='UNRESOLVED'));assert(r.addition_graph.geometry_valid);assert.equal(r.successor.verdict,'CARTOGRAPHIC_LINK_SUPPORTED_NOT_LEGAL_SUCCESSION');});
test('all29 inverse/neighbor paths must be identical before reusing conditional simulation',()=>{const r=assessReuse(old,rows);assert.equal(r.paths.length,29);assert(r.unchanged);assert.equal(r.simulation_reexecuted,false);});
for(const [name,mutate]of [
 ['untrusted response URL',r=>r[0].url='https://untrusted.invalid/relation/18966859.json'],
 ['missing HTTP410 witness',r=>r.splice(r.findIndex(x=>x.path==='relation/18966859.json'),1)],
 ['visible terminal history paired with HTTP410',r=>r.find(x=>x.path==='relation/18966859/history.json').elements.at(-1).visible=true],
 ['incomplete history versions',r=>r.find(x=>x.path==='relation/18966859/history.json').elements.splice(1,1)],
 ['historical payload different from accepted bytes',r=>r.find(x=>x.path==='relation/18966859/history.json').elements[3].tags.name='tampered'],
 ['current addition disagrees with history',r=>r.find(x=>x.path==='relation/21515245.json').elements[0].version++],
 ['missing addition node',r=>{const x=r.find(x=>x.path==='relation/21515245/full.json');x.elements.splice(x.elements.findIndex(e=>e.type==='node'),1);}],
 ['addition full graph disagrees with current root version',r=>r.find(x=>x.path==='relation/21515245/full.json').elements.find(e=>e.type==='relation'&&e.id===21515245).version++],
 ['future object timestamp',r=>r.find(x=>x.path==='relation/21515245.json').elements[0].timestamp='2099-01-01T00:00:00Z'],
 ['invalid original digest',r=>r[0].raw_sha256='administrative-pass']
])test('reject '+name,()=>{const r=structuredClone(rows);mutate(r);assert.throws(()=>reconcileTransitions(prior,r,base));});
test('missing inverse evidence cannot reuse a valid historical simulation',()=>assert.throws(()=>assessReuse(old,rows.filter(x=>x.path!=='node/12318728194/ways.json'))));
test('coherent dependency drift requires replay even when target relation/way versions remain unchanged',()=>{
 const r=structuredClone(rows),element=r.find(x=>x.path==='relation/18967493/full.json').elements.find(e=>e.type==='node'),id=element.id;
 for(const row of r)if(!row.path.includes('/history.'))for(const e of row.elements)if(e.type==='node'&&e.id===id){e.lat+=0.000001;e.version++;e.timestamp='2026-10-27T16:00:00Z';}
 const result=assessReuse(old,r);assert.equal(result.unchanged,false);assert(result.replay_required);assert(result.changed_paths.length>0);
});
test('conflicting repeated successful response is rejected',()=>{const r=structuredClone(rows),duplicate=structuredClone(r.find(x=>x.path==='relation/18967493/full.json'));duplicate.elements.find(e=>e.type==='node').lat+=1;r.push(duplicate);assert.throws(()=>indexRows(r));});

test('an immutable node version cannot acquire different coordinates across captures',()=>{
 const r=structuredClone(rows),id=r.find(x=>x.path==='relation/18967493/full.json').elements.find(e=>e.type==='node').id;
 for(const row of r)for(const e of row.elements)if(e.type==='node'&&e.id===id)e.lat+=0.000001;
 assert.throws(()=>assessReuse(old,r),/Immutable OSM version changed payload/);
});
test('unchanged connectivity predates every fresh historical alternative window',()=>{for(const id of [18967493,18968082]){const w=connectivityWitness(rows,id,rows.at(-1).accessed_at);assert(w.current_connectivity_predates_freshness_window);assert(w.connectivity_signature_sha256);}});
test('conditional simulation is not a source or promotion acceptance',async()=>{const r=await build();assert.equal(r['remaining-blockers.json'].flags.OSM_SOURCE_CANDIDATE_VALIDATED,false);assert.equal(r['remaining-blockers.json'].flags.PUBLIC_OSM_EDIT_AUTHORIZED,false);assert.equal(r['promotion-readiness.json'].promotion_ready,false);});
test('registers regenerate byte-identically and preserve32 protected component hashes',async()=>{const a=await build(),b=await build();assert.equal(encode(a),encode(b));for(const [name,value]of Object.entries(a))assert.equal(await readFile(new URL('docs/osm-fix5/'+name,root),'utf8'),encode(value));});
test('frozen manifest rejects missing/tampered evidence, including whitespace-only byte drift',async()=>{const m=await manifest(),saved=await readFile(new URL('docs/osm-fix5/sha256-manifest.json',root),'utf8');assert.equal(saved,encode(m));for(const e of m.files){const bytes=await readFile(new URL(e.path,root));assert.equal(sha(bytes),e.sha256);assert.notEqual(sha(Buffer.concat([bytes,Buffer.from(' ')])),e.sha256);}});
