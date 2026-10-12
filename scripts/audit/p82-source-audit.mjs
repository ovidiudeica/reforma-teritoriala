import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pointInGeometry} from '../../atlas-point-geometry.mjs';
const root=new URL('../../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const entities=(await json('public/data/actual-entities.json')).entities,byId=new Map(entities.map(e=>[e.id,e]));
const files=(await readdir(new URL('public/geo/actual/',root),{recursive:true})).filter(p=>p.endsWith('.geojson')).map(p=>'public/geo/actual/'+p.replaceAll('\\','/')).sort();
const hashes={},geometries=new Map(),copies=new Map(),errors=[],edges=new Map();let bytes=0,positions=0,holes=0,multipart=0;
const key=p=>p[0]+','+p[1],hash=b=>createHash('sha256').update(b).digest('hex');
for(const file of files){const raw=await readFile(new URL(file,root));bytes+=raw.length;hashes[file]=hash(raw);const data=JSON.parse(raw);
 for(const f of data.features){const id=f.properties.entity_id,g=f.geometry,digest=hash(JSON.stringify(g));if(!byId.has(id))errors.push({id,issue:'unknown_identity'});if(copies.has(id)&&copies.get(id)!==digest)errors.push({id,issue:'inconsistent_public_copies'});copies.set(id,digest);if(geometries.has(id))continue;geometries.set(id,g);
  try{const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;pointInGeometry(polygons[0][0][0],g);if(polygons.length>1)multipart++;for(const rings of polygons){holes+=rings.length-1;for(const ring of rings){positions+=ring.length;for(let i=1;i<ring.length;i++){const a=key(ring[i-1]),b=key(ring[i]);if(a===b)continue;const k=a<b?a+'|'+b:b+'|'+a;let owners=edges.get(k);if(!owners){owners=new Set();edges.set(k,owners);}owners.add(id);}}}}
  catch(error){errors.push({id,issue:'invalid_geometry',message:error.message});}
 }
}
let sharedSegments=0,crossBorderSegments=0;const pairs=new Map();
for(const owners of edges.values()){const ids=[...owners].sort();if(ids.length>1)sharedSegments++;for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=byId.get(ids[i]),b=byId.get(ids[j]);if(a.jurisdiction!==b.jurisdiction)crossBorderSegments++;const k=ids[i]+'|'+ids[j];pairs.set(k,(pairs.get(k)||0)+1);}}
const levels={};for(const e of entities){const k=e.jurisdiction+'|'+e.category+'|'+(e.representation?.admin_level??e.statistical?.level??'unknown');levels[k]=(levels[k]||0)+1;}
const report={base:'47e20f5091d11a826df02bed45b7447ff665650e',files:files.length,bytes,entities:entities.length,represented:geometries.size,positions,holes,multipart,uniqueSegments:edges.size,sharedSegments,crossBorderSegments,pairsSharingExactSegments:pairs.size,levels,statisticalRoles:entities.filter(e=>e.roles?.includes('statistical')).length,separateStatistical:entities.filter(e=>e.category==='statistical').length,errors,hashes,policy:'Exact segment equality is an audit inventory, not a neighbor classification: overlap and containment still require pairwise topology. No snapping, geographic epsilon, buffering or geometry repair.'};
await mkdir(new URL('outputs/P8.2/',root),{recursive:true});await writeFile(new URL('outputs/P8.2/source-audit.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,hashes:undefined},null,2));
if(files.length!==123||geometries.size!==5848||errors.length)process.exitCode=1;
