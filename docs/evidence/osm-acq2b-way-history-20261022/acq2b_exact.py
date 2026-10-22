"""Exact frozen-grid boundary audit. Not live Overpass-area certification."""
import sys,pathlib,json,gzip,hashlib,decimal,collections,math
from fractions import Fraction
sys.path.insert(0,str(pathlib.Path('work/gis-runtime').resolve()))
from shapely.geometry import LineString,box
from shapely.strtree import STRtree
from acq2a_audit import decode_graph,merge_graphs,rings,encode,EPOCH

SCALE=10**7
def grid(value):
    scaled=decimal.Decimal(str(value))*SCALE
    if scaled!=scaled.to_integral_value():
        raise ValueError('Coordinate not exactly on the OSM 1e-7 degree grid')
    return int(scaled)

def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def sub(a,b):return(a[0]-b[0],a[1]-b[1])
def on_edge(p,a,b):
    return cross(sub(p,a),sub(b,a))==0 and min(a[0],b[0])<=p[0]<=max(a[0],b[0]) and min(a[1],b[1])<=p[1]<=max(a[1],b[1])

def cuts(p,q,a,b):
    """Exact segment intersection parameters, including collinear overlaps."""
    r=sub(q,p);s=sub(b,a);ap=sub(a,p);den=cross(r,s)
    if den:
        t=Fraction(cross(ap,s),den);u=Fraction(cross(ap,r),den)
        return [t] if 0<=t<=1 and 0<=u<=1 else []
    if cross(ap,r) or p==q:return []
    axis=0 if r[0] else 1
    lo,hi=sorted([Fraction(a[axis]-p[axis],r[axis]),Fraction(b[axis]-p[axis],r[axis])])
    lo=max(Fraction(0),lo);hi=min(Fraction(1),hi)
    return [lo,hi] if lo<=hi else []

class ExactArea:
    def __init__(self,edges):
        self.edges=[(tuple(a),tuple(b)) for a,b in edges if a!=b]
        if not self.edges:raise ValueError('Empty boundary')
        self.tree=STRtree([LineString([a,b]) for a,b in self.edges])
        self.maxx=max(max(a[0],b[0]) for a,b in self.edges)
        self.points={};self.segments={}
    def point(self,p):
        p=tuple(p)
        if p in self.points:return self.points[p]
        # Integer bounds conservatively enclose the rational horizontal ray;
        # floating GEOS predicates are not used in the final determination.
        if p[0]>self.maxx:return 'outside'
        candidate=self.tree.query(box(math.floor(p[0]),math.floor(p[1]),self.maxx+1,math.ceil(p[1])))
        inside=False
        for idx in candidate:
            a,b=self.edges[int(idx)]
            if on_edge(p,a,b):self.points[p]='boundary';return 'boundary'
            if (a[1]>p[1])!=(b[1]>p[1]):
                x=a[0]+Fraction((p[1]-a[1])*(b[0]-a[0]),b[1]-a[1])
                if x>p[0]:inside=not inside
        result='inside' if inside else 'outside';self.points[p]=result;return result
    def segment(self,p,q):
        p,q=tuple(p),tuple(q);key=tuple(sorted([p,q]))
        if key in self.segments:return self.segments[key]
        if p==q:return {'inside':self.point(p)=='inside','intervals':{'degenerate':1}}
        parameters={Fraction(0),Fraction(1)}
        for idx in self.tree.query(LineString([p,q])):
            parameters.update(cuts(p,q,*self.edges[int(idx)]))
        parameters=sorted(parameters);states=collections.Counter()
        for lo,hi in zip(parameters,parameters[1:]):
            t=(lo+hi)/2
            point=(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t)
            states[self.point(point)]+=1
        result={'inside':states['inside']>0,'intervals':dict(states)}
        self.segments[key]=result;return result

def root_boundary(graph,code):
    roots=[o for (t,_),o in graph.items() if t=='relation' and o.get('tags',{}).get('ISO3166-1')==code and o['tags'].get('boundary')=='administrative']
    if len(roots)!=1:raise ValueError('Ambiguous root')
    root=roots[0];paths={'outer':[],'inner':[]};edges=[];descriptors=[]
    for m in root['members']:
        if m['type']=='way':
            role=m['role'] or 'outer'
            if role not in paths:raise ValueError('Unexpected country role')
            way=graph[('way',m['ref'])];paths[role].append(way['nodes']);descriptors.append(way)
    for role in paths:
        for ring in rings(paths[role]):
            xy=[(grid(graph[('node',n)]['lon']),grid(graph[('node',n)]['lat'])) for n in ring]
            edges.extend(zip(xy,xy[1:]))
    return root,edges,hashlib.sha256(encode(descriptors)).hexdigest()

