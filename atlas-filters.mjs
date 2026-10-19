import {OSM_ADMIN_LEVELS,OSM_UNKNOWN} from './atlas-osm-admin-filter.mjs';
import {geometryParentState,setGeometryGroup,setGeometrySubtype} from './geometry-taxonomy.mjs';

export function createAtlasFilters({container,document,index,state,onChange,onSeparate,onOsmGeometryPreview=()=>null,onOsmGeometryApply=()=>null,onOsmGeometryUndo=()=>null,canUndoOsmGeometry=()=>false}){
 const parents=new Map(),children=new Map(),levels=new Map(),osmLevels=new Map();
 let separate;
 const row=(label,count,kind,id)=>{
  const item=document.createElement('label');item.className='filter-row';
  // Long statistical counts belong below the label, never beside a shrinking title.
  if(kind==='statistical'||kind==='separate-statistical')item.className+=' filter-row-statistical';
  const input=document.createElement('input');input.type='checkbox';input.dataset.kind=kind;input.dataset.filter=String(id);input.setAttribute('aria-label',label);
  const text=document.createElement('span');text.textContent=label;
  const number=document.createElement('small');number.textContent=typeof count==='number'?'('+count.toLocaleString('ro-RO')+')':String(count);
  item.appendChild(input);item.appendChild(text);item.appendChild(number);
  return {item,input};
 };
 const section=(title,action,labels=[['Toate',true],['Niciuna',false]])=>{
  const el=document.createElement('details');el.className='filter-section atlas-panel-disclosure';el.open=title==='Tipuri administrative';
  const heading=document.createElement('summary');heading.textContent=title;el.appendChild(heading);
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
 const {el:osmSection}=section('Nivel administrativ OSM',enabled=>{for(const level of [...OSM_ADMIN_LEVELS,OSM_UNKNOWN]){if(enabled)state.osmAdminLevels.add(level);else state.osmAdminLevels.delete(level);}},[['Toate nivelurile în arbore',true],['Niciun nivel în arbore',false]]);
 const osmIntro=document.createElement('p');osmIntro.className='hint';osmIntro.textContent='Alege nivelurile afișate în arbore. Nu modifică bifele sau geometriile; nivelurile statistice sunt independente.';osmSection.appendChild(osmIntro);
 const treeSummary=document.createElement('p');treeSummary.className='hint osm-tree-summary';treeSummary.textContent='Numărătoarea arborelui va fi disponibilă după încărcarea ierarhiei.';osmSection.appendChild(treeSummary);
 for(const level of [...OSM_ADMIN_LEVELS,OSM_UNKNOWN]){const label=level===OSM_UNKNOWN?'Fără nivel OSM verificat':'Nivel OSM '+level;const item=row(label,'', 'osm-admin-level',level);osmLevels.set(level,item.input);item.input.addEventListener('change',()=>{if(item.input.checked)state.osmAdminLevels.add(level);else state.osmAdminLevels.delete(level);sync();onChange();});osmSection.appendChild(item.item);}
 // WEB-R2b.3: these controls are separate from the tree-only OSM filter above.
 const geometryActions=document.createElement('div');geometryActions.className='osm-level-geometry-actions';
 geometryActions.setAttribute('role','group');geometryActions.setAttribute('aria-label','Comenzi explicite pentru geometriile nivelurilor OSM');
 const actionHelp=document.createElement('p');actionHelp.className='hint';
 actionHelp.textContent='Comenzile schimbă bifele geometriilor pentru nivelurile OSM numerice selectate, numai după confirmare. Nu modifică filtrul arborelui, selecția sau nivelurile statistice. Cele 85 de roluri NI reutilizate și categoria fără nivel verificat sunt excluse.';
 geometryActions.appendChild(actionHelp);
 const actionButtons=document.createElement('div');actionButtons.className='osm-level-geometry-buttons';
 const showButton=document.createElement('button');showButton.type='button';showButton.textContent='Afișează geometriile nivelurilor selectate';
 const hideButton=document.createElement('button');hideButton.type='button';hideButton.textContent='Ascunde geometriile nivelurilor selectate';
 const undoButton=document.createElement('button');undoButton.type='button';undoButton.textContent='Anulează ultima operațiune pe niveluri';
 for(const b of [showButton,hideButton,undoButton]){b.className='action-button';b.setAttribute('aria-label',b.textContent+' — Nivel administrativ OSM');actionButtons.appendChild(b);}
 geometryActions.appendChild(actionButtons);
 const confirmation=document.createElement('div');confirmation.className='osm-level-action-confirm';confirmation.hidden=true;
 confirmation.setAttribute('role','group');confirmation.setAttribute('aria-label','Confirmarea domeniului acțiunii OSM');
 const scope=document.createElement('p');confirmation.appendChild(scope);
 const accept=document.createElement('button');accept.type='button';accept.className='action-button';accept.textContent='Confirmă operațiunea';
 const cancel=document.createElement('button');cancel.type='button';cancel.className='action-button';cancel.textContent='Renunță';
 for(const b of [accept,cancel])b.setAttribute('aria-label',b.textContent+' — confirmare Nivel administrativ OSM');
 confirmation.appendChild(accept);confirmation.appendChild(cancel);geometryActions.appendChild(confirmation);
 const actionStatus=document.createElement('p');actionStatus.className='hint';actionStatus.setAttribute('role','status');actionStatus.setAttribute('aria-live','polite');geometryActions.appendChild(actionStatus);
 osmSection.appendChild(geometryActions);
 let pending=null;
 const dismiss=()=>{pending=null;confirmation.hidden=true;};
 const preview=mode=>{
  dismiss();
  const chosen=[...state.osmAdminLevels],plan=onOsmGeometryPreview(mode,chosen);
  if(!plan){actionStatus.textContent='Catalogul geometric nu este încă disponibil.';return;}
  if(!plan.changed){actionStatus.textContent=plan.levels.length?'Pentru nivelurile numerice selectate, toate bifele eligibile sunt deja în starea cerută.':'Selectează cel puțin un nivel OSM numeric pentru o comandă asupra geometriilor. Categoria fără nivel verificat filtrează doar arborele.';return;}
  pending={mode,chosen,plan};
  const levels=plan.levels.join(', ')||'niciunul';
  const eligible=plan.eligible.RO+plan.eligible.MD+plan.eligible.NI;
  scope.textContent=(mode==='show'?'Vor fi bifate ':'Vor fi debifate ')+plan.changed+' dintre '+eligible+' geometrii eligibile: RO '+plan.counts.RO+', MD '+plan.counts.MD+', contururi NI '+plan.counts.NI+'. Niveluri OSM: '+levels+'. '+plan.skippedAliases+' roluri NI reutilizate excluse. '+(plan.hasUnknown?'Categoria fără nivel verificat este exclusă. ':'')+'Filtrul arborelui și selecția nu se modifică. Confirmi?';
  confirmation.hidden=false;actionStatus.textContent='';
 };
 showButton.addEventListener('click',()=>preview('show'));
 hideButton.addEventListener('click',()=>preview('hide'));
 cancel.addEventListener('click',()=>{dismiss();actionStatus.textContent='Operațiunea a fost anulată. Bifele geometriilor nu s-au schimbat.';});
 accept.addEventListener('click',()=>{
  if(!pending)return;
  const {mode,chosen,plan}=pending;dismiss();
  if(chosen.some(level=>!state.osmAdminLevels.has(level))||state.osmAdminLevels.size!==chosen.length){actionStatus.textContent='Selecția nivelurilor s-a schimbat. Verifică din nou domeniul operațiunii.';return;}
  const latest=onOsmGeometryPreview(mode,chosen);
  if(!latest||JSON.stringify(latest.changes)!==JSON.stringify(plan.changes)){actionStatus.textContent='Bifele s-au schimbat. Verifică din nou domeniul operațiunii.';return;}
  try{const result=onOsmGeometryApply(latest);actionStatus.textContent=result?.message||'Operațiune aplicată.';sync();}
  catch(error){actionStatus.textContent='Operațiunea nu a fost aplicată: '+error.message;}
 });
 undoButton.addEventListener('click',()=>{
  dismiss();const result=onOsmGeometryUndo();actionStatus.textContent=result?.message||'Nu există o operațiune de anulat.';sync();
 });
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
  for(const [level,input] of osmLevels)input.checked=state.osmAdminLevels.has(level);
  separate.checked=state.separateStatisticalGeometry;
  undoButton.disabled=!canUndoOsmGeometry();
 }
 sync();
 return {sync,parents,children,levels,osmLevels,separate,setOsmTreeSummary(summary){
  treeSummary.textContent=summary?'În arbore (toate ramurile): '+summary.matches.toLocaleString('ro-RO')+' potriviri și '+summary.ancestors.toLocaleString('ro-RO')+' strămoși de navigare.':'Numărătoarea arborelui nu este încă disponibilă.';
 },geometryActions:{showButton,hideButton,undoButton,confirmation,scope,accept,cancel,actionStatus}};
}
