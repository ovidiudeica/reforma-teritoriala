// P6.4.1 — overview bounds from immutable ACTUAL catalog metadata.
// Geometry itself is never simplified, transformed or changed.
export const countryRootIds=Object.freeze(['osm-r58974','osm-r90689']);
export function roMdBounds(entities){
 const bounds=[];
 for(const id of countryRootIds){
  const entity=entities.get(id),b=entity?.map?.bbox;
  if(!entity||!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||
     b[0]>=b[2]||b[1]>=b[3]||b[0]<-180||b[2]>180||b[1]<-90||b[3]>90){
   throw new Error('Limitele geometrice ACTUAL RO+MD sunt indisponibile: '+id);
  }
  bounds.push(b);
 }
 return [[Math.min(...bounds.map(b=>b[1])),Math.min(...bounds.map(b=>b[0]))],
  [Math.max(...bounds.map(b=>b[3])),Math.max(...bounds.map(b=>b[2]))]];
}
export function fitRoMd(map,entities,{mobile=map.getSize().x<900}={}){
 const bounds=roMdBounds(entities);
 const compact=mobile&&map.getSize().y<540;
 const padding=compact?{paddingTopLeft:[14,68],paddingBottomRight:[14,78]}
  :mobile?{paddingTopLeft:[18,105],paddingBottomRight:[18,110]}
  :{paddingTopLeft:[26,38],paddingBottomRight:[26,42]};
 map.fitBounds(bounds,{...padding,maxZoom:12,animate:false});
 return bounds;
}
export function attachRoMdZoomControl(document,Leaflet){
 const button=document.getElementById('map-home');
 const zoom=document.querySelector('.leaflet-control-zoom');
 if(!button||!zoom)throw new Error('Controlul Leaflet de zoom lipsește');
 zoom.appendChild(button);
 button.classList.add('leaflet-control-zoom-home');
 Leaflet.DomEvent?.disableClickPropagation?.(button);
 Leaflet.DomEvent?.disableScrollPropagation?.(button);
 return button;
}
