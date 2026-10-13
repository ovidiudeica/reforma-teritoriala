import {attribution,limits} from './atlas-export.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function mapSvg({map,L,title='Reforma Teritorială',snapshotId,selection=[],date=new Date(),legend=[]}){
 const size=map.getSize();if(!size.x||!size.y||map._animatingZoom||map._panAnim?._inProgress)throw Error('Așteaptă încheierea deplasării și reîncearcă exportul');
 const paths=[];let vertices=0;const renderedOrder=new Map([...map.getContainer().querySelectorAll('.leaflet-pane svg path,.leaflet-pane svg circle')].map((p,i)=>[p,i]));
 const point=latlng=>{const p=map.latLngToContainerPoint(latlng);if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Poziționare vectorială invalidă');return p;};
 function ring(points,close){const p=points.map(x=>{if(++vertices>2000000)throw Error('Harta este prea complexă pentru exportul vizual');const q=point(x);return q.x+','+q.y;});return p.length?'M'+p.join('L')+(close?'Z':''):'';}
 function nested(points,close){return points.length&&points[0]?.lat!==undefined?ring(points,close):points.map(p=>nested(p,close)).join(' ');}
 const styles=new Map();
 map.eachLayer(layer=>{
  if(layer instanceof L.TileLayer||layer instanceof L.LayerGroup||layer instanceof L.Renderer)return;
  if(!(layer instanceof L.Path))throw Error('Un strat vizibil nu permite export vectorial fidel. Exportul a fost oprit.');
  const o=layer.options||{},style={stroke:o.stroke===false?'none':o.color||'#3388ff',weight:o.weight??3,dash:o.dashArray||'',fill:o.fill===false?'none':o.fillColor||o.color||'#3388ff',fillOpacity:o.fillOpacity??.2,opacity:o.opacity??1};
  const attributes=`stroke="${esc(style.stroke)}" stroke-width="${esc(style.weight)}" stroke-dasharray="${esc(style.dash)}" stroke-opacity="${esc(style.opacity)}" fill="${esc(style.fill)}" fill-opacity="${esc(style.fillOpacity)}" fill-rule="evenodd" stroke-linejoin="round" stroke-linecap="round"`;
  let shape;if(layer instanceof L.CircleMarker){if(layer instanceof L.Circle)throw Error('Cercul metric nu este suportat de exportul vectorial');const p=point(layer.getLatLng());shape=`<circle cx="${p.x}" cy="${p.y}" r="${layer.getRadius()}" ${attributes}/>`;}else if(layer instanceof L.Polyline){shape=`<path d="${nested(layer.getLatLngs(),layer instanceof L.Polygon)}" ${attributes}/>`;}else throw Error('Geometrie vizuală nesuportată');
  const pane=map.getPane(o.pane||'overlayPane'),z=Number.parseInt(globalThis.getComputedStyle?.(pane).zIndex||'400',10)||400;paths.push({shape,z,order:renderedOrder.get(layer._path)??paths.length});
  const cls=o.className||'';const label=cls.startsWith('comparison')?({ 'comparison-A':'A — contur continuu','comparison-B':'B — contur întrerupt','comparison-common':'Intersecție — gros','comparison-exclusive-A':'Exclusiv A — puncte','comparison-exclusive-B':'Exclusiv B — linii lungi'})[cls]:cls==='neighbors-highlight'?'Vecini / frontiere evidențiate':cls==='measurement-point'||style.stroke==='#713c9b'?'Măsurare desenată de utilizator':cls==='identify-point-marker'?'Punct identificat':null;
  if(label)styles.set(label,style);
 });
 for(const entry of legend)styles.set(entry.label,{stroke:entry.style.color,weight:entry.style.weight??2,dash:entry.style.dashArray??'',fill:entry.style.fillColor??entry.style.color,fillOpacity:entry.style.fillOpacity??.1});
 const width=Math.max(640,size.x),top=85,scale=width/size.x,height=top+size.y*scale+140+styles.size*24;
 const text=(y,value)=>`<text x="16" y="${y}" font-size="14" font-family="sans-serif">${esc(value)}</text>`;
 const bounds=map.getBounds(),footer=[`Limite WGS84: ${bounds.getWest()}, ${bounds.getSouth()} — ${bounds.getEast()}, ${bounds.getNorth()}`,`Snapshot: ${snapshotId}; ${date.toISOString()}`,`${attribution.geometry} · ODbL · ${attribution.copyrightUrl}`,'Identitate oficială: INS SIRUTA / BNS CUATM; clasificări: Eurostat/GISCO / BNS','Fără raster OSM. Scară metrică omisă: scara Mercator variază cu latitudinea.','Geometria nu reprezintă document cadastral.'];
 const wrap=(value,length=95)=>String(value).match(new RegExp('.{1,'+length+'}(?:\\s|$)|.{1,'+length+'}','g'))||[''];
 const selected=selection.join(' · '),header=wrap(title+ (selected?' — '+selected:''),Math.max(40,Math.floor(width/8))).slice(0,3);
 let y=top+size.y*scale+24;const lines=[];for(const [label,s]of styles){lines.push(`<path d="M16 ${y-5}h42" stroke="${esc(s.stroke)}" stroke-width="${esc(s.weight)}" stroke-dasharray="${esc(s.dash)}"/>`+`<text x="70" y="${y}" font-size="14" font-family="sans-serif">${esc(label)}</text>`);y+=24;}
 for(const value of footer){for(const line of wrap(value,Math.max(40,Math.floor(width/8)))){lines.push(text(y,line));y+=20;}}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.max(height,y+20)}" viewBox="0 0 ${width} ${Math.max(height,y+20)}" role="img"><title>${esc(title)}</title><desc>${esc(limits)} Fără raster OSM.</desc><rect width="100%" height="100%" fill="white"/>${header.map((s,i)=>text(24+i*20,s)).join('')}<defs><clipPath id="atlas-map-clip"><rect width="${size.x}" height="${size.y}"/></clipPath></defs><g transform="translate(0 ${top}) scale(${scale})"><rect width="${size.x}" height="${size.y}" fill="#fff"/><g clip-path="url(#atlas-map-clip)">${paths.sort((a,b)=>a.z-b.z||a.order-b.order).map(p=>p.shape).join('')}</g></g><g fill="#111">${lines.join('')}</g></svg>`;
}
export function printSvg(document,svg,orientation){
 if(!['portrait','landscape'].includes(orientation))throw Error('Orientare invalidă');
 const previous=document.activeElement;const frame=document.createElement('iframe');frame.title='Hartă pregătită pentru imprimare';frame.hidden=true;document.body.appendChild(frame);
 const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||typeof win?.print!=='function'){frame.remove();throw Error('Imprimarea nu este disponibilă; descarcă SVG');}
 doc.open();doc.write(`<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Imprimă harta</title><style>@page{size:A4 ${orientation};margin:10mm}html,body{margin:0}body{display:flex;align-items:center;justify-content:center}svg{max-width:100%;max-height:${orientation==='landscape'?185:272}mm;width:auto;height:auto;print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body>${svg}</body></html>`);doc.close();
 const remove=()=>{const restore=document.activeElement===frame||document.activeElement===document.body;frame.remove();if(restore&&previous?.isConnected)previous.focus?.({preventScroll:true});};win.addEventListener('afterprint',remove,{once:true});try{win.focus();win.print();}catch(e){remove();throw e;}setTimeout(remove,120000);
}
