// Only these committed contracts may be selected by the network-enabled tooling.
// Return literals rather than passing environment/manifest strings to file APIs.
export function osmManifestPath(value='data/sources/osm-current.json') {
 switch(value){
 case 'data/sources/osm-current.json': return 'data/sources/osm-current.json';
 case 'data/sources/osm-source-current.json': return 'data/sources/osm-source-current.json';
 default: throw new Error('Forbidden OSM manifest path');
 }
}
export function osmEvidencePath(value,kind){
 const allowed={policy:'data/sources/osm-source-transition-policy.json',continuity:'outputs/osm-source-continuity.json',transition:'outputs/osm-fix2-source-transition.json',forensics:'outputs/osm-fix2-per-id-forensics.json'};
 if(!Object.hasOwn(allowed,kind)||value!==allowed[kind])throw new Error('Forbidden OSM evidence path');
 return allowed[kind];
}
export function osmSnapshotPath(entry,code){
 if(!['RO','MD'].includes(code)||!/^[a-f0-9]{64}$/.test(String(entry?.semantic_sha256)))throw new Error('Invalid OSM snapshot identity');
 const path='data/sources/osm-snapshots/'+code.toLowerCase()+'-'+entry.semantic_sha256+'.json.gz';
 if(entry.snapshot_path!==path)throw new Error('Forbidden OSM snapshot path');
 return path;
}
export function officialOsmUrl(value){
 const url=new URL(value);
 if(url.origin!=='https://api.openstreetmap.org'||url.username||url.password||url.search||url.hash||!/^\/api\/0\.6\/(?:relation\/[1-9]\d*(?:\/history|\/full)?|changeset\/[1-9]\d*)\.json$/.test(url.pathname))throw new Error('Forbidden official OSM URL');
 const match=/^\/api\/0\.6\/(relation|changeset)\/([1-9]\d*)(\/history|\/full)?\.json$/.exec(url.pathname);
 const id=Number(match[2]);
 if(!Number.isSafeInteger(id))throw new Error('Forbidden official OSM numeric identity');
 const resource=match[1]==='relation'?'relation':'changeset';
 const operation=match[3]==='/history'?'/history':match[3]==='/full'?'/full':'';
 // Build the request from a constant authority, finite path segments and an
 // integer. The caller-provided URL never becomes the outgoing authority/path.
 return new URL('https://api.openstreetmap.org/api/0.6/'+resource+'/'+id+operation+'.json');
}
