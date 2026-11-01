#!/usr/bin/env node
// Read-only NI-TREE.1 per-OSM-ID association register, derived from the same
// fail-closed presentation matcher used by the website. No ACTUAL writes.
import fs from 'node:fs';
import path from 'node:path';
import {validateNistreniaAdministrativeModel} from '../../atlas-nistrenia-administrative.mjs';
import {buildNistreniaUnifiedTree} from '../../atlas-ni-tree1.mjs';
const model=JSON.parse(fs.readFileSync('views/nistrenia/administration.json','utf8'));
const checked=validateNistreniaAdministrativeModel(model);
const view=buildNistreniaUnifiedTree(model,checked);
const rows=[...view.associationByResource].map(([canonicalId,association])=>{
 const resource=checked.resources.get(canonicalId);
 const node=view.nodes.get(association.nodeId);
 return {
  canonical_id:canonicalId,osm_relation_id:resource.osm_relation_id,
  osm_name:resource.display_name,osm_role:resource.osm_role,
  geometric_osm_parent_id:resource.geometric_osm_parent_id,
  ni_node_id:association.nodeId,ni_display_name:node.display_name,
  ni_kind:node.kind,ni_documentary_parent_id:node.parent_id,
  association_evidence:association.evidence,
  legal_boundary_equivalence:false,
  original_actual_entity_id:canonicalId
 };
}).sort((a,b)=>a.canonical_id.localeCompare(b.canonical_id));
const counts=Object.fromEntries([...new Set(rows.map(x=>x.association_evidence))].map(x=>[x,rows.filter(r=>r.association_evidence===x).length]));
const summary={schema:'ni-tree1-association-audit-v2',source:'views/nistrenia/administration.json',
 original_documentary_nodes:242,ni_presentation_nodes:view.nodes.size,
 top_level_branches:view.root.child_ids.length,verified_canonical_osm_roles:rows.length,
 unique_geometry_nodes:view.geometryByNode.size,counts,
 immutable_actual:true,legal_equivalence_claimed:false,
 administrative_centres_assigned:0,
 limitations:['OSM geometry is not a legal jurisdiction certificate','One Lunga reference-only node has no certified 2023 documentary identity','Cremenciug has a documented discrepancy between geometric OSM parent and 2023 source']
};
if(rows.length!==85||summary.top_level_branches!==7||Object.values(counts).reduce((a,b)=>a+b,0)!==85)throw Error('NI-TREE.1 completeness failure');
const out='outputs/ni-tree1';fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'associations.json'),JSON.stringify({summary,rows},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
