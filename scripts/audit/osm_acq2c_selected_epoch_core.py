"""Selected-object semantic reconciliation only, never source qualification."""
import datetime as dt,decimal,re

def moment(value):
    if not isinstance(value,str):raise ValueError('Timestamp type')
    result=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
    if result.tzinfo is None:raise ValueError('Naive timestamp')
    return result.astimezone(dt.timezone.utc)

def validate_epochs(base,target,expected_base,expected_target):
    if moment(base)!=moment(expected_base) or moment(target)!=moment(expected_target) or moment(base)>=moment(target):raise ValueError('Base/tail epoch mismatch')

def coordinate(value,bound):
    number=decimal.Decimal(value)
    if not number.is_finite() or not -bound<=number<=bound:raise ValueError('Coordinate bounds')
    scaled=number*10000000
    if scaled!=scaled.to_integral_value():raise ValueError('Non-OSM coordinate precision')
    return int(scaled)

def positive(value):
    if type(value) is not int or value<=0:raise ValueError('Invalid identity/version')
    return value

def tail_record(row):
    types={'node':'n','way':'w','relation':'r'}
    typ=types.get(row.get('type'))
    if typ is None:raise ValueError('Unknown object type')
    oid=positive(row['id']);version=positive(row['version'])
    action=row.get('action');visible=row.get('visible')
    if action not in ('create','modify','delete') or visible not in ('true','false') or (action=='delete')!=(visible=='false'):raise ValueError('Action/visibility conflict')
    tags=sorted(row['tags'])
    if len({k for k,v in tags})!=len(tags):raise ValueError('Duplicate tag key')
    result=dict(code=typ+str(oid),version=version,timestamp=moment(row['timestamp']).isoformat().replace('+00:00','Z'),visible=visible=='true',tags=tags)
    if typ=='n' and result['visible']:result.update(x=coordinate(row['lon'],180),y=coordinate(row['lat'],90))
    if typ=='w':result['nodes']=[positive(n) for n in row['nodes']]
    if typ=='r':
        members=[]
        for member in row['members']:
            ref=member['ref']
            role=member.get('role','')
            if not isinstance(ref,str) or not re.fullmatch('[1-9][0-9]*',ref) or member['type'] not in types or not isinstance(role,str):raise ValueError('Malformed relation member')
            members.append([types[member['type']],int(ref),role])
        result['members']=members
    return result

def reconcile(base_rows,tail_rows,requested,base_epoch,target_epoch):
    start,end=moment(base_epoch),moment(target_epoch)
    if start>=end:raise ValueError('Invalid epoch ordering')
    versions={};duplicates=0;base_keys=set()
    for row in base_rows:
        code=row['code'];v=positive(row['version'])
        if code not in requested or not isinstance(row['visible'],bool) or moment(row['timestamp'])>start:raise ValueError('Invalid base record')
        key=(code,v)
        if key in versions:raise ValueError('Duplicate base version')
        versions[key]=row;base_keys.add(key)
    for raw in tail_rows:
        row=tail_record(raw);key=(row['code'],row['version'])
        if row['code'] not in requested:raise ValueError('Unrequested tail identity')
        if key in versions:
            if row!=versions[key]:raise ValueError('Conflicting overlapping version')
            duplicates+=1
        else:
            if moment(row['timestamp'])<=start:raise ValueError('Tail introduces pre-base version absent from full base')
            versions[key]=row
    histories={}
    for (code,v),row in sorted(versions.items()):histories.setdefault(code,[]).append(row)
    gaps=[];selected={};post_target=0
    for code,rows in histories.items():
        nums=[r['version'] for r in rows];dates=[moment(r['timestamp']) for r in rows]
        if dates!=sorted(dates):raise ValueError('Reversed version timestamps')
        if nums[0]!=1 or any(b!=a+1 for a,b in zip(nums,nums[1:])):gaps.append(code)
        eligible=[r for r in rows if moment(r['timestamp'])<=end]
        if eligible:selected[code]=eligible[-1]
        post_target+=len(rows)-len(eligible)
    return {'selected':selected,'missing_ids':sorted(set(requested)-selected.keys()),'gapped_ids':sorted(gaps),'duplicate_observations_deduplicated':duplicates,'post_target_versions_retained':post_target,'histories':histories,'source_qualified':False,'dependency_closure_certified':False,'unknown_adjudicated':0}
