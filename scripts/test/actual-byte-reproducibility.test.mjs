import test from 'node:test';
import assert from 'node:assert/strict';
import {
  semanticArtifactEqual,
  stabilizeJsonBytes,
  stripArtifactVolatile
} from '../lib/actual-byte-stability.mjs';

test('byte stabilizer restores exact base bytes when only runtime artifact metadata or key order changed',()=>{
  const base=Buffer.from(JSON.stringify({
    schema_version:1,
    generated_at:'2026-01-01T00:00:00.000Z',
    entities:[
      {id:'a',imported_at:'2026-01-01T00:00:00.000Z',value:1},
      {id:'b',value:2}
    ],
    summary:{count:2}
  },null,2)+'\n');
  const current=Buffer.from(JSON.stringify({
    summary:{count:2},
    entities:[
      {value:1,imported_at:'2026-09-28T05:00:00.000Z',id:'a'},
      {value:2,id:'b'}
    ],
    generated_at:'2026-09-28T05:00:00.000Z',
    schema_version:1
  })+'\n');

  const result=stabilizeJsonBytes({
    baseBytes:base,
    currentBytes:current,
    stableTimestamp:'2026-02-02T00:00:00.000Z'
  });
  assert.equal(result.action,'RESTORE_BASE_BYTES');
  assert.equal(result.semantic_equal_to_base,true);
  assert.deepEqual(result.bytes,base);
});

test('substantive changes remain visible and canonicalized bytes are idempotent',()=>{
  const base=Buffer.from('{"schema_version":1,"generated_at":"2026-01-01T00:00:00.000Z","value":1}\n');
  const current=Buffer.from('{"value":2,"generated_at":"2026-09-28T05:00:00.000Z","schema_version":1}\n');
  const stableTimestamp='2026-02-02T00:00:00.000Z';
  const first=stabilizeJsonBytes({baseBytes:base,currentBytes:current,stableTimestamp});
  const second=stabilizeJsonBytes({baseBytes:base,currentBytes:first.bytes,stableTimestamp});

  assert.equal(first.action,'CANONICALIZE_CHANGED_CONTENT');
  assert.equal(first.semantic_equal_to_base,false);
  assert.deepEqual(second.bytes,first.bytes);
  const parsed=JSON.parse(first.bytes.toString('utf8'));
  assert.equal(parsed.value,2);
  assert.equal(parsed.generated_at,stableTimestamp);
});

test('only artifact-runtime metadata is ignored; external historical timestamps remain substantive',()=>{
  const a={generated_at:'2026-01-01T00:00:00Z',history:{created_at:'2020-01-01T00:00:00Z'}};
  const b={generated_at:'2026-09-01T00:00:00Z',history:{created_at:'2021-01-01T00:00:00Z'}};
  assert.equal(semanticArtifactEqual(a,b),false);
  assert.deepEqual(stripArtifactVolatile(a),{history:{created_at:'2020-01-01T00:00:00Z'}});
});


test('candidate stabilizes release components before manifest construction',async()=>{
  const {readFile}=await import('node:fs/promises');
  const [workflow,runner,pkg]=await Promise.all([
    readFile('.github/workflows/actual-candidate.yml','utf8'),
    readFile('scripts/process/run-actual-deterministic-candidate.sh','utf8'),
    readFile('package.json','utf8').then(JSON.parse)
  ]);
  const stabilizeIndex=runner.indexOf('npm run stabilize:actual-bytes');
  const manifestIndex=runner.indexOf('npm run build:actual-release-manifest');
  const diffIndex=runner.indexOf('npm run build:actual-candidate-diff');
  assert.ok(stabilizeIndex>=0&&manifestIndex>stabilizeIndex&&diffIndex>manifestIndex);
  assert.equal(pkg.scripts['stabilize:actual-bytes'],'node scripts/process/stabilize-actual-release-bytes.mjs');
  assert.match(workflow,/--env ACTUAL_BASE_REF="\$BASE_RELEASE_COMMIT"/);
  assert.match(workflow,/--network none/);
});

