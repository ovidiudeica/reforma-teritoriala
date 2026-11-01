// Required-check admission. Missing, cancelled or skipped suites must fail.
const suites = [
  ['browser-tests', 'CLEANUP_BROWSER_RESULT'],
  ['full-linux-regression', 'CLEANUP_FULL_RESULT'],
  ['p82-derived-topology', 'CLEANUP_TOPOLOGY_RESULT'],
  ['p84-export-validation', 'CLEANUP_EXPORT_RESULT'],
];
const allowed = new Set(['success', 'failure', 'cancelled', 'skipped']);
const results = suites.map(([job, key]) => ({job, result: allowed.has(process.env[key]) ? process.env[key] : 'missing_or_invalid'}));
const pass = results.every(({result}) => result === 'success');
console.log(JSON.stringify({status: pass ? 'PASS' : 'FAIL', results}));
process.exitCode = pass ? 0 : 1;
