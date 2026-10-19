// WEB-R2b.3: explicit, reversible geometry-checkbox actions; source data stays immutable.
import {osmLevelForTreeNode} from './atlas-osm-admin-badges.mjs';
import {OSM_ADMIN_LEVELS,OSM_UNKNOWN} from './atlas-osm-admin-filter.mjs';
const validLevels=new Set(OSM_ADMIN_LEVELS);
const key=change=>change.kind+':'+change.id;
const checked=(change,actual,outline)=>(change.kind==='outline'?outline:actual).has(change.id);

export function planOsmLevelGeometryAction({mode,levels,nodeById,entityById,osmRoleById,outlineIds,visibleEntityIds,visibleOperationalOutlineIds}){
 if(!['show','hide'].includes(mode))throw Error('WEB-R2b.3: invalid action');
 if(!(nodeById instanceof Map)||!(entityById instanceof Map)||!(outlineIds instanceof Set)||
  !(visibleEntityIds instanceof Set)||!(visibleOperationalOutlineIds instanceof Set))throw Error('WEB-R2b.3: invalid explicit selection state');
 const selected=new Set([...levels].filter(level=>validLevels.has(level)));
 const changes=[],counts={RO:0,MD:0,NI:0},eligible={RO:0,MD:0,NI:0};
 let skippedAliases=0;
 for(const [id,node] of nodeById){
  if(id.startsWith('view-nistrenia-role-')){if(selected.has(osmLevelForTreeNode(node,{entityById,osmRoleById})))skippedAliases++;continue;}
  const level=osmLevelForTreeNode(node,{entityById,osmRoleById});
  if(!selected.has(level))continue;
  const outline=outlineIds.has(id);
  const entity=outline?null:entityById.get(id);
  // Never allow the 85 reused NI aliases to become independent ACTUAL mutations.
  if(!outline&&!entity)continue;
  const jurisdiction=outline?'NI':entity.jurisdiction;
  if(!['RO','MD','NI'].includes(jurisdiction)||(jurisdiction==='NI'&&!outline))continue;
  const kind=outline?'outline':'actual';
  const was=(outline?visibleOperationalOutlineIds:visibleEntityIds).has(id);
  eligible[jurisdiction]++;
  const after=mode==='show';
  if(was!==after){changes.push({kind,id,was,after});counts[jurisdiction]++;}
 }
 changes.sort((a,b)=>key(a).localeCompare(key(b)));
 return {mode,levels:[...selected].sort((a,b)=>a-b),hasUnknown:[...levels].includes(OSM_UNKNOWN),eligible,counts,
  skippedAliases,changes,changed:changes.length};
}

export function applyOsmLevelGeometryAction(plan,{visibleEntityIds,visibleOperationalOutlineIds}){
 if(!plan||!Array.isArray(plan.changes)||!(visibleEntityIds instanceof Set)||!(visibleOperationalOutlineIds instanceof Set))throw Error('WEB-R2b.3: invalid confirmation');
 // Check the entire plan before changing any checkbox (no partial mutation).
 for(const change of plan.changes)if(checked(change,visibleEntityIds,visibleOperationalOutlineIds)!==change.was)throw Error('WEB-R2b.3: checkbox state changed; repeat preview');
 for(const change of plan.changes){const set=change.kind==='outline'?visibleOperationalOutlineIds:visibleEntityIds;if(change.after)set.add(change.id);else set.delete(change.id);}
 return {changes:plan.changes.map(change=>({...change})),mode:plan.mode};
}

export function undoOsmLevelGeometryAction(transaction,{visibleEntityIds,visibleOperationalOutlineIds}){
 if(!transaction?.changes)throw Error('WEB-R2b.3: missing undo');
 let reverted=0,conflicts=0;
 for(const change of transaction.changes){
  const set=change.kind==='outline'?visibleOperationalOutlineIds:visibleEntityIds;
  if(set.has(change.id)!==change.after){conflicts++;continue;} // Never overwrite later manual edits.
  if(change.was)set.add(change.id);else set.delete(change.id);
  reverted++;
 }
 return {reverted,conflicts};
}
