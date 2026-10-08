import {formatEntityName} from './atlas-name-format.mjs';
export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const jurisdictionOrder=j=>j==='RO'?0:j==='MD'?1:2;
const collator=new Intl.Collator('ro');
// Shared display labels do not classify geometry.
export const typeLabels={
 statistical_level_1:'nivel statistic 1',
 statistical_level_2:'nivel statistic 2',
 statistical_level_3:'nivel statistic 3',
 state:'stat (context teritorial)',
 county:'județ',
 district:'raion',
 capital_municipality:'municipiu-capitală',
 municipality:'municipiu',
 town:'oraș',
 commune:'comună',
 independent_village:'sat independent',
 chisinau_sector:'sector al municipiului Chișinău',
 local_uat:'UAT locală',
 sector:'sector',
 level_2_municipality:'municipiu de nivelul II',
 special_territorial_unit:'unitate teritorială specială',
 level_2_or_special_unit:'unitate administrativă de nivel superior',
 level_1_municipality:'municipiu de nivelul I',
 town_uat:'oraș',
 level_1_uat:'UAT de nivelul I',
 commune_or_independent_village_uat:'comună / sat independent',
 municipality_or_city_uat:'municipiu / oraș',
 component_locality:'localitate componentă',
 subdivision_or_component_area:'subdiviziune / localitate',
 intermediate_administrative_unit:'unitate administrativă intermediară',
 component_village_boundary_representation:'reprezentare de sat component',
 municipality_component_locality_boundary_representation:'reprezentare de localitate componentă',
 non_administrative_or_auxiliary_area:'zonă auxiliară'
};
export const typeLabel=type=>typeLabels[type]||String(type||'unitate administrativă').replaceAll('_',' ');
function parents(entity,nodeById,entityById){
 const result=[],seen=new Set([entity.id]);let cursor=entity.id;
 while(cursor){const id=nodeById.get(cursor)?.parent_id??entityById.get(cursor)?.hierarchy?.consolidated_parent_id;
  if(!id||seen.has(id))break;seen.add(id);const parent=nodeById.get(id)||entityById.get(id);if(!parent)break;
  result.push(formatEntityName(parent.display_name));cursor=id;
 }return result;
}
export function searchResultDescriptor(entity,nodeById=new Map(),entityById=new Map()){
 const ancestry=parents(entity,nodeById,entityById);
 const parent=ancestry[0]||entity.hierarchy?.consolidated_parent_name||entity.hierarchy?.legal_parent_name||entity.legal?.parent_name||(entity.roles?.includes('statistical')?entity.hierarchy?.statistical_parent_name:null);
 const identifier=entity.legal?.id?String(entity.legal.registry||'ID')+' '+entity.legal.id:entity.statistical?.code||(entity.representation?.osm_relation_id!=null?'OSM r'+entity.representation.osm_relation_id:entity.id);
 return {name:formatEntityName(entity.display_name),type:typeLabel(entity.display_type||entity.representation?.inferred_type),parent:formatEntityName(parent||''),ancestry,identifier};
}
export function createSearchIndex(entities,nodeById=new Map()){
 const byId=new Map(entities.map(e=>[e.id,e]));
 const records=[...byId.values()].map(entity=>{
  const descriptor=searchResultDescriptor(entity,nodeById,byId),relation=entity.representation?.osm_relation_id;
  const fields=[[0,[entity.display_name]],[1,[entity.official_name,entity.legal?.name]],[2,[entity.legal?.id,entity.statistical?.code,entity.id,relation,relation==null?null:'r'+relation]],[3,entity.searchable_names||[]],[4,[descriptor.parent,...descriptor.ancestry,entity.hierarchy?.legal_parent_name,entity.hierarchy?.parent_name]]].map(([priority,values])=>({priority,values:[...new Set(values.map(normalizeSearch).filter(Boolean))]}));
  return {entity,descriptor,fields};
 });
 const peers=new Map();
 for(const record of records){const key=[record.entity.jurisdiction,normalizeSearch(record.descriptor.name),record.descriptor.type].join('|');if(!peers.has(key))peers.set(key,[]);peers.get(key).push(record);}
 for(const list of peers.values())for(const record of list){
  const d=record.descriptor;let context=d.parent;
  if(list.length>1&&list.some(other=>other!==record&&other.descriptor.parent===d.parent))context=[...new Set([d.parent,...d.ancestry.slice(1,2)].filter(Boolean))].join(' → ');
  const parts=[record.entity.jurisdiction,d.type,context,d.identifier].filter(Boolean);
  if(list.some(other=>other!==record&&other.descriptor.parent===d.parent&&other.descriptor.identifier===d.identifier))parts.push(record.entity.id);
  d.secondary=parts.join(' · ');
 }return records;
}
export function rankSearchResult(record,query){
 const q=normalizeSearch(query);if(!q)return Infinity;let score=Infinity;
 for(const field of record.fields)for(const value of field.values){const match=value===q?0:value.startsWith(q)?1:value.includes(q)?2:Infinity;score=Math.min(score,match*10+field.priority);}
 return score;
}
export function searchEntities(query,index,limit=20){
 if(!normalizeSearch(query))return [];
 return index.map(record=>({record,score:rankSearchResult(record,query)})).filter(r=>Number.isFinite(r.score)).sort((a,b)=>a.score-b.score||jurisdictionOrder(a.record.entity.jurisdiction)-jurisdictionOrder(b.record.entity.jurisdiction)||collator.compare(a.record.entity.display_name,b.record.entity.display_name)||(a.record.entity.id<b.record.entity.id?-1:a.record.entity.id>b.record.entity.id?1:0)).slice(0,limit).map(r=>r.record);
}
export function groupSearchResults(results){
 return [...new Set(results.map(r=>r.entity.jurisdiction))].sort((a,b)=>jurisdictionOrder(a)-jurisdictionOrder(b)||a.localeCompare(b)).map(j=>({jurisdiction:j,label:j==='RO'?'România':j==='MD'?'Republica Moldova':j,results:results.filter(r=>r.entity.jurisdiction===j)}));
}
// Individual Unicode code points: injective IDs, no raw HTML.
export const searchOptionId=id=>'atlas-search-option-'+Array.from(String(id),c=>c.codePointAt(0).toString(16)).join('-');
export function revealSearchOption(container,option){
 const outer=container.getBoundingClientRect(),row=option.getBoundingClientRect(),top=outer.top+(container.clientTop||0),bottom=top+container.clientHeight;
 if(row.top<top)container.scrollTop+=row.top-top;else if(row.bottom>bottom)container.scrollTop+=row.bottom-bottom;
}
export function createAtlasSearch({input,container,status,document,index,onSelect,onError=console.error}){
 let query='',results=[],activeId=null,open=false,options=new Map();
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',container.id||'search-results');container.setAttribute('role','listbox');container.setAttribute('aria-label','Rezultate căutare');
 function sync(){
  input.setAttribute('aria-expanded',String(open));container.hidden=!open;
  for(const [id,option] of options){const active=open&&id===activeId;option.setAttribute('aria-selected',String(active));option.classList.toggle('active',active);}
  if(open&&activeId)input.setAttribute('aria-activedescendant',searchOptionId(activeId));else input.removeAttribute?.('aria-activedescendant');
 }
 function close(){open=false;activeId=null;if(status)status.textContent='';sync();}
 function activate(id,scroll=false){if(!options.has(id))return;activeId=id;sync();if(scroll)revealSearchOption(container,options.get(id));}
 async function select(id){const record=results.find(r=>r.entity.id===id);if(!record)return;query=record.descriptor.name;input.value=query;close();input.focus?.();await onSelect(id,{zoom:true,source:'search'});}
 function render(){
  container.innerHTML='';options=new Map();const groups=groupSearchResults(results);results=groups.flatMap(g=>g.results);
  for(const group of groups){let target=container;
   if(groups.length>1){target=document.createElement('div');target.setAttribute('role','group');target.setAttribute('aria-label',group.label);const heading=document.createElement('div');heading.className='search-group-heading';heading.textContent=group.label;heading.setAttribute('aria-hidden','true');target.appendChild(heading);container.appendChild(target);}
   for(const record of group.results){
    const option=document.createElement('button');option.type='button';option.tabIndex=-1;option.className='search-result';option.id=searchOptionId(record.entity.id);option.dataset.entityId=record.entity.id;option.setAttribute('role','option');
    const name=document.createElement('b');name.textContent=record.descriptor.name;const metadata=document.createElement('small');metadata.textContent=record.descriptor.secondary;option.appendChild(name);option.appendChild(metadata);
    option.addEventListener('pointermove',()=>activate(record.entity.id));option.addEventListener('mousedown',event=>event.preventDefault());option.addEventListener('click',()=>select(record.entity.id).catch(onError));options.set(record.entity.id,option);target.appendChild(option);
   }
  }
  if(status)status.textContent=open&&!results.length?'Nicio entitate găsită.':open?results.length+' rezultate.':'';sync();
 }
 function setQuery(value){query=String(value);input.value=query;results=searchEntities(query,index);activeId=null;open=Boolean(normalizeSearch(query));render();}
 function moveActive(direction){if(!open&&normalizeSearch(query))setQuery(query);if(!results.length)return;const current=results.findIndex(r=>r.entity.id===activeId),next=current<0?(direction>0?0:results.length-1):Math.max(0,Math.min(results.length-1,current+direction));if(results[next].entity.id!==activeId)activate(results[next].entity.id,true);}
 input.addEventListener('input',()=>setQuery(input.value));
 input.addEventListener('keydown',event=>{if(event.isComposing)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();moveActive(event.key==='ArrowDown'?1:-1);}else if(event.key==='Enter'&&open&&activeId){event.preventDefault();return select(activeId).catch(onError);}else if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab')close();});
 input.addEventListener('blur',close);sync();
 return {setQuery,moveActive,close,selectActive:()=>open&&activeId?select(activeId):Promise.resolve(),updateIndex(value){index=value;if(open)setQuery(query);},get state(){return {query,results:[...results],activeId,activeIndex:results.findIndex(r=>r.entity.id===activeId),open};}};
}
