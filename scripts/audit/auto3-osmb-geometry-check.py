"""Recompute only the fixed AUTO-3 case geometries; no source census or writes."""
import gzip,json,hashlib,sys,math
from pathlib import Path
import shapely,pyproj
from shapely.geometry import shape
root=Path(__file__).resolve().parents[2]/'docs/audits/auto3-osmb'
reg=json.loads((root/'register.json').read_bytes());p=pyproj.Transformer.from_crs(4326,3035,always_xy=True)
geometries=json.loads(gzip.decompress((root/'geometry-cases.json.gz').read_bytes()))
area=lambda g:shapely.transform(g,p.transform,interleaved=False).area
scalar_checks=[]
def check_area(g,expected,label):
 pg=shapely.transform(g,p.transform,interleaved=False);observed=pg.area
 coordinates=shapely.get_coordinates(pg)
 magnitude=max((abs(float(v)) for pair in coordinates for v in pair),default=1.0)
 # Cross-platform projection roundoff: at most 128 coordinate ULPs times
 # perimeter, plus 64 ULPs of the area scalar. This is a numerical error
 # budget, not a topology/identity acceptance threshold. Every input hash
 # and exact difference/equality predicate below remains mandatory.
 budget=max(1e-8,128*math.ulp(magnitude)*pg.length,64*math.ulp(abs(expected)))
 difference=abs(observed-expected)
 scalar_checks.append({'check':label,'expected_m2':expected,'observed_m2':observed,'absolute_difference_m2':difference,'roundoff_budget_m2':budget})
 assert difference<=budget,scalar_checks[-1]
differences=equivalents=checked=0
for r in reg['records']:
 d=geometries[r['geometry_key']]
 rawcase=json.dumps(d,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8')
 assert hashlib.sha256(rawcase).hexdigest()==r['geometry_case_canonical_sha256']
 if 'source' in d:
  sg=shape(d['source']['geometry']);assert sg.is_valid
  raw=json.dumps(d['source'],ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8')
  assert hashlib.sha256(raw).hexdigest()==r['osm']['feature_canonical_sha256']
  check_area(sg,r['geometry']['osmb_area_m2'],r['case_id']+':osmb_area')
 if r['exception_kind']=='GEOMETRY_DIFFERENCE':
  ag=shape(d['actual']['geometry']);assert ag.is_valid
  delta=sg.symmetric_difference(ag)
  check_area(delta,r['geometry']['symmetric_difference_m2'],r['case_id']+':symmetric_difference')
  assert sg.difference(ag).equals(shape(d['source_minus_actual']))
  assert ag.difference(sg).equals(shape(d['actual_minus_source']))
  differences+=1
 for f in d.get('equal_actual_features',[]):assert sg.equals(shape(f['geometry']));equivalents+=1
 if r['exception_kind']=='ACTUAL_ONLY':
  ag=shape(d['actual']['geometry']);assert ag.is_valid
  check_area(ag,r['geometry']['actual_area_m2'],r['case_id']+':actual_area')
  for f in d.get('equal_osmb_features',[]):assert ag.equals(shape(f['geometry']))
 checked+=1
assert checked==298 and differences==13
partition=json.loads((root/'bretcu-ojdula-partition-check.json').read_bytes())
shell=shape(geometries['osm-r14735731']['source']['geometry']);oj=shape(geometries['osm-r14735731']['actual']['geometry']);br=shape(geometries['siruta-u64096']['actual']['geometry'])
assert oj.union(br).equals(shell)==partition['union_equals_osmb_shell']
check_area(oj.union(br).symmetric_difference(shell),partition['union_shell_symmetric_difference_m2'],'bretcu-ojdula:union_residual')
assert area(oj.intersection(br))==partition['interior_overlap_m2']==0
print(json.dumps({'status':'PASS','cases':checked,'differences_reproduced':differences,'alternative_equivalences_verified':equivalents,'actual_modified':False,'shapely':shapely.__version__,'geos':shapely.geos_version_string,'pyproj':pyproj.__version__,'proj':pyproj.proj_version_str,'scalar_checks':len(scalar_checks),'largest_scalar_drift':max(scalar_checks,key=lambda x:x['absolute_difference_m2'])}))
