"""Recompute only the fixed AUTO-3 case geometries; no source census or writes."""
import gzip,json,hashlib,sys
from pathlib import Path
import shapely,pyproj
from shapely.geometry import shape
root=Path(__file__).resolve().parents[2]/'docs/audits/auto3-osmb'
reg=json.loads((root/'register.json').read_bytes());p=pyproj.Transformer.from_crs(4326,3035,always_xy=True)
geometries=json.loads(gzip.decompress((root/'geometry-cases.json.gz').read_bytes()))
area=lambda g:shapely.transform(g,p.transform,interleaved=False).area
differences=equivalents=checked=0
for r in reg['records']:
 d=geometries[r['geometry_key']]
 rawcase=json.dumps(d,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8')
 assert hashlib.sha256(rawcase).hexdigest()==r['geometry_case_canonical_sha256']
 if 'source' in d:
  sg=shape(d['source']['geometry']);assert sg.is_valid
  raw=json.dumps(d['source'],ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8')
  assert hashlib.sha256(raw).hexdigest()==r['osm']['feature_canonical_sha256']
  assert abs(area(sg)-r['geometry']['osmb_area_m2'])<1e-5
 if r['exception_kind']=='GEOMETRY_DIFFERENCE':
  ag=shape(d['actual']['geometry']);assert ag.is_valid
  delta=sg.symmetric_difference(ag)
  assert abs(area(delta)-r['geometry']['symmetric_difference_m2'])<1e-5
  assert sg.difference(ag).equals(shape(d['source_minus_actual']))
  assert ag.difference(sg).equals(shape(d['actual_minus_source']))
  differences+=1
 for f in d.get('equal_actual_features',[]):assert sg.equals(shape(f['geometry']));equivalents+=1
 if r['exception_kind']=='ACTUAL_ONLY':
  ag=shape(d['actual']['geometry']);assert ag.is_valid
  assert abs(area(ag)-r['geometry']['actual_area_m2'])<1e-5
  for f in d.get('equal_osmb_features',[]):assert ag.equals(shape(f['geometry']))
 checked+=1
assert checked==298 and differences==13
partition=json.loads((root/'bretcu-ojdula-partition-check.json').read_bytes())
shell=shape(geometries['osm-r14735731']['source']['geometry']);oj=shape(geometries['osm-r14735731']['actual']['geometry']);br=shape(geometries['siruta-u64096']['actual']['geometry'])
assert oj.union(br).equals(shell)==partition['union_equals_osmb_shell']
assert abs(area(oj.union(br).symmetric_difference(shell))-partition['union_shell_symmetric_difference_m2'])<1e-5
assert area(oj.intersection(br))==partition['interior_overlap_m2']==0
print(json.dumps({'status':'PASS','cases':checked,'differences_reproduced':differences,'alternative_equivalences_verified':equivalents,'actual_modified':False,'shapely':shapely.__version__,'pyproj':pyproj.__version__}))
