const map=L.map('map',{zoomControl:true}).setView([46.8,26.6],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
L.control.scale({imperial:false}).addTo(map);

const groups={ro:L.layerGroup().addTo(map),md:L.layerGroup().addTo(map)};
const style={color:'#304b40',weight:1.4,opacity:.9,fillColor:'#607c6e',fillOpacity:.08};
const hover={weight:3,fillOpacity:.18};
const snapshots={
 ro:{
  data:'public/geo/current/ro-administrative.geojson',
  gate:'data/current/ro-release-gate.json',
  label:'RO'
 },
 md:{
  data:'public/geo/current/md-administrative.geojson',
  gate:'data/current/md-release-gate.json',
  label:'MD'
 }
};

function popup(feature){
 const p=feature.properties||{}, t=p.tags||p;
 const name=t['name:ro']||t.name||'Fără denumire';
 const type=t.border_type||t.place||'unitate administrativă';
 return '<b>'+name+'</b><br>'+type+'<br>admin_level: '+(t.admin_level||'—')+'<br>OSM: '+(p.id||'—');
}
async function load(key){
 const group=groups[key], source=snapshots[key], status=document.getElementById(key+'-source-status');
 group.clearLayers();
 try{
  const [data,gate]=await Promise.all([
   fetch(source.data,{cache:'no-cache'}),
   fetch(source.gate,{cache:'no-cache'})
  ]);
  if(!data.ok||!gate.ok) throw new Error('Snapshot '+source.label+' indisponibil');
  const gateData=await gate.json();
  if(gateData.status!=='PASS') throw new Error('Snapshot '+source.label+' nu a trecut release gate');
  const geo=await data.json();
  const stamp=gateData.generated_at?new Date(gateData.generated_at).toLocaleString('ro-RO'):'—';
  if(status) status.textContent=source.label+': snapshot local validat · '+stamp;
  L.geoJSON(geo,{style,onEachFeature:(f,l)=>{
   l.bindPopup(popup(f));
   l.on({mouseover:e=>e.target.setStyle(hover),mouseout:e=>e.target.setStyle(style)});
  }}).addTo(group);
 }catch(e){
  if(status) status.textContent=source.label+': snapshot local indisponibil sau nevalidat';
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