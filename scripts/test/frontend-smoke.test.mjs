import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

test('ACTUAL v1 frontend binds only validated unsimplified release assets',async()=>{
 const [html,app,manifestText,gateText]=await Promise.all([
  readFile('index.html','utf8'),
  readFile('app.js','utf8'),
  readFile('data/current/actual-release-manifest.json','utf8'),
  readFile('data/current/actual-release-gate.json','utf8')
 ]);
 const manifest=JSON.parse(manifestText);
 const gate=JSON.parse(gateText);
 assert.equal(gate.status,'PASS');
 assert.equal(gate.snapshot_id,manifest.snapshot_id);
 assert.equal(manifest.public_contract?.contract,'actual-public-entity-v1');
 assert.match(html,/leaflet@1\.9\.4\/dist\/leaflet\.css" integrity="sha256-p4NxAoJBhIIN\+hmNHrzRCf9tD\/miZyoHS5obTRR9BMY=" crossorigin=""/);
 assert.match(html,/leaflet@1\.9\.4\/dist\/leaflet\.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2\/Z9VM\+kNiyxNV1lvTlZBo=" crossorigin=""/);
 assert.doesNotMatch(html,/derivată simplificată/i);
 assert.match(html,/fără simplificare/i);
 assert.match(app,/actual-release-manifest\.json/);
 assert.match(app,/actual-release-gate\.json/);
 assert.match(app,/smoothFactor\s*:\s*0/);
 const tiers=manifest.public_contract?.geometry_tiers??{};
 const paths=[];
 for(const jurisdiction of ['RO','MD'])for(const tier of ['overview','local','detail'])paths.push(tiers[jurisdiction]?.[tier]?.path);
 assert.equal(paths.filter(Boolean).length,6);
 await access(manifest.public_contract.path);
 for(const path of paths)await access(path);
});
