import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {loadSpec,effectiveCensus,validateDisk} from './ni-fin0-spec.mjs';
import {validateNistreniaAdministrativeModel} from '../../atlas-nistrenia-administrative.mjs';
const root=new URL('../../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const bytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const hash=value=>createHash('sha256').update(value).digest('hex');

// A traceable display transliteration of the parallel Moldovan-Cyrillic text,
// not a legal name/identity assertion. Original source names remain in cards.
export function displayTransliteration(text){
 const map={а:'a',б:'b',в:'v',д:'d',е:'e',ё:'io',ж:'j',з:'z',и:'i',й:'i',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ț',ш:'ș',щ:'șci',ъ:'',ы:'î',ь:'i',э:'ă',ю:'iu',я:'ia',ӂ:'g'};
 return [...text].map((letter,i,chars)=>{const c=letter.toLowerCase(),next=(chars[i+1]||'').toLowerCase();let value=c==='к'?(/[еи]/u.test(next)?'ch':'c'):c==='г'?(/[еи]/u.test(next)?'gh':'g'):c==='ч'?(/[еи]/u.test(next)?'c':'ci'):map[c];if(value===undefined)return letter;return letter===c?value:value[0].toUpperCase()+value.slice(1);}).join('');
}

export function buildModel(packet,annex,navigation,outlineProof,semantic,catalog){
 const census=effectiveCensus(packet.census,packet.corrections),nodes=[],aliases={},byId=new Map();
 const cross=new Map(packet.crosswalk.localities.map(x=>[x.id,x]));
 const roleById=new Map(semantic.rows.map(x=>[Number(x.osm_relation_id),x]));
 const resourceId=id=>'osm-r'+id;
 const idFor=source=>source.startsWith('unit-')?(packet.contract.upper_units.find(x=>x.source_id===source)?.osm_outline_relation_id? 'view-nistrenia-group-osm-r'+packet.contract.upper_units.find(x=>x.source_id===source).osm_outline_relation_id:'view-nistrenia-'+source):'view-nistrenia-'+source;
 if(catalog.entity_count!==5848||catalog.entities.length!==5848)throw Error('ACTUAL catalog coverage differs');
 const nameIndex=new Map(),fold=s=>s.normalize('NFKC').trim().toLocaleLowerCase('ro-RO');
 for(const entity of catalog.entities)if(entity.jurisdiction==='MD'&&entity.roles.includes('administrative')){
  const key=fold(entity.display_name);if(!nameIndex.has(key))nameIndex.set(key,[]);nameIndex.get(key).push(entity);
 }
 const base={jurisdiction:'NI',view_only:true,administrative_status:'SOURCE_SCOPED_CONFIRMED',contemporary_status:'PROVISIONAL',baseline_year:2023,temporal_notice:packet.contract.temporal_notice,effective_control:'UNDETERMINED',legal_certification:'PENDING',additional_md_name_candidates:[]};
 const add=node=>{const value={...base,...node,child_ids:[]};nodes.push(value);byId.set(value.id,value);return value;};
 add({id:'view-nistrenia',kind:'root',display_type:'state',display_name:'Nistrenia',parent_id:null,source_refs:[],source_indices:[],original_names:[],geometry_ref:'view-nistrenia',geometry_candidates:[],geometry_status:'GEOMETRY_VERIFIED',depth:0});
 for(const unit of packet.contract.upper_units){
  const source=census.upper_units.find(x=>x.id===unit.source_id);aliases[source.id]=idFor(source.id);
  add({id:aliases[source.id],kind:source.type==='rayon'?'raion':'upper_city',display_type:source.type==='rayon'?'district':'city',display_name:unit.label_ro,parent_id:'view-nistrenia',source_refs:[source.id],source_indices:[source.annex_index],original_names:[source.name_ru],geometry_ref:unit.osm_outline_relation_id?idFor(source.id):null,geometry_candidates:[],geometry_status:unit.osm_outline_relation_id?'GEOMETRY_VERIFIED':'NO_GEOMETRY_EVIDENCE',depth:1});
 }
 const labelFor=(source,kind)=>{
  const parallel=annex.paragraphs[source.annex_index+252];
  if(!parallel||parallel.nonempty_index_zero_based!==source.annex_index+252)throw Error('Missing parallel source label');
  let name=parallel.text.replace(/^\s*(?:[а-я]|\d+)\)\s*/u,'').replace(/\s*[–—]\s*чентрул.*$/u,'').replace(/[:;.]$/u,'');
  if(kind==='council')name=name.replace(/^советул сэтеск\s+/u,'');
  else name=name.replace(/^(?:орашул-сателит|орашул|орэшелул|сатул|локалитате-стацие)\s+/u,'');
  const names=[...new Set((cross.get(source.id)?.osm85_relation_candidates||[]).map(x=>roleById.get(x.osm_relation_id)?.display_label_existing_ro).filter(Boolean))];
  let translated=names.length===1&&kind!=='council'?names[0]:displayTransliteration(name);
  if(kind==='place'&&source.name_ru.startsWith('ж/д станции'))translated='Stația '+displayTransliteration(source.name_ru.replace(/^ж\/д станции\s*/u,'')).replace(/(\d+)\s*cm$/u,'$1 km');
  return {display_name:kind==='council'?'Consiliul sătesc '+translated:translated,parallel_source_index:parallel.nonempty_index_zero_based,parallel_source_text:parallel.text,name_basis:names.length===1&&kind!=='council'?'EXISTING_RO_DISPLAY_ALIAS_NOT_IDENTITY_PROOF':'DISPLAY_TRANSLITERATION_OF_PARALLEL_SOURCE'};
 };
 for(const council of census.councils){aliases[council.id]=idFor(council.id);add({id:aliases[council.id],kind:'council',display_type:'rural_council',...labelFor(council,'council'),parent_id:aliases[council.parent_id],source_refs:[council.id],source_indices:[council.annex_index],original_names:[council.name_ru],geometry_ref:null,geometry_candidates:[],geometry_status:'NO_GEOMETRY_EVIDENCE',depth:2});}
 for(const place of census.place_mentions)if(place.parent_id===null)aliases[place.id]=aliases[place.upper_id];else aliases[place.id]=idFor(place.id);
 for(const place of census.place_mentions){
  const candidates=[...new Set((cross.get(place.id)?.osm85_relation_candidates||[]).map(x=>resourceId(x.osm_relation_id)))];
  if(place.parent_id===null){const node=byId.get(aliases[place.id]);node.source_refs.push(place.id);node.source_indices.push(place.annex_index);node.geometry_candidates=candidates;if(!node.geometry_ref)node.geometry_status=candidates.length?'GEOMETRY_CANDIDATE':'NO_GEOMETRY_EVIDENCE';continue;}
  const label=labelFor(place,'place');
  const discovered=candidates.length?[]:(nameIndex.get(fold(label.display_name))||[]).map(entity=>({actual_id:entity.id,display_name:entity.display_name,display_type:entity.display_type,official_md_parent:entity.legal?.parent_name||null,match_status:'EXACT_DISPLAY_NAME_ONLY_NOT_IDENTITY_PROOF'})).sort((a,b)=>a.actual_id.localeCompare(b.actual_id,'en'));
  add({id:aliases[place.id],kind:'place',display_type:place.kind_ru==='город'?'city':place.kind_ru==='село'?'village':'settlement',...label,parent_id:aliases[place.parent_id],source_refs:[place.id],source_indices:[place.annex_index],original_names:[place.name_ru],geometry_ref:null,geometry_candidates:candidates,additional_md_name_candidates:discovered,geometry_status:candidates.length||discovered.length?'GEOMETRY_CANDIDATE':'NO_GEOMETRY_EVIDENCE',depth:0,parent_correction:packet.corrections.rows.find(x=>x.source_id===place.id)?.id||null});
 }
 for(const node of nodes)if(node.parent_id!==null){const parent=byId.get(node.parent_id);if(!parent)throw Error('Missing documentary parent');parent.child_ids.push(node.id);}
 const setDepth=node=>{for(const id of node.child_ids){const child=byId.get(id);child.depth=node.depth+1;setDepth(child);}};
 for(const node of nodes)if(node.id!=='view-nistrenia')node.child_ids.sort((a,b)=>byId.get(a).source_indices[0]-byId.get(b).source_indices[0]);setDepth(byId.get('view-nistrenia'));
 const resources=semantic.rows.map(x=>({canonical_id:x.actual_id,kind:'ACTUAL',osm_relation_id:Number(x.osm_relation_id),display_name:x.display_label_existing_ro,osm_role:x.osm_role_from_tags,osm_admin_level:Number(x.osm_admin_level),osm_version:x.osm_relation_version,osm_timestamp:x.osm_relation_timestamp,evidence_polygon_sha256:x.pinned_2026_10_12_polygon_sha256,geometric_osm_parent_id:Number(x.geometric_osm_parent_id),context_notes:x.context_notes,geometry_status:'GEOMETRY_VERIFIED',legal_boundary_equivalence:'NOT_CLAIMED'}));
 resources.push(...outlineProof.relations.map(x=>({canonical_id:x.id,kind:'OSM_OUTLINE',osm_relation_id:x.osm_relation_id,osm_version:x.relation_version,osm_timestamp:x.relation_timestamp,evidence_edges_sha256:x.edges_sha256,geometry_status:'GEOMETRY_VERIFIED',legal_boundary_equivalence:'NOT_CLAIMED'})));
 const model={schema:'ni-fin-administrative-view-v1',baseline_year:2023,actual_mutation_allowed:false,p91_import_allowed:false,legal_certification:'PENDING',effective_control:'UNDETERMINED',temporal_notice:packet.contract.temporal_notice,nodes,source_aliases:aliases,geometry_resources:resources,compatibility_role_aliases:Object.fromEntries(semantic.rows.map(x=>['view-nistrenia-role-'+x.actual_id,x.actual_id])),source_provenance:{annex_original_sha256:annex.original_sha256,source_bindings_sha256:hash(readFileSync(new URL('docs/ni-fin/source-bindings.json',root))),actual_catalog_sha256:hash(readFileSync(new URL('public/data/actual-entities.json',root))),navigation_schema:navigation.schema,baseline_actual_fingerprint:'actual-a9e5a4ddcb5277ef'}};
 validateNistreniaAdministrativeModel(model);return model;
}

export function generateModel(){validateDisk();return buildModel(loadSpec(),read('docs/evidence/ni-jur-independent-20261020/documentary/PMR-ATD-ANNEX1-133268-text.json'),read('public/data/p909-nistrenia-osm-navigation.json'),read('public/data/p9095-osm-outlines-manifest.json'),read('docs/p9.0.7.2.15-osm-semantic-reconciliation.json'),read('public/data/actual-entities.json'));}
export function writeOrCheck(check=false){
 const model=generateModel(),body=bytes(model),proof=bytes({schema:'ni-fin-model-manifest-v1',model_file:'public/data/ni-fin-administration.json',bytes:body.length,sha256:hash(body),source_provenance:model.source_provenance,actual_mutation_allowed:false,p91_import_allowed:false});
 for(const [path,raw] of [['public/data/ni-fin-administration.json',body],['public/data/ni-fin-administration-manifest.json',proof]]){const file=new URL(path,root);if(check){if(!readFileSync(file).equals(raw))throw Error('NI-FIN deterministic output differs: '+path);}else writeFileSync(file,raw);}
 return {status:check?'PASS_BYTE_IDENTICAL':'GENERATED',...validateNistreniaAdministrativeModel(model).counts,geometry_status_counts:Object.fromEntries(['GEOMETRY_VERIFIED','GEOMETRY_CANDIDATE','NO_GEOMETRY_EVIDENCE'].map(k=>[k,model.nodes.filter(x=>x.geometry_status===k).length]))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.slice(2).some(x=>x!=='--check'))throw Error('Only --check is accepted');console.log(JSON.stringify(writeOrCheck(process.argv.includes('--check'))));}
