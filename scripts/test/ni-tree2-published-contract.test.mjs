import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {NI_TREE2_ACCEPTANCE as c,assertNiTree2Initial} from '../audit/helpers/ni-tree2-acceptance-contract.mjs';
const initial={actual:[...c.actualRoots],roots:[...c.actualRoots],jurisdictions:[...c.jurisdictions],ni:[],niParent:c.parent,mdFirst:c.rootOutline,groups:7,outlines:8};
test('NI-TREE.2 acceptance rejects an implicit outline or jurisdiction and a regressed tree placement',()=>{
 assertNiTree2Initial(initial);
 for(const change of [{ni:['view-nistrenia']},{jurisdictions:['RO','MD','NI']},{niParent:null},{mdFirst:'stat-MD11'},{groups:8},{outlines:7},{roots:['view-nistrenia',...c.actualRoots]}])assert.throws(()=>assertNiTree2Initial({...initial,...change}));
});
test('historical navigation evidence still binds the original audit byte for byte',()=>{
 const root=new URL('../../',import.meta.url),b=readFileSync(new URL(c.historicalScript,root));
 const hash=createHash('sha256').update(b).digest('hex');assert.equal(hash,c.historicalSha256);
 const historical=JSON.parse(readFileSync(new URL('docs/evidence/navigation-failure-20261023/local-tests.json',root)));
 assert.equal(historical.code_sha256[c.historicalScript],hash);
});
