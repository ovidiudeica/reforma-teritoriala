import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../../docs/osm-fix4/',import.meta.url);
test('frozen evidence manifest is complete and byte exact',()=>{
 const manifest=JSON.parse(readFileSync(new URL('manifest-sha256.json',root)));
 for(const row of manifest.files){assert.match(row.path,/^[a-zA-Z0-9.-]+$/);const b=readFileSync(new URL(row.path,root));assert.equal(b.length,row.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),row.sha256);}
});
test('official frozen preflight regenerates identically without approving publication',()=>{
 const before=readFileSync(new URL('preflight.json',root));
 execFileSync(process.execPath,[new URL('../process/audit-osm-fix4-preflight.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')]);
 assert.deepEqual(readFileSync(new URL('preflight.json',root)),before);
 const r=JSON.parse(before);assert.equal(r.CONDITIONAL_SIMULATION_PASS,true);assert.equal(r.PUBLIC_OSM_EDIT_EXECUTED,false);assert.equal(r.publication_eligible,false);
});
