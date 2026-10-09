'use strict';
// P5.0 isolated UX prototype. Demo records; no ACTUAL reads, writes or claims of real geometry.
const items=[
{id:'ro',p:null,n:'România',type:'state',j:'RO',stat:0,code:'RO',map:'ro'},
{id:'ro-n1',p:'ro',n:'Macroregiunea 1',type:'regional',j:'RO',stat:1,code:'RO1',map:'ro'},
{id:'ro-nv',p:'ro-n1',n:'Regiunea Nord-Vest',type:'regional',j:'RO',stat:2,code:'RO11',map:'ro'},
{id:'ro-cluj',p:'ro-nv',n:'Cluj',type:'regional',j:'RO',stat:3,code:'RO113',map:'ro'},
{id:'ro-bihor',p:'ro-nv',n:'Bihor',type:'regional',j:'RO',stat:3,code:'RO111',map:'ro'},
{id:'ro-uat',p:'ro-cluj',n:'Cluj-Napoca',type:'local',j:'RO',stat:0,code:'SIRUTA · demo',map:'ro'},
{id:'ro-stat',p:'ro',n:'Limită statistică ilustrativă',type:'other',j:'RO',stat:1,separate:true,code:'DEMO-RO',map:'ro'},
{id:'md',p:null,n:'Republica Moldova',type:'state',j:'MD',stat:0,code:'MD',map:'md'},
{id:'md-n1',p:'md',n:'Nivel statistic 1 · demonstrativ',type:'regional',j:'MD',stat:1,code:'MD1 · demo',map:'md'},
{id:'md-n2',p:'md-n1',n:'Nivel statistic 2 · demonstrativ',type:'regional',j:'MD',stat:2,code:'MD11 · demo',map:'md'},
{id:'md-chisinau',p:'md-n2',n:'Chișinău',type:'regional',j:'MD',stat:3,code:'CUATM · demo',map:'md'},
{id:'md-local',p:'md-chisinau',n:'Localitate demonstrativă',type:'local',j:'MD',stat:0,code:'DEMO-MD',map:'md'},
{id:'md-sep',p:'md',n:'Limită statistică separată · demo',type:'other',j:'MD',stat:2,separate:true,code:'DEMO-SEP',map:'md'}
];
const byId=new Map(items.map(x=>[x.id,x])),children=new Map(items.map(x=>[x.id,items.filter(y=>y.p===x.id)])),roots=items.filter(x=>!x.p);
const $=id=>document.getElementById(id);
const state={open:new Set(['ro','md','ro-n1','ro-nv']),selected:new Set(),focused:null,overrides:new Map(),query:'',tab:'tree',zoom:1,layer:true,filters:false};
const checked=(selector,value)=>{const el=document.querySelector(selector+'="'+value+'"]');return Boolean(el&&el.checked)};
function visible(item){if(state.overrides.has(item.id))return state.overrides.get(item.id);const jurisdiction=checked('input[data-jurisdiction]',item.j),admin=checked('input[data-class]',item.type),stat=Boolean(item.stat)&&checked('input[data-level]',String(item.stat));return jurisdiction&&(item.separate?stat&&$('separate').checked:admin||stat);}
function descendants(id){let count=0;for(const n of children.get(id)||[]){count++;count+=descendants(n.id);}return count;}
function ancestorIds(item){const a=[];for(let p=item.p;p;p=byId.get(p)?.p)a.push(p);return a;}
function makeRow(item,depth){const wrap=document.createElement('div');wrap.className='node';const row=document.createElement('div');row.className='node-row';row.style.setProperty('--depth',depth);row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(depth+1));row.setAttribute('aria-selected',String(state.selected.has(item.id)));row.classList.toggle('active',state.focused===item.id);row.classList.toggle('is-hidden',!visible(item));const kids=children.get(item.id)||[];if(kids.length)row.setAttribute('aria-expanded',String(state.open.has(item.id)));
 const twist=document.createElement('button');twist.className='twisty';twist.type='button';twist.disabled=!kids.length;twist.textContent=kids.length?(state.open.has(item.id)?'▾':'▸'):'·';twist.setAttribute('aria-label',(state.open.has(item.id)?'Restrânge ':'Extinde ')+item.n);twist.onclick=()=>{if(state.open.has(item.id))state.open.delete(item.id);else state.open.add(item.id);render();};row.append(twist);
 const toggle=document.createElement('input');toggle.type='checkbox';toggle.className='show';toggle.checked=visible(item);toggle.setAttribute('aria-label','Geometrie: '+item.n);toggle.onchange=()=>{state.overrides.set(item.id,toggle.checked);render();};row.append(toggle);
 const level=document.createElement('span');level.className='level '+(item.stat?'stat':item.type==='local'?'admin':'');level.textContent=item.stat?'S'+item.stat:item.type==='state'?'STAT':item.type==='local'?'UAT':'ADM';row.append(level);
 const name=document.createElement('button');name.type='button';name.className='item';name.title=item.n+' · '+item.code;const label=document.createElement('span');label.textContent=item.n;const sub=document.createElement('small');sub.textContent=item.code+' · '+item.j+(item.separate?' · limită separată':'');name.append(label,sub);name.onclick=()=>select(item.id);row.append(name);
 if(kids.length){const count=document.createElement('small');count.className='counter';count.textContent=descendants(item.id);count.title='Descendenți';row.append(count);}wrap.append(row);
 if(kids.length&&state.open.has(item.id)){const sub=document.createElement('div');sub.setAttribute('role','group');for(const n of kids)sub.append(makeRow(n,depth+1));wrap.append(sub);}return wrap;}
