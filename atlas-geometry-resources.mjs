// Raw shared GeoJSON cache. Reading never mounts a Leaflet layer or changes UI state.
export function createGeometryResources({fetch:fetcher=globalThis.fetch}={}){
 const cache=new Map(),pending=new Map();
 async function read(path){
  if(typeof path!=='string'||/[\r\n]/.test(path)||!/^public\/geo\/actual\/(?:(?:ro|md)-(?:overview|local|detail|statistical)|chunks\/(?:ro|md)\/(?:local|detail)\/osm-r\d+)\.geojson$/.test(path))throw Error('Resursă geometrică în afara contractului');
  if(cache.has(path))return cache.get(path);if(pending.has(path))return pending.get(path);
  const request=(async()=>{const response=await fetcher(path,{cache:'no-cache'});if(!response.ok)throw Error('Resursă geometrică indisponibilă');const data=await response.json();if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Colecție geometrică invalidă');cache.set(path,data);return data;})();
  pending.set(path,request);try{return await request;}finally{pending.delete(path);}
 }
 return {read,get size(){return cache.size;}};
}
