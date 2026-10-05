import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {applyMdReviewedParentHierarchyOverrides} from '../lib/md-parent-hierarchy-overrides.mjs';
import {
 MD_MALCOCI_INVALID_OSM_FALLBACK,
 inspectMalcociInvalidOsmContract,
 assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints,
 applyReviewedMalcociLastValidOsmGeometry
} from '../lib/md-osm-invalid-geometry-fallback.mjs';

const wrapperPath='.github/workflows/import-osm.yml';
const candidatePath='.github/workflows/actual-candidate.yml';
const importerPath='scripts/import/import-osm.mjs';
const builderPath='scripts/process/build-osm-actual.mjs';
const deterministicRunnerPath='scripts/process/run-actual-deterministic-candidate.sh';
const manifestPath='data/sources/osm-current.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');

test('OSM source refresh is explicit and routed exclusively through ACTUAL candidate lifecycle',async()=>{
 const [wrapper,candidate]=await Promise.all([
  readFile(wrapperPath,'utf8'),
  readFile(candidatePath,'utf8')
 ]);
 assert.match(wrapper,/uses:\s*\.\/\.github\/workflows\/actual-candidate\.yml/);
 assert.match(wrapper,/refresh_osm:\s*true/);
 assert.match(wrapper,/source_trigger:\s*'osm-refresh'/);
 assert.match(wrapper,/schedule:\s*\n\s*- cron: '29 4 \* \* 0'/);
 assert.doesNotMatch(wrapper,/\bgit\s+push\b/);
 assert.doesNotMatch(wrapper,/\bgit\s+commit\b/);
 assert.doesNotMatch(wrapper,/npm run import:osm/);
 assert.doesNotMatch(wrapper,/npm run build:osm-actual/);
 assert.doesNotMatch(wrapper,/audit:actual-release-gate/);

 assert.match(candidate,/refresh_osm:/);
 assert.match(candidate,/description: 'Refresh raw OSM source through Overpass before deterministic build'/);
 assert.match(candidate,/if:[^\n]*inputs\.refresh_osm == true/);
 assert.match(candidate,/echo "- Refresh OSM raw source: \$\{\{ inputs\.refresh_osm \}\}"/);
 assert.match(candidate,/--network bridge/);
 assert.match(candidate,/--network none/);
 const refreshIndex=candidate.indexOf('npm run import:osm');
 const deterministicIndex=candidate.indexOf('scripts/process/run-actual-deterministic-candidate.sh');
 assert.ok(refreshIndex>=0&&deterministicIndex>refreshIndex,'optional OSM source refresh must precede the network-denied deterministic phase');
 const runner=await readFile(deterministicRunnerPath,'utf8');
 const buildIndex=runner.indexOf('npm run build:osm-actual');
 const roIndex=runner.indexOf('npm run audit:ro-official-reconciliation');
 const mdIndex=runner.indexOf('npm run reconcile:cuatm');
 assert.ok(buildIndex>=0&&roIndex>buildIndex&&mdIndex>buildIndex,'all jurisdiction reconciliation must consume the deterministic OSM build');
});

test('candidate defaults to offline OSM rebuild and only the OSM wrapper enables network refresh',async()=>{
 const [candidate,osmWrapper,roWrapper,mdWrapper]=await Promise.all([
  readFile(candidatePath,'utf8'),
  readFile(wrapperPath,'utf8'),
  readFile('.github/workflows/refresh-ro-official.yml','utf8'),
  readFile('.github/workflows/refresh-md-official.yml','utf8')
 ]);
 const refreshInputBlocks=[...candidate.matchAll(/refresh_osm:\s*\n\s+(?:description:.*\n\s+)?required:\s*false\s*\n\s+type:\s*boolean\s*\n\s+default:\s*false/g)];
 assert.equal(refreshInputBlocks.length,2,'workflow_dispatch and workflow_call must both default refresh_osm=false');
 assert.match(osmWrapper,/refresh_osm:\s*true/);
 assert.match(roWrapper,/refresh_osm:\s*false/);
 assert.match(mdWrapper,/refresh_osm:\s*false/);
});

