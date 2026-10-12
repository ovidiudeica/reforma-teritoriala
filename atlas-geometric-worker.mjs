import './vendor/gis/jsts-2.12.1.min.js';
import {createGeometricOverlay} from './atlas-geometric-overlay.mjs';
const engine=createGeometricOverlay(globalThis.jsts);
self.onmessage=({data})=>{try{const result=data.operation==='metrics'?engine.metrics(data.a):engine.compare(data.a,data.b);self.postMessage({id:data.id,result});}catch(error){self.postMessage({id:data.id,error:'Calcul indisponibil: '+error.message});}};
