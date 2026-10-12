// Raw shared GeoJSON cache. Reading never mounts a Leaflet layer or changes UI state.
const actualPath=path=>/^public\/geo\/actual\/(?:(?:ro|md)-(?:overview|local|detail|statistical)|chunks\/(?:ro|md)\/(?:local|detail)\/osm-r\d+)\.geojson$/.test(path);
export function createGeometryResources({fetch:fetcher=globalThis.fetch,allowPath=actualPath,getDescriptor=()=>null}={}){
 const cache=new Map(),pending=new Map();
 async function read(path){
  if(typeof path!=='string'||/[\r\n]/.test(path)||!allowPath(path))throw Error('Resursă geometrică în afara contractului');
  if(cache.has(path))return cache.get(path);if(pending.has(path))return pending.get(path);
  const request=(async()=>{const response=await fetcher(path,{cache:'no-cache'});if(!response.ok)throw Error('Resursă geometrică indisponibilă');const descriptor=getDescriptor(path);let data;if(descriptor){const raw=await response.text(),bytes=new TextEncoder().encode(raw);if(descriptor.bytes!=null&&bytes.length!==descriptor.bytes)throw Error('Resursă geometrică incompletă');const digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==descriptor.sha256)throw Error('Integritate geometrică neconfirmată');data=JSON.parse(raw);}else data=await response.json();if(!Array.isArray(data?.features))throw Error('Colecție geometrică invalidă');cache.set(path,data);return data;})();
  pending.set(path,request);try{return await request;}finally{pending.delete(path);}
 }
 return {read,invalidate:path=>cache.delete(path),get size(){return cache.size;}};
}
