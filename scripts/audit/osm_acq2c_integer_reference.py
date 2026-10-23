"""Independent integer/rational selection checker; never source/topology approval.

Integer bins only prune impossible intersections. They do not buffer, snap,
round coordinates or change the strict-interior predicate.
"""
from fractions import Fraction

def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def minus(a,b):return a[0]-b[0],a[1]-b[1]
def on_segment(p,a,b):
    return cross(minus(p,a),minus(b,a))==0 and min(a[0],b[0])<=p[0]<=max(a[0],b[0]) and min(a[1],b[1])<=p[1]<=max(a[1],b[1])

def intersection_parameters(p,q,a,b):
    r,s=minus(q,p),minus(b,a);den=cross(r,s);delta=minus(a,p)
    if den:
        t,u=Fraction(cross(delta,s),den),Fraction(cross(delta,r),den)
        return [t] if 0<=t<=1 and 0<=u<=1 else []
    if cross(delta,r) or p==q:return []
    axis=0 if abs(r[0])>=abs(r[1]) else 1
    lo,hi=sorted((Fraction(a[axis]-p[axis],r[axis]),Fraction(b[axis]-p[axis],r[axis])))
    lo,hi=max(Fraction(0),lo),min(Fraction(1),hi)
    return [lo,hi] if lo<=hi else []

class IntegerArea:
    def __init__(self,edges,bin_width=1000000):
        if type(bin_width) is not int or bin_width<=0:raise ValueError('Invalid index width')
        self.width=bin_width;self.edges=[];self.y_bins={};self.xy_bins={};self.point_cache={};self.segment_cache={}
        for a,b in edges:
            a,b=tuple(a),tuple(b)
            if len(a)!=2 or len(b)!=2 or any(type(x) is not int for x in a+b):raise ValueError('Noninteger boundary')
            if a==b:continue
            i=len(self.edges);self.edges.append((a,b))
            for y in range(min(a[1],b[1])//bin_width,max(a[1],b[1])//bin_width+1):
                self.y_bins.setdefault(y,[]).append(i)
                for x in range(min(a[0],b[0])//bin_width,max(a[0],b[0])//bin_width+1):self.xy_bins.setdefault((x,y),[]).append(i)
        if not self.edges:raise ValueError('Empty boundary')
        self.bounds=(min(min(a[0],b[0]) for a,b in self.edges),min(min(a[1],b[1]) for a,b in self.edges),max(max(a[0],b[0]) for a,b in self.edges),max(max(a[1],b[1]) for a,b in self.edges))
    def point(self,p):
        p=tuple(p)
        if p in self.point_cache:return self.point_cache[p]
        minx,miny,maxx,maxy=self.bounds
        if p[0]<minx or p[0]>maxx or p[1]<miny or p[1]>maxy:
            self.point_cache[p]='outside';return 'outside'
        inside=False
        for i in self.y_bins.get(p[1]//self.width,[]):
            a,b=self.edges[i]
            if on_segment(p,a,b):self.point_cache[p]='boundary';return 'boundary'
            if (a[1]>p[1])!=(b[1]>p[1]) and cross(minus(b,a),minus(p,a))*(b[1]-a[1])>0:inside=not inside
        answer='inside' if inside else 'outside';self.point_cache[p]=answer;return answer
    def segment_has_interior(self,p,q):
        p,q=tuple(p),tuple(q);key=tuple(sorted((p,q)))
        if key in self.segment_cache:return self.segment_cache[key]
        if p==q:return self.point(p)=='inside'
        minx,miny,maxx,maxy=self.bounds
        lo_x,hi_x=max(min(p[0],q[0]),minx),min(max(p[0],q[0]),maxx)
        lo_y,hi_y=max(min(p[1],q[1]),miny),min(max(p[1],q[1]),maxy)
        if lo_x>hi_x or lo_y>hi_y:
            self.segment_cache[key]=False;return False
        candidates=set()
        if lo_x<=hi_x and lo_y<=hi_y:
            for x in range(lo_x//self.width,hi_x//self.width+1):
                for y in range(lo_y//self.width,hi_y//self.width+1):candidates.update(self.xy_bins.get((x,y),()))
        cuts={Fraction(0),Fraction(1)}
        for i in candidates:cuts.update(intersection_parameters(p,q,*self.edges[i]))
        parameters=sorted(cuts);answer=False
        for a,b in zip(parameters,parameters[1:]):
            mid=(a+b)/2;sample=(p[0]+(q[0]-p[0])*mid,p[1]+(q[1]-p[1])*mid)
            if self.point(sample)=='inside':answer=True;break
        self.segment_cache[key]=answer;return answer

def node_point(nodes,ref):
    row=nodes.get(str(ref))
    if row is None:raise ValueError('Missing certificate node')
    p=row['x'],row['y']
    if any(type(v) is not int for v in p) or not(-1800000000<=p[0]<=1800000000 and -900000000<=p[1]<=900000000):raise ValueError('Invalid exact node coordinate')
    return p

def relation_has_interior(relation,nodes,ways,area):
    for kind,ref,role in relation['members']:
        if kind=='r':continue  # Canonical area-query direct-member contract, not polygon assembly.
        if kind=='n':
            if area.point(node_point(nodes,ref))=='inside':return True
        elif kind=='w':
            way=ways.get(str(ref))
            if way is None:raise ValueError('Missing certificate way')
            points=[node_point(nodes,n) for n in way['nodes']]
            if any(area.point(p)=='inside' for p in points):return True
            if any(area.segment_has_interior(a,b) for a,b in zip(points,points[1:])):return True
        else:raise ValueError('Unknown member type')
    return False
