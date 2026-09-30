import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('ACTUAL dependency policy excludes known vulnerable spreadsheet and XML parser versions',async()=>{
 const [pkgText,lockText]=await Promise.all([
  readFile('package.json','utf8'),
  readFile('package-lock.json','utf8')
 ]);
 const pkg=JSON.parse(pkgText);
 const lock=JSON.parse(lockText);
 assert.equal(pkg.dependencies?.xlsx,undefined);
 assert.equal(pkg.dependencies?.['@stackline/xlsx'],'1.0.9');
 assert.equal(pkg.overrides?.['@xmldom/xmldom'],'0.9.12');
 assert.equal(lock.packages?.['node_modules/xlsx'],undefined);
 assert.equal(lock.packages?.['node_modules/@stackline/xlsx']?.version,'1.0.9');
 assert.equal(lock.packages?.['node_modules/@xmldom/xmldom']?.version,'0.9.12');
});

test('CUATM import uses the hardened workbook parser',async()=>{
 for(const path of ['scripts/import/import-md-cuatm.mjs','scripts/process/inspect-cuatm-workbook.mjs']){
  const content=await readFile(path,'utf8');
  assert.match(content,/from '@stackline\/xlsx'/);
  assert.doesNotMatch(content,/from 'xlsx'/);
 }
});
