import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {posix} from 'node:path';
test('isolated changes to NI replay dependencies and protected reference inputs select the actual workflow',()=>{
 const text=readFileSync(new URL('../../.github/workflows/ni-independent-evidence.yml',import.meta.url),'utf8');
 const inputs=['scripts/audit/ni-independent-review.mjs','docs/evidence/ni-jur-review-20261021/review.json','docs/evidence/ni-jur-review-regression-20261021/manifest.json','docs/ni-jur-independent-review-20261021.md','scripts/lib/osm-adaptive-transport.mjs','scripts/lib/p82-topology.mjs','scripts/audit/helpers/performance-source.mjs','scripts/audit/p907218-osm-live-85.mjs','scripts/audit/ni-current-preparation.mjs','data/current/actual-release-manifest.json','public/data/actual-entities.json','public/data/p907216-osm-roles.json','public/data/p9095-osm-outlines.json','public/geo/actual/md-detail.geojson','package-lock.json','scripts/process/install-actual-npm-offline.mjs','docs/evidence/ni-jur-current-preparation-20261021/generate.mjs','scripts/test/ni-evidence-dependency-coverage.test.mjs'];
 const release=JSON.parse(readFileSync(new URL('../../data/current/actual-release-manifest.json',import.meta.url),'utf8'));
 for(const component of Object.values(release.components))if(component.path&&component.sha256)inputs.push(component.path);
 for(const trigger of ['pull_request','push']){const section=text.split('  '+trigger+':')[1].split('\n  push:')[0].split('\npermissions:')[0],patterns=[...section.matchAll(/^\s+- '([^']+)'/gm)].map(m=>m[1]);for(const input of inputs)assert.ok(patterns.some(pattern=>posix.matchesGlob(input,pattern)),trigger+' omits '+input);}
});
