import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const laws = read('law-effects-20.json');
const local = read('local-source-gaps.json');
const exceptions = read('exceptions.json');

assert.equal(laws.schema, 'ni-adm12-local-government-20-law-review-v1');
assert.equal(laws.as_of, '2026-10-24');
assert.equal(laws.law_rows.length, 20);
assert.equal(new Set(laws.law_rows.map(x => x.publication_id)).size, 20);
const enacted = laws.law_rows.filter(x => x.operational_category === 'ENACTED_LAW_INDEXED');
const draft = laws.law_rows.filter(x => x.operational_category.startsWith('DRAFT_'));
assert.equal(enacted.length, 18);
assert.equal(draft.length, 2);
assert.deepEqual(draft.map(x => x.publication_id).sort(), ['2024001732', '2025001798']);
assert.deepEqual([2023, 2024, 2025, 2026].map(y => laws.law_rows.filter(x => x.year === y).length), [6, 6, 4, 4]);
assert.ok(laws.law_rows.every(x => x.signed_original_reviewed === false));
assert.ok(laws.law_rows.every(x => x.exact_local_org_effect_certified === false));
assert.ok(laws.law_rows.every(x => x.geom_or_boundary_change_accepted === false));
assert.ok(laws.law_rows.every(x => x.parent_change_accepted === false));
assert.equal(laws.totals.complete_signed_originals_verified, 0);
assert.equal(laws.totals.fully_adjudicated_individual_2026_ATU_effects, 0);

assert.equal(local.schema, 'ni-adm12-local-evidence-v1');
assert.equal(local.portals.length, 7);
assert.equal(new Set(local.portals.map(x => x.name)).size, 7);
assert.equal(local.regulation_example.default_normative_days_after_publication, 7);
assert.equal(local.all_local_originals_collected, false);
assert.equal(local.all_annual_editions_reviewed, false);
assert.equal(local.verified_de_facto_territorial_boundaries, false);

assert.equal(exceptions.exceptions.length, 9);
assert.equal(exceptions.closed_classification, 1);
assert.equal(exceptions.open_or_carried, 8);
assert.equal(exceptions.all_normative_exceptions_closed, false);
assert.ok(exceptions.exceptions.every(x => x.status === 'CLOSED_CLASSIFICATION_ONLY' || x.status.startsWith('OPEN_')));
assert.equal(laws.verdict.contemporary_adm_register_certified, false);
assert.equal(laws.verdict.tree_change_allowed, false);
assert.equal(laws.verdict.P9_1_allowed, false);
assert.equal(exceptions.controls.actual_modification, false);
assert.equal(exceptions.controls.website_tree_change, false);
console.log('PASS NI-ADM.1.2 source-scoped classification; legal/local certification remains blocked.');
