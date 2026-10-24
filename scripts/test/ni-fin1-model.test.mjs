import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {generateModel,writeOrCheck,displayTransliteration} from '../audit/build-ni-fin-model.mjs';
import {validateNistreniaAdministrativeModel,nistreniaNodeGeometry,fetchNistreniaAdministrativeModel} from '../../atlas-nistrenia-administrative.mjs';
const model=generateModel(),fixture=()=>structuredClone(model),byRef=(m,ref)=>m.nodes.find(x=>x.id===m.source_aliases[ref]);
test('real model is deterministic and published output is byte-identical',()=>assert.equal(writeOrCheck(true).status,'PASS_BYTE_IDENTICAL'));
test('complete source roles yield 242nodes, not four duplicated cities',()=>{const x=validateNistreniaAdministrativeModel(model);assert.equal(x.nodes.size,242);for(const n of [11,15,16,17])assert.equal(model.source_aliases['unit-'+n],model.source_aliases['place-'+n]);});
test('all74councils remain without own polygon',()=>assert.equal(model.nodes.filter(x=>x.kind==='council'&&nistreniaNodeGeometry(x)===null).length,74));
test('source2023and2026uncertainty remain independent',()=>assert.ok(model.nodes.every(x=>x.administrative_status==='SOURCE_SCOPED_CONFIRMED'&&x.contemporary_status==='PROVISIONAL'&&x.effective_control==='UNDETERMINED')));
test('Cremenciug documentary Tiraspol and geometric Slobozia remain separate',()=>{const x=model.nodes.find(x=>x.geometry_candidates.includes('osm-r1216706'));assert.equal(x.parent_id,model.source_aliases['unit-17']);assert.equal(model.geometry_resources.find(x=>x.canonical_id==='osm-r1216706').geometric_osm_parent_id,1702218);});
test('Maiac parent correction and true nested locality parents are retained',()=>{assert.equal(byRef(model,'place-28').parent_id,model.source_aliases['unit-22']);assert.equal(byRef(model,'place-25').parent_id,model.source_aliases['place-24']);});
test('BenderMDandNIresources remain distinct',()=>{assert.ok(model.geometry_resources.some(x=>x.osm_relation_id===9581354&&x.kind==='ACTUAL'));assert.equal(byRef(model,'unit-11').geometry_ref,'view-nistrenia-group-osm-r944727');});
test('Dubasari/Ribnita city and rayon IDs differ',()=>{assert.notEqual(model.source_aliases['unit-15'],model.source_aliases['unit-66']);assert.notEqual(model.source_aliases['unit-16'],model.source_aliases['unit-145']);});
test('75unmatched mentions are inspected only in existingMDnames without identity promotion',()=>{const found=model.nodes.filter(x=>x.additional_md_name_candidates.length);assert.ok(found.length>0&&found.length<=75);assert.ok(found.every(x=>nistreniaNodeGeometry(x)===null));assert.ok(found.flatMap(x=>x.additional_md_name_candidates).every(x=>x.match_status==='EXACT_DISPLAY_NAME_ONLY_NOT_IDENTITY_PROOF'));});
test('Romanian display aliases preserve original names and parallel source labels',()=>{assert.equal(displayTransliteration('Дубэсарь'),'Dubăsari');assert.ok(model.nodes.filter(x=>x.kind==='council').every(x=>x.display_name.startsWith('Consiliul sătesc ')));assert.ok(byRef(model,'place-12').original_names.includes('Варница'));});
for(const [name,change] of [
 ['ACTUALmutation',x=>x.actual_mutation_allowed=true],['2026certification',x=>x.baseline_year=2026],
 ['duplicate resource',x=>x.geometry_resources[1].canonical_id=x.geometry_resources[0].canonical_id],
 ['copied polygon',x=>x.nodes[1].geometry={type:'Polygon',coordinates:[]}],
 ['council centre polygon',x=>{const n=x.nodes.find(x=>x.kind==='council');n.geometry_ref='view-nistrenia';n.geometry_status='GEOMETRY_VERIFIED';}],
 ['promoted nominal association',x=>{const n=x.nodes.find(x=>x.geometry_status==='GEOMETRY_CANDIDATE');n.geometry_status='GEOMETRY_VERIFIED';}],
 ['missing parent',x=>x.nodes[10].parent_id='view-nistrenia-missing'],
 ['source alias rebound',x=>x.source_aliases['place-28']=x.source_aliases['place-25']]
])test('reject '+name,()=>{const x=fixture();change(x);assert.throws(()=>validateNistreniaAdministrativeModel(x));});
const root=new URL('../../',import.meta.url);
const fetcher=async path=>({ok:true,text:async()=>readFileSync(new URL(path,root),'utf8'),json:async()=>JSON.parse(readFileSync(new URL(path,root),'utf8'))});
test('browser hash loader verifies actual model bytes',async()=>assert.equal((await fetchNistreniaAdministrativeModel(fetcher,webcrypto.subtle)).nodes.size,242));
test('browser loader rejects corrupt body and missing resources',async()=>{
 await assert.rejects(fetchNistreniaAdministrativeModel(async path=>path.endsWith('manifest.json')?fetcher(path):{ok:true,text:async()=>'{"bad":true}'},webcrypto.subtle));
 await assert.rejects(fetchNistreniaAdministrativeModel(async()=>({ok:false}),webcrypto.subtle));
});
