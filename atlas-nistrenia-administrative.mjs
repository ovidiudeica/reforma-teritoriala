// NI-FIN: source-scoped presentation identities, never legal ACTUAL entities.
const fail=message=>{throw Error('NI-FIN model: '+message);};
export const NI_ADMIN_SCHEMA='ni-fin-administrative-view-v1';
export const NI_GEOMETRY_STATUSES=Object.freeze(['GEOMETRY_VERIFIED','GEOMETRY_CANDIDATE','NO_GEOMETRY_EVIDENCE','TOPOLOGY_CONFLICT']);
export function validateNistreniaAdministrativeModel(model,{actualIds=null}={}){
 if(model?.schema!==NI_ADMIN_SCHEMA||model.baseline_year!==2023||model.actual_mutation_allowed!==false||model.p91_import_allowed!==false||model.legal_certification!=='PENDING'||model.effective_control!=='UNDETERMINED')fail('authority/temporal contract');
 if(!Array.isArray(model.nodes)||!Array.isArray(model.geometry_resources)||!model.source_aliases)fail('missing registry');
 const nodes=new Map(),resources=new Map();
 for(const resource of model.geometry_resources){
  if(typeof resource.canonical_id!=='string'||resources.has(resource.canonical_id)||!['ACTUAL','OSM_OUTLINE'].includes(resource.kind)||resource.geometry_status!=='GEOMETRY_VERIFIED'||!Number.isInteger(resource.osm_relation_id))fail('resource identity');
  if(resource.kind==='ACTUAL'&&(resource.canonical_id!=='osm-r'+resource.osm_relation_id||(actualIds&&!actualIds.has(resource.canonical_id))))fail('unavailable canonical ACTUAL reference');
  if('geometry' in resource||'coordinates' in resource)fail('copied polygon');
  resources.set(resource.canonical_id,resource);
 }
 if(resources.size!==93||model.geometry_resources.filter(x=>x.kind==='ACTUAL').length!==85||model.geometry_resources.filter(x=>x.kind==='OSM_OUTLINE').length!==8)fail('resource coverage');
 for(const node of model.nodes){
  if(typeof node.id!=='string'||!node.id.startsWith('view-nistrenia')||nodes.has(node.id)||!Array.isArray(node.child_ids)||!Array.isArray(node.source_refs)||!Array.isArray(node.geometry_candidates)||!NI_GEOMETRY_STATUSES.includes(node.geometry_status)||node.administrative_status!=='SOURCE_SCOPED_CONFIRMED'||node.contemporary_status!=='PROVISIONAL')fail('presentation identity/status');
  if('geometry' in node||'coordinates' in node||'source_actual_id' in node)fail('polygon or legal identity copied into documentary node');
  if(node.geometry_ref!==null&&!resources.has(node.geometry_ref))fail('missing own geometry resource');
  if(node.geometry_candidates.some(id=>!resources.has(id))||new Set(node.geometry_candidates).size!==node.geometry_candidates.length)fail('invalid candidate reference');
  if(!Array.isArray(node.additional_md_name_candidates)||node.additional_md_name_candidates.some(x=>x.match_status!=='EXACT_DISPLAY_NAME_ONLY_NOT_IDENTITY_PROOF'||(actualIds&&!actualIds.has(x.actual_id))))fail('unverified name discovery');
  if(node.kind==='council'&&(node.geometry_ref!==null||node.geometry_status!=='NO_GEOMETRY_EVIDENCE'))fail('council inherits settlement polygon');
  if(node.geometry_ref!==null&&node.geometry_status!=='GEOMETRY_VERIFIED')fail('own reference has incompatible status');
  if(node.geometry_ref===null&&node.geometry_candidates.length&&node.geometry_status!=='GEOMETRY_CANDIDATE')fail('candidate promoted');
  if(node.geometry_ref===null&&node.additional_md_name_candidates.length&&node.geometry_status!=='GEOMETRY_CANDIDATE')fail('name discovery promoted');
  nodes.set(node.id,node);
 }
 const root=nodes.get('view-nistrenia');
 if(!root||root.parent_id!==null||root.child_ids.length!==9||root.geometry_ref!=='view-nistrenia')fail('root');
 const counts=kind=>model.nodes.filter(x=>x.kind===kind).length;
 if(counts('raion')!==5||counts('upper_city')!==4||counts('council')!==74||counts('place')!==158||nodes.size!==242)fail('administrative coverage');
 for(const node of nodes.values()){
  if(new Set(node.child_ids).size!==node.child_ids.length)fail('duplicate child');
  for(const id of node.child_ids)if(nodes.get(id)?.parent_id!==node.id)fail('inconsistent child');
  const seen=new Set();let current=node;
  while(current.parent_id!==null){if(seen.has(current.id))fail('cycle');seen.add(current.id);const parent=nodes.get(current.parent_id);if(!parent?.child_ids.includes(current.id))fail('orphan');current=parent;}
  if(current!==root)fail('unreachable node');
 }
 const aliases=Object.entries(model.source_aliases);
 if(aliases.length!==245||aliases.some(([,id])=>!nodes.has(id))||new Set(aliases.map(([id])=>id)).size!==245)fail('source role coverage');
 const refs=model.nodes.flatMap(x=>x.source_refs);
 if(refs.length!==245||new Set(refs).size!==245||model.nodes.some(node=>node.source_refs.some(ref=>model.source_aliases[ref]!==node.id)))fail('source role association differs');
 for(const n of [11,15,16,17])if(model.source_aliases['unit-'+n]!==model.source_aliases['place-'+n])fail('duplicated shared city identity');
 return {nodes,resources,root,counts:{nodes:nodes.size,raions:5,upper_cities:4,councils:74,place_mentions:162,cartographic_roles:85,outlines:8}};
}

export function nistreniaNodeGeometry(modelNode){
 // A nominal candidate is inspected explicitly from its card, never plotted as
 // the unit's own certified administrative polygon.
 return modelNode?.geometry_status==='GEOMETRY_VERIFIED'?modelNode.geometry_ref:null;
}

export async function fetchNistreniaAdministrativeModel(fetcher,subtle,options={}){
 const [bodyResponse,proofResponse]=await Promise.all([
  fetcher('public/data/ni-fin-administration.json',{cache:'no-cache'}),
  fetcher('public/data/ni-fin-administration-manifest.json',{cache:'no-cache'})
 ]);
 if(!bodyResponse.ok||!proofResponse.ok)fail('model resource unavailable');
 const [body,proof]=await Promise.all([bodyResponse.text(),proofResponse.json()]);
 if(!subtle?.digest||proof.schema!=='ni-fin-model-manifest-v1'||proof.model_file!=='public/data/ni-fin-administration.json'||proof.actual_mutation_allowed!==false||proof.p91_import_allowed!==false)fail('manifest authority');
 const bytes=new TextEncoder().encode(body),digest=await subtle.digest('SHA-256',bytes);
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(bytes.length!==proof.bytes||hash!==proof.sha256)fail('model hash mismatch');
 const model=JSON.parse(body),validated=validateNistreniaAdministrativeModel(model,options);
 return {model,proof,...validated};
}