def audit_relation(relation,graph,area):
    node_states=collections.Counter();intervals=collections.Counter();way_count=0;segment_count=0
    missing=set();used={};inside_witness=None
    def point(n):
        key=('node',n);obj=graph.get(key)
        if obj is None:missing.add(key);return None
        used[key]=obj
        xy=(grid(obj['lon']),grid(obj['lat']))
        state=area.point(xy);node_states[state]+=1
        return xy,state
    for m in relation['members']:
        if m['type']=='node':
            p=point(m['ref'])
            if p and p[1]=='inside':inside_witness={'type':'node','id':m['ref']}
        elif m['type']=='way':
            key=('way',m['ref']);way=graph.get(key)
            if way is None:missing.add(key);continue
            used[key]=way;way_count+=1;previous=None
            for n in way['nodes']:
                current=point(n)
                if current and current[1]=='inside':inside_witness={'type':'way','id':m['ref'],'node':n}
                if current and previous:
                    state=area.segment(previous[0],current[0]);intervals.update(state['intervals']);segment_count+=1
                    if state['inside']:inside_witness={'type':'way','id':m['ref'],'segment':[previous[2],n]}
                previous=(current[0],current[1],n) if current else None
    verdict='UNKNOWN_MISSING_DEPENDENCIES' if missing else ('IN_SCOPE_PROVEN' if inside_witness else 'OUT_OF_SCOPE_PROVEN')
    return {'verdict':verdict,'missing':sorted(missing),'inside_witness':inside_witness,
        'node_occurrence_states':dict(node_states),'segment_interval_states':dict(intervals),
        'way_count':way_count,'segment_count':segment_count,'used_objects':len(used),
        'used_objects_sha256':hashlib.sha256(encode([used[k] for k in sorted(used)])).hexdigest()}

def generate():
    root=pathlib.Path(pathlib.Path('work/current-osm-resume-20261022.txt').read_text(encoding='utf8').strip())
    raw_registry=pathlib.Path('outputs/OSM-ACQ2a-20261022/registry-final.json').read_bytes()
    if hashlib.sha256(raw_registry).hexdigest()!='833a25a36d4251c022ed84853207e90a71771498f4bd99c4189e901aacdd539e':raise ValueError('Registry drift')
    registry=json.loads(raw_registry);report=json.loads((root/'extract-replay-v2/report.json').read_text(encoding='utf8'))
    graphs={};inputs=[]
    for row in report['reports']:
        packed=(root/'extract-replay-v2'/row['raw_file']).read_bytes()
        _,graphs[row['country']]=decode_graph(packed,row)
        if row['raw_gzip_sha256']!=next(i['gzip_sha256'] for i in registry['input_evidence'] if i['domain']==row['country']):raise ValueError('Unbound input')
        inputs.append({'domain':row['country'],'gzip_sha256':row['raw_gzip_sha256'],'body_sha256':row['raw_body_sha256']})
    graph,_=merge_graphs(graphs);areas={};boundaries=[]
    for code in graphs:
        own={(o['type'],o['id']):o for o in graphs[code]};r,edges,ways_hash=root_boundary(own,code)
        areas[code]=ExactArea(edges);boundaries.append({'domain':code,'root_id':r['id'],'version':r['version'],'edge_count':len(edges),'edges_sha256':hashlib.sha256(encode(edges)).hexdigest(),'ways_sha256':ways_hash})
    rows=[]
    for old in registry['rows']:
        for d in old['domains']:
            if d['new_verdict']!='UNKNOWN_INSUFFICIENT_SPATIAL_EVIDENCE':continue
            r=graph[('relation',old['id'])]
            if hashlib.sha256(encode(r)).hexdigest()!=d['relation_sha256']:raise ValueError('Relation drift')
            audit=audit_relation(r,graph,areas[d['domain']])
            rows.append({'id':old['id'],'domain':d['domain'],'version':r['version'],'timestamp':r['timestamp'],'previous_verdict':d['new_verdict'],**audit})
            if len(rows)%20==0:print(json.dumps({'phase':'exact_boundary_audit','completed':len(rows)}),flush=True)
    counts=dict(collections.Counter(r['verdict'] for r in rows))
    if len(rows)!=116:raise ValueError('Unexpected cohort')
    resolved_ids={r['id'] for r in rows if not r['verdict'].startswith('UNKNOWN')}
    # This cohort has one domain per ID; preserve all original missing cases.
    if len({r['id'] for r in rows})!=len(rows):raise ValueError('Unexpected duplicate domain')
    return {'schema':'osm-acq2b-independent-exact-grid-boundary-v1','epoch':EPOCH,
        'scope':'Exact direct-node/way predicate against frozen country polygons, not live Overpass area equivalence.',
        'source_promoted':False,'overpass_equivalence_certified':False,'grid_scale':SCALE,
        'method':'Integer orientation, rational intersections, split-segment interval witnesses; even-odd ray crossing. STRtree supplies conservative integer bbox candidates only.',
        'parent_registry_sha256':hashlib.sha256(raw_registry).hexdigest(),'input_evidence':inputs,'country_boundaries':boundaries,
        'summary':{'audited_boundary_ids':116,'verdict_counts':counts,'new_resolved_ids':len(resolved_ids),'previous_remaining_ids':376,'remaining_ids':376-len(resolved_ids),'previous_resolved_ids':15,'total_resolved_ids':15+len(resolved_ids)},
        'rows':rows}

if __name__=='__main__':
    out=pathlib.Path('outputs/OSM-ACQ2b-EXACT-20261022');out.mkdir(exist_ok=True)
    result=generate();data=encode(result);p=out/'boundary-registry.json'
    if '--verify' in sys.argv:
        if p.read_bytes()!=data:raise ValueError('Non-identical regeneration')
    else:
        if p.exists():raise FileExistsError('Do not overwrite evidence')
        p.write_bytes(data)
    print(json.dumps({'summary':result['summary'],'sha256':hashlib.sha256(data).hexdigest()}))
