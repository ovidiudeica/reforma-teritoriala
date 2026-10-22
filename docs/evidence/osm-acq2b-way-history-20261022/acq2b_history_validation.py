import datetime
from acq2b_exact import grid,EPOCH

def select_version(history,current,target=EPOCH):
    def stamp(t):return datetime.datetime.fromisoformat(t.replace('Z','+00:00'))
    def canonical(n):return dict(n.attrib),[(t.tag,dict(t.attrib))for t in n if t.tag!='tag'],sorted((t.get('k'),t.get('v'))for t in n.findall('tag'))
    if not history or len(current)!=1:raise ValueError('History/current incomplete')
    ids={n.get('id')for n in history+current}
    if len(ids)!=1:raise ValueError('Mixed identities')
    versions=[int(n.get('version'))for n in history]
    if versions!=list(range(1,max(versions)+1)):raise ValueError('History has gaps/duplicates/reordering')
    dates=[stamp(n.get('timestamp'))for n in history]
    if dates!=sorted(dates):raise ValueError('Nonmonotonic history')
    if canonical(history[-1])!=canonical(current[0]):raise ValueError('Latest history/current mismatch')
    eligible=[i for i,t in enumerate(dates)if t<=stamp(target)]
    if not eligible:raise ValueError('No target version')
    i=eligible[-1];n=history[i]
    if n.get('visible','true')!='true':raise ValueError('Target deleted/redacted')
    return n,{'effective_from':n.get('timestamp'),'effective_until':history[i+1].get('timestamp')if i+1<len(history)else None,'latest_version':versions[-1]}

def validate_history(history,current,target=EPOCH):
    n,proof=select_version(history,current,target)
    if n.tag!='node' or n.get('lon') is None or n.get('lat') is None:raise ValueError('Missing node coordinates')
    grid(n.get('lon'));grid(n.get('lat'))
    lon,lat=float(n.get('lon')),float(n.get('lat'))
    if not(-180<=lon<=180 and -90<=lat<=90):raise ValueError('Coordinates invalid')
    return {'object':{'type':'node','id':int(n.get('id')),'version':int(n.get('version')),'timestamp':n.get('timestamp'),
        'lon':lon,'lat':lat,'tags':{t.get('k'):t.get('v')for t in n.findall('tag')}},
        **proof}

def validate_way_history(history,current,target=EPOCH):
    n,proof=select_version(history,current,target)
    refs=[int(t.get('ref'))for t in n.findall('nd')]
    if n.tag!='way' or len(refs)<2 or any(r<=0 for r in refs):raise ValueError('Incomplete way geometry references')
    return {'object':{'type':'way','id':int(n.get('id')),'version':int(n.get('version')),'timestamp':n.get('timestamp'),
        'nodes':refs,'tags':{t.get('k'):t.get('v')for t in n.findall('tag')}},**proof}
