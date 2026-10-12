import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import GeoJSONWriter from 'jsts/org/locationtech/jts/io/GeoJSONWriter.js';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import OverlayOp from 'jsts/org/locationtech/jts/operation/overlay/OverlayOp.js';
import IsValidOp from 'jsts/org/locationtech/jts/operation/valid/IsValidOp.js';
import STRtree from 'jsts/org/locationtech/jts/index/strtree/STRtree.js';
import Envelope from 'jsts/org/locationtech/jts/geom/Envelope.js';
import {orientation,pointInGeometry} from '../../atlas-point-geometry.mjs';
import {frontierMetres} from '../../atlas-topology-policy.mjs';
const reader=new GeoJSONReader(),writer=new GeoJSONWriter();
export function readTopologyGeometry(raw){if(!raw||!['Polygon','MultiPolygon'].includes(raw.type))throw Error('Geometrie poligonală indisponibilă');const polygons=raw.type==='Polygon'?[raw.coordinates]:raw.coordinates;pointInGeometry(polygons?.[0]?.[0]?.[0],raw);const g=reader.read(raw),op=new IsValidOp(g);if(!op.isValid())throw Error(op.getValidationError().getMessage());return g;}
export function classifyMatrix(m){if(m.isDisjoint())return 'disjoint';if(m.isEquals(2,2))return 'equal';if(m.isCovers())return 'contains';if(m.isCoveredBy())return 'within';if(m.get(0,0)===2)return 'overlap';return m.get(1,1)===1?'boundary':'point';}
function linesOf(g){if(g.type==='LineString')return [g.coordinates];if(g.type==='MultiLineString')return g.coordinates;if(g.type==='GeometryCollection')return g.geometries.flatMap(linesOf);return [];}
const pointKey=p=>p[0]+','+p[1];
const edgeTrees=new WeakMap();
function edges(g){if(edgeTrees.has(g))return edgeTrees.get(g);const tree=new STRtree(),raw=writer.write(g),polygons=raw.type==='Polygon'?[raw.coordinates]:raw.coordinates;for(const rings of polygons)for(const ring of rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if(pointKey(a)!==pointKey(b))tree.insert(new Envelope(a[0],b[0],a[1],b[1]),{a,b});}edgeTrees.set(g,tree);return tree;}
function exactlyCovered(g,a,b){return edges(g).query(new Envelope(a[0],b[0],a[1],b[1])).toArray().some(e=>[a,b].every(p=>p[0]>=Math.min(e.a[0],e.b[0])&&p[0]<=Math.max(e.a[0],e.b[0])&&p[1]>=Math.min(e.a[1],e.b[1])&&p[1]<=Math.max(e.a[1],e.b[1])&&orientation(e.a,e.b,p)===0));}
export function commonFrontier(a,b){
 // Direct OverlayOp deliberately avoids SnapIfNeededOverlayOp's repair fallback.
 const geometry=OverlayOp.overlayOp(a.getBoundary(),b.getBoundary(),OverlayOp.INTERSECTION),seen=new Set(),lines=[];
 for(const line of linesOf(writer.write(geometry)))for(let i=1;i<line.length;i++){let x=line[i-1].slice(0,2),y=line[i].slice(0,2);let kx=pointKey(x),ky=pointKey(y);if(kx===ky)continue;if(!exactlyCovered(a,x,y)||!exactlyCovered(b,x,y))throw Error('Segment GIS neconfirmat prin orientare exactă pe ambele surse');if(kx>ky){[x,y]=[y,x];[kx,ky]=[ky,kx];}const key=kx+'|'+ky;if(!seen.has(key)){seen.add(key);lines.push([x,y]);}}
 lines.sort((a,b)=>pointKey(a[0]).localeCompare(pointKey(b[0]))||pointKey(a[1]).localeCompare(pointKey(b[1])));
 const metres=frontierMetres(lines);if(!lines.length||!Number.isFinite(metres)||metres<=0)throw Error('Frontieră de dimensiune 1 fără lungime verificabilă');return {lines,metres};
}
function fillsHole(container,island){if(island.getNumGeometries()!==1)return false;for(let i=0;i<container.getNumGeometries();i++){const polygon=container.getGeometryN(i);for(let j=0;j<polygon.getNumInteriorRing();j++){const coordinates=polygon.getInteriorRingN(j).getCoordinates().map(c=>[c.x,c.y]),hole=reader.read({type:'Polygon',coordinates:[coordinates]});if(RelateOp.relate(hole,island).isEquals(2,2))return true;}}return false;}
export function relateGeometries(a,b){const matrix=RelateOp.relate(a,b),relation=classifyMatrix(matrix);if(relation!=='boundary')return {relation,matrix:matrix.toString()};const frontier=commonFrontier(a,b),enclosure=fillsHole(a,b)?'b':fillsHole(b,a)?'a':null;return {relation,matrix:matrix.toString(),...frontier,...(enclosure?{enclosure}:{})};}
