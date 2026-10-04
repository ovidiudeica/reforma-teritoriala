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

function properSegmentIntersection(a,b,c,d){
 const x1=Number(a[0]),y1=Number(a[1]),x2=Number(b[0]),y2=Number(b[1]);
 const x3=Number(c[0]),y3=Number(c[1]),x4=Number(d[0]),y4=Number(d[1]);
 const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
 if(Math.abs(den)<1e-15)return null;
 const det1=x1*y2-y1*x2,det2=x3*y4-y3*x4;
 const px=(det1*(x3-x4)-(x1-x2)*det2)/den;
 const py=(det1*(y3-y4)-(y1-y2)*det2)/den;
 const fraction=(p,u,v)=>Math.abs(v-u)<1e-15?NaN:(p-u)/(v-u);
 const tx=Math.abs(x2-x1)>=Math.abs(y2-y1)?fraction(px,x1,x2):fraction(py,y1,y2);
 const ux=Math.abs(x4-x3)>=Math.abs(y4-y3)?fraction(px,x3,x4):fraction(py,y3,y4);
 const eps=1e-10;
 if(!Number.isFinite(tx)||!Number.isFinite(ux)||tx<=eps||tx>=1-eps||ux<=eps||ux>=1-eps)return null;
 return {coordinate:[px,py],path_fraction:tx,shell_fraction:ux};
}

