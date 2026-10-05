import {createHash} from 'node:crypto';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const sha256=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const NAMESPACES={MD:['ref:cuatm:codunic','ref:cuatm:cod','ref:cuatm'],RO:['siruta:code','ref:siruta','siruta','ref:ins:siruta']};
export function authoritativeRegistryScope(relation){
 const evidence=Object.entries(NAMESPACES).flatMap(([country,keys])=>keys.filter(k=>/^\d+$/.test(String(relation?.tags?.[k]||''))).map(key=>({country,key,value:String(relation.tags[key])})));
 const owners=[...new Set(evidence.map(e=>e.country))];
 if(relation?.tags?.boundary!=='administrative'||owners.length!==1)throw Error('OSM cross-country source scope conflict requires review: missing or conflicting authoritative registry namespaces');
 return {country:owners[0],evidence};
}
export async function resolveOsmSourceScopeConflicts({inventories,fetchAuthoritativeRelation,matchesScope=()=>true}){
 const selected=Object.fromEntries(Object.entries(inventories).map(([country,v])=>[country,new Set(v.relation_ids)]));
 const owners=new Map();for(const [country,ids] of Object.entries(selected))for(const id of ids){if(!owners.has(id))owners.set(id,[]);owners.get(id).push(country);}
 const resolutions=[],attempts=[];
 for(const [id,countries] of [...owners].sort((a,b)=>a[0]-b[0])){
  if(countries.length<2)continue;
  const fetched=await fetchAuthoritativeRelation(id);attempts.push(...(fetched.attempts||[]));
  const relation=fetched.raw?.elements?.find(e=>e.type==='relation'&&Number(e.id)===Number(id));
  if(!relation)throw Error('Authoritative OSM source scope collision relation missing '+id);
  const scope=authoritativeRegistryScope(relation),country=scope.country;
  if(!selected[country]?.has(id)||!matchesScope(relation,country))throw Error('Authoritative OSM source scope collision is outside selected owner scope '+id);
  const sourceRelation=inventories[country].raw.elements.find(e=>e.type==='relation'&&Number(e.id)===Number(id));
  if(!sourceRelation||String(sourceRelation.tags?.admin_level)!==String(relation.tags?.admin_level)||JSON.stringify(authoritativeRegistryScope(sourceRelation))!==JSON.stringify(scope))throw Error('Authoritative OSM source scope collision disagrees with snapshot registry evidence '+id);
  const excluded=countries.filter(c=>c!==country);for(const c of excluded)selected[c].delete(id);
  resolutions.push({relation_id:id,selected_jurisdiction:country,excluded_jurisdictions:excluded,registry_namespace_evidence:scope.evidence,authoritative_relation_version:relation.version,authoritative_relation_changeset:relation.changeset,authoritative_full_sha256:sha256(fetched.raw),raw_snapshot_edit:false,coordinate_edit:false,legal_identity_assignment:false,policy:'Resolve only overlapping country source inventories by a unique current authoritative OSM registry namespace. Preserve the raw snapshots and retain the relation in its authoritative owner inventory. Unknown, conflicting or drifting namespace evidence fails closed.'});
 }
 return {relation_ids:Object.fromEntries(Object.entries(selected).map(([country,ids])=>[country,[...ids].sort((a,b)=>a-b)])),resolutions,attempts};
}
