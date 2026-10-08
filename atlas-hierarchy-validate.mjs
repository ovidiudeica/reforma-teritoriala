// Frontend ACTUAL/P2 boundary: validate the entire public hierarchy before any DOM,
// URL, search, or map controller can consume it. No writes to source or release data.
const CONTRACT='actual-consolidated-hierarchy-v1';
const ROOTS=['osm-r90689','osm-r58974'];
const fail=(message)=>{throw new Error('Atlas hierarchy contract: '+message);};
const nonempty=value=>typeof value==='string'&&value.length>0;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const nodeField=(node,key,expected)=>{
 if(!same(node[key],expected))fail(node.id+': '+key+' differs from ACTUAL entity index');
};

export function validateConsolidatedHierarchy(tree,entityById,{expectedCount=null}={}){
 if(!tree||typeof tree!=='object'||Array.isArray(tree))fail('missing tree object');
 if(tree.contract!==CONTRACT||tree.schema_version!==1||tree.mode!=='ACTUAL')
  fail('unsupported contract/schema/mode');
 if(!Array.isArray(tree.nodes)||!Array.isArray(tree.root_ids))fail('invalid nodes/root_ids');
 if(!same(tree.root_ids,ROOTS))fail('unexpected or duplicate RO/MD roots');
 if(!Number.isSafeInteger(tree.node_count)||tree.node_count!==tree.nodes.length)
  fail('node_count differs from nodes array');
 if(!(entityById instanceof Map)||tree.node_count!==entityById.size)
  fail('node_count differs from public entity index');
 if(expectedCount!==null&&tree.node_count!==expectedCount)
  fail('node_count differs from immutable release manifest');
 if(!Number.isSafeInteger(tree.max_depth)||tree.max_depth<0)
  fail('invalid max_depth');
 const nodes=new Map(),members={RO:0,MD:0};
 for(const node of tree.nodes){
  if(!node||!nonempty(node.id)||!nonempty(node.display_name)||!nonempty(node.display_type))
   fail('incomplete node identity/label');
  if(nodes.has(node.id))fail('duplicate node id '+node.id);
  if(!['RO','MD'].includes(node.jurisdiction))fail(node.id+': invalid jurisdiction');
  if(!Array.isArray(node.child_ids)||!Array.isArray(node.roles))
   fail(node.id+': missing child_ids/roles');
  if(!Number.isSafeInteger(node.depth)||node.depth<0)
   fail(node.id+': invalid depth');
  if(node.parent_id!==null&&!nonempty(node.parent_id))
   fail(node.id+': invalid parent_id');
  const entity=entityById.get(node.id);
  if(!entity)fail(node.id+': missing public entity');
  if(node.jurisdiction!==entity.jurisdiction)fail(node.id+': jurisdiction differs from public index');
  for(const field of ['display_name','display_type','roles'])
   nodeField(node,field,entity[field]);
  nodeField(node,'parent_id',entity.hierarchy?.consolidated_parent_id??null);
  nodeField(node,'statistical_code',entity.statistical?.code??null);
  nodeField(node,'statistical_level',entity.statistical?.level??null);
  if(new Set(node.roles).size!==node.roles.length)
   fail(node.id+': duplicate semantic role');
  nodes.set(node.id,node);members[node.jurisdiction]++;
 }
 for(const id of entityById.keys())if(!nodes.has(id))fail('unreachable public entity '+id);
 if(!same(tree.entity_count_by_jurisdiction,members))
  fail('jurisdiction counts differ from tree nodes');
 const rootSet=new Set(ROOTS),seen=new Set(),queue=ROOTS.map((id)=>[id,0]);
 for(const [id] of queue){
  const root=nodes.get(id);
  if(!root||root.parent_id!==null||root.display_type!=='state')
   fail('invalid state root '+id);
 }
 let maximum=0;
 for(let i=0;i<queue.length;i++){
  const [id,depth]=queue[i],node=nodes.get(id);
  if(seen.has(id))fail('cycle/duplicate reachability at '+id);
  seen.add(id);
  if(depth!==node.depth)fail(id+': depth differs from calculated hierarchy');
  maximum=Math.max(maximum,depth);
  const localChildren=new Set();
  for(const childId of node.child_ids){
   if(!nonempty(childId)||localChildren.has(childId))
    fail(id+': duplicate or malformed child_id '+String(childId));
   localChildren.add(childId);
   const child=nodes.get(childId);
   if(!child)fail(id+': orphan child '+childId);
   if(child.parent_id!==id)fail(childId+': reciprocal parent mismatch');
   if(child.jurisdiction!==node.jurisdiction)fail(childId+': crosses RO/MD jurisdiction');
   if(rootSet.has(childId))fail(childId+': state root nested below another node');
   queue.push([childId,depth+1]);
  }
 }
 if(seen.size!==nodes.size)
  fail('unreachable/cyclic nodes: '+[...nodes.keys()].filter(id=>!seen.has(id)).slice(0,5).join(', '));
 if(maximum!==tree.max_depth)fail('max_depth metadata differs from calculated hierarchy');
 for(const node of nodes.values()){
  if(node.parent_id===null&&!rootSet.has(node.id))
   fail(node.id+': unexpected detached root');
  if(node.parent_id!==null){
   const parent=nodes.get(node.parent_id);
   if(!parent||!parent.child_ids.includes(node.id))
    fail(node.id+': missing reciprocal parent-to-child edge');
  }
 }
 return nodes;
}
