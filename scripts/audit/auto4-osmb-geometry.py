"""Read-only reconstruction of exactly109 AUTO-4 geometries. No repair or snapping."""
from pathlib import Path
import json,gzip,hashlib,sys,math
import shapely,pyproj
from shapely.geometry import shape,Polygon,LineString,mapping
from shapely.ops import polygonize_full,unary_union
repo=Path(__file__).resolve().parents[2];root=repo/'docs/audits/auto4-osmb-109'
reg=json.loads((root/'register.json').read_bytes());bundle=json.loads(gzip.decompress((repo/'docs/audits/auto3-osmb/geometry-cases.json.gz').read_bytes()))
proj=pyproj.Transformer.from_crs(4326,3035,always_xy=True)
area=lambda g:shapely.transform(g,proj.transform,interleaved=False).area
canon=lambda o:json.dumps(o,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8')
scope=json.loads((root/'scope.json').read_bytes())
baseline=json.loads((repo/'docs/audits/auto3-osmb/register.json').read_bytes())
for r in baseline['records']:
 if r['cartographic_status']!='REVIEW_REQUIRED':assert hashlib.sha256(canon(r)).hexdigest()==scope['preserved_189_record_sha256'][r['case_id']]
actual={}
for p in sorted((repo/'public/geo/actual').glob('*.geojson')):
 for f in json.loads(p.read_bytes()).get('features',[]):
  key=f.get('properties',{}).get('entity_id')
  if key and key not in actual:actual[key]=f
def reconstruct(row):
 typ=row['osm']['type'];oid=row['osm']['id'];path=root/'osm'/f'{typ}{oid}-full.json.gz'
 if not path.exists():return None,{'status':'DELETED_NO_CURRENT_FULL_RESPONSE','legal_consequence':None}
 elements=json.loads(gzip.decompress(path.read_bytes()))['elements'];nodes={e['id']:(e['lon'],e['lat']) for e in elements if e['type']=='node'};ways={e['id']:e for e in elements if e['type']=='way'};obj=next(e for e in elements if e['type']==typ and e['id']==oid)
 if typ=='way':
  refs=obj['nodes']
  if refs[0]!=refs[-1]:return None,{'status':'OPEN_WAY_NOT_POLYGON'}
  if any(n not in nodes for n in refs):return None,{'status':'MISSING_NODE'}
  g=Polygon([nodes[n] for n in refs]);detail={'status':'RECONSTRUCTED_CLOSED_WAY','nodes':len(refs),'version':obj['version'],'timestamp':obj['timestamp']}
 else:
  boundary=[m for m in obj['members'] if m.get('role','') in ('','outer','inner') and m['type']!='node']
  if any(m['type']!='way' for m in boundary):return None,{'status':'NESTED_BOUNDARY_REQUIRES_RECURSIVE_EPOCH_PROOF'}
  groups={'outer':[],'inner':[]}
  for m in boundary:
   if m['ref'] not in ways:return None,{'status':'MISSING_MEMBER_WAY'}
   refs=ways[m['ref']]['nodes']
   if any(n not in nodes for n in refs):return None,{'status':'MISSING_MEMBER_NODE'}
   groups['inner' if m.get('role')=='inner' else 'outer'].append(LineString([nodes[n] for n in refs]))
  polygons={}
  for role,lines in groups.items():
   p,cuts,dangles,invalid=polygonize_full(lines)
   if any(not e.is_empty for e in (cuts,dangles,invalid)):return None,{'status':'UNRESOLVED_MEMBER_LINEWORK','role':role,'cuts':len(cuts.geoms),'dangles':len(dangles.geoms),'invalid':len(invalid.geoms)}
   polygons[role]=unary_union(list(p.geoms))
  g=polygons['outer'].difference(polygons['inner']);detail={'status':'RECONSTRUCTED_RELATION_LINEWORK','outer_ways':len(groups['outer']),'inner_ways':len(groups['inner']),'version':obj['version'],'timestamp':obj['timestamp'],'temporal_caveat':'Full API is a current response; member edit timestamps may differ. No historical simultaneity or legal perimeter inferred.'}
 if g.is_empty or not g.is_valid:return None,{'status':'INVALID_CURRENT_POLYGON','validity':shapely.is_valid_reason(g)}
 return g,detail
rows=[]
for row in reg['records']:
 d=bundle[row['geometry_key']];assert hashlib.sha256(canon(d)).hexdigest()==row['baseline_geometry_case_sha256'];feature=d['source'] if 'source' in d else d['actual'];g=shape(feature['geometry']);assert g.is_valid
 current,detail=reconstruct(row)
 if current is not None:detail.update(geometry=mapping(current),valid=current.is_valid,equals_archive=current.equals(g),symmetric_difference_m2=area(current.symmetric_difference(g)),current_area_m2=area(current),current_bbox=list(current.bounds))
 parents=[]
 keys=[p['osm_key'] for p in row['original_hierarchy'].get('osmb_parent_context',[])]
 if row['original_hierarchy'].get('actual'):keys+=[row['original_hierarchy']['actual'].get('parent_catalog_id')]
 for key in dict.fromkeys(k for k in keys if k):
  if key not in actual:parents.append({'parent_id':key,'status':'NO_ACCEPTED_GEOMETRY_AVAILABLE'});continue
  pg=shape(actual[key]['geometry']);assert pg.is_valid;outside=g.difference(pg);parents.append({'parent_id':key,'status':'COMPUTED_AGAINST_ACCEPTED_CARTOGRAPHY_ONLY','covered':pg.covers(g),'outside_area_m2':area(outside),'outside_empty':outside.is_empty,'legal_parentage_certified':False})
 rows.append({'case_id':row['case_id'],'geometry_key':row['geometry_key'],'archived_geometry_canonical_sha256':hashlib.sha256(canon(feature['geometry'])).hexdigest(),'archived_area_m2':area(g),'archived_bbox':list(g.bounds),'archived_valid':g.is_valid,'accepted_parent_cartography':parents,'current_osm_comparison':detail,'legal_geometry_certified':False})
result={'schema':'auto4-targeted-geometry-v1','scope':109,'input_crs':'EPSG:4326','area_crs':'EPSG:3035','operations':'Exact predicates and unsnapped difference in4326, then project difference to3035 for area. No repair/simplification. Current OSM is observational evidence only.','software':{'shapely':shapely.__version__,'geos':shapely.geos_version_string,'pyproj':pyproj.__version__,'proj':pyproj.proj_version_str},'records':rows}
if '--emit-json' in sys.argv:
 print(json.dumps(result,ensure_ascii=False,indent=2));raise SystemExit(0)
else:
 expected=json.loads((root/'geometry-results.json').read_bytes());assert expected['scope']==109
 def compare(a,b):
  if isinstance(a,float) and isinstance(b,(float,int)):
   assert math.isclose(a,b,rel_tol=1e-11,abs_tol=1e-6),(a,b)
  elif isinstance(a,dict):
   assert set(a)==set(b)
   for k in a:
    if k!='software':compare(a[k],b[k])
  elif isinstance(a,(list,tuple)):
   assert len(a)==len(b)
   for x,y in zip(a,b):compare(x,y)
  else:assert a==b,(a,b)
 compare(result,expected)
print(json.dumps({'status':'PASS','cases':len(rows),'current_reconstructed':sum('geometry' in r['current_osm_comparison'] for r in rows),'current_equal_archive':sum(r['current_osm_comparison'].get('equals_archive',False) for r in rows),'unreconstructed':[{'id':r['case_id'],'status':r['current_osm_comparison']['status']} for r in rows if 'geometry' not in r['current_osm_comparison']],'actual_changes':0}))
