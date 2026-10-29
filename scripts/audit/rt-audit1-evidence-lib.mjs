import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const key=r=>r.child_id+'|'+r.parent_id;
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const semanticEqual=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export async function verifySourceManifest(rows,read){const seen=new Set();for(const r of rows){assert(typeof r.path==='string'&&!/^[a-z]+:|^[/\\]|\0/i.test(r.path)&&!r.path.split(/[\\/]/).includes('..'),'Cale nepermisa');assert(!seen.has(r.path),'Sursa duplicata');seen.add(r.path);assert.match(r.sha256,/^[a-f0-9]{64}$/);const b=await read(r.path);assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);}return seen.size;}
export function asOfHistory(elements,type,id,epoch){
 const rows=elements.filter(e=>e.type===type&&e.id===id).sort((a,b)=>a.version-b.version);
 assert(rows.length,'Istoric absent');
 for(let i=0;i<rows.length;i++){assert(rows[i].version===i+1,'HISTORY_INCOMPLETE');assert(Number.isFinite(Date.parse(rows[i].timestamp)),'Timestamp invalid');if(i)assert(Date.parse(rows[i].timestamp)>=Date.parse(rows[i-1].timestamp),'Ordine temporala contradictorie');}
 const selected=rows.filter(x=>Date.parse(x.timestamp)<=Date.parse(epoch)).at(-1);
 assert(selected&&selected.visible!==false,'Nicio versiune vizibila la epoca');return selected;
}
export function memberDelta(before,after){
 const id=m=>m.type+'/'+m.ref+'/'+(m.role||'');const a=new Map((before?.members||[]).map(m=>[id(m),m])),b=new Map((after.members||[]).map(m=>[id(m),m]));
 return {added:[...b].filter(([k])=>!a.has(k)).map(([,v])=>v),removed:[...a].filter(([k])=>!b.has(k)).map(([,v])=>v),order_changed:JSON.stringify(before?.members||[])!==JSON.stringify(after.members||[])};
}
function decimal(value){assert(Number.isFinite(value),'Coordonata invalida');const [mantissa,exponent='0']=String(value).toLowerCase().split('e'),neg=mantissa.startsWith('-'),text=neg?mantissa.slice(1):mantissa,[whole,fraction='']=text.split('.');let n=BigInt(whole+fraction)*(neg?-1n:1n),d=fraction.length-Number(exponent);if(d<0){n*=10n**BigInt(-d);d=0;}return {n,d};}
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const c=a%b;a=b;b=c;}return a;};
export function geometryEdges(g){assert(['Polygon','MultiPolygon'].includes(g?.type));const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates,edges=[];for(const poly of polygons)for(const ring of poly){assert(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1),'Inel deschis');for(let i=1;i<ring.length;i++)edges.push([ring[i-1],ring[i]]);}return edges;}
// Decimal coordinates are interpreted exactly as stored. No rounding, snapping,
// vertex removal or rewritten geometries. Only intervals on the same exact line.
export function exactBoundaryComparison(edgesA,edgesB){
 let digits=0;for(const edges of [edgesA,edgesB])for(const edge of edges)for(const p of edge)for(const c of p.slice(0,2))digits=Math.max(digits,decimal(c).d);
 const integer=x=>{const r=decimal(x);return r.n*10n**BigInt(digits-r.d);};
 const build=edges=>{const lines=new Map();for(const [[x0,y0],[x1,y1]]of edges){const x=integer(x0),y=integer(y0),xx=integer(x1),yy=integer(y1),dx=xx-x,dy=yy-y;if(dx===0n&&dy===0n)continue;const divisor=gcd(dx,dy);let a=dy/divisor,b=-dx/divisor;if(a<0n||(a===0n&&b<0n)){a=-a;b=-b;}const c=-(a*x+b*y),k=[a,b,c].map(String).join(','),u=dx===0n?y:x,v=dx===0n?yy:xx,range=u<v?[u,v]:[v,u];if(!lines.has(k))lines.set(k,[]);lines.get(k).push(range);}
  for(const [k,values]of lines){values.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);const merged=[];for(const interval of values){const last=merged.at(-1);if(last&&interval[0]<=last[1]){if(interval[1]>last[1])last[1]=interval[1];}else merged.push([...interval]);}lines.set(k,merged);}return lines;};
 const a=build(edgesA),b=build(edgesB);
 const missing=(a,b)=>{let count=0,first=null;for(const [line,intervals]of a)for(const [start,end]of intervals){let cursor=start;for(const [lo,hi]of b.get(line)||[]){if(hi<=cursor)continue;if(lo>=end)break;if(lo>cursor){count++;first??={line,from:String(cursor),to:String(lo<end?lo:end)};}if(hi>cursor)cursor=hi;if(cursor>=end)break;}if(cursor<end){count++;first??={line,from:String(cursor),to:String(end)};}}return {uncovered_intervals:count,first_witness:first};};
 const onlyA=missing(a,b),onlyB=missing(b,a);return {algorithm:'exact-decimal-line-intervals-v1',decimal_scale:digits,a_segments:edgesA.length,b_segments:edgesB.length,a_not_covered_by_b:onlyA,b_not_covered_by_a:onlyB,boundary_sets_equal:onlyA.uncovered_intervals===0&&onlyB.uncovered_intervals===0,geometry_modified:false};
}
export function verifyUniquePairs(rows,expected){assert.equal(rows.length,expected);assert.equal(new Set(rows.map(key)).size,expected,'Perechi duplicate');}
export function parseCsv(text){const rows=[];let row=[],s='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){s+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(s);s='';}else if(c==='\n'&&!quoted){row.push(s);rows.push(row);row=[];s='';}else s+=c;}assert(!quoted,'CSV incomplet');assert(!s&&!row.length,'CSV fara terminator');return rows;}
