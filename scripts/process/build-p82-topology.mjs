import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import STRtree from 'jsts/org/locationtech/jts/index/strtree/STRtree.js';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import {readTopologyGeometry,relateGeometries} from '../lib/p82-topology.mjs';
import {compatibleLevels,reverseRelation} from '../../atlas-topology-policy.mjs';
import {encodeFrontiers} from '../../atlas-topology-frontier-codec.mjs';
const root=new URL('../../',import.meta.url),read=async p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await read(p)),hash=b=>createHash('sha256').update(b).digest('hex'),sort=(a,b)=>a<b?-1:a>b?1:0,started=performance.now();
const indexBytes=await read('public/data/actual-entities.json'),entities=JSON.parse(indexBytes).entities.sort((a,b)=>sort(a.id,b.id)),byId=new Map(entities.map(e=>[e.id,e])),geometries=new Map(),addresses={},sources={},shards=new Map(),frontiers=new Map(),tree=new STRtree(),errors=[],counts={};
const files=(await readdir(new URL('public/geo/actual/',root),{recursive:true})).filter(p=>p.endsWith('.geojson')).map(p=>'public/geo/actual/'+p.replaceAll('\\','/')).sort(sort);
const target=p=>'public/data/topology/'+p.slice('public/geo/actual/'.length).replace(/\.geojson$/,'.json'),border=p=>p.replace('/topology/','/topology-frontiers/');
for(const p of files){const raw=await read(p);sources[p]=hash(raw);for(const f of JSON.parse(raw).features){const id=f.properties.entity_id;if(!byId.has(id))throw Error('Identitate necunoscută '+id);if(geometries.has(id))continue;const g=readTopologyGeometry(f.geometry);geometries.set(id,g);addresses[id]=target(p);if(!shards.has(target(p)))shards.set(target(p),{contract:'actual-topology-shard-v1',entities:{}});const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 const parent=polygons.map((_,i)=>i),find=i=>parent[i]===i?i:parent[i]=find(parent[i]);for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++){const a=g.getGeometryN(i),b=g.getGeometryN(j);if(a.getEnvelopeInternal().intersects(b.getEnvelopeInternal())&&!RelateOp.relate(a,b).isDisjoint())parent[find(i)]=find(j);}
 shards.get(target(p)).entities[id]={components:polygons.length,connectedComponents:new Set(parent.map((_,i)=>find(i))).size,holes:polygons.reduce((n,r)=>n+r.length-1,0),relations:[]};}}
if(files.length!==123||geometries.size!==5848)throw Error('Acoperire geometrică neașteptată');
for(const e of entities)tree.insert(geometries.get(e.id).getEnvelopeInternal(),e);
let candidates=0;
for(let i=0;i<entities.length;i++){const a=entities[i],ga=geometries.get(a.id),items=tree.query(ga.getEnvelopeInternal()).toArray().filter(b=>sort(b.id,a.id)>0).sort((a,b)=>sort(a.id,b.id));
 for(const b of items){candidates++;let r;try{r=relateGeometries(ga,geometries.get(b.id));}catch(error){r={relation:'uncertain',error:error.message};errors.push({a:a.id,b:b.id,error:error.message});}counts[r.relation]=(counts[r.relation]||0)+1;if(r.relation==='disjoint')continue;
  const pair=a.id+'|'+b.id,compatibility=compatibleLevels(a,b),row={other:b.id,relation:r.relation,matrix:r.matrix,compatibility,...(r.error?{error:r.error}:{}),...(r.enclosure?{enclosure:r.enclosure==='a'?'selected':'other'}:{})};
  if(r.lines){const p=border(addresses[a.id]);if(!frontiers.has(p))frontiers.set(p,{type:'FeatureCollection',metadata:{contract:'actual-topology-frontiers-v1'},features:[]});frontiers.get(p).features.push({type:'Feature',properties:{pair},geometry:{type:'MultiLineString',coordinates:r.lines}});Object.assign(row,{metres:r.metres,boundaryPath:p,pair});}
  shards.get(addresses[a.id]).entities[a.id].relations.push(row);shards.get(addresses[b.id]).entities[b.id].relations.push({...row,other:a.id,relation:reverseRelation(r.relation),...(row.enclosure?{enclosure:row.enclosure==='selected'?'other':'selected'}:{})});
 }
 if(i%500===0)console.log(JSON.stringify({processed:i,candidates,seconds:(performance.now()-started)/1000}));
}
const outputs=new Map();for(const [p,s]of shards){for(const entity of Object.values(s.entities))entity.relations.sort((a,b)=>sort(a.other,b.other));outputs.set(p,JSON.stringify(s)+'\n');}for(const [p,s]of frontiers)outputs.set(p,JSON.stringify(encodeFrontiers(s.features))+'\n');
const resources={};for(const [p,s]of [...outputs].sort(([a],[b])=>sort(a,b)))resources[p]={sha256:hash(s),bytes:Buffer.byteLength(s)};
const release=await json('data/current/actual-release-manifest.json');const index={contract:'actual-topology-index-v1',snapshot_id:release.snapshot_id,entityCount:entities.length,geometryCount:files.length,catalogSha256:hash(indexBytes),sources,addresses,resources,counts,errors,policy:{engine:'jsts-2.12.1-direct-overlay-no-snap',matrixOrientation:'ascending entity IDs',geometricEnclosure:'single polygon exactly fills a hole; no legal inference',geographicTolerance:0,lengthModel:'IUGG mean-radius spherical geodesic',radiusMetres:6371008.8,legalEnclaveExclave:'not inferred'}};
outputs.set('public/data/actual-topology-index.json',JSON.stringify(index)+'\n');
const check=process.argv.includes('--check');for(const [p,s]of outputs){if(check){if(!Buffer.from(s).equals(await read(p)))throw Error('Derivare nereproductibilă '+p);}else{await mkdir(new URL(p.slice(0,p.lastIndexOf('/')+1),root),{recursive:true});await writeFile(new URL(p,root),s);}}
const report={check,entityCount:entities.length,geometryCount:files.length,candidates,counts,errors,durationMs:performance.now()-started,resourceCount:outputs.size,bytes:[...outputs.values()].reduce((n,s)=>n+Buffer.byteLength(s),0)};await mkdir(new URL('outputs/P8.2/',root),{recursive:true});await writeFile(new URL(check?'outputs/P8.2/reproducibility.json':'outputs/P8.2/build.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
