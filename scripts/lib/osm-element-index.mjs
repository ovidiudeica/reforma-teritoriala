// Shared OSM identities may overlap across shards; conflicting payloads never win by order.
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
 ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const identity=e=>{
 if(!e||!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||e.id<=0)
  throw new Error('Invalid OSM element identity');
 return `${e.type}/${e.id}`;
};
export function mergeOsmElements(index,elements){
 if(!(index instanceof Map)||!Array.isArray(elements))throw new Error('Invalid OSM element collection');
 for(const element of elements){
  const key=identity(element),previous=index.get(key);
  if(previous&&JSON.stringify(canonical(previous))!==JSON.stringify(canonical(element)))
   throw new Error(`Conflicting OSM element ${key}`);
  if(!previous)index.set(key,element);
 }
 return index;
}
export function osmElementIndex(raw){
 return mergeOsmElements(new Map(),raw?.elements);
}
