// Visible hierarchy order is derived exclusively from validated child_ids.
// This model owns expansion and height offsets; it never materializes DOM nodes.
export function flattenVisibleTree(nodeById,rootIds,openIds,visibleIds=null){
 const rows=[],seen=new Set(),pending=rootIds.map((id,index)=>({id,depth:0,pos:index+1,size:rootIds.length})).reverse();
 while(pending.length){
  const row=pending.pop(),node=nodeById.get(row.id);
  if(!node||seen.has(row.id))throw new Error('Atlas hierarchy: missing or repeated node '+row.id);
  seen.add(row.id);if(visibleIds&&!visibleIds.has(row.id))continue;rows.push(row);
  if(!openIds.has(row.id))continue;
  const children=node.child_ids||[];
  for(let i=children.length-1;i>=0;i--)pending.push({id:children[i],depth:row.depth+1,pos:i+1,size:children.length});
 }
 return rows;
}

export function createTreeWindow(rows,{minimumHeight=44,overscan=4}={}){
 if(!Number.isFinite(minimumHeight)||minimumHeight<44)throw new RangeError('Tree row height must be at least 44');
 const measured=new Map();let offsets=[],indices=new Map();
 function rebuild(next=rows){rows=next;indices=new Map(rows.map((row,index)=>[row.id,index]));offsets=[0];for(const row of rows)offsets.push(offsets.at(-1)+Math.max(minimumHeight,measured.get(row.id)||minimumHeight));}
 function indexAt(position){let low=0,high=rows.length;while(low<high){const middle=(low+high)>>1;if(offsets[middle+1]<=position)low=middle+1;else high=middle;}return Math.min(low,Math.max(0,rows.length-1));}
 rebuild();
 return {
  reset:rebuild,
  invalidate(){measured.clear();rebuild();},
  measure(id,height){if(!indices.has(id)||!Number.isFinite(height)||height<minimumHeight)return false;const previous=measured.get(id)||minimumHeight;if(Math.abs(previous-height)<0.5)return false;measured.set(id,height);return true;},
  remeasure(){rebuild();},
  indexAt,
  indexOf:id=>indices.get(id)??-1,
  offset:index=>offsets[index]??offsets.at(-1),
  height:index=>(offsets[index+1]??offsets.at(-1))-(offsets[index]??offsets.at(-1)),
  range(scrollTop,viewportHeight){if(!rows.length)return {start:0,end:0};const start=Math.max(0,indexAt(Math.max(0,scrollTop))-overscan),end=Math.min(rows.length,indexAt(Math.max(0,scrollTop)+Math.max(minimumHeight,viewportHeight))+overscan+1);return {start,end};},
  get rows(){return rows;},
  get totalHeight(){return offsets.at(-1);}
 };
}
