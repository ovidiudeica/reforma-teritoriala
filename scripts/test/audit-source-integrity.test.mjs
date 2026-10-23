import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {verifyAuditSourceIntegrity} from '../audit/helpers/audit-source-integrity.mjs';

function fixture(t){
 const root=fs.mkdtempSync(path.join(tmpdir(),'audit-source-integrity-'));t.after(()=>{const target=path.resolve(root);assert.equal(path.dirname(target),path.resolve(tmpdir()));assert.ok(path.basename(target).startsWith('audit-source-integrity-'));assert.equal(fs.lstatSync(target).isSymbolicLink(),false);fs.rmSync(target,{recursive:true});});
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['init','-b','main']);for(const p of ['data','public'])fs.mkdirSync(path.join(root,p));
 fs.writeFileSync(path.join(root,'data','fixture.json'),'{}\n');fs.writeFileSync(path.join(root,'public','fixture.txt'),'frozen\n');fs.writeFileSync(path.join(root,'audit.mjs'),'// base\n');
 const commit=()=>{git(['add','.']);git(['-c','user.name=Audit Fixture','-c','user.email=audit@example.invalid','commit','-m','fixture']);return git(['rev-parse','HEAD']);};
 return {root,git,commit,base:commit()};
}
test('approved current base accepts code-only changes',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.root,'audit.mjs'),'// approved code change\n');const head=f.commit();assert.equal(verifyAuditSourceIntegrity(f.root,{baseSha:f.base,headSha:head}).status,'PASS');});
test('missing base fails although the legacy empty-stdout predicate would pass',t=>{const f=fixture(t),missing='a'.repeat(40);fs.writeFileSync(path.join(f.root,'public','fixture.txt'),'unexpected mutation\n');const old=spawnSync('git',['diff','--name-only',missing+'...HEAD','--','data','public'],{cwd:f.root,encoding:'utf8'});assert.notEqual(old.status,0);assert.equal(old.stdout,'');assert.throws(()=>verifyAuditSourceIntegrity(f.root,{baseSha:missing,headSha:f.base}));});
test('candidate data changes against approved base fail',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.root,'data','fixture.json'),'{"changed":true}\n');const head=f.commit();assert.throws(()=>verifyAuditSourceIntegrity(f.root,{baseSha:f.base,headSha:head}));});
test('runtime mutations of checked-out public bytes fail',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.root,'public','fixture.txt'),'mutated\n');assert.throws(()=>verifyAuditSourceIntegrity(f.root,{baseSha:f.base,headSha:f.base}));});
test('wrong tested head cannot be certified',t=>{const f=fixture(t);assert.throws(()=>verifyAuditSourceIntegrity(f.root,{baseSha:f.base,headSha:'b'.repeat(40)}),/Checkout differs/);});
test('missing or malformed immutable refs fail before Git use',t=>{const f=fixture(t);for(const baseSha of [undefined,'HEAD','--all','a'.repeat(39)])assert.throws(()=>verifyAuditSourceIntegrity(f.root,{baseSha,headSha:f.base}),/Exact approved base SHA/);});
