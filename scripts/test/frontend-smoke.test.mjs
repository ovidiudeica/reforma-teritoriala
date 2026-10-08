import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access,readFile} from 'node:fs/promises';

test('ACTUAL frontend validates current snapshot while tracking published release independently',async()=>{
 const [html,app,manifestText,gateText,buildInfoText]=await Promise.all([
  readFile('index.html','utf8'),
  readFile('app.js','utf8'),
  readFile('data/current/actual-release-manifest.json','utf8'),
  readFile('data/current/actual-release-gate.json','utf8'),
  readFile('public/data/app-build-info.json','utf8')
 ]);
 const manifest=JSON.parse(manifestText);
 const gate=JSON.parse(gateText);
 const buildInfo=JSON.parse(buildInfoText);
 assert.equal(gate.status,'PASS');
 assert.equal(gate.snapshot_id,manifest.snapshot_id);
 assert.ok(['actual-public-entity-v1','actual-public-entity-v2','actual-public-entity-v3'].includes(manifest.public_contract?.contract));
 assert.match(buildInfo.actual_snapshot_id,/^actual-[0-9a-f]{16}$/);
 assert.match(buildInfo.release_fingerprint_sha256,/^[0-9a-f]{64}$/);
 if(buildInfo.actual_snapshot_id===manifest.snapshot_id)assert.equal(buildInfo.release_fingerprint_sha256,manifest.release_fingerprint_sha256);
 assert.match(buildInfo.actual_release_tag,/^actual-v\d+\.\d+\.\d+$/);
 assert.match(buildInfo.app_version,/^web-v\d+(?:\.\d+)*$/);
 assert.match(buildInfo.app_commit,/^[0-9a-f]{40}$/);
 assert.equal(buildInfo.app_version,'web-v1.2.1');
 assert.equal(buildInfo.app_commit,'dd7a3dcb1e50095b56861edb3466a911f7d9cfe4');
 assert.equal(buildInfo.actual_release_tag,'actual-v1.2.0');
 assert.equal(buildInfo.actual_snapshot_id,'actual-a9e5a4ddcb5277ef');
 assert.equal(buildInfo.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
 assert.equal(buildInfo.actual_snapshot_id,manifest.snapshot_id);
 assert.equal(buildInfo.release_fingerprint_sha256,manifest.release_fingerprint_sha256);
 assert.doesNotMatch(app,/Build metadata nu corespunde snapshot-ului ACTUAL/);
 assert.match(app,/ACTUAL curent:/);
 assert.match(app,/publicat:/);
 assert.match(html,/leaflet@1\.9\.4\/dist\/leaflet\.css" integrity="sha256-p4NxAoJBhIIN\+hmNHrzRCf9tD\/miZyoHS5obTRR9BMY=" crossorigin=""/);
 assert.match(html,/leaflet@1\.9\.4\/dist\/leaflet\.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2\/Z9VM\+kNiyxNV1lvTlZBo=" crossorigin=""/);
 assert.doesNotMatch(html,/derivată simplificată/i);
 assert.match(html,/fără simplificare/i);
 assert.match(app,/actual-release-manifest\.json/);
 assert.match(app,/actual-release-gate\.json/);
 assert.match(app,/smoothFactor\s*:\s*0/);
 assert.match(app,/loadChunkIndex/);
 assert.match(app,/bboxIntersectsViewport/);
 assert.match(app,/zoomend moveend/);
 const tiers=manifest.public_contract?.geometry_tiers??{};
 const paths=[];
 for(const jurisdiction of ['RO','MD'])for(const tier of ['overview','local','detail'])paths.push(tiers[jurisdiction]?.[tier]?.path);
 assert.equal(paths.filter(Boolean).length,6);
 await access(manifest.public_contract.path);
 for(const path of paths)await access(path);
 const chunkDescriptor=manifest.public_contract?.geometry_chunks;
 if(chunkDescriptor?.path){
  const chunkIndex=JSON.parse(await readFile(chunkDescriptor.path,'utf8'));
  assert.equal(chunkIndex.contract,'actual-public-geometry-chunks-v1');
  assert.equal(chunkIndex.chunk_count,chunkIndex.chunks.length);
  for(const chunk of chunkIndex.chunks){
   await access(chunk.path);
   const bytes=await readFile(chunk.path);
   assert.equal(bytes.length,chunk.bytes);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),chunk.sha256);
  }
 }
});

test('ACTUAL v3 public contract exposes a consolidated statistical hierarchy when active',async()=>{
 const manifest=JSON.parse(await readFile('data/current/actual-release-manifest.json','utf8'));
 if(manifest.public_contract?.contract!=='actual-public-entity-v3')return;
 const index=JSON.parse(await readFile(manifest.public_contract.path,'utf8'));
 const tree=JSON.parse(await readFile(manifest.public_contract.hierarchy.path,'utf8'));
 assert.equal(index.entity_count,5848);
 assert.equal(index.statistical_only_entity_count,18);
 assert.equal(index.statistical_role_entity_count,63);
 assert.equal(tree.contract,'actual-consolidated-hierarchy-v1');
 assert.equal(tree.node_count,5848);
 assert.deepEqual(tree.root_ids,['osm-r90689','osm-r58974']);
});
