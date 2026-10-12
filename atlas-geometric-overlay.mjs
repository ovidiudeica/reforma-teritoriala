import {geographicMetrics} from './atlas-geographic-measurement.mjs';
export function createGeometricOverlay(jsts){
 const reader=new jsts.io.GeoJSONReader(),writer=new jsts.io.GeoJSONWriter(),Overlay=jsts.operation.overlay.OverlayOp;
 function read(raw){if(!raw||!['Polygon','MultiPolygon'].includes(raw.type))throw Error('Geometrie poligonală indisponibilă');const g=reader.read(raw),valid=new jsts.operation.valid.IsValidOp(g);if(!valid.isValid())throw Error('Geometrie invalidă: '+valid.getValidationError().getMessage());geographicMetrics(raw);return g;}
 function polygonal(g){const raw=writer.write(g);if(g.isEmpty())return null;if(['Polygon','MultiPolygon'].includes(raw.type))return raw;if(raw.type==='GeometryCollection'){const polygons=raw.geometries.flatMap(p=>p.type==='Polygon'?[p.coordinates]:p.type==='MultiPolygon'?p.coordinates:[]);return polygons.length?{type:'MultiPolygon',coordinates:polygons}:null;}return null;}
 const area=g=>g?geographicMetrics(g).areaM2:0;
 function compare(a,b){
  const started=performance.now(),ga=read(a),gb=read(b),ma=geographicMetrics(a),mb=geographicMetrics(b),matrix=jsts.operation.relate.RelateOp.relate(ga,gb);
  const relation=matrix.isDisjoint()?'disjoint':matrix.isEquals(2,2)?'equal':matrix.isCovers()?'contains':matrix.isCoveredBy()?'within':matrix.get(0,0)===2?'overlap':matrix.get(1,1)===1?'boundary':'point';
  // No SnapIfNeededOverlayOp or geometric repair fallback.
  const intersection=polygonal(Overlay.overlayOp(ga,gb,Overlay.INTERSECTION)),union=polygonal(Overlay.overlayOp(ga,gb,Overlay.UNION)),exclusiveA=polygonal(Overlay.overlayOp(ga,gb,Overlay.DIFFERENCE)),exclusiveB=polygonal(Overlay.overlayOp(gb,ga,Overlay.DIFFERENCE));
  for(const raw of [intersection,union,exclusiveA,exclusiveB])if(raw)read(raw);
  const i=area(intersection),u=area(union),x=area(exclusiveA),y=area(exclusiveB);
  // Computation-only tolerance in m²; never used by a topological predicate.
  const toleranceM2=Math.max(.01,Math.max(ma.areaM2,mb.areaM2,u)*1e-9);
  const residuals={union:u-ma.areaM2-mb.areaM2+i,a:x+i-ma.areaM2,b:y+i-mb.areaM2};
  if(Object.values(residuals).some(v=>Math.abs(v)>toleranceM2))throw Error('Identități de arie neconfirmate numeric; calcul indisponibil');
  return {a:ma,b:mb,areaDifferenceM2:ma.areaM2-mb.areaM2,areaRatio:mb.areaM2>0?ma.areaM2/mb.areaM2:null,intersectionM2:i,unionM2:u,exclusiveAM2:x,exclusiveBM2:y,overlapA:100*i/ma.areaM2,overlapB:100*i/mb.areaM2,relation,matrix:matrix.toString(),geometries:{intersection,union,exclusiveA,exclusiveB},validation:{toleranceM2,residuals},durationMs:performance.now()-started};
 }
 return {metrics:raw=>{read(raw);return geographicMetrics(raw);},compare};
}
