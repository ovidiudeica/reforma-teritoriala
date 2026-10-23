import test from 'node:test';
import assert from 'node:assert/strict';
import {navigatePerformanceProfile,navigationFailureEvidence} from '../audit/helpers/performance-navigation.mjs';
import {Page} from './helpers/atlas-browser.mjs';

function brokenPage(){const original=new Error('Timeout: app ready; last=false');return {original,requests:[{url:'https://example.invalid/app.js',method:'GET'}],responses:[{url:'https://example.invalid/app.js',status:503}],failures:[],console:[{type:'error',text:'Failed module import'}],errors:[],externalTileWarnings:[],async send(){return{identifier:'test'};},async navigate(){throw original;}};}
test('failed navigation retains the original exception and exact network evidence',async()=>{
 const page=brokenPage();await assert.rejects(navigatePerformanceProfile(page,'https://example.invalid/',390,844),error=>{assert.equal(error,page.original);assert.deepEqual(error.navigationFailure.responses,page.responses);assert.deepEqual(error.navigationFailure.console,page.console);assert.deepEqual(error.navigationFailure.viewport,{width:390,height:844});return true;});
});
test('closing or later updating the page cannot empty the captured event arrays',()=>{
 const page=brokenPage(),evidence=navigationFailureEvidence(page,'https://example.invalid/',1440,900);
 page.responses.length=0;page.requests.push({url:'later'});assert.equal(evidence.responses.length,1);assert.equal(evidence.requests.length,1);
});
test('the final readiness observation is retained independently of later page updates',()=>{
 const page=brokenPage();page.lastNavigationReadiness={readyState:'interactive',filters:true,tree:true};
 const evidence=navigationFailureEvidence(page,'https://example.invalid/',1440,900);
 page.lastNavigationReadiness.readyState='complete';assert.equal(evidence.readiness.readyState,'interactive');
});
test('cleanup failure cannot mask the original navigation failure',async()=>{
 const page=brokenPage();page.send=async name=>{if(name==='Page.removeScriptToEvaluateOnNewDocument')throw Error('Disconnected during cleanup');return{identifier:'test'};};
 await assert.rejects(navigatePerformanceProfile(page,'https://example.invalid/',1440,900),error=>{assert.equal(error,page.original);assert.match(error.navigationFailure.cleanupError,/Disconnected during cleanup/);return true;});
});
test('infrastructure cleanup errors still fail a successful navigation',async()=>{
 const page=brokenPage();page.navigate=async()=>{};page.viewport=async()=>{};page.call=async()=>({width:1440,height:900,mobile:false});page.send=async name=>{if(name==='Page.removeScriptToEvaluateOnNewDocument')throw Error('Cleanup failure');return{identifier:'test'};};
 await assert.rejects(navigatePerformanceProfile(page,'https://example.invalid/',1440,900),/Cleanup failure/);
});
test('direct Page navigation failures also retain evidence outside performance profiles',async()=>{
 const page=Object.assign(Object.create(Page.prototype),brokenPage());delete page.navigate;
 page.send=async()=>{throw page.original;};
 await assert.rejects(page.navigate('https://example.invalid/'),error=>{assert.equal(error,page.original);assert.deepEqual(error.navigationFailure.responses,page.responses);return true;});
});
