import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {posix} from 'node:path';
test('isolated inventory sources, imported modules and frozen release components select NI-JUR.0 on PR and main push',()=>{
 const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),workflow=read('.github/workflows/ni-jur0-inventory.yml'),generator=read('scripts/audit/ni-jur0-inventory.mjs');
 const files=generator.match(/const files=\{([^\n]+)\};/)[1],inputs=[...files.matchAll(/\w+:'([^']+)'/g)].map(m=>m[1]);
 for(const m of generator.matchAll(/files\.\w+='([^']+)'/g))inputs.push(m[1]);
 inputs.push('atlas-nistrenia-osm.mjs','scripts/audit/helpers/performance-source.mjs','scripts/test/ni-osm-relation.test.mjs','scripts/test/ni-jur0-dependency-coverage.test.mjs','docs/ni-jur0-individual-inventory.json','docs/ni-jur0-inventory-manifest.json');
 const manifest=JSON.parse(read('data/current/actual-release-manifest.json'));for(const c of Object.values(manifest.components))if(c.path&&c.sha256)inputs.push(c.path);
 assert.ok(new Set(inputs).size>=40,'the actual inventory dependencies must be enumerated');
 for(const trigger of ['pull_request','push']){const section=workflow.split('  '+trigger+':')[1].split('\n  push:')[0].split('\npermissions:')[0],patterns=[...section.matchAll(/^\s+- '([^']+)'/gm)].map(m=>m[1]);for(const input of inputs)assert.ok(patterns.some(p=>posix.matchesGlob(input,p)),trigger+' omits '+input);}
});
