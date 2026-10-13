#!/usr/bin/env node
// P9.0.4.3: use this exact gate in ACTUAL candidate build, promotion, and required PR trust chain.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {evaluateP9JurisdictionGate,parseAddedGitDiff} from '../lib/actual-p9-jurisdiction-promotion-gate.mjs';
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
const additions=parseAddedGitDiff(changedText);
const prior=readGitJson(resolvedBase,'public/data/actual-entities.json');
const next=mode==='commit'?readGitJson(resolvedHead,'public/data/actual-entities.json'):await readJson('public/data/actual-entities.json');
const policy=mode==='commit'?readGitJson(resolvedHead,'docs/p9.0.4.3-promotion-policy.json'):await readJson('docs/p9.0.4.3-promotion-policy.json');
const ledger=mode==='commit'?readGitJson(resolvedHead,'docs/p9.0.4.1-individual-candidates.json'):await readJson('docs/p9.0.4.1-individual-candidates.json');
if(ledger?.schema_version!=='p9041-member-claim-ledger-v1'||ledger.records?.length!==85)throw Error('Missing immutable 85-case P9.0.4.1 ledger');
const ids=ledger.records.map(x=>x.actual_id);
if(new Set(ids).size!==85)throw Error('85-case P9 sensitive IDs not unique');
const answer=evaluateP9JurisdictionGate({policy,baseCatalog:prior,candidateCatalog:next,changedPaths,addedLines:additions,knownSensitiveIds:ids});
console.log('ACTUAL_P9_PROMOTION_GATE '+JSON.stringify({
 ...answer,base_ref:resolvedBase,head_ref:resolvedHead||'WORKTREE',executable_policy:'Current P9.0.4.3 policy fails closed for P9 changes while leaving unrelated ACTUAL RO/MD candidates eligible to existing release gates'
}));
if(answer.status!=='PASS')process.exitCode=2;