test('OSM importer is the only networked OSM source step and writes durable content-addressed snapshots',async()=>{
 const [importer,builder]=await Promise.all([
  readFile(importerPath,'utf8'),
  readFile(builderPath,'utf8')
 ]);
 assert.match(importer,/\bfetch\s*\(/);
 assert.match(importer,/AbortController/);
 assert.match(importer,/OVERPASS_REQUEST_TIMEOUT_MS/);
 assert.match(importer,/OVERPASS_RETRIES_PER_ENDPOINT/);
 assert.match(importer,/data\/sources\/osm-current\.json/);
 assert.match(importer,/data\/sources\/osm-snapshots/);
 assert.match(importer,/snapshotPath/);
 assert.match(importer,/compressed_sha256/);
 assert.match(importer,/snapshot_at/);
 assert.match(importer,/previousEntry\?\.semantic_sha256===result\.semanticSha/);
 assert.match(importer,/status=unchanged\?'UNCHANGED':'UPDATED'/);
 assert.match(importer,/semantic_sha256/);
 assert.match(importer,/OSM_API_BASE='https:\/\/api\.openstreetmap\.org\/api\/0\.6'/);
 assert.match(importer,/refreshRequiredRelationsFromOsmApi/);
 assert.match(importer,/relation\/\$\{relationId\}\/full\.json/);
 assert.match(importer,/authoritative_relation_source/);
 assert.match(importer,/authoritative_relation_ids/);
 assert.match(importer,/authoritative_relation_attempts/);
 assert.match(importer,/Authoritative OSM relation refresh failed closed/);
 assert.match(importer,/requiredRelations:\[1813306,1813297,58512,1813315,1813316,18968071\]/);
 assert.doesNotMatch(importer,/data\/sources\/osm-runtime/);

 assert.match(builder,/data\/sources\/osm-current\.json/);
 assert.match(builder,/data\/sources\/osm-snapshots/);
 assert.match(builder,/snapshot_path/);
 assert.match(builder,/compressed_sha256/);
 assert.match(builder,/osmSource\.snapshot_at/);
 assert.match(builder,/readRawSnapshot/);
 assert.match(builder,/gunzipSync/);
 assert.doesNotMatch(builder,/\bfetch\s*\(/);
 assert.doesNotMatch(builder,/OVERPASS_/);
 assert.doesNotMatch(builder,/https:\/\/overpass/);
 assert.doesNotMatch(builder,/new Date\s*\(\s*\)/);
 assert.doesNotMatch(builder,/Date\.now\s*\(/);
 assert.doesNotMatch(builder,/osm-runtime/);
});

test('committed OSM manifest points to exact durable content-addressed bytes',async()=>{
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 assert.equal(manifest.schema_version,2);
 assert.equal(manifest.snapshot_directory,'data/sources/osm-snapshots');
 assert.ok(Number.isFinite(new Date(manifest.snapshot_at).getTime()));
 for(const code of ['RO','MD']){
  const entry=manifest.countries?.[code];
  assert.ok(entry,code+' manifest entry is required');
  assert.ok(Number.isFinite(new Date(entry.snapshot_at).getTime()),code+' snapshot_at must be stable');
  const expected=`data/sources/osm-snapshots/${code.toLowerCase()}-${entry.semantic_sha256}.json.gz`;
  assert.equal(entry.snapshot_path,expected);
  const compressed=await readFile(entry.snapshot_path);
  assert.equal(sha256(compressed),entry.compressed_sha256,code+' compressed SHA256 must match');
  const canonical=gunzipSync(compressed);
  assert.equal(sha256(canonical),entry.semantic_sha256,code+' semantic SHA256 must match');
  const raw=JSON.parse(canonical.toString('utf8'));
  assert.equal(raw.elements.length,entry.element_count,code+' element count must match');
 }
});

test('candidate commits durable OSM snapshots but network review artifacts never become a separate runtime source',async()=>{
 const candidate=await readFile(candidatePath,'utf8');
 const commitStart=candidate.indexOf('git add data/current/');
 const commitEnd=candidate.indexOf('git diff --cached',commitStart);
 const commitBlock=commitStart>=0?candidate.slice(commitStart,commitEnd):'';
 assert.match(commitBlock,/data\/sources\/osm-current\.json/);
 assert.match(commitBlock,/data\/sources\/osm-snapshots\//);
 assert.doesNotMatch(commitBlock,/osm-runtime/);
 assert.match(candidate,/data\/sources\/osm-snapshots\/\*\.json\.gz/);
 assert.doesNotMatch(candidate,/data\/sources\/osm-runtime\/\*\.json\.gz/);
});

test('deterministic OSM builder retains all non-network classifier dependencies after extraction',async()=>{
 const builder=await readFile(builderPath,'utf8');
 assert.match(builder,/const CLASSIFIER_VERSION='2\.3'/);
 assert.match(builder,/const countries=\{/);
 assert.match(builder,/ro-level9-exception-evidence\.json/);
 assert.match(builder,/const roSemanticByRelation=/);
 assert.match(builder,/const RO_SEMANTIC_CLASSES=/);
});


test('reviewed Chișinău city parent override replaces a sector parent without touching geometry state',()=>{
 const entities=[
  {id:'osm-r1691801',jurisdiction:'MD',parent_id:'MD',osm:{relation_id:1691801,admin_level:4,place:'municipality',cuatm_unique_id:'0100'}},
  {id:'osm-r1813306',jurisdiction:'MD',parent_id:'osm-r1691801',osm:{relation_id:1813306,admin_level:7,place:'borough',cuatm_unique_id:'0110'}},
  {id:'osm-r1748490',jurisdiction:'MD',parent_id:'osm-r1813306',osm:{relation_id:1748490,admin_level:8,place:'city',cuatm_unique_id:'0100'}}
 ];
 const before=structuredClone(entities);
 const warnings=[];
 applyMdReviewedParentHierarchyOverrides(entities,warnings);
 assert.equal(entities[2].parent_id,'osm-r1691801');
 assert.deepEqual(entities[0].osm,before[0].osm);
 assert.deepEqual(entities[1].osm,before[1].osm);
 assert.deepEqual(entities[2].osm,before[2].osm);
 assert.equal(warnings.length,1);
 assert.equal(warnings[0].geometry_mutation,false);
 assert.equal(warnings[0].previous_parent_id,'osm-r1813306');
 assert.equal(warnings[0].canonical_parent_id,'osm-r1691801');
});

test('reviewed Chișinău city parent override fails closed on an unexpected parent or CUATM drift',()=>{
 const base=[
  {id:'osm-r1691801',jurisdiction:'MD',parent_id:'MD',osm:{relation_id:1691801,admin_level:4,place:'municipality',cuatm_unique_id:'0100'}},
  {id:'osm-r1813306',jurisdiction:'MD',parent_id:'osm-r1691801',osm:{relation_id:1813306,admin_level:7,place:'borough',cuatm_unique_id:'0110'}},
  {id:'osm-r1748490',jurisdiction:'MD',parent_id:'osm-r999999',osm:{relation_id:1748490,admin_level:8,place:'city',cuatm_unique_id:'0100'}}
 ];
 assert.throws(()=>applyMdReviewedParentHierarchyOverrides(structuredClone(base)),/unexpected geometric parent/);
 const drift=structuredClone(base);
 drift[2].parent_id='osm-r1813306';
 drift[2].osm.cuatm_unique_id='9999';
 assert.throws(()=>applyMdReviewedParentHierarchyOverrides(drift),/child contract drift/);
});

test('deterministic OSM builder applies reviewed MD hierarchy override after geometric parent selection and before final classification',async()=>{
 const builder=await readFile(builderPath,'utf8');
 const assign=builder.indexOf('assignParents(entities,byId,report.warnings)');
 const override=builder.indexOf('applyMdReviewedParentHierarchyOverrides(entities,report.warnings)',assign);
 const finalize=builder.indexOf('finalizeAfterParents(entities)',override);
 assert.ok(assign>=0&&override>assign&&finalize>override);
});

test('network-enabled source refresh uses a writable explicit HOME inside the unprivileged runtime',async()=>{
 const candidate=await readFile(candidatePath,'utf8');
 const start=candidate.indexOf('Refresh explicitly requested sources in network-enabled control phase');
 const end=candidate.indexOf('Apply explicitly requested ACTUAL v1.1 geometry policy migration',start);
 assert.ok(start>=0&&end>start,'source-refresh control phase must exist');
 const block=candidate.slice(start,end);
 assert.match(block,/--user "\$\(id -u\):\$\(id -g\)"/);
 assert.match(block,/--env HOME=\/tmp\/actual-home/);
 assert.match(block,/mkdir -p "\$HOME"/);
 assert.match(block,/git config --global --add safe\.directory \/workspace/);
 assert.match(block,/--network bridge/);
 assert.doesNotMatch(block,/--privileged/);
 assert.doesNotMatch(block,/--user 0(?=\s|\\)/);
});


test('OSM refresh overlays explicitly required MD relations from authoritative OSM API before canonical hashing',async()=>{
 const importer=await readFile(importerPath,'utf8');
 const refreshIndex=importer.indexOf('refreshRequiredRelationsFromOsmApi(raw,code,cfg)');
 const canonicalIndex=importer.indexOf('const canonical=canonicalRaw(raw)',refreshIndex);
 assert.ok(refreshIndex>=0&&canonicalIndex>refreshIndex,'authoritative relation/full overlay must happen before canonical snapshot hashing');
 assert.match(importer,/for\(const element of accepted\.elements\)byKey\.set\(/);
 assert.match(importer,/Authoritative OSM relation refresh failed closed/);
 assert.match(importer,/accept:'application\/json'/);
});


const malcociCfg=MD_MALCOCI_INVALID_OSM_FALLBACK;
function syntheticBrokenMalcociRaw(){
 const endpointPairs=[
  [7298612217,353223870],
  [8401795301,7298612217],
  [8401795301,12742046176],
  [8401795250,12742046176],
  [8401795250,7302127276],
  [1379403421,7302127276],
  [1379403420,1379403421]
 ];
 const nodes=[
  {type:'node',id:353223870,lon:28.6176407,lat:47.0341981},
  {type:'node',id:1379403420,lon:28.617828,lat:47.0343526}
 ];
 const ways=malcociCfg.expected_members.map((expected,index)=>({
  type:'way',id:expected.ref,version:expected.version,changeset:expected.changeset,timestamp:expected.timestamp,nodes:endpointPairs[index]
 }));
 const relation={
  type:'relation',id:malcociCfg.relation_id,version:malcociCfg.expected_relation_version,
  changeset:malcociCfg.expected_relation_changeset,timestamp:malcociCfg.expected_relation_timestamp,
  tags:{admin_level:'9',boundary:'administrative','ref:cuatm:codunic':malcociCfg.legal_id,name:'Malcoci',place:'village',type:'boundary'},
  members:malcociCfg.expected_members.map(x=>({type:'way',ref:x.ref,role:x.role}))
 };
 return {version:0.6,elements:[...nodes,...ways,relation]};
}
function syntheticOpenMalcociGeo(){
 return {type:'FeatureCollection',features:[{
  type:'Feature',id:'relation/18968071',properties:{tags:{name:'Malcoci'}},
  geometry:{type:'Polygon',coordinates:[[
   [28.6176407,47.0341981],[28.63,47.03],[28.64,47.02],[28.617828,47.0343526]
  ]]}
 }]};
}

test('Malcoci invalid-live-boundary exception is exact, OSM-derived and self-expiring',async()=>{
 const raw=syntheticBrokenMalcociRaw();
 const inspected=inspectMalcociInvalidOsmContract(raw);
 assert.deepEqual(inspected.odd_endpoints.map(x=>x.node_id).sort((a,b)=>a-b),[353223870,1379403420].sort((a,b)=>a-b));

 const memberDrift=structuredClone(raw);
 memberDrift.elements.find(x=>x.type==='way'&&x.id===1376180717).version=9;
 assert.throws(()=>inspectMalcociInvalidOsmContract(memberDrift),/member way contract drift/);

 const endpointDrift=structuredClone(raw);
 endpointDrift.elements.find(x=>x.type==='node'&&x.id===353223870).lon+=0.0001;
 assert.throws(()=>inspectMalcociInvalidOsmContract(endpointDrift),/open-ring endpoint contract drift/);

 const open=syntheticOpenMalcociGeo();
 assert.doesNotThrow(()=>assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints(open.features[0]));
 const repaired=structuredClone(open.features[0]);
 repaired.geometry.coordinates[0].push([...repaired.geometry.coordinates[0][0]]);
 assert.throws(()=>assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints(repaired),/now closed; remove stale fallback/);

 const report={warnings:[]};
 const applied=await applyReviewedMalcociLastValidOsmGeometry({
  country:'MD',raw,geo:open,report,
  convertRawToGeoJson:()=>({type:'FeatureCollection',features:[{
   type:'Feature',id:'relation/18968071',properties:{},
   geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}
  }]})
 });
 assert.equal(applied,true);
 const geometry=open.features[0].geometry;
 const rings=geometry.type==='Polygon'?geometry.coordinates:geometry.coordinates.flat();
 assert.ok(rings.length>0);
 for(const ring of rings)assert.deepEqual(ring[0],ring.at(-1));
 assert.equal(open.features[0].properties.fabricated_closure,false);
 assert.equal(open.features[0].properties.geometry_source_snapshot_semantic_sha256,malcociCfg.fallback_snapshot.semantic_sha256);
 assert.equal(report.warnings.length,1);
 assert.equal(report.warnings[0].geometry_source_snapshot_stale,true);
 assert.equal(report.warnings[0].fabricated_closure,false);
});
