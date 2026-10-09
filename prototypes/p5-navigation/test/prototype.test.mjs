import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('P5.0 isolated prototype requires no actual geodata, CDN or application hooks',()=>{
 const html=read('index.html'),script=read('app.js'),css=read('style.css');
 assert.match(html,/prototip/i);assert.match(html,/date demonstrative/i);
 assert.doesNotMatch(html,/\bsrc="https?:|\bhref="https?:/i);
 assert.match(html,/id="sidebar"/);assert.match(html,/id="filters"/);assert.match(html,/id="tree"/);assert.match(html,/id="resizer"/);
 assert.match(html,/id="query"/);assert.match(html,/id="detail-name"/);
 assert.doesNotMatch(script,/fetch\s*\(|localStorage|indexedDB|XMLHttpRequest/);
 assert.match(script,/state\.open/);assert.match(script,/visible\(item\)/);
 assert.match(script,/pointermove/);assert.match(script,/ArrowLeft/);
 assert.match(css,/@media\(max-width:900px\)/);
});
test('P5.0 standalone script parses without runtime dependencies',()=>{
 const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../app.js',import.meta.url))],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
