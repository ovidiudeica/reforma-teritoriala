#!/usr/bin/env node
// P9.0.4.3: use this exact gate in ACTUAL candidate build, promotion, and required PR trust chain.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {evaluateP9JurisdictionGate,parseAddedGitDiff,verifyPureReviewedGeometryRemoval} from '../lib/actual-p9-jurisdiction-promotion-gate.mjs';
const args=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(x=>x.slice(2).split('=',2)));
const base=args.base,mode=args.mode||'commit',head=args.head||'HEAD';
if(!base||!['commit','working'].includes(mode))throw Error('Usage: --base=BASE_COMMIT_OR_REF --mode=commit|working [--head=HEAD]');
const git=(arr,buffer=192*1024*1024)=>execFileSync('git',arr,{encoding:'utf8',maxBuffer:buffer});
const resolvedBase=git(['rev-parse',base+'^{commit}']).trim();
const resolvedHead=mode==='commit'?git(['rev-parse',head+'^{commit}']).trim():null;
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const readGitJson=(revision,path)=>JSON.parse(git(['show',revision+':'+path]));
const publicationPaths=[
 'data/current/entities.json','public/data/actual-entities.json',
 'public/data/actual-consolidated-tree.json','data/sources/osm-current.json',
 'data/sources/osm-snapshots','public/geo/actual','public/geo/current',
 'data/sources/actual-jurisdiction-policy.json'
];
const diffBase=mode==='commit'?[resolvedBase,resolvedHead]:[resolvedBase];
const changedPaths=git(['diff','--no-renames','--name-only',...diffBase,'--',...publicationPaths]).split('\n').filter(Boolean);
const changedText=git(['diff','--no-renames','--unified=0',...diffBase,'--',...publicationPaths],256*1024*1024);
const rawAdditions=parseAddedGitDiff(changedText);
const baselineStatisticalPolicy=readGitJson(resolvedBase,'data/sources/actual-statistical-policy.json');
const candidateStatisticalPolicy=mode==='commit'?readGitJson(resolvedHead,'data/sources/actual-statistical-policy.json'):await readJson('data/sources/actual-statistical-policy.json');
const variantAActivated=candidateStatisticalPolicy?.progress?.P2_3_PUBLIC?.public_entity_count===5725 && baselineStatisticalPolicy?.progress?.P2_3_PUBLIC?.public_entity_count===5848;
const provenRemoval=[];
const exactRemovalOnlyPaths=[];
if(variantAActivated){
 const scope=mode==='commit'?readGitJson(resolvedHead,'docs/evidence/rt-va1-semantic-exclusion/actual-variant-a-exclusions.json'):await readJson('docs/evidence/rt-va1-semantic-exclusion/actual-variant-a-exclusions.json');
 if(scope.status!=='APPROVED_SCOPE'||scope.contract!=='actual-canonical-variant-a-exclusions-v1'||scope.expected_exclusion_count!==123||scope.exclusions?.length!==123)throw Error('RT-VA1 approved 123-ID scope invalid');
 const excluded=scope.exclusions.map(x=>x.id);
 const sensitiveIds=new Set(readGitJson(resolvedBase,'docs/p9.0.4-geometric-candidates.json').candidates.map(x=>x.actual_id));
 if(excluded.some(id=>sensitiveIds.has(id)))throw Error('RT-VA1 exclusion intersects P9 protected 153 IDs');
 for(const geometryPath of ['public/geo/current/md-administrative.geojson','public/geo/actual/md-detail.geojson']){
  if(!changedPaths.includes(geometryPath))continue;
  const previous=readGitJson(resolvedBase,geometryPath);
  const candidate=mode==='commit'?readGitJson(resolvedHead,geometryPath):await readJson(geometryPath);
  const proof=verifyPureReviewedGeometryRemoval(previous,candidate,excluded);
  if(!proof.verified)throw Error('RT-VA1 changed retained P9-sensitive geometry: '+geometryPath);
  exactRemovalOnlyPaths.push(geometryPath);provenRemoval.push({path:geometryPath,...proof});
 }
}
const additions=rawAdditions.filter(x=>!exactRemovalOnlyPaths.includes(x.path));
const prior=readGitJson(resolvedBase,'public/data/actual-entities.json');
const next=mode==='commit'?readGitJson(resolvedHead,'public/data/actual-entities.json'):await readJson('public/data/actual-entities.json');
const policy=mode==='commit'?readGitJson(resolvedHead,'docs/p9.0.4.3-promotion-policy.json'):await readJson('docs/p9.0.4.3-promotion-policy.json');
const ledger=mode==='commit'?readGitJson(resolvedHead,'docs/p9.0.4.1-individual-candidates.json'):await readJson('docs/p9.0.4.1-individual-candidates.json');
if(ledger?.schema_version!=='p9041-member-claim-ledger-v1'||ledger.records?.length!==85)throw Error('Missing immutable 85-case P9.0.4.1 ledger');
const roster=mode==='commit'?readGitJson(resolvedHead,'docs/p9.0.4-geometric-candidates.json'):await readJson('docs/p9.0.4-geometric-candidates.json');
if(roster?.schema_version!=='p904-geometric-candidates-v1'||roster.candidates?.length!==153)throw Error('Missing immutable 153-case P9 geometric scope');
const ids=roster.candidates.map(x=>x.actual_id);
if(new Set(ids).size!==153)throw Error('153-case P9 protected IDs are not unique');
if(ledger.records.some(x=>!ids.includes(x.actual_id)))throw Error('85 positive geometric candidates not a subset of 153 protected IDs');
const answer=evaluateP9JurisdictionGate({policy,baseCatalog:prior,candidateCatalog:next,changedPaths,addedLines:additions,knownSensitiveIds:ids});
console.log('ACTUAL_P9_PROMOTION_GATE '+JSON.stringify({
 ...answer,verified_removal_only_geometries:provenRemoval,base_ref:resolvedBase,head_ref:resolvedHead||'WORKTREE',executable_policy:'Current P9.0.4.3 policy fails closed for P9 changes while leaving unrelated ACTUAL RO/MD candidates eligible to existing release gates'
}));
if(answer.status!=='PASS')process.exitCode=2;
