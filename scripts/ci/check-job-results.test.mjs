import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const keys = ['CLEANUP_BROWSER_RESULT','CLEANUP_FULL_RESULT','CLEANUP_TOPOLOGY_RESULT','CLEANUP_EXPORT_RESULT'];
const entry = new URL('./check-job-results.mjs', import.meta.url);
const run = (overrides = {}) => {
  const env = {...process.env, ...Object.fromEntries(keys.map(key => [key, 'success'])), ...overrides};
  for (const key of keys) if (env[key] === undefined) delete env[key];
  return spawnSync(process.execPath, [fileURLToPath(entry)], {env, encoding:'utf8', windowsHide:true});
};

test('all four executed successful suites admit the required check', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'PASS');
});

for (const key of keys) for (const result of ['failure','cancelled','skipped',undefined,'success\n']) {
  test(`${key}: ${result ?? 'missing'} rejects the required check`, () => {
    const child = run({[key]:result});
    assert.equal(child.status, 1, child.stderr);
    assert.equal(JSON.parse(child.stdout).status, 'FAIL');
  });
}

test('workflow wires all four results and executes the rollup even after failure', () => {
  const yaml = readFileSync(new URL('../../.github/workflows/frontend-browser-qa.yml', import.meta.url), 'utf8').replaceAll('\r','');
  const gate = yaml.split('\n  frontend-browser-qa:\n')[1];
  assert.ok(gate, 'original required context must exist');
  assert.match(gate, /if: always\(\)/);
  assert.match(gate, /needs: \[browser-tests, full-linux-regression, p82-derived-topology, p84-export-validation\]/);
  for (const [key, job] of keys.map((key, i) => [key, ['browser-tests','full-linux-regression','p82-derived-topology','p84-export-validation'][i]])) {
    const expected = key + ': $' + '{{ needs.' + job + '.result }}';
    assert.ok(gate.includes(expected));
  }
  assert.match(gate, /run: node scripts\/ci\/check-job-results\.mjs/);
  assert.equal((yaml.match(/run: node scripts\/audit\/p82-full-validation\.mjs/g) ?? []).length, 1, 'full suite must execute once automatically');
  const full = yaml.split('\n  full-linux-regression:\n')[1].split('\n  p82-derived-topology:\n')[0];
  assert.ok(full.includes('outputs/P8.2/local/full-suite.*'));
  assert.ok(full.includes('outputs/P8.4/'), 'retain export evidence produced by the full suite in its new job');
  for (const file of ['p82-derived-topology.yml','p84-export-validation.yml']) {
    const manual = readFileSync(new URL('../../.github/workflows/' + file, import.meta.url), 'utf8');
    assert.match(manual, /workflow_dispatch:/);
    assert.doesNotMatch(manual, /\n  (?:push|pull_request):/);
    assert.match(manual, /run: node scripts\/audit\/p82-full-validation\.mjs/);
  }
});
