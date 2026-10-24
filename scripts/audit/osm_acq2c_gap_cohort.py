"""Extend an observation-only gap cohort; never close missing historical versions."""
import copy,re

def extend_cohort(prior,delta):
    if prior.get('source_qualified') is not False or type(prior.get('history_gaps_resolved')) is not int or prior['history_gaps_resolved']!=0:raise ValueError('Invalid observation-only prior')
    if delta.get('source_qualified') is not False or type(delta.get('history_gaps_resolved')) is not int or delta['history_gaps_resolved']!=0:raise ValueError('Observation delta cannot certify history')
    old=prior['rows'];new=delta['rows']
    if not isinstance(old,list) or not isinstance(new,list) or not old or not new:raise ValueError('Empty/invalid cohort')
    if type(prior.get('objects')) is not int or type(prior.get('missing_observed_versions')) is not int or prior['objects']!=len(old) or prior['missing_observed_versions']!=sum(x['missing_observed_versions'] for x in old):raise ValueError('Prior count mismatch')
    codes=set()
    for r in old+new:
        code=r.get('code')
        if not isinstance(code,str) or re.fullmatch('[nwr][1-9][0-9]*',code) is None or code in codes:raise ValueError('Invalid/duplicate typed identity')
        codes.add(code)
        if r.get('source_qualified') is not False or (type(r.get('history_gaps_resolved')) is not int or r['history_gaps_resolved']!=0) or r.get('historical_continuity')!='BLOCKED_VERSION_GAPS':raise ValueError('History closure not supported by this observation')
        if type(r.get('missing_observed_versions')) is not int or r['missing_observed_versions']<=0:raise ValueError('Invalid missing count')
    for r in new:
        observed=r['observed_versions'];missing=r['missing_versions']
        for values in (observed,missing):
            if not isinstance(values,list) or not values or any(type(v) is not int or not 0<v<2**32 for v in values) or sorted(set(values))!=values:raise ValueError('Invalid version set')
        absent=observed[0]-1+sum(b-a-1 for a,b in zip(observed,observed[1:]))
        if absent!=len(missing) or absent!=r['missing_observed_versions'] or max(missing)>=max(observed) or set(observed)&set(missing):raise ValueError('Missing version set inconsistent')
        access=r.get('missing_version_access',{})
        if access.get('status')==403 and access.get('accepted_as_version_evidence',False):raise ValueError('403 is not version evidence')
    rows=sorted(copy.deepcopy(old+new),key=lambda x:x['code'])
    return dict(objects=len(rows),rows=rows,missing_observed_versions=sum(x['missing_observed_versions'] for x in rows),history_gaps_resolved=0,source_qualified=False,source_promoted=False,provenance_human_or_signed_validation_pending=True)