test('stabilizer scope matches the release manifest component set',async()=>{
  const {readFile}=await import('node:fs/promises');
  const [stabilizer,manifestBuilder]=await Promise.all([
    readFile('scripts/process/stabilize-actual-release-bytes.mjs','utf8'),
    readFile('scripts/process/build-actual-release-manifest.mjs','utf8')
  ]);
  for(const key of [
    'catalog','inventory','ro_geojson','md_geojson','public_index',
    'ro_overview','ro_local','ro_detail','md_overview','md_local','md_detail',
    'ro_gate','md_gate','ro_official','md_official','md_individual_review',
    'md_semantic_bridge','topology_audit','regression_audit',
    'structural_completeness_audit','official_identity_audit','settlement_policy'
  ]){
    assert.match(stabilizer,new RegExp('\\b'+key+':'));
    assert.match(manifestBuilder,new RegExp('\\b'+key+':'));
  }
});


test('Wikipedia/Wikidata drift is ignored only when explicitly enabled for administrative artifacts',()=>{
  const base={id:'osm-r1',osm:{wikipedia:'ro:raionul Ștefan Vodă',wikidata:'Q1'},type:'district'};
  const current={id:'osm-r1',osm:{wikipedia:'ro:Raionul Ștefan Vodă',wikidata:'Q2'},type:'district'};
  assert.equal(semanticArtifactEqual(base,current),false);
  assert.equal(semanticArtifactEqual(base,current,{ignoreNonAdministrativeMetadata:true}),true);
});

test('administrative comparator never hides legal, classification or geometry changes',()=>{
  assert.equal(
    semanticArtifactEqual(
      {id:'osm-r1',type:'district',osm:{wikipedia:'ro:x'}},
      {id:'osm-r1',type:'town_uat',osm:{wikipedia:'ro:X'}},
      {ignoreNonAdministrativeMetadata:true}
    ),
    false
  );
  assert.equal(
    semanticArtifactEqual(
      {type:'Feature',properties:{catalog_id:'osm-r1',wikipedia:'ro:x'},geometry:{type:'Point',coordinates:[1,2]}},
      {type:'Feature',properties:{catalog_id:'osm-r1',wikipedia:'ro:X'},geometry:{type:'Point',coordinates:[1,3]}},
      {ignoreNonAdministrativeMetadata:true}
    ),
    false
  );
  assert.equal(
    semanticArtifactEqual(
      {type:'Feature',properties:{catalog_id:'osm-r1',wikipedia:'ro:x',legal_id:'1'},geometry:{type:'Point',coordinates:[1,2]}},
      {type:'Feature',properties:{catalog_id:'osm-r1',wikipedia:'ro:X',legal_id:'2'},geometry:{type:'Point',coordinates:[1,2]}},
      {ignoreNonAdministrativeMetadata:true}
    ),
    false
  );
});

test('byte restoration can explicitly reuse base bytes for non-admin metadata-only drift',()=>{
  const base=Buffer.from('{"id":"osm-r1","osm":{"wikipedia":"ro:raionul Ștefan Vodă"},"type":"district"}\n');
  const current=Buffer.from('{"id":"osm-r1","osm":{"wikipedia":"ro:Raionul Ștefan Vodă"},"type":"district"}\n');
  const strict=stabilizeJsonBytes({baseBytes:base,currentBytes:current,stableTimestamp:'2026-01-01T00:00:00.000Z'});
  assert.equal(strict.semantic_equal_to_base,false);
  const admin=stabilizeJsonBytes({
    baseBytes:base,
    currentBytes:current,
    stableTimestamp:'2026-01-01T00:00:00.000Z',
    ignoreNonAdministrativeMetadata:true
  });
  assert.equal(admin.action,'RESTORE_BASE_BYTES');
  assert.deepEqual(admin.bytes,base);
});

test('non-admin metadata tolerance is scoped only to catalog and master GeoJSON components',async()=>{
  const {readFile}=await import('node:fs/promises');
  const stabilizer=await readFile('scripts/process/stabilize-actual-release-bytes.mjs','utf8');
  assert.match(stabilizer,/NON_ADMIN_METADATA_COMPONENTS=new Set\(\['catalog','ro_geojson','md_geojson'\]\)/);
  assert.match(stabilizer,/ignoreNonAdministrativeMetadata=NON_ADMIN_METADATA_COMPONENTS\.has\(key\)/);
});
