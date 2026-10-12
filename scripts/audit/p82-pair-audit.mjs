import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import IsValidOp from 'jsts/org/locationtech/jts/operation/valid/IsValidOp.js';
import STRtree from 'jsts/org/locationtech/jts/index/strtree/STRtree.js';
const root=new URL('../../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const entities=(await json('public/data/actual-entities.json')).entities.sort((a,b)=>a.id<b.id?-1:1),reader=new GeoJSONReader(),geometries=new Map(),tree=new STRtree(),invalid=[];
const files=(await readdir(new URL('public/geo/actual/',root),{recursive:true})).filter(p=>p.endsWith('.geojson')).sort();
for(const p of files)for(const f of (await json('public/geo/actual/'+p.replaceAll('\\','/'))).features){const id=f.properties.entity_id;if(!geometries.has(id))geometries.set(id,reader.read(f.geometry));}
for(const e of entities){const g=geometries.get(e.id),op=new IsValidOp(g);if(!op.isValid())invalid.push({id:e.id,error:op.getValidationError().getMessage()});tree.insert(g.getEnvelopeInternal(),e);}
const relations=[],errors=[],counts={};let candidates=0;const started=performance.now();
for(let i=0;i<entities.length;i++){const a=entities[i],ga=geometries.get(a.id),items=tree.query(ga.getEnvelopeInternal()).toArray().filter(b=>b.id>a.id).sort((a,b)=>a.id<b.id?-1:1);
 for(const b of items){candidates++;try{const m=RelateOp.relate(ga,geometries.get(b.id));let relation;if(m.isDisjoint())relation='disjoint';else if(m.isEquals(2,2))relation='equal';else if(m.isCovers())relation='contains';else if(m.isCoveredBy())relation='within';else if(m.get(0,0)===2)relation='overlap';else if(m.get(1,1)===1)relation='boundary';else relation='point';counts[relation]=(counts[relation]||0)+1;if(relation!=='disjoint')relations.push({a:a.id,b:b.id,relation,matrix:m.toString(),crossBorder:a.jurisdiction!==b.jurisdiction});}catch(error){errors.push({a:a.id,b:b.id,error:error.message});}}
 if(i%100===0)console.log(JSON.stringify({processed:i,candidates,seconds:(performance.now()-started)/1000}));
}
const report={base:'47e20f5091d11a826df02bed45b7447ff665650e',entityCount:entities.length,candidates,counts,invalid,errors,durationMs:performance.now()-started,relations};await mkdir(new URL('outputs/P8.2/',root),{recursive:true});await writeFile(new URL('outputs/P8.2/pair-audit.json',root),JSON.stringify(report)+'\n');console.log(JSON.stringify({...report,relations:undefined}));
