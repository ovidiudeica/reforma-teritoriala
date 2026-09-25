const map=L.map('map',{zoomControl:true}).setView([46.7,26.7],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
L.control.scale({imperial:false}).addTo(map);
document.querySelectorAll('.mode').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('.mode').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
 document.getElementById('modeLabel').textContent='Mod: '+btn.textContent;
}));