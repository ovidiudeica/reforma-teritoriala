import assert from 'node:assert/strict';

// The device must be configured before the document starts, not after load.
export async function navigatePerformanceProfile(page,url,width,height){
 for(const value of [width,height])assert.ok(Number.isSafeInteger(value)&&value>0&&value<=16384,'Invalid performance viewport');
 await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
 const {identifier}=await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"document.addEventListener('DOMContentLoaded',()=>{globalThis.__atlasPerfDocumentViewport={width:innerWidth,height:innerHeight,mobile:matchMedia('(max-width: 899px)').matches};},{once:true});"});
 try{
  await page.navigate(url);
  await page.viewport(width,height);
  const observed=await page.call(function(){return globalThis.__atlasPerfDocumentViewport;});
  assert.deepEqual(observed,{width,height,mobile:width<900},'Viewport at DOMContentLoaded differs from the named load profile');
  return observed;
 }finally{await page.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});}
}
