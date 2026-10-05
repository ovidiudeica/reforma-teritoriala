const MALCOCI_LOCALITY_RELATION_ID=18968071;
const MALCOCI_CONNECTOR_WAY_ID=123810097;
const EXPECTED_GAP_ENDPOINTS=new Set([1379403420,353223870]);
const REQUIRED_ADMIN_RELATIONS=[
 {id:1691800,admin_level:'4',name:'Raionul Ialoveni'},
 {id:1691801,admin_level:'4',name:'Municipiul Chișinău'},
 {id:18822134,admin_level:'8',name:'Malcoci'}
];

const relationById=(raw,id)=>(raw.elements||[]).find(x=>x.type==='relation'&&Number(x.id)===Number(id))||null;
const wayById=(raw,id)=>(raw.elements||[]).find(x=>x.type==='way'&&Number(x.id)===Number(id))||null;
const endpointSet=way=>new Set([Number(way?.nodes?.[0]),Number(way?.nodes?.at(-1))]);
const setEquals=(a,b)=>a.size===b.size&&[...a].every(x=>b.has(x));

function outerMemberWays(raw,relation){
 const ways=[];
 for(const m of relation?.members||[]){
  if(m.type!=='way'||!['outer',''].includes(m.role||''))continue;
  const w=wayById(raw,m.ref);
  if(!w||!Array.isArray(w.nodes)||w.nodes.length<2)throw new Error('Reviewed Malcoci normalization missing member way '+m.ref);
  ways.push(w);
 }
 return ways;
}
function oddEndpoints(ways){
 const degree=new Map();
 for(const w of ways){
  for(const id of [Number(w.nodes[0]),Number(w.nodes.at(-1))])degree.set(id,(degree.get(id)||0)+1);
 }
 return new Set([...degree].filter(([,d])=>d%2===1).map(([id])=>id));
}
function relationUsesWay(relation,wayId){
 return Boolean((relation?.members||[]).some(m=>m.type==='way'&&Number(m.ref)===Number(wayId)));
}

export function normalizeReviewedMdOsmBoundaryGaps(raw,warnings=[]){
 const relation=relationById(raw,MALCOCI_LOCALITY_RELATION_ID);
 if(!relation)return raw;
 const tags=relation.tags||{};
 if(String(tags.admin_level)!=='9'||tags.boundary!=='administrative'||tags.name!=='Malcoci'||String(tags['ref:cuatm:codunic']||'')!=='5520'){
  throw new Error('Reviewed Malcoci OSM relation contract drift');
 }
 const ways=outerMemberWays(raw,relation);
 const odd=oddEndpoints(ways);
 if(odd.size===0)return raw;
 if(!setEquals(odd,EXPECTED_GAP_ENDPOINTS)){
  throw new Error('Reviewed Malcoci OSM boundary gap drift: '+JSON.stringify([...odd].sort((a,b)=>a-b)));
 }
 const connector=wayById(raw,MALCOCI_CONNECTOR_WAY_ID);
 if(!connector||!setEquals(endpointSet(connector),EXPECTED_GAP_ENDPOINTS)){
  throw new Error('Reviewed Malcoci OSM connector way drift');
 }
 for(const expected of REQUIRED_ADMIN_RELATIONS){
  const r=relationById(raw,expected.id);
  if(!r||String(r.tags?.admin_level)!==expected.admin_level||r.tags?.boundary!=='administrative'||r.tags?.name!==expected.name||!relationUsesWay(r,MALCOCI_CONNECTOR_WAY_ID)){
   throw new Error('Reviewed Malcoci OSM connector administrative evidence drift: '+expected.id);
  }
 }
 if(relationUsesWay(relation,MALCOCI_CONNECTOR_WAY_ID))throw new Error('Reviewed Malcoci OSM gap state inconsistent');
 relation.members=[...(relation.members||[]),{type:'way',ref:MALCOCI_CONNECTOR_WAY_ID,role:'outer'}];
 const closedOdd=oddEndpoints(outerMemberWays(raw,relation));
 if(closedOdd.size!==0)throw new Error('Reviewed Malcoci OSM connector did not close boundary');
 warnings.push({
  type:'reviewed_osm_shared_boundary_member_completion',
  jurisdiction:'MD',
  relation_id:MALCOCI_LOCALITY_RELATION_ID,
  connector_way_id:MALCOCI_CONNECTOR_WAY_ID,
  gap_endpoint_node_ids:[...EXPECTED_GAP_ENDPOINTS].sort((a,b)=>a-b),
  evidence_relation_ids:REQUIRED_ADMIN_RELATIONS.map(x=>x.id),
  coordinate_edit:false,
  source_membership_edit:false,
  build_geometry_member_completion:true,
  reason:'Live OSM relation 18968071 omits an existing shared administrative boundary way. Reuse exact OSM way 123810097, already shared by current OSM administrative relations, solely to assemble the polygon drawn by the standard OSM boundary network.'
 });
 return raw;
}