function renderTree(){const tree=$('tree');tree.replaceChildren();for(const n of roots)tree.append(makeRow(n,0));}
function renderResults(){const target=$('results');target.replaceChildren();const q=state.query.trim().toLocaleLowerCase('ro');const matched=q?items.filter(i=>(i.n+' '+i.code+' '+i.id+' '+i.j).toLocaleLowerCase('ro').includes(q)):items;$('matches').textContent='('+matched.length+')';for(const item of matched){const b=document.createElement('button');b.className='result';b.style.cssText='display:block;border:0;background:transparent;width:100%;text-align:left;padding:11px 9px;border-bottom:1px solid #e4eae4;cursor:pointer';b.textContent=item.n+' · '+item.code;b.onclick=()=>select(item.id);target.append(b);}if(!matched.length){const p=document.createElement('p');p.textContent='Niciun rezultat în datele demonstrative.';target.append(p);}}
function renderMap(){const item=byId.get(state.focused);for(const n of document.querySelectorAll('.area')){n.classList.toggle('active',Boolean(item&&n.dataset.region===item.map));n.classList.toggle('is-hidden',!state.layer||!items.some(x=>x.map===n.dataset.region&&visible(x)));}const svg=document.querySelector('.mockmap svg');svg.style.transform='scale('+state.zoom+')';svg.style.transformOrigin='center';$('detail-name').textContent=item?.n||'Nicio entitate selectată';$('detail-meta').textContent=item?(item.j+' · '+(item.stat?'Nivel statistic '+item.stat+' · ':'')+item.type+' · '+item.code):'Nume · tip · rol statistic/administrativ · cod';$('map-caption').textContent=item?'Selecție demonstrativă: '+item.n+'. Conturul este schematic.':'Selectează o identitate din arbore pentru a evidenția o zonă demonstrativă.';$('map-layers').setAttribute('aria-pressed',String(state.layer));}
function render(){renderTree();renderResults();renderMap();$('selection-count').textContent=state.selected.size+' '+(state.selected.size===1?'entitate selectată':'entități selectate');$('tree').hidden=state.tab!=='tree';$('results').hidden=state.tab!=='results';$('tab-tree').setAttribute('aria-selected',String(state.tab==='tree'));$('tab-results').setAttribute('aria-selected',String(state.tab==='results'));let changed=0;for(const el of document.querySelectorAll('.filter-body input'))if(!el.checked)changed++;$('filter-count').textContent=String(changed+state.overrides.size);}
function select(id){const item=byId.get(id);if(!item)return;state.focused=id;state.selected.add(id);for(const p of ancestorIds(item))state.open.add(p);render();if(innerWidth<=900)toggleNav(false);}
function toggleNav(open){$('sidebar').classList.toggle('open',open);$('nav-open').setAttribute('aria-expanded',String(open));$('drawer-shade').hidden=!open;}
function toggleFilters(open){state.filters=open;$('filters').classList.toggle('open',open);$('filters').setAttribute('aria-hidden',String(!open));$('filters-open').setAttribute('aria-expanded',String(open));if(open&&innerWidth<=900)toggleNav(false);}
$('query').addEventListener('input',e=>{state.query=e.target.value;state.tab=state.query?'results':'tree';render();});
$('search-clear').onclick=()=>{$('query').value='';state.query='';state.tab='tree';render();$('query').focus();};
$('tab-tree').onclick=()=>{state.tab='tree';render();};$('tab-results').onclick=()=>{state.tab='results';render();};
$('collapse').onclick=()=>{state.open.clear();render();};$('expand').onclick=()=>{for(const n of items)if(ancestorIds(n).length<3)state.open.add(n.id);render();};
$('reset').onclick=()=>{state.open=new Set(['ro','md']);state.selected.clear();state.focused=null;state.overrides.clear();$('query').value='';state.query='';state.tab='tree';render();};
$('clear-selection').onclick=()=>{state.selected.clear();state.focused=null;render();};$('detail-close').onclick=$('clear-selection').onclick;
$('filters-open').onclick=()=>toggleFilters(!state.filters);$('filters-close').onclick=()=>toggleFilters(false);
$('filters-reset').onclick=()=>{for(const n of document.querySelectorAll('.filter-body input'))n.checked=true;state.overrides.clear();render();};for(const n of document.querySelectorAll('.filter-body input'))n.addEventListener('change',render);
$('zoom-in').onclick=()=>{state.zoom=Math.min(1.65,Math.round((state.zoom+.15)*100)/100);renderMap();};$('zoom-out').onclick=()=>{state.zoom=Math.max(.75,Math.round((state.zoom-.15)*100)/100);renderMap();};$('map-reset').onclick=()=>{state.zoom=1;renderMap();};$('map-layers').onclick=()=>{state.layer=!state.layer;renderMap();};
$('nav-open').onclick=()=>toggleNav(!$('sidebar').classList.contains('open'));$('drawer-shade').onclick=()=>toggleNav(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){toggleFilters(false);toggleNav(false);}});
const grip=$('resizer'),sidebar=$('sidebar');let dragging=false;
grip.addEventListener('pointerdown',e=>{if(innerWidth<=900)return;dragging=true;grip.setPointerCapture(e.pointerId);});
grip.addEventListener('pointermove',e=>{if(!dragging)return;const v=Math.max(280,Math.min(660,e.clientX));sidebar.style.width=v+'px';grip.setAttribute('aria-valuenow',String(v));});
grip.addEventListener('pointerup',()=>{dragging=false;});grip.addEventListener('pointercancel',()=>{dragging=false;});
grip.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const old=parseInt(getComputedStyle(sidebar).width);const n=e.key==='Home'?280:e.key==='End'?660:Math.max(280,Math.min(660,old+(e.key==='ArrowRight'?20:-20)));sidebar.style.width=n+'px';grip.setAttribute('aria-valuenow',String(n));});
render();