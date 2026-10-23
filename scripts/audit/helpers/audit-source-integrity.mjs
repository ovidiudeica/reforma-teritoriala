import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function verifyAuditSourceIntegrity(root,{baseSha,headSha}){
 assert.match(baseSha??'',/^[a-f0-9]{40}$/,'Exact approved base SHA required');
 assert.match(headSha??'',/^[a-f0-9]{40}$/,'Exact tested head SHA required');
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['cat-file','-e',baseSha+'^{commit}']);
 assert.equal(git(['rev-parse','HEAD']),headSha,'Checkout differs from tested head');
 git(['diff','--exit-code',baseSha,'HEAD','--','data','public']);
 git(['diff','--exit-code','--','data','public']);
 return {status:'PASS',baseSha,headSha,trackedDataUntouched:true};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('../../../',import.meta.url));
 console.log(JSON.stringify(verifyAuditSourceIntegrity(root,{baseSha:process.env.AUDIT_BASE_SHA,headSha:process.env.AUDIT_HEAD_SHA})));
}
