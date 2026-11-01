// NI-TREE.1 — read-only mapping of existing OSM geometry onto documented NI nodes.
// No legal identity is inferred from a shared display name.
import fs from 'node:fs';
import path from 'node:path';
const model=JSON.parse(fs.readFileSync('views/nistrenia/administration.json','utf8'));
const nodes=new Map(model.nodes.map(n=>[n.id,n]));
const normalize=s=>s.toLocaleLowerCase('ro').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\\s*—\\s*oras$/u,'').trim();
const parents=new Map();
function topGroup(n){let seen=new Set();while(n?.parent_id&&n.parent_id!=='view-nistrenia'){if(seen.has(n.id))throw Error('cycle '+n.id);seen.add(n.id);n=nodes.get(n.parent_id);}return n?.id;}
for(const n of model.nodes)if(n.kind==='raion'||n.kind==='upper_city'||n.kind==='place'){const k=normalize(n.display_name);if(!parents.has(k))parents.set(k,[]);parents.get(k).push(n)}
const groups=new Map(model.nodes.filter(n=>n.kind==='raion'||n.kind==='upper_city').map(n=>[Number((n.id.match(/osm-r(\\d+)/)||[])[1]),n.id]));
const rows=[];
for(const r of model.geometry_resources.filter(r=>r.kind==='ACTUAL')){
 const candidates=parents.get(normalize(r.display_name))||[];
 const inGroup=candidates.filter(n=>topGroup(n)===groups.get(r.geometric_osm_parent_id));
 const determination=inGroup.length===1?'UNIQUE_NAME_AND_OSM_GROUP':candidates.length===1?'UNIQUE_NAME_ONLY_REVIEW':'AMBIGUOUS_OR_MISSING_REVIEW';
 rows.push({osm_id:r.canonical_id,display_name:r.display_name,geometric_osm_parent_id:r.geometric_osm_parent_id,group_node:groups.get(r.geometric_osm_parent_id)||null,candidate_node_ids:candidates.map(n=>n.id),group_filtered_ids:inGroup.map(n=>n.id),decision:determination,selected_node_id:inGroup.length===1?inGroup[0].id:null});
}
if(rows.length!==85||new Set(rows.map(r=>r.osm_id)).size!==85)throw Error('85 canonical OSM resources invariant failed');
const summary={schema:'ni-tree1-association-audit-v1',source:'views/nistrenia/administration.json',source_scope:'2023 documentary model / OSM geometry',counts:Object.fromEntries([...new Set(rows.map(r=>r.decision))].map(k=>[k,rows.filter(r=>r.decision===k).length])),unresolved:rows.filter(r=>!r.selected_node_id).map(r=>r.osm_id),constraints:['No ACTUAL mutation','No legal equivalence inferred','Only unique group-constrained candidates may be proposed','All cases must be reviewed before a production tree rewrite']};
const dir='outputs/ni-tree1';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'associations.json'),JSON.stringify({summary,rows},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
