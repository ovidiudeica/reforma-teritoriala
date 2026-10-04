import * as turf from '@turf/turf';

const coordKey=c=>JSON.stringify([Number(c[0]),Number(c[1])]);
const edgeKey=(a,b)=>[coordKey(a),coordKey(b)].sort().join('|');
const sameCoord=(a,b)=>coordKey(a)===coordKey(b);

function geometryRings(geometry){
 if(geometry?.type==='Polygon')return geometry.coordinates||[];
 if(geometry?.type==='MultiPolygon')return (geometry.coordinates||[]).flat();
 throw new Error('Expected Polygon or MultiPolygon geometry');
}

function sharedEdgePath(aGeometry,bGeometry){
 const aEdges=new Map();
 for(const ring of geometryRings(aGeometry)){
  for(let i=0;i<ring.length-1;i++)aEdges.set(edgeKey(ring[i],ring[i+1]),{a:ring[i],b:ring[i+1]});
 }
 const shared=[];
 for(const ring of geometryRings(bGeometry)){
  for(let i=0;i<ring.length-1;i++){
   const key=edgeKey(ring[i],ring[i+1]);
   if(aEdges.has(key))shared.push(aEdges.get(key));
  }
 }
 if(!shared.length)throw new Error('ANCPI Brețcu/Ojdula geometries have no exact shared edges');
 const adjacency=new Map(),coords=new Map();
 const add=(a,b)=>{
  const ak=coordKey(a),bk=coordKey(b);
  coords.set(ak,a);coords.set(bk,b);
  if(!adjacency.has(ak))adjacency.set(ak,new Set());
  adjacency.get(ak).add(bk);
 };
 for(const e of shared){add(e.a,e.b);add(e.b,e.a);}
 const bad=[...adjacency].filter(([,v])=>v.size>2);
 if(bad.length)throw new Error('ANCPI shared boundary is branching');
 const endpoints=[...adjacency].filter(([,v])=>v.size===1).map(([k])=>k).sort();
 if(endpoints.length!==2)throw new Error('ANCPI shared boundary must be one open path; endpoints='+endpoints.length);
 const path=[],seenEdges=new Set();
 let prev=null,current=endpoints[0];
 for(;;){
  path.push(coords.get(current));
  const next=[...adjacency.get(current)].find(n=>n!==prev&&!seenEdges.has([current,n].sort().join('|')));
  if(!next)break;
  seenEdges.add([current,next].sort().join('|'));
  prev=current;current=next;
 }
 if(path.length<2||coordKey(path.at(-1))!==endpoints[1])throw new Error('ANCPI shared boundary is disconnected');
 if(seenEdges.size!==shared.length)throw new Error('ANCPI shared boundary contains disconnected edge components');
 return {coordinates:path,edgeKeys:new Set(shared.map(e=>edgeKey(e.a,e.b))),edgeCount:shared.length};
}

function boundaryLines(geometry){
 return geometryRings(geometry).map((ring,index)=>({index,feature:turf.lineString(ring.map(c=>[c[0],c[1]]))}));
}

function nearestShellSnap(lines,coordinate){
 const point=turf.point(coordinate);
 let best=null;
 for(const line of lines){
  const snapped=turf.nearestPointOnLine(line.feature,point,{units:'kilometers'});
  const distKm=Number(snapped.properties?.dist);
  if(!best||distKm<best.distance_km)best={
   line_index:line.index,
   segment_index:Number(snapped.properties?.index),
   coordinate:snapped.geometry.coordinates,
   distance_km:distKm
  };
 }
 if(!best||!Number.isFinite(best.segment_index))throw new Error('Cannot project ANCPI boundary endpoint onto OSM shell');
 return best;
}

function insertSnaps(lines,snaps){
 const byLine=new Map();
 for(const snap of snaps){
  if(!byLine.has(snap.line_index))byLine.set(snap.line_index,[]);
  byLine.get(snap.line_index).push(snap);
 }
 return lines.map(line=>{
  const coordinates=line.feature.geometry.coordinates;
  const inserts=byLine.get(line.index)||[];
  const bySegment=new Map();
  for(const s of inserts){
   if(!bySegment.has(s.segment_index))bySegment.set(s.segment_index,[]);
   bySegment.get(s.segment_index).push(s);
  }
  const out=[];
  for(let i=0;i<coordinates.length-1;i++){
   out.push(coordinates[i]);
   const segmentInserts=bySegment.get(i)||[];
   segmentInserts.sort((x,y)=>turf.distance(turf.point(coordinates[i]),turf.point(x.coordinate),{units:'kilometers'})-turf.distance(turf.point(coordinates[i]),turf.point(y.coordinate),{units:'kilometers'}));
   for(const s of segmentInserts){
    if(!sameCoord(out.at(-1),s.coordinate)&&!sameCoord(coordinates[i+1],s.coordinate))out.push(s.coordinate);
   }
  }
  out.push(coordinates.at(-1));
  return turf.lineString(out);
 });
}

