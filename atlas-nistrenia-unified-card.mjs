// WEB-NI-U1.2: NI information is a perspective on an existing ACTUAL geometry ID.
// This module never clones geometries, upgrades candidates or rewrites MD parents.
export function nistreniaPerspectiveForGeometry(view,canonicalId){
 if(!view?.model||!view.roleIds?.has(canonicalId))return null;
 const resource=view.resources?.get(canonicalId);
 if(!resource||resource.kind!=='ACTUAL'||resource.canonical_id!==canonicalId)throw Error('NI card: unexpected resource identity '+canonicalId);
 const associations=[];
 const treeAssociation=view.associationByResource?.get(canonicalId);
 if(treeAssociation){
  const n=view.nodes.get(treeAssociation.nodeId);
  const p=view.nodes.get(n?.parent_id);
  if(!n)throw Error('NI card: missing mapped documentary node '+canonicalId);
  associations.push({
   node_id:n.id,name:n.display_name,documentary_kind:n.kind,parent_id:n.parent_id,
   parent_name:p?.display_name||null,source_refs:[...(n.source_refs||[])],
   reference_year:n.baseline_year,contemporary_status:n.contemporary_status,
   geometry_association:treeAssociation.evidence,
   legal_certification:'PENDING'
  });
 }
 for(const id of view.virtualIds){
  const n=view.nodes.get(id);
  if(!n?.geometry_candidates?.includes(canonicalId)||associations.some(a=>a.node_id===n.id))continue;
  const p=view.nodes.get(n.parent_id);
  associations.push({
   node_id:n.id,
   name:n.display_name,
   documentary_kind:n.kind,
   parent_id:n.parent_id,
   parent_name:p?.display_name||null,
   source_refs:[...n.source_refs],
   reference_year:n.baseline_year,
   contemporary_status:n.contemporary_status,
   geometry_association:'CANDIDATE_NOT_CERTIFIED',
   legal_certification:n.legal_certification
  });
 }
 associations.sort((a,b)=>a.node_id.localeCompare(b.node_id));
 return {
  canonical_id:canonicalId,
  source_kind:resource.kind,
  osm_relation_id:resource.osm_relation_id,
  osm_version:resource.osm_version,
  osm_timestamp:resource.osm_timestamp,
  role:resource.osm_role,
  osm_admin_level:resource.osm_admin_level,
  geometry_status:resource.geometry_status,
  legal_boundary_equivalence:resource.legal_boundary_equivalence,
  source_year:view.model.baseline_year,
  contemporary_legal_certification:view.model.legal_certification,
  associated_documentary_nodes:associations,
  no_documentary_candidate:associations.length===0,
  full_polygon_control_certified:false,
  md_official_identity_changed:false
 };
}
