// Copy before closing a failed page. No retry, error filtering or gate changes.
export function navigationFailureEvidence(page,url,width,height){
 const readiness=page.lastNavigationReadiness?{...page.lastNavigationReadiness}:null;
 const evidence={url,viewport:{width:width??readiness?.width??null,height:height??readiness?.height??null},readiness};
 for(const key of ['requests','responses','failures','externalTileWarnings','console','errors'])evidence[key]=Array.isArray(page[key])?[...page[key]]:[];
 return evidence;
}
