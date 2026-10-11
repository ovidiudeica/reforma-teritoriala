import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {auditEvidenceDirectory} from './helpers/atlas-evidence.mjs';

test('hostile output environment cannot redirect audit writes outside their fixed namespace',()=>{
 const expected=auditEvidenceDirectory(),previous=process.env.ATLAS_QA_OUTPUT;assert.ok(path.isAbsolute(expected));assert.equal(path.relative(tmpdir(),expected),'atlas-browser-evidence');
 try{
  for(const value of ['../../outside','/outside','C:\\Windows\\System32','\\\\host\\share','file:///outside']){
   process.env.ATLAS_QA_OUTPUT=value;assert.equal(auditEvidenceDirectory(),expected);
  }
 }finally{if(previous===undefined)delete process.env.ATLAS_QA_OUTPUT;else process.env.ATLAS_QA_OUTPUT=previous;}
});
