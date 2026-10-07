import {geometryParentState,setGeometryGroup,setGeometrySubtype} from './geometry-taxonomy.mjs';

export function createAtlasFilters({container,document,index,state,onChange,onSeparate}){
 const parents=new Map(),children=new Map(),levels=new Map();
 let separate;
 const row=(label,count,kind,id)=>{
  const item=document.createElement('label');item.className='filter-row';
  const input=document.createElement('input');input.type='checkbox';input.dataset.kind=kind;input.dataset.filter=String(id);
  const text=document.createElement('span');text.textContent=label;
  const number=document.createElement('small');number.textContent='('+count.toLocaleString('ro-RO')+')';
  item.appendChild(input);item.appendChild(text);item.appendChild(number);
  return {item,input};
 };
 const section=(title,action)=>{
  const el=document.createElement('section');el.className='filter-section';
  const heading=document.createElement('h3');heading.textContent=title;el.appendChild(heading);
  const controls=document.createElement('div');controls.className='filter-actions';
  for(const [label,enabled] of [['Toate',true],['Niciuna',false]]){
   const button=document.createElement('button');button.type='button';button.textContent=label;
   button.addEventListener('click',()=>{action(enabled);sync();onChange();});controls.appendChild(button);
  }
  el.appendChild(controls);container.appendChild(el);return el;
 };
 container.innerHTML='';
 for(const [key,title] of [['administrative','Tipuri administrative'],['other','Alte reprezentări']]){
  const groups=index.groups.filter(g=>g.section===key);
  const el=section(title,enabled=>{for(const g of groups)setGeometryGroup(g,state,enabled);});
  for(const g of groups){
   const wrapper=document.createElement('div');wrapper.className='atlas-filter-group';
   const parent=row(g.label,g.count,'geometry-class',g.id);parent.item.className+=' filter-parent';
   parents.set(g.id,parent.input);wrapper.appendChild(parent.item);
   parent.input.addEventListener('change',()=>{setGeometryGroup(g,state,parent.input.checked);sync();onChange();});
   const disclosure=document.createElement('details');disclosure.className='atlas-filter-subtypes';
   const summary=document.createElement('summary');summary.textContent='Subtipuri pe jurisdicții';disclosure.appendChild(summary);
   for(const j of g.jurisdictions){
    const heading=document.createElement('p');heading.className='filter-jurisdiction';heading.textContent=j.label+' ('+j.count.toLocaleString('ro-RO')+')';disclosure.appendChild(heading);
    for(const sub of j.subtypes){
     const child=row(sub.label,sub.count,'geometry-subtype',sub.id);children.set(sub.id,{input:child.input,group:g});
     child.input.addEventListener('change',()=>{setGeometrySubtype(g,state,sub.id,child.input.checked);sync();onChange();});
     disclosure.appendChild(child.item);
    }
   }
   wrapper.appendChild(disclosure);el.appendChild(wrapper);
  }
 }
 const statKeys=[1,2,3,...(index.statisticalCounts.has('unclassified')?['unclassified']:[])];
 const stats=section('Niveluri statistice',enabled=>{for(const level of statKeys){if(enabled)state.statisticalLevels.add(level);else state.statisticalLevels.delete(level);}});
 for(const level of statKeys){
  const item=row(level==='unclassified'?'Rol statistic neclasificat':'Nivel statistic '+level,index.statisticalCounts.get(level)||0,'statistical',level);
  levels.set(level,item.input);
  item.input.addEventListener('change',()=>{if(item.input.checked)state.statisticalLevels.add(level);else state.statisticalLevels.delete(level);sync();onChange();});stats.appendChild(item.item);
 }
 const separateRow=row('Limite statistice separate',index.statisticalOnly,'separate-statistical','separate');separate=separateRow.input;
 separate.addEventListener('change',()=>{onSeparate(separate.checked);sync();onChange();});stats.appendChild(separateRow.item);
 const note=document.createElement('p');note.className='hint';note.textContent=index.statisticalRoles+' roluri statistice: '+index.reusedStatistical+' reutilizează geometria administrativă, '+index.statisticalOnly+' au limite separate. Filtrele geometrice și nivelurile statistice se intersectează fără dublarea entităților.';stats.appendChild(note);
 function sync(){
  for(const g of index.groups){const input=parents.get(g.id);Object.assign(input,geometryParentState(g,state));}
  for(const [id,{input,group}] of children)input.checked=state.geometryClasses.has(group.id)&&state.geometrySubtypes.has(id);
  for(const [level,input] of levels)input.checked=state.statisticalLevels.has(level);
  separate.checked=state.separateStatisticalGeometry;
 }
 sync();
 return {sync,parents,children,levels,separate};
}
