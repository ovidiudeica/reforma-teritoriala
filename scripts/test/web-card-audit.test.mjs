import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cardAuditBinding,cardAuditBucket,publicOsmTags,validateCardAudit} from '../../atlas-card-audit.mjs';
const root=new URL('../../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
test('WEB-CARD.1: exact 5848 bindings, 64 chunks and complete hash verification',async()=>{
 const index=await read('public/data/actual-entities.json'),manifest=await read('data/current/actual-release-manifest.json'),audit=await read('assets/web-card-audit/manifest.json');
 assert.equal(audit.record_count,5848);assert.equal(audit.files.length,64);const found=new Map();
 for(const f of audit.files){const b=await readFile(new URL('assets/web-card-audit/'+f.path,root));assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);const j=JSON.parse(b);for(const [id,r]of Object.entries(j.records)){assert(!found.has(id));found.set(id,j);assert.equal(r.geometry.valid,true);assert(r.geometry.area_m2>0);assert(r.geometry.perimeter_m>0);assert.equal(cardAuditBucket(id),f.path.slice(3,5));assert(!Object.keys(r.osmb_tags).some(k=>/idno|rson|rsud|contact|email|phone|operator|owner/.test(k)));}}
 assert.equal(found.size,5848);for(const e of index.entities)assert.equal(validateCardAudit(found.get(e.id),e,manifest).id,e.id);
 const bond=found.get('osm-r18967570').records['osm-r18967570'];assert(bond.parent_conflict);assert.equal(bond.geometric_parent_id,'osm-r19076879');assert.equal(index.entities.find(e=>e.id===bond.id).legal.parent_id,'8960');
});
test('WEB-CARD.1: no guessed identity or incompatible release is accepted',()=>{
 const e={id:'osm-r1',jurisdiction:'MD',legal:{registry:'CUATM',id:'0100'}},m={snapshot_id:cardAuditBinding.snapshot,release_fingerprint_sha256:cardAuditBinding.fingerprint};
 const j={schema:'web-card-audit-v1',snapshot:m.snapshot_id,fingerprint:m.release_fingerprint_sha256,records:{'osm-r1':{id:e.id,jurisdiction:e.jurisdiction,legal_registry:'CUATM',legal_id:'0100'}}};assert.equal(validateCardAudit(j,e,m).id,e.id);
 assert.throws(()=>validateCardAudit(j,e,{...m,snapshot_id:'other'}));assert.throws(()=>validateCardAudit(j,{...e,legal:{registry:'CUATM',id:'9999'}},m));assert.throws(()=>validateCardAudit({...j,records:{}},e,m));
});
test('WEB-CARD.1: privacy allowlist excludes arbitrary external fields and limits size',()=>{
 assert.deepEqual(publicOsmTags({name:'<img src=x onerror=alert(1)>',boundary:'administrative',email:'private@example.test',user:'person',uid:'1','ref:rson:idno':'1234567890123',operator:'person',note:'x','contact:phone':'x','name:ro':'Localitate',full_name:'a'.repeat(2001)}),{boundary:'administrative',name:'<img src=x onerror=alert(1)>','name:ro':'Localitate'});
});
