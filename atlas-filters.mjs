import {geometryParentState,setGeometryGroup,setGeometrySubtype} from './geometry-taxonomy.mjs';

export function createAtlasFilters({container,document,index,state,onChange,onSeparate}){
 const parents=new Map(),children=new Map(),levels=new Map();
 let separate;
 const row=(label,count,kind,id)=>{
  const item=document.createElement('label');item.className='filter-row';
  const input=document.createElement('input');input.type='checkbox';input.dataset.kind=kind;input.dataset.filter=String(id);input.setAttribute('aria-label',label);
  const text=document.createElement('span');text.textContent=label;
  const number=document.createElement('small');number.textContent=typeof count==='number'?'('+count.toLocaleString('ro-RO')+')':String(count);
  item.appendChild(input);item.appendChild(text);item.appendChild(number);
  return {item,input};
 };
 const section=(title,action,labels=[['Toate',true],['Niciuna',false]])=>{
  const el=document.createElement('section');el.className='filter-section';
  const heading=document.createElement('h3');heading.textContent=title;el.appendChild(heading);
  const controls=document.createElement('div'),buttons=[];controls.className='filter-actions';
  for(const [label,enabled] of labels){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',label+' — '+title);
   button.addEventListener('click',()=>{action(enabled);sync();onChange();});controls.appendChild(button);buttons.push(button);
  }
  el.appendChild(controls);container.appendChild(el);return {el,buttons};
 };
 container.innerHTML='';
 for(const [key,title] of [['administrative','Tipuri administrative'],['other','Alte reprezentări']]){
  const groups=index.groups.filter(g=>g.section===key);
  const {el}=section(title,enabled=>{for(const g of groups)setGeometryGroup(g,state,enabled);});
  for(const g of groups){
   const wrapper=document.createElement('div');wrapper.className='atlas-filter-group';wrapper.setAttribute('role','group');wrapper.setAttribute('aria-label',g.label);
   const parent=row(g.label,g.count,'geometry-class',g.id);parent.item.className+=' filter-parent';
   parents.set(g.id,parent.input);wrapper.appendChild(parent.item);
   parent.input.addEventListener('change',()=>{setGeometryGroup(g,state,parent.input.checked);sync();onChange();});
   const disclosure=document.createElement('details');disclosure.className='atlas-filter-subtypes';
   const summary=document.createElement('summary');summary.textContent='Subtipuri pe jurisdicții';summary.setAttribute('aria-label','Subtipuri — '+g.label);disclosure.appendChild(summary);
   for(const j of g.jurisdictions){
    const heading=document.createElement('h4');heading.className='filter-jurisdiction';heading.textContent=j.label+' ('+j.count.toLocaleString('ro-RO')+')';disclosure.appendChild(heading);
    for(const sub of j.subtypes){
     const child=row(sub.label,sub.count,'geometry-subtype',sub.id);child.input.setAttribute('aria-label',sub.label+' — '+j.label+' — '+g.label);children.set(sub.id,{input:child.input,group:g});
     child.input.addEventListener('change',()=>{setGeometrySubtype(g,state,sub.id,child.input.checked);sync();onChange();});
     disclosure.appendChild(child.item);
    }
   }
   wrapper.appendChild(disclosure);el.appendChild(wrapper);
  }
 }
 const statKeys=[1,2,3,...(index.statisticalCounts.has('unclassified')?['unclassified']:[])];
 const {el:stats}=section('Niveluri statistice',enabled=>{for(const level of statKeys){if(enabled)state.statisticalLevels.add(level);else state.statisticalLevels.delete(level);}},[['Toate nivelurile',true],['Niciun nivel',false]]);
 const intro=document.createElement('p');intro.className='hint statistical-filter-note';intro.textContent='Nivelurile controlează toate cele '+index.statisticalRoles+' entități cu rol statistic. Cele '+index.reusedStatistical+' entități coalesced reutilizează geometria administrativă existentă, fără duplicare; cele '+index.statisticalOnly+' limite separate sunt controlate și de comutatorul de mai jos.';stats.appendChild(intro);
 const separateRow=row('Afișează limite statistice separate',index.statisticalOnly,'separate-statistical','separate');separate=separateRow.input;
 separate.addEventListener('change',()=>{onSeparate(separate.checked);sync();onChange();});stats.appendChild(separateRow.item);
 for(const level of statKeys){
  const meta=index.statisticalLevelStats.get(level)||{roles:index.statisticalCounts.get(level)||0,separate:0,reused:0,jurisdictions:{RO:{roles:0,separate:0},MD:{roles:0,separate:0}}};
  const label=level==='unclassified'?'Rol statistic neclasificat':'Nivel statistic '+level;
  const count=meta.roles.toLocaleString('ro-RO')+' entități · '+meta.reused.toLocaleString('ro-RO')+' reutilizate · '+meta.separate.toLocaleString('ro-RO')+' separate';
  const item=row(label,count,'statistical',level);
  levels.set(level,item.input);
  item.input.addEventListener('change',()=>{if(item.input.checked)state.statisticalLevels.add(level);else state.statisticalLevels.delete(level);sync();onChange();});stats.appendChild(item.item);
  const breakdown=document.createElement('p');breakdown.className='hint statistical-level-breakdown';
  const ro=meta.jurisdictions.RO||{roles:0,separate:0},md=meta.jurisdictions.MD||{roles:0,separate:0};
  breakdown.textContent='RO: '+ro.roles.toLocaleString('ro-RO')+' total / '+ro.reused.toLocaleString('ro-RO')+' reutilizate / '+ro.separate.toLocaleString('ro-RO')+' separate · MD: '+md.roles.toLocaleString('ro-RO')+' total / '+md.reused.toLocaleString('ro-RO')+' reutilizate / '+md.separate.toLocaleString('ro-RO')+' separate';
  stats.appendChild(breakdown);
 }
 const note=document.createElement('p');note.className='hint';note.textContent='Pentru entitățile coalesced, geometria este vizibilă dacă o activează filtrul administrativ sau nivelul statistic. Pentru ascundere completă trebuie dezactivate ambele roluri. Comutatorul pentru limite separate nu dezactivează nivelurile reutilizate.';stats.appendChild(note);
 function sync(){
  for(const g of index.groups){const input=parents.get(g.id);Object.assign(input,geometryParentState(g,state));}
  for(const [id,{input,group}] of children)input.checked=state.geometryClasses.has(group.id)&&state.geometrySubtypes.has(id);
  for(const [level,input] of levels)input.checked=state.statisticalLevels.has(level);
  separate.checked=state.separateStatisticalGeometry;
 }
 sync();
 return {sync,parents,children,levels,separate};
}
