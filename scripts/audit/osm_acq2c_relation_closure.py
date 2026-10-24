"""Deterministic relation projection; closure here never certifies geometry/source."""
import collections,re

def identity(code):
    if not isinstance(code,str) or re.fullmatch(r'r[1-9][0-9]*',code) is None:
        raise ValueError('Invalid relation identity')
    return code

def merge_relations(*datasets):
    result={}
    for dataset in datasets:
        for code,row in dataset.items():
            identity(code)
            if not isinstance(row,dict) or row.get('code')!=code or row.get('type','relation')!='relation':
                raise ValueError('Invalid relation row')
            version=row.get('version')
            if type(version) is not int or version<1:raise ValueError('Invalid version')
            if code in result and result[code]!=row:raise ValueError('Conflicting relation observations')
            result[code]=row
    return {code:result[code] for code in sorted(result)}

def project_relations(known,roots):
    """W/N cannot point to relations, so R-only reachability is independent of them."""
    known=merge_relations(known)
    roots=sorted({identity(code) for code in roots})
    queue=collections.deque(roots);visited=set();missing={};ways=set();nodes=set()
    while queue:
        code=queue.popleft()
        if code in visited:continue
        visited.add(code)
        if code not in known:
            missing.setdefault(code,set())
            continue
        row=known[code]
        if row.get('visible') is not True:raise ValueError('Invisible referenced relation')
        members=row.get('members')
        if not isinstance(members,list):raise ValueError('Missing relation members')
        for member in members:
            if not isinstance(member,(list,tuple)) or len(member)!=3:raise ValueError('Invalid member')
            typ,ref,role=member
            if typ not in ('r','w','n') or type(ref) is not int or ref<1 or not isinstance(role,str):
                raise ValueError('Invalid member identity/role')
            child=typ+str(ref)
            if typ=='r':
                if child not in known:missing.setdefault(child,set()).add(code)
                else:queue.append(child)
            elif typ=='w':ways.add(child)
            else:nodes.add(child)
    return dict(roots=roots,visited_relations=len(visited),known_relations=len(known),
                missing_relations=[dict(code=code,parents=sorted(missing[code])) for code in sorted(missing)],
                direct_way_ids=sorted(ways),direct_node_ids=sorted(nodes),relation_graph_closed=not missing,
                dependency_closure_certified=False,topology_certified=False,source_qualified=False)
