import {actualSemanticFingerprint} from '../lib/actual-semantic-fingerprint.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('P2.3 activation tooling is wired through the deterministic public builder',async()=>{
 const builder=await readFile('scripts/process/build-actual-public-data.mjs','utf8');
 assert.match(builder,/activateStatisticalPublic/);
});

test('P2.3 public contract schema permits statistical-only IDs and typed hierarchy',async()=>{
 const schema=JSON.parse(await readFile('schemas/actual-public-entity-v3.schema.json','utf8'));
 assert.equal(schema.properties.schema_version.const,3);
 assert.equal(schema.properties.contract.const,'actual-public-entity-v3');
 assert.match(schema.$defs.entity.properties.id.pattern,/stat-/);
 assert.ok(schema.$defs.entity.properties.roles);
 assert.ok(schema.$defs.entity.properties.statistical);
});

test('P2.3 frontend accepts v3 and exposes consolidated hierarchy surface',async()=>{
 const [app,html,validator]=await Promise.all([readFile('app.js','utf8'),readFile('index.html','utf8'),readFile('atlas-hierarchy-validate.mjs','utf8')]);
 assert.match(app,/actual-public-entity-v3/);
 assert.match(app,/validateConsolidatedHierarchy\(tree,entityById/);
 assert.match(validator,/actual-consolidated-hierarchy-v1/);
 assert.match(app,/loadHierarchyTree/);
 assert.match(html,/id="hierarchy-tree"/);
});


test('activated statistical model changes release identity to actual-semantic-v3',async()=>{
 const read=async p=>JSON.parse(await readFile(p,'utf8'));
 const [catalog,inventory,roGeo,mdGeo,roOfficial,mdOfficial,mdIndividualReview,settlementPolicy,geometryRoleContract,statisticalPolicy,statisticalContract,statisticalSourceBundle,roStatisticalLayer,mdStatisticalLayer]=await Promise.all([
  read('data/current/entities.json'),
  read('data/current/administrative-inventory.json'),
  read('public/geo/current/ro-administrative.geojson'),
  read('public/geo/current/md-administrative.geojson'),
  read('data/sources/ro-siruta-current.json'),
  read('data/sources/cuatm-current.json'),
  read('data/sources/md-cuatm-individual-review.json'),
  read('data/sources/actual-settlement-policy.json'),
  read('schemas/actual-geometry-role-contract.json'),
  read('data/sources/actual-statistical-policy.json'),
  read('schemas/actual-statistical-hierarchy-contract.json'),
  read('data/sources/actual-statistical-source-bundle.json'),
  read('data/p2/actual-statistical-ro.json'),
  read('data/p2/actual-statistical-md.json')
 ]);
 const base=actualSemanticFingerprint({catalog,inventory,roGeo,mdGeo,roOfficial,mdOfficial,mdIndividualReview,settlementPolicy,geometryRoleContract});
 const activatedSettlement=structuredClone(settlementPolicy);
 activatedSettlement.public_contract='actual-public-entity-v3';
 const activatedPolicy=structuredClone(statisticalPolicy);
 activatedPolicy.activated=true;
 activatedPolicy.phase='P2_ACTIVATED';
 const activeContract=structuredClone(statisticalContract);
 activeContract.phase='P2_ACTIVATED';
 const active=actualSemanticFingerprint({
  catalog,inventory,roGeo,mdGeo,roOfficial,mdOfficial,mdIndividualReview,
  settlementPolicy:activatedSettlement,geometryRoleContract,
  statisticalPolicy:activatedPolicy,statisticalContract:activeContract,
  statisticalSourceBundle,roStatisticalLayer,mdStatisticalLayer
 });
 assert.equal(base.algorithm,'actual-semantic-v2');
 assert.equal(active.algorithm,'actual-semantic-v3');
 assert.notEqual(active.sha256,base.sha256);
});


test('P2.3 activator is explicit, fail-closed and preserves administrative geometry policy',async()=>{
 const script=await readFile('scripts/process/apply-actual-statistical-activation.mjs','utf8');
 assert.match(script,/public_contract='actual-public-entity-v3'/);
 assert.match(script,/phase='P2_ACTIVATED'/);
 assert.match(script,/expected_public_entity_count:5848/);
 assert.match(script,/expected_administrative_entity_count:5830/);
 assert.match(script,/statistical_entity_activation_allowed:true/);
 assert.match(script,/administrative_geometry_mutation_allowed:false/);
 assert.doesNotMatch(script,/public\/geo\/current/);
});


test('official identity audit keeps a narrow v3 statistical-only exception',async()=>{
 const script=await readFile('scripts/process/audit-actual-official-identity.mjs','utf8');
 assert.match(script,/pub\.contract==='actual-public-entity-v3'/);
 assert.match(script,/\^stat-\(\?:RO\|MD\)\[A-Z0-9\]\+\$/);
 assert.match(script,/category==='statistical'/);
 assert.match(script,/roles\.includes\('statistical'\)/);
 assert.match(script,/legal==null/);
 assert.match(script,/legal_identity_status==='statistical_identity'/);
 assert.match(script,/statistical_only_public_entity_count_mismatch/);
 assert.match(script,/forbidden_md121_statistical_identity/);
 assert.match(script,/unexpected_public_entity/);
});


test('P2.3 release manifest and candidate identity bind the activated statistical model',async()=>{
 const [manifestBuilder,candidateDiff]=await Promise.all([
  readFile('scripts/process/build-actual-release-manifest.mjs','utf8'),
  readFile('scripts/process/build-actual-candidate-diff.mjs','utf8')
 ]);
 assert.match(manifestBuilder,/statisticalPolicy,\s*statisticalContract,\s*statisticalSourceBundle,\s*roStatisticalLayer,\s*mdStatisticalLayer/);
 assert.match(manifestBuilder,/public_contract:\{[\s\S]*hierarchy:\{/);
 assert.match(manifestBuilder,/statistical_geometry:\{/);
 assert.match(manifestBuilder,/baseStatisticalActivated/);
 assert.match(candidateDiff,/baselineStatisticalActivated/);
 assert.match(candidateDiff,/candidateStatisticalActivated/);
 assert.match(candidateDiff,/\.\.\.baselineStatisticalDocuments/);
 assert.match(candidateDiff,/\.\.\.candidateStatisticalDocuments/);
});
