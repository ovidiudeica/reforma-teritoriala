import {geographicPoint,orientation} from './atlas-point-geometry.mjs';
import {geodesicMetres} from './atlas-topology-policy.mjs';
export const earthRadiusMetres=6371008.8;
const rad=Math.PI/180;
function sum(values){let total=0,c=0;for(const value of values){const y=value-c,t=total+y;c=(t-total)-y;total=t;}return total;}
function ringMetrics(ring){
 if(!Array.isArray(ring)||ring.length<4)throw Error('Inel cu mai puțin de trei vârfuri');
 for(const p of ring){if(!Array.isArray(p))throw Error('Vârf invalid');geographicPoint(p[0],p[1]);}
 if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('Inel deschis');
 const integrals=[],lengths=[];
 for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],delta=(b[0]-a[0])*rad;
  if(Math.abs(delta)>Math.PI)throw Error('Traversare antimeridian nesuportată');
  const mid=(a[1]+b[1])*rad/2,half=(b[1]-a[1])*rad/2;
  // Exact integral for a straight source-coordinate edge; stable as delta latitude -> 0.
  const sinc=Math.abs(half)<1e-4?1-half*half/6+half**4/120:Math.sin(half)/half;
  integrals.push(delta*Math.sin(mid)*sinc);lengths.push(geodesicMetres(a,b));
 }
 const area=Math.abs(sum(integrals))*earthRadiusMetres**2;
 if(!Number.isFinite(area)||area<=0||area>2*Math.PI*earthRadiusMetres**2)throw Error('Inel degenerat sau mai mare decât o emisferă');
 return {areaM2:area,perimeterMetres:sum(lengths)};
}
// Caller validates polygon topology with GIS. This function never repairs source coordinates.
export function geographicMetrics(geometry){
 if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type))throw Error('Geometrie poligonală indisponibilă');
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 if(!Array.isArray(polygons)||!polygons.length)throw Error('Geometrie goală');
 const areas=[],perimeters=[];let holes=0,vertices=0;
 for(const rings of polygons){if(!Array.isArray(rings)||!rings.length)throw Error('Poligon gol');const metrics=rings.map(ringMetrics),area=metrics[0].areaM2-sum(metrics.slice(1).map(m=>m.areaM2));if(area<=0)throw Error('Arie poligonală nepozitivă');areas.push(area);perimeters.push(...metrics.map(m=>m.perimeterMetres));holes+=rings.length-1;vertices+=rings.reduce((n,r)=>n+r.length-1,0);}
 return {areaM2:sum(areas),perimeterMetres:sum(perimeters),components:polygons.length,holes,vertices};
}
export function distanceMeasurement(points){for(const p of points)geographicPoint(...p);const segments=points.slice(1).map((p,i)=>geodesicMetres(points[i],p));return {segments,totalMetres:sum(segments),points:points.length};}
const onSegment=(a,b,p)=>orientation(a,b,p)===0&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
function intersects(a,b,c,d){const x=orientation(a,b,c),y=orientation(a,b,d),z=orientation(c,d,a),w=orientation(c,d,b);return x*y<0&&z*w<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);}
export function areaMeasurement(points){
 if(points.length<3)throw Error('Sunt necesare minimum trei puncte');
 if(points.length>1000)throw Error('Maximum 1.000 de vârfuri pentru măsurarea interactivă');
 for(const p of points)geographicPoint(...p);
 const keys=points.map(p=>p.join(','));if(new Set(keys).size!==points.length)throw Error('Vârfuri repetate; închiderea este automată');
 const ring=[...points,points[0]],n=points.length;
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
  if(j===i+1||i===0&&j===n-1)continue;
  if(intersects(ring[i],ring[i+1],ring[j],ring[j+1]))throw Error('Poligon autointersectat sau cu atingere proprie');
 }
 for(let i=0;i<n;i++)if(orientation(points[(i+n-1)%n],points[i],points[(i+1)%n])===0&&onSegment(points[(i+n-1)%n],points[i],points[(i+1)%n]))throw Error('Laturi adiacente suprapuse');
 return geographicMetrics({type:'Polygon',coordinates:[ring]});
}
