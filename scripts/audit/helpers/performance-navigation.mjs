import assert from 'node:assert/strict';
import {navigationFailureEvidence} from '../../test/helpers/navigation-evidence.mjs';
export {navigationFailureEvidence} from '../../test/helpers/navigation-evidence.mjs';

// The device must be configured before the document starts, not after load.
export async function navigatePerformanceProfile(page,url,width,height){
 for(const value of [width,height])assert.ok(Number.isSafeInteger(value)&&value>0&&value<=16384,'Invalid performance viewport');
 await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
 const {identifier}=await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"document.addEventListener('DOMContentLoaded',()=>{globalThis.__atlasPerfDocumentViewport={width:innerWidth,height:innerHeight,mobile:matchMedia('(max-width: 899px)').matches};import('./app.js').then(async module=>{await module.frontendReady;globalThis.__atlasPerfReadyObservedMs=performance.now();});},{once:true});"});
 let failure;
 try{
  await page.navigate(url);
  await page.viewport(width,height);
  const observed=await page.call(function(){return globalThis.__atlasPerfDocumentViewport;});
  assert.deepEqual(observed,{width,height,mobile:width<900},'Viewport at DOMContentLoaded differs from the named load profile');
  return observed;
 }catch(error){
  failure=error instanceof Error?error:new Error(String(error));
  failure.navigationFailure=navigationFailureEvidence(page,url,width,height);
  throw failure;
 }finally{
  try{await page.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});}
  catch(error){if(!failure)throw error;failure.navigationFailure.cleanupError=String(error);}
 }
}
