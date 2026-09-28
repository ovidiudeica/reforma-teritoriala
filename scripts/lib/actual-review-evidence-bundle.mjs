import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const REVIEW_EVIDENCE_BUNDLE_PATH='data/current/actual-review-evidence-bundle.json';
export const REVIEW_EVIDENCE_GATE_PATH='data/current/actual-review-evidence-bundle-gate.json';
export const REVIEW_EVIDENCE_ALGORITHM='actual-review-evidence-bundle-v1';

export const REVIEW_EVIDENCE_PATHS={
 ro_official_exception_audit:'data/current/ro-official-exception-audit.json',
 ro_level9_exception_audit:'data/current/ro-level9-exception-audit.json',
 ro_osm_official_exception_history:'data/sources/ro-osm-official-exception-history.json',
 ro_osm_level9_exception_history:'data/sources/ro-osm-level9-exception-history.json',
 md_osm_multiple_representation_history:'data/sources/md-osm-multiple-representation-history.json',
 md_balti_city_boundary_way_history:'data/sources/md-balti-city-boundary-way-history.json',
 md_balti_city_boundary_changeset_semantics:'data/sources/md-balti-city-boundary-changeset-semantics.json',
 md_cuatm_individual_deep_audit:'data/current/md-cuatm-individual-deep-audit.json'
};

export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function canonicalizeReviewEvidence(value){
 if(Array.isArray(value))return value.map(canonicalizeReviewEvidence);
 if(value&&typeof value==='object'){
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalizeReviewEvidence(value[key])]));
 }
 return value;
}

export function reviewEvidenceFingerprint(bundle){
 const payload=canonicalizeReviewEvidence({
  algorithm:REVIEW_EVIDENCE_ALGORITHM,
  evidence:bundle?.evidence??null
 });
 return {
  algorithm:REVIEW_EVIDENCE_ALGORITHM,
  sha256:sha256(Buffer.from(JSON.stringify(payload),'utf8')),
  payload
 };
}

const iso=value=>{
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toISOString():null;
};

export async function inspectCurrentReviewEvidence({readFileFn=readFile}={}){
 const evidence={};
 const timestamps=[];
 for(const [key,path] of Object.entries(REVIEW_EVIDENCE_PATHS)){
  const bytes=await readFileFn(path);
  const doc=JSON.parse(bytes.toString('utf8'));
  const generatedAt=iso(doc.generated_at);
  if(generatedAt)timestamps.push(generatedAt);
  evidence[key]={
   path,
   sha256:sha256(bytes),
   bytes:bytes.byteLength,
   schema_version:doc.schema_version??null,
   generated_at:generatedAt
  };
 }
 const evidenceWatermark=(timestamps.length
  ?new Date(Math.max(...timestamps.map(value=>new Date(value).getTime())))
  :new Date(0)).toISOString();
 return {evidence_watermark:evidenceWatermark,evidence};
}

export function buildReviewEvidenceBundle(inspected){
 const draft={
  schema_version:1,
  mode:'ACTUAL_REVIEW_EVIDENCE_BUNDLE',
  evidence_watermark:inspected.evidence_watermark,
  policy:'Frozen review evidence for deterministic ACTUAL candidate builds. OSM relation/way/changeset history and INS-derived reconciliation evidence are refreshed only by the dedicated review-evidence workflow. Candidate builds consume these committed bytes without network access.',
  evidence:inspected.evidence
 };
 const fingerprint=reviewEvidenceFingerprint(draft);
 return {
  schema_version:draft.schema_version,
  mode:draft.mode,
  evidence_watermark:draft.evidence_watermark,
  bundle_fingerprint_algorithm:fingerprint.algorithm,
  bundle_fingerprint_sha256:fingerprint.sha256,
  policy:draft.policy,
  evidence:draft.evidence
 };
}

export async function validateReviewEvidenceBundle(bundle,{readFileFn=readFile}={}){
 const checks=[],failures=[];
 const check=(name,ok,detail={})=>{
  checks.push({name,ok:Boolean(ok),detail});
  if(!ok)failures.push({name,detail});
 };
 let current=null,error=null;
 try{current=await inspectCurrentReviewEvidence({readFileFn});}
 catch(err){error=err;}
 check('bundle_schema_and_mode',
  bundle?.schema_version===1&&bundle?.mode==='ACTUAL_REVIEW_EVIDENCE_BUNDLE',
  {schema_version:bundle?.schema_version??null,mode:bundle?.mode??null});
 if(error){
  check('evidence_files_are_readable',false,{error:error.message});
 }else{
  check('bundle_evidence_watermark_matches_current_bytes',
   bundle?.evidence_watermark===current.evidence_watermark,
   {expected:current.evidence_watermark,actual:bundle?.evidence_watermark??null});
  check('bundle_evidence_matches_current_bytes',
   JSON.stringify(canonicalizeReviewEvidence(bundle?.evidence??null))===JSON.stringify(canonicalizeReviewEvidence(current.evidence)),
   {evidence_count:Object.keys(current.evidence).length});
 }
 const fingerprint=reviewEvidenceFingerprint(bundle);
 check('bundle_fingerprint_recomputes',
  bundle?.bundle_fingerprint_algorithm===fingerprint.algorithm
  &&bundle?.bundle_fingerprint_sha256===fingerprint.sha256,
  {algorithm:fingerprint.algorithm,expected:fingerprint.sha256,actual:bundle?.bundle_fingerprint_sha256??null});
 return {status:failures.length?'FAIL':'PASS',checks,failures,current,fingerprint};
}
