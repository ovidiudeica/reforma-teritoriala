import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublishedWithRetry} from '../audit/helpers/published-runtime.mjs';

const response=status=>({status});

test('transient public HTTP 503 is retried without becoming a PASS itself',async()=>{
 const calls=[];
 const out=await fetchPublishedWithRetry('https://example.test/file',{
  fetcher:async()=>{calls.push(1);return response(calls.length===1?503:200);},
  pause:async()=>{}
 });
 assert.equal(out.response.status,200);
 assert.equal(out.attempts,2);
 assert.deepEqual(out.httpHistory,[503,200]);
});

test('persistent transient HTTP error is returned as failure for strict HTTP 200 caller',async()=>{
 let calls=0;
 const out=await fetchPublishedWithRetry('https://example.test/file',{
  fetcher:async()=>{calls++;return response(503);},
  pause:async()=>{}
 });
 assert.equal(out.response.status,503);
 assert.equal(out.attempts,3);
 assert.deepEqual(out.httpHistory,[503,503,503]);
 assert.equal(calls,3);
});

test('HTTP 404 is not retried or treated as transient',async()=>{
 let calls=0;
 const out=await fetchPublishedWithRetry('https://example.test/missing',{
  fetcher:async()=>{calls++;return response(404);},
  pause:async()=>{}
 });
 assert.equal(out.response.status,404);
 assert.equal(out.attempts,1);
 assert.equal(calls,1);
});

test('nontransient fetch errors propagate without retry',async()=>{
 let calls=0;
 await assert.rejects(()=>fetchPublishedWithRetry('https://example.test/file',{
  fetcher:async()=>{calls++;throw new Error('test integrity error');},
  pause:async()=>{}
 }),/test integrity error/);
 assert.equal(calls,1);
});
