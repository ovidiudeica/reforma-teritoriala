import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('./ni-fin2-browser.test.mjs',import.meta.url));
for(const mode of ['https://unreviewed.invalid/','published; echo injected','local\npublished','constructor']){
 test('NI acceptance rejects unreviewed target before browser launch: '+JSON.stringify(mode),()=>{
  const result=spawnSync(process.execPath,[entry],{env:{...process.env,NI_FIN_BROWSER_MODE:mode},encoding:'utf8',timeout:15000});
  assert.equal(result.error,undefined);assert.notEqual(result.status,0);
  assert.match(result.stderr,/Unsupported NI acceptance mode/);
 });
}
