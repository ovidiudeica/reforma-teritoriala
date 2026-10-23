"""Per-object observed history gaps and current-state comparison; no admission."""
import datetime,re

def instant(value):
    t=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
    if t.tzinfo is None:raise ValueError('Naive object epoch')
    return t

def canonical(row):
    result={k:row[k] for k in ('code','version','visible','tags','nodes','members','x','y','payload_sha256') if k in row}
    if 'payload_sha256' in result and (not isinstance(result['payload_sha256'],str) or not re.fullmatch(r'[0-9a-f]{64}',result['payload_sha256'])):raise ValueError('Invalid payload fingerprint')
    result['timestamp']=instant(row['timestamp'])
    if 'tags' in result:result['tags']=sorted(result['tags'])
    return result

def inspect_gap(code,history,target,current=None,epoch="2026-10-20T20:23:47Z"):
    if not isinstance(code,str) or not re.fullmatch(r"[nwr][1-9][0-9]*",code):raise ValueError("Invalid typed identity")
    frozen=instant(epoch)
    if not history:raise ValueError('Missing observed history')
    if target.get('code')!=code or type(target.get('version')) is not int or target['version']<1:raise ValueError('Invalid target identity/version')
    if any(r['code']!=code or type(r['version']) is not int or r['version']<1 for r in history):raise ValueError('Mixed identity or invalid version')
    gaps=[];previous=None
    for row in history:
        stamp=instant(row['timestamp']);version=row['version'];pv=previous['version'] if previous else 0
        if version<=pv or (previous and stamp<instant(previous['timestamp'])):raise ValueError('Duplicate or nonmonotonic history')
        if version!=pv+1:gaps.append(dict(first_missing=pv+1,last_missing=version-1,before=None if previous is None else dict(version=pv,timestamp=previous['timestamp']),after=dict(version=version,timestamp=row['timestamp'])))
        previous=row
    if not gaps:raise ValueError('Not an observed gapped history')
    if target['code']!=code or not any(canonical(r)==canonical(target) for r in history):raise ValueError('Replay target absent or altered in observed history')
    eligible=[r for r in history if instant(r['timestamp'])<=frozen]
    if not eligible or canonical(eligible[-1])!=canonical(target):raise ValueError('Replay target is not the latest observed version at frozen epoch')
    observation='CURRENT_UNOBSERVED'
    if current is not None:
        if current['code']!=code:raise ValueError('Wrong current identity')
        if type(current['version']) is not int or current['version']<target['version']:raise ValueError('Current version contradicts replay target')
        if current['version']==target['version']:
            if canonical(current)!=canonical(target):raise ValueError('Same version has contradictory contents')
            observation='CURRENT_EQUALS_REPLAY_TARGET'
        else:
            if instant(current['timestamp'])<instant(target['timestamp']):raise ValueError('Current timestamp contradicts replay target')
            observation='CURRENT_DIFFERS_FROM_REPLAY_TARGET'
    return dict(code=code,observed_versions=[r['version'] for r in history],gaps=gaps,missing_observed_versions=sum(g['last_missing']-g['first_missing']+1 for g in gaps),target_version=target['version'],target_timestamp=target['timestamp'],current_version=None if current is None else current['version'],current_timestamp=None if current is None else current['timestamp'],current_observation=observation,historical_continuity='BLOCKED_VERSION_GAPS',target_state_acceptance='NOT_GRANTED',source_qualified=False,history_gaps_resolved=0)
