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

function ringEdgeSet(ring){
 const out=new Set();
 for(let i=0;i<ring.length-1;i++)out.add(edgeKey(ring[i],ring[i+1]));
 return out;
}

function exteriorEdgeSet(geometries){
 const counts=new Map();
 for(const geometry of geometries){
  for(const ring of geometryRings(geometry)){
   for(let i=0;i<ring.length-1;i++){
    const key=edgeKey(ring[i],ring[i+1]);
    counts.set(key,(counts.get(key)||0)+1);
   }
  }
 }
 return new Set([...counts].filter(([,count])=>count===1).map(([key])=>key));
}

function sameSet(a,b){
 return a.size===b.size&&[...a].every(x=>b.has(x));
}

const intersectionArea=(a,b)=>{
 const x=turf.intersect(turf.featureCollection([turf.feature(a),turf.feature(b)]));
 return x?turf.area(x):0;
};
const differenceArea=(a,b)=>{
 const x=turf.difference(turf.featureCollection([turf.feature(a),turf.feature(b)]));
 return x?turf.area(x):0;
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
 if(splitShell.length!==1)throw new Error('Reviewed OSM shell must contain exactly one exterior ring');
 const shellCoords=splitShell[0].geometry.coordinates.slice(0,-1);
 const startIndex=shellCoords.findIndex(c=>sameCoord(c,startSnap.coordinate));
 const endIndex=shellCoords.findIndex(c=>sameCoord(c,endSnap.coordinate));
 if(startIndex<0||endIndex<0||startIndex===endIndex)throw new Error('Projected ANCPI divider endpoints are not distinct vertices on the OSM shell');
 const circularArc=(coords,from,to)=>{
  const out=[coords[from]];
  let i=from,guard=0;
  while(i!==to){
   i=(i+1)%coords.length;
   out.push(coords[i]);
   if(++guard>coords.length)throw new Error('OSM shell arc traversal did not terminate');
  }
  return out;
 };
 const closeRing=ring=>{
  const out=ring.filter((coord,index,array)=>index===0||!sameCoord(coord,array[index-1]));
  if(!sameCoord(out[0],out.at(-1)))out.push(out[0]);
  return out;
 };
 const dividerCoords=[startSnap.coordinate,...shared.coordinates,endSnap.coordinate].filter((coord,index,array)=>index===0||!sameCoord(coord,array[index-1]));
 const forwardArc=circularArc(shellCoords,startIndex,endIndex);
 const reverseArc=circularArc(shellCoords,endIndex,startIndex);
 const forwardRing=closeRing([...forwardArc,...dividerCoords.toReversed().slice(1)]);
 const reverseRing=closeRing([...reverseArc,...dividerCoords.slice(1)]);
 const candidates=[turf.polygon([forwardRing]),turf.polygon([reverseRing])];
 if(candidates.some(p=>turf.area(p)<1))throw new Error('OSM shell + ANCPI divider produced a degenerate partition polygon');
 const scores=candidates.map(p=>intersectionArea(p.geometry,ancpiB.geometry));
 const bIndex=scores[0]>=scores[1]?0:1;
 const bretcu=candidates[bIndex],ojdula=candidates[1-bIndex];
 const union=turf.union(turf.featureCollection([bretcu,ojdula]));
 if(!union)throw new Error('Hybrid partition union failed');
 const overlapM2=intersectionArea(bretcu.geometry,ojdula.geometry);
 const shellSymDiffM2=differenceArea(old.geometry,union.geometry)+differenceArea(union.geometry,old.geometry);
 const expectedShellRing=[...splitShell[0].geometry.coordinates];
 const expectedShellEdges=ringEdgeSet(expectedShellRing);
 const partitionExteriorEdges=exteriorEdgeSet([bretcu.geometry,ojdula.geometry]);
 const osmShellEdgesPreserved=sameSet(expectedShellEdges,partitionExteriorEdges);
 const partitionAreaSumResidualM2=Math.abs((turf.area(bretcu)+turf.area(ojdula))-turf.area(old));
 const areaBalanceDeltaM2=Math.abs(turf.area(union)-turf.area(old));
 const hybridShared=commonEdgeKeys(bretcu.geometry,ojdula.geometry);
 const missingAncpiEdges=[...shared.edgeKeys].filter(k=>!hybridShared.has(k));
 if(missingAncpiEdges.length)throw new Error('Hybrid partition does not preserve every ANCPI Brețcu–Ojdula shared edge');
 if(!osmShellEdgesPreserved)throw new Error('Hybrid partition exterior edges differ from the reviewed OSM shell');
 return {
  bretcu_geometry:bretcu.geometry,
  ojdula_geometry:ojdula.geometry,
  audit:{
   method:'osm_shell_ancpi_shared_boundary_polygonization_v1',
   osm_shell_area_m2:turf.area(old),
   hybrid_union_area_m2:turf.area(union),
   shell_symmetric_difference_m2:shellSymDiffM2,
   osm_shell_edges_preserved:osmShellEdgesPreserved,
   osm_shell_edge_count:expectedShellEdges.size,
   partition_exterior_edge_count:partitionExteriorEdges.size,
   area_balance_delta_m2:areaBalanceDeltaM2,
   partition_area_sum_residual_m2:partitionAreaSumResidualM2,
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
