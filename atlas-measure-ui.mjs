import {areaMeasurement,distanceMeasurement} from './atlas-geographic-measurement.mjs';
import {parseCoordinate} from './atlas-identify-ui.mjs';
import {geographicPoint} from './atlas-point-geometry.mjs';
import {geometricMethod} from './atlas-geometric-ui.mjs';
const fmt=(n,d=2)=>n.toLocaleString('ro',{maximumFractionDigits:d}),length=n=>n<1000?fmt(n,1)+' m':fmt(n/1000)+' km',area=n=>n<10000?fmt(n,1)+' m²':n<1e6?fmt(n/10000)+' ha':fmt(n/1e6)+' km²';
export function createAtlasMeasure({document,panels,draw}){
 const el=id=>document.getElementById(id);if(document.nodeType!==9||!el('measure-panel'))return null;
 let points=[],mode='distance',armed=false,finished=false,layer=null,internal=false,moved=false,down=null;const pointers=new Set();
 const status=el('measure-status'),error=el('measure-error'),map=el('map'),floating=el('measure-map-command');
 function disarm(){armed=false;floating.hidden=true;map.classList.remove('measure-picking');el('measure-map-status').textContent='';}
 function render(){
  layer?.remove();layer=points.length?draw(points,mode,finished):null;error.textContent='';el('measure-points').textContent=points.length+' puncte';
  const details=el('measure-coordinates');details.textContent=points.map((p,i)=>(i+1)+': '+p[1]+', '+p[0]).join('\n');
  try{if(mode==='distance'){const m=distanceMeasurement(points);status.textContent='Distanță cumulată: '+length(m.totalMetres);el('measure-segments').textContent=m.segments.map((v,i)=>'Segment '+(i+1)+': '+length(v)).join(' · ');}else{el('measure-segments').textContent='';if(!finished){status.textContent='Suprafață în curs: închide explicit poligonul pentru validare.';}else{const m=areaMeasurement(points);status.textContent='Suprafață: '+area(m.areaM2)+' · Perimetru: '+length(m.perimeterMetres);}}}catch(e){status.textContent='Calcul indisponibil';error.textContent=e.message;}
  el('measure-undo').disabled=!points.length;el('measure-finish').disabled=points.length<(mode==='distance'?2:3);el('measure-map-finish').disabled=el('measure-finish').disabled;
 }
 function add(point){if(finished)throw Error('Șterge măsurarea sau anulează ultimul punct pentru a continua.');geographicPoint(...point);if(points.length>=1000)throw Error('Maximum 1.000 de puncte');points.push(point);render();}
 function clear(){disarm();points=[];finished=false;render();}
 function finish(){if(mode==='area'){try{areaMeasurement(points);}catch(e){disarm();panels.open('measure');error.textContent=e.message;return;}}else if(points.length<2){error.textContent='Sunt necesare minimum două puncte';return;}finished=true;disarm();panels.open('measure');render();}
 function arm(){finished=false;armed=true;internal=true;panels.close({focus:false});internal=false;floating.hidden=false;map.classList.add('measure-picking');el('measure-map-status').textContent='Măsurare activă: adaugă puncte cu click. Deplasarea hărții nu adaugă puncte. Escape oprește desenarea.';map.focus();render();}
 el('measure-mode').addEventListener('change',()=>{clear();mode=el('measure-mode').value;render();});
 el('measure-start').addEventListener('click',arm);el('measure-clear').addEventListener('click',clear);el('measure-finish').addEventListener('click',finish);el('measure-map-finish').addEventListener('click',finish);
 el('measure-map-return').addEventListener('click',()=>{disarm();panels.open('measure');});
 el('measure-undo').addEventListener('click',()=>{points.pop();finished=false;render();});
 el('measure-form').addEventListener('submit',event=>{event.preventDefault();try{add([parseCoordinate(el('measure-lon').value),parseCoordinate(el('measure-lat').value)]);}catch(e){error.textContent=e.message;}});
 panels.onChange(({active})=>{if(active!=='measure'&&!internal)disarm();});
 map.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);down={id:e.pointerId,x:e.clientX,y:e.clientY};moved=pointers.size>1;},{capture:true});
 map.addEventListener('pointermove',e=>{if(down&&e.pointerId===down.id&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)moved=true;},{capture:true});
 map.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);},{capture:true});
 map.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);moved=true;down=null;},{capture:true});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&armed&&!event.defaultPrevented){event.preventDefault();disarm();panels.open('measure');}},true);
 el('measure-method').textContent=geometricMethod+' Distanța este între punctele alese, nu rutieră. Datele rămân numai în memoria acestei pagini.';
 render();return {get armed(){return armed;},fromMap(latlng){if(!armed||moved)return;try{add([latlng.lng,latlng.lat]);}catch(e){error.textContent=e.message;}},clear,disarm,get state(){return {mode,armed,finished,points:points.map(p=>[...p])};}};
}
