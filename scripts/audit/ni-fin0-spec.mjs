import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateNistreniaOutlinePackage} from '../../atlas-nistrenia-outlines.mjs';
const root=new URL('../../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const fail=message=>{throw Error('NI-FIN.0: '+message);};
export function effectiveCensus(original,corrections){
 const census=structuredClone(original),seen=new Set();
 for(const correction of corrections.rows){
  const row=census.place_mentions.find(x=>x.id===correction.source_id);
  if(seen.has(correction.source_id)||!row||row.parent_id!==correction.original_parent_id||row.annex_index!==correction.annex_index||row.annex_text!==correction.expected_annex_text)fail('unbound source correction');
  seen.add(correction.source_id);row.parent_id=correction.effective_parent_id;
 }
 return census;
}
export function validateSpec({census:original,crosswalk,contract,corrections}){
 const census=effectiveCensus(original,corrections);
 if(contract.schema!=='ni-fin-contract-v1'||contract.baseline_year!==2023||contract.stage!=='NI-FIN.0_SPECIFICATION_ONLY')fail('scope/epoch');
 for(const k of ['actual_mutation_allowed','p91_import_allowed','osm_public_edit_allowed','NI_FUNCTIONAL_COMPLETE','name_only_match_is_geometry_certification','council_inherits_centre_polygon','select_parent_selects_descendants'])if(contract[k]!==false)fail('forbidden authority '+k);
 if(contract.NI_LEGAL_CERTIFICATION_PENDING!==true||contract.OSM_SOURCE_PENDING!==true||census.controls.actual_mutation_allowed!==false||census.controls.p91_import_allowed!==false||census.controls.NI_JUR_formal_accepted!==false)fail('source acceptance');
 const units=new Map(census.upper_units.map(x=>[x.id,x]));
 const councils=new Map(census.councils.map(x=>[x.id,x]));
 const places=new Map(census.place_mentions.map(x=>[x.id,x]));
 if(units.size!==9||units.size!==census.upper_units.length||councils.size!==74||councils.size!==census.councils.length||places.size!==162||places.size!==census.place_mentions.length)fail('documentary identity coverage');
 if(census.upper_units.filter(x=>x.type==='rayon').length!==5||census.upper_units.filter(x=>x.type==='independent_city').length!==4)fail('upper types');
 if(contract.upper_units.length!==9||new Set(contract.upper_units.map(x=>x.source_id)).size!==9||contract.upper_units.some(x=>!units.has(x.source_id)))fail('upper contract');
 for(const x of councils.values())if(!units.has(x.parent_id))fail('council parent');
 const aliases=[];
 for(const x of places.values()){
  if(!units.has(x.upper_id))fail('place upper');
  if(x.parent_id===null){
   const unit=units.get(x.upper_id);
   if(unit.type!=='independent_city'||unit.annex_index!==x.annex_index)fail('unsupported shared identity');
   aliases.push(x.id);
  }else if(councils.has(x.parent_id)){
   if(councils.get(x.parent_id).parent_id!==x.upper_id)fail('council/upper conflict');
  }else if(places.has(x.parent_id)){
   if(places.get(x.parent_id).upper_id!==x.upper_id)fail('place upper conflict');
  }else if(x.parent_id!==x.upper_id)fail('place parent');
  const seen=new Set([x.id]);let parent=x.parent_id;
  while(places.has(parent)){if(seen.has(parent))fail('documentary cycle');seen.add(parent);parent=places.get(parent).parent_id;}
 }
 if(aliases.length!==4)fail('shared city roles');
 if(crosswalk.localities.length!==162||new Set(crosswalk.localities.map(x=>x.id)).size!==162||crosswalk.localities.some(x=>!places.has(x.id)))fail('crosswalk place coverage');
 if(crosswalk.localities.filter(x=>x.osm85_relation_candidates.length).length!==87)fail('crosswalk references');
 if(crosswalk.localities.some(x=>!['REFERENCE_ONLY_NOT_CERTIFIED','NO_REFERENCE_WITHIN_OSM85'].includes(x.match_status)))fail('unapproved geometry association');
 if(crosswalk.councils.length!==74||crosswalk.councils.some(x=>x.osm85_role_crosswalk_status!=='NOT_MAPPED_AS_SEPARATE_COUNCIL_UNIT'))fail('unproved council geometry');
 if(census.OSM_85_crosswalk.length!==85||new Set(census.OSM_85_crosswalk.map(x=>x.actual_id)).size!==85)fail('role identity coverage');
 return {status:'PASS_SPECIFICATION_ONLY',upper_units:9,raions:5,upper_cities:4,councils:councils.size,place_mentions:places.size,shared_city_mentions:aliases.length,derived_administrative_nodes:1+units.size+councils.size+places.size-aliases.length,role_count:85,NI_FUNCTIONAL_COMPLETE:false,NI_LEGAL_CERTIFICATION_PENDING:true,OSM_SOURCE_PENDING:true};
}
export function loadSpec(){return {census:read('docs/ni-fin/sources/census-2023.json'),crosswalk:read('docs/ni-fin/sources/categorical-crosswalk.json'),contract:read('docs/ni-fin/contract.json'),corrections:read('docs/ni-fin/parent-corrections.json')};}
export function validateDisk(){
 const packet=loadSpec(),bindings=read('docs/ni-fin/source-bindings.json');
 const allowed=new Map([
  'docs/ni-fin/sources/census-2023.json','docs/ni-fin/sources/categorical-crosswalk.json','docs/ni-fin/parent-corrections.json',
  'public/data/p909-nistrenia-osm-navigation.json','public/data/p9095-osm-outlines.json','public/data/p9095-osm-outlines-manifest.json',
  'docs/p9.0.7.2.15-osm-semantic-reconciliation.json','docs/evidence/ni-jur-independent-20261020/documentary/PMR-ATD-ANNEX1-133268-text.json'
 ].map(path=>[path,new URL(path,root)]));
 // Baseline JS hashes are immutable references, not a prohibition on NI-FIN.2.
 for(const record of [...bindings.adopted_sources,...bindings.existing_sources.filter(x=>!x.path.endsWith('.mjs'))]){
  const path=allowed.get(record.path);if(!path)fail('unexpected input path');
  const bytes=readFileSync(path);
  if(createHash('sha256').update(bytes).digest('hex')!==record.sha256||(record.bytes!==undefined&&record.bytes!==bytes.length))fail('source digest');
 }
 const nav=read('public/data/p909-nistrenia-osm-navigation.json');
 const ids=new Set(nav.groups.flatMap(x=>x.role_ids));
 if(ids.size!==85||packet.census.OSM_85_crosswalk.some(x=>!ids.has(x.actual_id)))fail('canonical geometry role coverage');
 const geometry=read('public/data/p9095-osm-outlines.json'),proof=read('public/data/p9095-osm-outlines-manifest.json');
 if(validateNistreniaOutlinePackage(geometry,proof,nav).size!==8)fail('outline package');
 const raw=readFileSync(allowed.get('public/data/p9095-osm-outlines.json'));
 if(createHash('sha256').update(raw).digest('hex')!==proof.file_sha256)fail('outline content integrity');
 const annex=read('docs/evidence/ni-jur-independent-20261020/documentary/PMR-ATD-ANNEX1-133268-text.json');
 for(const correction of packet.corrections.rows)if(annex.paragraphs[correction.annex_index]?.text!==correction.expected_annex_text)fail('correction primary citation differs');
 return validateSpec(packet);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(validateDisk()));
