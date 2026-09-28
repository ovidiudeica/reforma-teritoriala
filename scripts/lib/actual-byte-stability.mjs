import {createHash} from 'node:crypto';

export const ARTIFACT_VOLATILE_KEYS=new Set([
  'generated_at',
  'source_generated_at',
  'applied_at',
  'imported_at'
]);

export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function stripArtifactVolatile(value){
  if(Array.isArray(value))return value.map(stripArtifactVolatile);
  if(value&&typeof value==='object'){
    return Object.fromEntries(
      Object.keys(value)
        .filter(key=>!ARTIFACT_VOLATILE_KEYS.has(key))
        .sort()
        .map(key=>[key,stripArtifactVolatile(value[key])])
    );
  }
  return value;
}

function semanticEqualValue(a,b){
  if(Object.is(a,b))return true;
  if(Array.isArray(a)||Array.isArray(b)){
    if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
    for(let i=0;i<a.length;i++)if(!semanticEqualValue(a[i],b[i]))return false;
    return true;
  }
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
    const ak=Object.keys(a).filter(key=>!ARTIFACT_VOLATILE_KEYS.has(key)).sort();
    const bk=Object.keys(b).filter(key=>!ARTIFACT_VOLATILE_KEYS.has(key)).sort();
    if(ak.length!==bk.length)return false;
    for(let i=0;i<ak.length;i++){
      if(ak[i]!==bk[i]||!semanticEqualValue(a[ak[i]],b[bk[i]]))return false;
    }
    return true;
  }
  return false;
}

export function semanticArtifactEqual(a,b){
  return semanticEqualValue(a,b);
}

function replaceArtifactVolatileInPlace(value,timestamp){
  if(Array.isArray(value)){
    for(const item of value)replaceArtifactVolatileInPlace(item,timestamp);
    return value;
  }
  if(value&&typeof value==='object'){
    for(const [key,item] of Object.entries(value)){
      if(ARTIFACT_VOLATILE_KEYS.has(key)&&typeof item==='string')value[key]=timestamp;
      else replaceArtifactVolatileInPlace(item,timestamp);
    }
  }
  return value;
}

function formatJsonLike(bytes,value){
  const text=Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes);
  const pretty=text.startsWith('{\n')||text.startsWith('[\n');
  const trailingNewline=text.endsWith('\n');
  const serialized=JSON.stringify(value,null,pretty?2:0);
  return Buffer.from(serialized+(trailingNewline?'\n':''));
}

export function stabilizeJsonBytes({baseBytes,currentBytes,stableTimestamp}){
  const baseBuffer=Buffer.from(baseBytes);
  const currentBuffer=Buffer.from(currentBytes);
  if(baseBuffer.equals(currentBuffer)){
    return {
      action:'ALREADY_BASE_BYTES',
      bytes:baseBuffer,
      semantic_equal_to_base:true
    };
  }

  const base=JSON.parse(baseBuffer.toString('utf8'));
  const current=JSON.parse(currentBuffer.toString('utf8'));
  if(semanticArtifactEqual(base,current)){
    return {
      action:'RESTORE_BASE_BYTES',
      bytes:baseBuffer,
      semantic_equal_to_base:true
    };
  }

  replaceArtifactVolatileInPlace(current,stableTimestamp);
  return {
    action:'CANONICALIZE_CHANGED_CONTENT',
    bytes:formatJsonLike(currentBuffer,current),
    semantic_equal_to_base:false
  };
}

export function maxIsoTimestamp(values){
  const valid=(values||[])
    .filter(Boolean)
    .map(value=>new Date(value))
    .filter(value=>Number.isFinite(value.getTime()));
  return (valid.length?new Date(Math.max(...valid.map(value=>value.getTime()))):new Date(0)).toISOString();
}
