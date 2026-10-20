import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {parseFull,polygon,segments} from '../audit/p907218-osm-live-85.mjs';

test('static import performs no fetch and no CLI output even with --audit in argv',()=>{
 const url=new URL('../audit/p907218-osm-live-85.mjs',import.meta.url).href;
 const code=`process.argv.push('--audit');globalThis.fetch=()=>{throw Error('Unexpected network request')};await import(${JSON.stringify(url)});console.log('IMPORT_ONLY');`;
 assert.equal(execFileSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'}).trim(),'IMPORT_ONLY');
});
test('coincident coordinates do not close distinct source node identities',()=>{
 const xml='<osm><node id="1" lat="0" lon="0"/><node id="2" lat="0" lon="1"/><node id="3" lat="1" lon="1"/><node id="4" lat="0" lon="0"/><way id="8"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/></way><relation id="9"><member type="way" ref="8" role="outer"/></relation></osm>';
 const f=parseFull(xml);assert.throws(()=>polygon(f.relations.get('9'),f.ways,f.nodes),/open_ring_outer/);
 const closed=parseFull(xml.replace('<nd ref="4"/>','<nd ref="1"/>'));
 const shape=polygon(closed.relations.get('9'),closed.ways,closed.nodes);assert.equal(segments(shape).lines.length,3);
});
