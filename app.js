const map=L.map('map',{zoomControl:true}).setView([46.8,26.6],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
L.control.scale({imperial:false}).addTo(map);

const groups={ro:L.layerGroup().addTo(map),md:L.layerGroup().addTo(map)};
const style={color:'#304b40',weight:1.4,opacity:.9,fillColor:'#607c6e',fillOpacity:.08};
const hover={weight:3,fillOpacity:.18};

const queries={
 ro:'[out:json][timeout:60];area["ISO3166-1"="RO"][boundary=administrative]->.a;relation(area.a)[boundary=administrative][admin_level=4];out body;>;out skel qt;',
 md:null
};
const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];

async function overpass(query){
 let last;
 for(const endpoint of endpoints){
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query)});
   if(!r.ok) throw new Error('HTTP '+r.status);
   return await r.json();
  }catch(e){last=e;}
 }
 throw last;
}
function popup(feature){
 const p=feature.properties||{}, t=p.tags||p;
 const name=t['name:ro']||t.name||'Fără denumire';
 const type=t.border_type||t.place||'unitate administrativă';
 return '<b>'+name+'</b><br>'+type+'<br>admin_level: '+(t.admin_level||'—')+'<br>OSM: '+(p.id||'—');
}
async function load(key){
 const group=groups[key]; group.clearLayers();
 try{
  let geo;
  if(key==='md'){
   const [data,gate]=await Promise.all([
    fetch('public/geo/current/md-administrative.geojson',{cache:'no-cache'}),
    fetch('data/current/md-release-gate.json',{cache:'no-cache'})
   ]);
   if(!data.ok||!gate.ok) throw new Error('Snapshot MD indisponibil');
   const gateData=await gate.json();
   if(gateData.status!=='PASS') throw new Error('Snapshot MD nu a trecut release gate');
   geo=await data.json();
   const stamp=gateData.generated_at?new Date(gateData.generated_at).toLocaleString('ro-RO'):'—';
   const el=document.getElementById('md-source-status');
   if(el) el.textContent='MD: snapshot local validat · '+stamp;
  }else{
   const data=await overpass(queries[key]);
   geo=osmtogeojson(data);
  }
  L.geoJSON(geo,{style,onEachFeature:(f,l)=>{
   l.bindPopup(popup(f));
   l.on({mouseover:e=>e.target.setStyle(hover),mouseout:e=>e.target.setStyle(style)});
  }}).addTo(group);
 }catch(e){
  if(key==='md'){const el=document.getElementById('md-source-status');if(el) el.textContent='MD: snapshot local indisponibil';}
  console.error('Nu s-a putut încărca stratul '+key,e);
 }
}
load('ro'); load('md');

document.getElementById('layer-ro').addEventListener('change',e=>e.target.checked?groups.ro.addTo(map):map.removeLayer(groups.ro));
document.getElementById('layer-md').addEventListener('change',e=>e.target.checked?groups.md.addTo(map):map.removeLayer(groups.md));
document.querySelectorAll('.mode').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('.mode').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
 document.getElementById('modeLabel').textContent='Mod: '+btn.textContent;
}));