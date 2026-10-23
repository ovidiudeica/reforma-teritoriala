import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function canonicalOsmInteger(value){
 if(!['string','number'].includes(typeof value))throw Error('Invalid canonical OSM integer');
 const number=Number(value);
 if(!Number.isSafeInteger(number)||number<=0||String(number)!==String(value))throw Error('Invalid canonical OSM integer');
 return number;
}
export function osmRelationFullUrl(value,mirror=false){
 const id=canonicalOsmInteger(value);
 return mirror?`https://www.openstreetmap.org/api/0.6/relation/${id}/full`:`https://api.openstreetmap.org/api/0.6/relation/${id}/full`;
}
export function osmRelationVersionUrl(value,version){
 const id=canonicalOsmInteger(value),revision=canonicalOsmInteger(version);
 return `https://api.openstreetmap.org/api/0.6/relation/${id}/${revision}`;
}
export function publishedAuditUrl(value='https://ovidiudeica.github.io/reforma-teritoriala/'){
 const parsed=new URL(value);
 if(parsed.origin!=='https://ovidiudeica.github.io'||parsed.pathname!=='/reforma-teritoriala/'||parsed.username||parsed.password||parsed.search||parsed.hash)throw Error('Refuse non-public or non-baseline audit target');
 return 'https://ovidiudeica.github.io/reforma-teritoriala/';
}
export function historicalAuditOutput(args=[]){
 if(args.length===0)return path.join(tmpdir(),'web-r2a2');
 if(args.length!==2||args[0]!=='--output-slot')throw Error('Use only a named historical audit output slot');
 if(args[1]==='temporary')return path.join(tmpdir(),'web-r2a2');
 if(args[1]==='repository')return fileURLToPath(new URL('../../../outputs/WEB-R2a2-historical/',import.meta.url));
 throw Error('Unknown historical audit output slot');
}
