import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

export function performanceSource(root,{ci=process.env.GITHUB_ACTIONS==='true'}={}){
 const run=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const sha=run(['rev-parse','HEAD']);assert.match(sha,/^[a-f0-9]{40}$/,'Audit requires an exact Git commit');
 const changes=run(['status','--porcelain','--untracked-files=no']);
 if(ci)assert.equal(changes,'','CI performance acceptance requires clean tracked sources');
 return {sha,trackedSourcesClean:changes===''};
}
