// Robust predicates for the supplied binary WGS84 values; no geographic epsilon.
export function geographicPoint(lon,lat){if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)throw new RangeError('Coordonate WGS84 invalide');return [lon,lat];}
export function bboxContains(b,p){return Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<=b[2]&&b[1]<=b[3]&&p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];}
const bits=new DataView(new ArrayBuffer(8));
function dyadic(n){bits.setFloat64(0,n);const v=bits.getBigUint64(0),e=Number((v>>52n)&2047n),m=v&((1n<<52n)-1n);return {m:(v>>63n?-1n:1n)*(e?m+(1n<<52n):m),e:e?e-1075:-1074};}
export function orientation(a,b,p){
 const x=(b[0]-a[0])*(p[1]-a[1]),y=(b[1]-a[1])*(p[0]-a[0]),det=x-y;
 const magnitude=Math.abs(x)+Math.abs(y);
 if(magnitude>=2**-1022&&Math.abs(det)>8*Number.EPSILON*magnitude)return Math.sign(det);
 const d=[a[0],a[1],b[0],b[1],p[0],p[1]].map(dyadic),e=Math.min(...d.map(x=>x.e)),v=d.map(x=>x.m<<BigInt(x.e-e));
 const exact=(v[2]-v[0])*(v[5]-v[1])-(v[3]-v[1])*(v[4]-v[0]);return exact>0n?1:exact<0n?-1:0;
}
const prepared=new WeakMap();
function ring(r){
 if(!Array.isArray(r)||r.length<4||r.some(p=>!Array.isArray(p)||p.length<2))throw Error('Inel geometric invalid');
 const bbox=[Infinity,Infinity,-Infinity,-Infinity];for(const p of r){geographicPoint(p[0],p[1]);bbox[0]=Math.min(bbox[0],p[0]);bbox[1]=Math.min(bbox[1],p[1]);bbox[2]=Math.max(bbox[2],p[0]);bbox[3]=Math.max(bbox[3],p[1]);}
 if(r[0][0]!==r.at(-1)[0]||r[0][1]!==r.at(-1)[1])throw Error('Inel deschis');
 const distinct=r.find(p=>p[0]!==r[0][0]||p[1]!==r[0][1]);
 if(!distinct||bbox[0]===bbox[2]||bbox[1]===bbox[3]||!r.some(p=>orientation(r[0],distinct,p)!==0))throw Error('Inel degenerat');
 for(let i=1;i<r.length;i++)if(Math.abs(r[i][0]-r[i-1][0])>180)throw Error('Traversare antimeridian nesuportată');
 // Conservative y buckets: monotone IEEE-754 arithmetic preserves the edge range.
 // Exact predicates still decide membership; buckets introduce no tolerance.
 const count=Math.min(64,Math.max(1,Math.ceil(Math.sqrt(r.length)))),buckets=Array.from({length:count},()=>[]);
 const bucket=y=>Math.min(count-1,Math.max(0,Math.floor((y-bbox[1])/(bbox[3]-bbox[1])*count)));
 for(let i=1;i<r.length;i++)for(let b=bucket(Math.min(r[i-1][1],r[i][1]));b<=bucket(Math.max(r[i-1][1],r[i][1]));b++)buckets[b].push(i);
 return {coordinates:r,bbox,buckets,bucket};
}
function prepare(g){
 if(!g||!['Polygon','MultiPolygon'].includes(g.type)||!Array.isArray(g.coordinates)||!g.coordinates.length)throw Error('Geometrie poligonală indisponibilă');
 if(prepared.has(g))return prepared.get(g);
 const polygons=(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>{if(!Array.isArray(p)||!p.length)throw Error('Poligon gol');return p.map(ring);});prepared.set(g,polygons);return polygons;
}
function inRing(p,r){
 if(!bboxContains(r.bbox,p))return 'outside';let inside=false;const c=r.coordinates;
 for(const i of r.buckets[r.bucket(p[1])]){
  const a=c[i-1],b=c[i];const crossing=(a[1]>p[1])!==(b[1]>p[1]),segment=p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
  if(!crossing&&!segment)continue;const sign=orientation(a,b,p);if(segment&&sign===0)return 'boundary';
  if(crossing&&((b[1]>a[1]&&sign>0)||(b[1]<a[1]&&sign<0)))inside=!inside;
 }return inside?'inside':'outside';
}
export function pointInGeometry(point,geometry){
 geographicPoint(...point);let boundary=false;
 for(const polygon of prepare(geometry)){
  const outer=inRing(point,polygon[0]);if(outer==='outside')continue;let excluded=false,onBoundary=outer==='boundary';
  for(const hole of polygon.slice(1)){const result=inRing(point,hole);if(result==='inside'){excluded=true;break;}if(result==='boundary')onBoundary=true;}
  if(!excluded){if(!onBoundary)return 'inside';boundary=true;}
 }return boundary?'boundary':'outside';
}
