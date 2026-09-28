import {createHash} from 'node:crypto';

export const ARTIFACT_VOLATILE_KEYS=new Set([
  'generated_at',
  'source_generated_at',
  'applied_at',
  'imported_at'
]);

export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalize(value[key])]));
  }
  return value;
}

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

export function semanticArtifactEqual(a,b){
  return JSON.stringify(stripArtifactVolatile(a))===JSON.stringify(stripArtifactVolatile(b));
}

export function replaceArtifactVolatile(value,timestamp){
  if(Array.isArray(value))return value.map(item=>replaceArtifactVolatile(item,timestamp));
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[
      key,
      ARTIFACT_VOLATILE_KEYS.has(key)&&typeof item==='string'
        ?timestamp
        :replaceArtifactVolatile(item,timestamp)
    ]));
  }
  return value;
}

export function formatJsonLike(bytes,value){
  const text=Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes);
  const pretty=text.startsWith('{\n')||text.startsWith('[\n');
  const trailingNewline=text.endsWith('\n');
  const serialized=JSON.stringify(canonicalize(value),null,pretty?2:0);
  return Buffer.from(serialized+(trailingNewline?'\n':''));
}

export function stabilizeJsonBytes({baseBytes,currentBytes,stableTimestamp}){
  const base=JSON.parse(Buffer.from(baseBytes).toString('utf8'));
  const current=JSON.parse(Buffer.from(currentBytes).toString('utf8'));
  if(semanticArtifactEqual(base,current)){
    return {
      action:'RESTORE_BASE_BYTES',
      bytes:Buffer.from(baseBytes),
      semantic_equal_to_base:true
    };
  }
  const deterministic=replaceArtifactVolatile(current,stableTimestamp);
  return {
    action:'CANONICALIZE_CHANGED_CONTENT',
    bytes:formatJsonLike(currentBytes,deterministic),
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
