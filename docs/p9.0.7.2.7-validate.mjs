import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=p=>JSON.parse(readFileSync(p,'utf8'));
const v=load('docs/p9.0.7.2.7-legal-trigger-provenance.json');
const prev=load('docs/p9.0.7.2.6-primary-evidence-closure.json');
const policy=load('docs/p9.0.4.3-promotion-policy.json');

assert.equal(v.schema_version,'p90727-2024-2026-primary-dependency-evidence-v1');
assert.equal(v.dependency_records.length,5);
const byId=new Map(v.dependency_records.map(x=>[x.id,x]));
assert.equal(byId.size,5);

const civ=byId.get('PMR-2024-96-ZI-VII');
const local=byId.get('PMR-2024-97-ZD-VII');
assert(civ&&local);
assert.equal(civ.ministerial_publication_id,'2024001013');
assert.equal(local.ministerial_publication_id,'2024001014');
assert.equal(civ.publication_day,'2024-05-30');
assert.equal(local.publication_day,'2024-05-30');
assert.equal(civ.effective_rule,'AFTER_EXPIRATION_OF_60_DAYS_AFTER_PUBLICATION');
assert.equal(local.conditional_trigger_id,civ.id);
assert.equal(local.trigger_text_and_publication_match,true);
assert.equal(local.effective_date_proof,'TRIGGER_MATCHED_CALENDAR_INFERENCE_AWAITING_LEGAL_CONFIRMATION');
assert.equal(local.provisional_effective_date,'2024-07-30');
assert.equal(v.temporal_findings.civil_code_court_liquidation_condition_proven,true);
assert.equal(v.temporal_findings.civil_code_date_2024_07_30,'CALCULATED_SUBJECT_TO_INDEPENDENT_LEGAL_CONFIRMATION');

const source=byId.get('PMR-2024-339-ZI-VII');
const dependent=byId.get('PMR-2024-340-ZI-VII');
assert(source&&dependent);
assert.equal(source.ministerial_publication_id,'2024002592');
assert.equal(dependent.ministerial_publication_id,'2024002593');
assert.equal(source.publication_day,'2024-12-26');
assert.equal(dependent.publication_day,'2024-12-26');
assert.equal(source.effective_rule,'DAY_AFTER_OFFICIAL_PUBLICATION');
assert.equal(dependent.conditional_trigger_id,source.id);
assert.equal(dependent.trigger_text_and_publication_match,true);
assert.equal(source.provisional_effective_date,'2024-12-27');
assert.equal(dependent.provisional_effective_date,'2024-12-27');
assert.equal(v.temporal_findings.local_deputy_339_340_dependency_matched,true);

const cons=byId.get('PMR-2025-94-KZID-VII');
assert(cons);
assert.equal(cons.original_docx_terminal_date,'2024-06-09');
assert.equal(cons.new_registry_original_revision_terminal_date,'2025-06-09');
assert.equal(cons.official_catalog_date,'2025-06-09');
assert.equal(cons.date_conflict_reconciled_by_official_erratum,false);
assert.equal(cons.substantive_effective_date_certified,false);
assert.equal(v.temporal_findings.constitutional_94_conflicting_year_requires_official_erratum,true);
assert.equal(prev.identity_count,85);
assert.equal(v.identity_count,85);
assert.equal(v.identity_rows.length,85);
assert.equal(new Set(v.identity_rows.map(x=>x.actual_id)).size,85);
assert.deepEqual(v.identity_rows.map(x=>x.actual_id).sort(),prev.identity_rows.map(x=>x.actual_id).sort());
assert(v.identity_rows.every(x=>x.legal_md_parent_preserved &&
x.normative_trigger_records_read.length===5 &&
!x.administrative_parent_change_authorized &&
!x.administrative_status_identity_adjudicated &&
!x.full_polygon_effective_control_adjudicated &&
x.semantic_acceptance==='BLOCKED_INCOMPLETE' && x.p91_import_allowed===false));
assert(v.dependency_records.every(x=>x.id==='PMR-2025-94-KZID-VII'||(x.immutable_primary_file_sha256===null&&x.stable_primary_file_committed===false)));
assert(Object.values(v.outstanding).every(x=>x===true));
assert.equal(v.individual_adjudication_performed,false);
assert.equal(v.normative_exhaustiveness_certified,false);
assert.equal(v.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(v.p91_import_allowed,false);
assert.equal(v.actual_mutation_allowed,false);
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.p91_import_allowed,false);
console.log('P90727_DEPENDENCY_FAIL_CLOSED_PASS: Civil Code 96->Local 97 and deputies 339->340, 94/2025 conflict, 85 IDs, no P9.1');
