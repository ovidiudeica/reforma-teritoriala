import assert from 'node:assert/strict';
const canonical=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])):x);
export function mergeOsmElements(target,elements){
 for(const e of elements){const key=`${e.type}/${e.id}`,old=target.get(key);if(old)for(const field of ['version','timestamp','nodes','members','lat','lon','tags'])if(old[field]!==undefined&&e[field]!==undefined)assert.equal(canonical(old[field]),canonical(e[field]),`Concurrent OSM content/version drift ${key} ${field}`);target.set(key,{...old,...e});}return target;
}