function clipAncpiSharedPathAtTerminalShellCrossings(sharedCoordinates,shellRing,old){
 const hits=[];
 for(let i=0;i<sharedCoordinates.length-1;i++){
  for(let j=0;j<shellRing.length-1;j++){
   const hit=properSegmentIntersection(sharedCoordinates[i],sharedCoordinates[i+1],shellRing[j],shellRing[j+1]);
   if(hit)hits.push({...hit,path_segment_index:i,shell_segment_index:j});
  }
 }
 const lastSegment=sharedCoordinates.length-2;
 const nonTerminal=hits.filter(x=>x.path_segment_index!==0&&x.path_segment_index!==lastSegment);
 if(nonTerminal.length)throw new Error('ANCPI shared boundary crosses reviewed OSM shell away from a terminal edge');
 const startHits=hits.filter(x=>x.path_segment_index===0);
 const endHits=hits.filter(x=>x.path_segment_index===lastSegment);
 if(startHits.length>1||endHits.length>1)throw new Error('ANCPI shared boundary has multiple crossings on one terminal edge');
 const startHit=startHits[0]||null,endHit=endHits[0]||null;
 const endpointInside=coordinate=>turf.booleanPointInPolygon(turf.point(coordinate),old,{ignoreBoundary:false});
 if(startHit&&endpointInside(sharedCoordinates[0]))throw new Error('ANCPI shared boundary start crosses outward from inside the reviewed OSM shell');
 if(endHit&&endpointInside(sharedCoordinates.at(-1)))throw new Error('ANCPI shared boundary end crosses outward from inside the reviewed OSM shell');
 if(!startHit&&!endpointInside(sharedCoordinates[0]))throw new Error('ANCPI shared boundary start lies outside reviewed OSM shell without a terminal crossing');
 if(!endHit&&!endpointInside(sharedCoordinates.at(-1)))throw new Error('ANCPI shared boundary end lies outside reviewed OSM shell without a terminal crossing');
 const coordinates=sharedCoordinates.map(c=>[Number(c[0]),Number(c[1])]);
 const clippedStartM=startHit?turf.distance(turf.point(coordinates[0]),turf.point(startHit.coordinate),{units:'kilometers'})*1000:0;
 const clippedEndM=endHit?turf.distance(turf.point(coordinates.at(-1)),turf.point(endHit.coordinate),{units:'kilometers'})*1000:0;
 if(startHit)coordinates[0]=startHit.coordinate;
 if(endHit)coordinates[coordinates.length-1]=endHit.coordinate;
 return {coordinates,start_hit:startHit,end_hit:endHit,clipped_start_m:clippedStartM,clipped_end_m:clippedEndM};
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

function edgeMultiplicity(geometries){
 const counts=new Map();
 for(const geometry of geometries){
  for(const ring of geometryRings(geometry)){
   for(let i=0;i<ring.length-1;i++){
    const key=edgeKey(ring[i],ring[i+1]);
    counts.set(key,(counts.get(key)||0)+1);
   }
  }
 }
 return counts;
}

function exteriorEdgeSet(geometries){
 return new Set([...edgeMultiplicity(geometries)].filter(([,count])=>count===1).map(([key])=>key));
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
 if(lines.length!==1)throw new Error('Reviewed OSM shell must contain exactly one exterior ring');
 const shellRing=lines[0].feature.geometry.coordinates;
 const clippedShared=clipAncpiSharedPathAtTerminalShellCrossings(shared.coordinates,shellRing,old);
 const hitSnap=hit=>hit?{line_index:0,segment_index:hit.shell_segment_index,coordinate:hit.coordinate,distance_km:0}:null;
 const startSnap=hitSnap(clippedShared.start_hit)||nearestShellSnap(lines,clippedShared.coordinates[0]);
 const endSnap=hitSnap(clippedShared.end_hit)||nearestShellSnap(lines,clippedShared.coordinates.at(-1));
 const splitShell=insertSnaps(lines,[startSnap,endSnap]);
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
 const dividerCoords=[startSnap.coordinate,...clippedShared.coordinates,endSnap.coordinate].filter((coord,index,array)=>index===0||!sameCoord(coord,array[index-1]));
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
 const partitionEdgeCounts=edgeMultiplicity([bretcu.geometry,ojdula.geometry]);
 const partitionExteriorEdges=new Set([...partitionEdgeCounts].filter(([,count])=>count===1).map(([key])=>key));
 const partitionInteriorEdges=new Set([...partitionEdgeCounts].filter(([,count])=>count===2).map(([key])=>key));
 const invalidMultiplicity=[...partitionEdgeCounts].filter(([,count])=>count!==1&&count!==2);
 const osmShellEdgesPreserved=sameSet(expectedShellEdges,partitionExteriorEdges);
 const partitionAreaSumResidualM2=Math.abs((turf.area(bretcu)+turf.area(ojdula))-turf.area(old));
 const areaBalanceDeltaM2=Math.abs(turf.area(union)-turf.area(old));
 const hybridShared=commonEdgeKeys(bretcu.geometry,ojdula.geometry);
 const expectedDividerEdges=new Set(dividerCoords.slice(0,-1).map((p,i)=>edgeKey(p,dividerCoords[i+1])));
 const partitionBoundaryEdgeProof=invalidMultiplicity.length===0&&sameSet(partitionInteriorEdges,expectedDividerEdges)&&sameSet(hybridShared,expectedDividerEdges)&&osmShellEdgesPreserved;
 const retainedFullAncpiEdges=[...shared.edgeKeys].filter(k=>hybridShared.has(k));
 const terminalClippedEdgeCount=Number(Boolean(clippedShared.start_hit))+Number(Boolean(clippedShared.end_hit));
 const ancpiSharedPathPreserved=retainedFullAncpiEdges.length===shared.edgeCount-terminalClippedEdgeCount;
 const partitionPolygonsValid=turf.booleanValid(bretcu)&&turf.booleanValid(ojdula);
 if(!ancpiSharedPathPreserved)throw new Error('Hybrid partition does not preserve the ANCPI shared path after terminal clipping to the OSM shell');
 if(!partitionPolygonsValid)throw new Error('Hybrid partition produced an invalid polygon topology');
 if(!partitionBoundaryEdgeProof)throw new Error('Hybrid partition boundary-edge multiplicity proof failed');
 if(!osmShellEdgesPreserved)throw new Error('Hybrid partition exterior edges differ from the reviewed OSM shell');
 return {
  bretcu_geometry:bretcu.geometry,
  ojdula_geometry:ojdula.geometry,
  audit:{
   method:'osm_shell_ancpi_shared_boundary_terminal_clip_v2',
   osm_shell_area_m2:turf.area(old),
   hybrid_union_area_m2:turf.area(union),
   shell_symmetric_difference_m2:shellSymDiffM2,
   osm_shell_edges_preserved:osmShellEdgesPreserved,
   osm_shell_edge_count:expectedShellEdges.size,
   partition_exterior_edge_count:partitionExteriorEdges.size,
   partition_interior_edge_count:partitionInteriorEdges.size,
   exact_partition_boundary_edge_proof:partitionBoundaryEdgeProof,
   invalid_edge_multiplicity_count:invalidMultiplicity.length,
   area_balance_delta_m2:areaBalanceDeltaM2,
   partition_area_sum_residual_m2:partitionAreaSumResidualM2,
   overlap_m2:overlapM2,
   ancpi_shared_edge_count:shared.edgeCount,
   ancpi_full_edges_preserved_count:retainedFullAncpiEdges.length,
   ancpi_terminal_clipped_edge_count:terminalClippedEdgeCount,
   ancpi_shared_path_preserved_with_terminal_clipping:ancpiSharedPathPreserved,
   ancpi_shared_boundary_length_m:turf.length(turf.lineString(shared.coordinates),{units:'kilometers'})*1000,
   ancpi_clipped_start_m:clippedShared.clipped_start_m,
   ancpi_clipped_end_m:clippedShared.clipped_end_m,
   connector_start_m:startSnap.distance_km*1000,
   connector_end_m:endSnap.distance_km*1000,
   partition_polygons_valid:partitionPolygonsValid,
   bretcu_overlap_with_ancpi_m2:intersectionArea(bretcu.geometry,ancpiB.geometry),
   ojdula_overlap_with_ancpi_m2:intersectionArea(ojdula.geometry,ancpiO.geometry)
  }
 };
}
