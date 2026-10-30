#!/usr/bin/env python3
import json,hashlib,datetime,argparse
from pathlib import Path
from shapely.geometry import shape,mapping
from shapely.ops import transform,unary_union
from shapely.validation import explain_validity
from pyproj import Transformer
P='osm-r377733'
IDS={'osm-r7960954':1,'osm-r7960953':2,'osm-r7960937':3,'osm-r7960957':4,'osm-r7960956':5,'osm-r7960955':6}
SOURCE=Path('public/geo/actual/chunks/ro/detail/osm-r377733.geojson')
OUT=Path('docs/audits/rt-adm2-13-1')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rows(p):
 d=json.loads(p.read_text(encoding='utf-8'))
 return d.get('features',[]) if d.get('type')=='FeatureCollection' else [d] if d.get('type')=='Feature' else []
def eid(f):return str((f.get('properties') or {}).get('entity_id') or (f.get('properties') or {}).get('id') or '')
def main():
 if not SOURCE.is_file():raise RuntimeError('sector source missing')
 sectors={eid(f):f for f in rows(SOURCE)}
 if set(sectors)!=set(IDS):raise RuntimeError('sector IDs incomplete/extra: '+str(set(sectors)^set(IDS)))
 parent_candidates=[]
 for p in [Path('public/geo/actual/ro-overview.geojson'),Path('public/geo/actual/ro-local.geojson'),Path('public/geo/actual/ro-detail.geojson')]+sorted(Path('public/geo/actual/chunks/ro').rglob('*.geojson')):
  if not p.is_file():continue
  try:
   for f in rows(p):
    if eid(f)==P and f.get('geometry'):parent_candidates.append((p,f))
  except (ValueError,KeyError,UnicodeError):continue
 if not parent_candidates:raise RuntimeError('BLOCAT: independent municipal polygon not found; cannot substitute sectors union')
 # More than one matching parent is permitted only if all versions have identical geometry.
 parent_path,parent=parent_candidates[0]
 if any(shape(f['geometry'])!=shape(parent['geometry']) for _,f in parent_candidates[1:]):
  raise RuntimeError('BLOCAT: discordant independent parent geometries')
 geometries={k:shape(v['geometry']) for k,v in sectors.items()}
 geometries[P]=shape(parent['geometry'])
 validity={k:{'valid':g.is_valid,'empty':g.is_empty,'reason':explain_validity(g)} for k,g in geometries.items()}
 if not all(v['valid'] and not v['empty'] for v in validity.values()):raise RuntimeError('BLOCAT: invalid geometry: '+str(validity))
 project=Transformer.from_crs('EPSG:4326','EPSG:3844',always_xy=True)
 gs={k:transform(project.transform,g) for k,g in geometries.items()}
 B=gs[P];keys=list(IDS);U=unary_union([gs[k] for k in keys])
 anomalies=[];geo=[]
 def record(kind,geometry,sectors):
  pending=[geometry]
  while pending:
   obj=pending.pop()
   if obj.is_empty:continue
   if obj.geom_type not in ('Polygon','MultiPolygon'):
    pending.extend(getattr(obj,'geoms',[]));continue
   if obj.geom_type=='MultiPolygon':pending.extend(obj.geoms);continue
   if obj.area<=0:continue
   row={'id':f'RT-ADM.2.13.1-{len(anomalies)+1:05d}','kind':kind,'sector_ids':sectors,'area_m2':obj.area,'area_km2':obj.area/1e6,'bounds_epsg3844':list(obj.bounds),'wkb_sha256':hashlib.sha256(obj.wkb).hexdigest()}
   anomalies.append(row);geo.append({'type':'Feature','properties':row,'geometry':mapping(obj)})
 for i,a in enumerate(keys):
  for b in keys[i+1:]:record('pairwise_overlap',gs[a].intersection(gs[b]),[a,b])
 record('gap_inside_parent',B.difference(U),[])
 record('outside_parent',U.difference(B),keys)
 OUT.mkdir(parents=True,exist_ok=True)
 report={'schema':'rt-adm2-13-1-topology-v1','scope':'OSM cartography only; no legal equivalence','parent_id':P,'parent_source':str(parent_path),'parent_candidate_count':len(parent_candidates),'sector_source':str(SOURCE),'source_sha256':{str(p):digest(p) for p in set([SOURCE]+[p for p,_ in parent_candidates])},'source_crs':'EPSG:4326','metric_crs':'EPSG:3844','validity':validity,'area_m2':{'parent':B.area,'sector_union':U.area,'gap':B.difference(U).area,'outside':U.difference(B).area,'symmetric_difference':B.symmetric_difference(U).area,'pairwise_overlap_sum':sum(gs[a].intersection(gs[b]).area for i,a in enumerate(keys) for b in keys[i+1:])},'anomaly_count':len(anomalies),'anomalies':anomalies}
 (OUT/'topology-register.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (OUT/'anomalies-epsg3844.geojson').write_text(json.dumps({'type':'FeatureCollection','features':geo},ensure_ascii=False)+'\n',encoding='utf-8')
 receipt={'schema':'rt-adm2-13-1-receipt-v1','sha256':{p.name:digest(p) for p in [OUT/'topology-register.json',OUT/'anomalies-epsg3844.geojson']}}
 (OUT/'artifact-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps({'anomaly_count':len(anomalies),'area_m2':report['area_m2']},indent=2))
if __name__=='__main__':main()
