import json, hashlib, pathlib
from shapely.geometry import shape
from shapely.ops import unary_union, transform
from pyproj import Transformer
from itertools import combinations

root=pathlib.Path(__file__).resolve().parents[2]
sources=['public/geo/actual/ro-detail.geojson','public/geo/actual/ro-overview.geojson']
data=[(root/p).read_bytes() for p in sources]
detail,overview=[json.loads(x) for x in data]
ids=[7960954,7960953,7960937,7960957,7960956,7960955]
f={x['properties']['osm_relation_id']:x for x in detail['features'] if x['properties']['osm_relation_id'] in ids}
city=next(x for x in overview['features'] if x['properties']['osm_relation_id']==377733)
assert len(f)==6
projection=Transformer.from_crs('EPSG:4326','EPSG:3035',always_xy=True).transform
P={i:transform(projection,shape(x['geometry'])) for i,x in f.items()}
C=transform(projection,shape(city['geometry']))
U=unary_union(list(P.values()))
def sqm(g):return round(g.area,4)
pairs=[]
for a,b in combinations(ids,2):
 x,y=P[a],P[b]
 pairs.append({'a':a,'b':b,'intersection_area_m2':sqm(x.intersection(y)),'interior_overlap_m2':sqm(x.intersection(y)),'boundary_intersection_m':round(x.boundary.intersection(y.boundary).length,4),'symmetric_difference_area_m2':sqm(x.symmetric_difference(y)),'touches':x.touches(y)})
per_sector=[{'relation':i,'valid':P[i].is_valid,'area_m2':sqm(P[i]),'outside_city_m2':sqm(P[i].difference(C)),'city_not_in_sector_m2':sqm(C.difference(P[i]))} for i in ids]
res={'schema':'rt-adm2-13-topological-overlay-v1','crs_analysis':'EPSG:3035','source_git_paths':sources,'input_sha256':[hashlib.sha256(x).hexdigest() for x in data],'source_ids':ids,'city_relation':377733,'per_sector':per_sector,'pairwise':pairs,'summary':{'all_valid':all(x.is_valid for x in P.values()) and C.is_valid,'sector_union_area_m2':sqm(U),'city_area_m2':sqm(C),'symmetric_difference_area_m2':sqm(U.symmetric_difference(C)),'uncovered_city_area_m2':sqm(C.difference(U)),'union_outside_city_area_m2':sqm(U.difference(C)),'total_pairwise_overlap_area_m2':round(sum(x['intersection_area_m2'] for x in pairs),4),'geometric_match_certified':None},'legal_boundary_certified':False,'ACTUAL_modified':False}
s=res['summary'];s['geometric_match_certified']=s['all_valid'] and s['symmetric_difference_area_m2']<=0.01 and s['total_pairwise_overlap_area_m2']<=0.01
out=root/'outputs/RT-ADM.2.13/topological-overlay.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(res,indent=2)+'\n')
print(json.dumps(s,indent=2))
assert s['geometric_match_certified'],'Geometric partition not exact'