function commonEdgeKeys(aGeometry,bGeometry){
 const a=new Set();
 for(const ring of geometryRings(aGeometry))for(let i=0;i<ring.length-1;i++)a.add(edgeKey(ring[i],ring[i+1]));
 const out=new Set();
 for(const ring of geometryRings(bGeometry))for(let i=0;i<ring.length-1;i++){const k=edgeKey(ring[i],ring[i+1]);if(a.has(k))out.add(k);}
 return out;
}

const intersectionArea=(a,b)=>{
 try{
  const x=turf.intersect(turf.featureCollection([turf.feature(a),turf.feature(b)]));
  return x?turf.area(x):0;
 }catch{return 0;}
};
const differenceArea=(a,b)=>{
 try{
  const x=turf.difference(turf.featureCollection([turf.feature(a),turf.feature(b)]));
  return x?turf.area(x):0;
 }catch{return 0;}
};

export function buildBretcuOjdulaHybridPartition({osmOjdulaGeometry,ancpiOjdulaGeometry,ancpiBretcuGeometry}){
 const old=turf.feature(structuredClone(osmOjdulaGeometry));
 const ancpiO=turf.feature(structuredClone(ancpiOjdulaGeometry));
 const ancpiB=turf.feature(structuredClone(ancpiBretcuGeometry));
 const shared=sharedEdgePath(ancpiO.geometry,ancpiB.geometry);
 const lines=boundaryLines(old.geometry);
 const startSnap=nearestShellSnap(lines,shared.coordinates[0]);
 const endSnap=nearestShellSnap(lines,shared.coordinates.at(-1));
 const splitShell=insertSnaps(lines,[startSnap,endSnap]);
 const dividerCoords=[startSnap.coordinate,...shared.coordinates,endSnap.coordinate].filter((c,i,a)=>i===0||!sameCoord(c,a[i-1]));
 const divider=turf.lineString(dividerCoords);
 const polygonized=turf.polygonize(turf.featureCollection([...splitShell,divider]));
 const candidates=(polygonized.features||[]).filter(p=>{
  if(turf.area(p)<1)return false;
  try{return turf.booleanPointInPolygon(turf.pointOnFeature(p),old);}catch{return false;}
 }).sort((a,b)=>turf.area(b)-turf.area(a));
 if(candidates.length!==2)throw new Error('OSM shell + ANCPI divider must polygonize into exactly two UAT polygons; got '+candidates.length);
 const scores=candidates.map(p=>intersectionArea(p.geometry,ancpiB.geometry));
 const bIndex=scores[0]>=scores[1]?0:1;
 const bretcu=candidates[bIndex],ojdula=candidates[1-bIndex];
 const union=turf.union(turf.featureCollection([bretcu,ojdula]));
 if(!union)throw new Error('Hybrid partition union failed');
 const overlapM2=intersectionArea(bretcu.geometry,ojdula.geometry);
 const shellSymDiffM2=differenceArea(old.geometry,union.geometry)+differenceArea(union.geometry,old.geometry);
 const hybridShared=commonEdgeKeys(bretcu.geometry,ojdula.geometry);
 const missingAncpiEdges=[...shared.edgeKeys].filter(k=>!hybridShared.has(k));
 if(missingAncpiEdges.length)throw new Error('Hybrid partition does not preserve every ANCPI Brețcu–Ojdula shared edge');
 return {
  bretcu_geometry:bretcu.geometry,
  ojdula_geometry:ojdula.geometry,
  audit:{
   method:'osm_shell_ancpi_shared_boundary_polygonization_v1',
   osm_shell_area_m2:turf.area(old),
   hybrid_union_area_m2:turf.area(union),
   shell_symmetric_difference_m2:shellSymDiffM2,
   overlap_m2:overlapM2,
   ancpi_shared_edge_count:shared.edgeCount,
   ancpi_shared_edges_preserved:missingAncpiEdges.length===0,
   ancpi_shared_boundary_length_m:turf.length(turf.lineString(shared.coordinates),{units:'kilometers'})*1000,
   connector_start_m:startSnap.distance_km*1000,
   connector_end_m:endSnap.distance_km*1000,
   bretcu_overlap_with_ancpi_m2:intersectionArea(bretcu.geometry,ancpiB.geometry),
   ojdula_overlap_with_ancpi_m2:intersectionArea(ojdula.geometry,ancpiO.geometry)
  }
 };
}
