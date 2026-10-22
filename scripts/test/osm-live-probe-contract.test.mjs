import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {posix} from 'node:path';
const text=()=>readFileSync(new URL('../../.github/workflows/osm-live-source-probe.yml',import.meta.url),'utf8');
test('every source acquisition job checks out the exact PR head, never a synthetic merge',()=>{const blocks=[...text().matchAll(/uses: actions\/checkout@[a-f0-9]+[^\n]*\n\s+with:\n([\s\S]*?)(?=\n\s+- |\n\n|$)/g)];assert.equal(blocks.length,4);for(const b of blocks)assert.match(b[1],/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);});
test('isolated importer transport libraries and their regressions trigger the real live probe',()=>{const section=text().split('  pull_request:')[1].split('\npermissions:')[0],patterns=[...section.matchAll(/^\s+- '([^']+)'/gm)].map(m=>m[1]);for(const input of ['scripts/lib/osm-adaptive-transport.mjs','scripts/lib/osm-capture-session.mjs','scripts/test/osm-capture-session.test.mjs','scripts/test/osm-live-probe-contract.test.mjs','scripts/process/restore-osm-capture-checkpoint.mjs'])assert.ok(patterns.some(p=>posix.matchesGlob(input,p)),'pull_request omits '+input);});
