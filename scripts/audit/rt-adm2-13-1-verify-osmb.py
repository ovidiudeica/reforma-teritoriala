#!/usr/bin/env python3
"""Verify archived OSMB evidence byte-for-byte; fail closed if source bundle unavailable."""
import hashlib,json,pathlib,sys
BASE=pathlib.Path('docs/audits/rt-adm2-13-1')
SOURCE=pathlib.Path('docs/audits/rt-adm2-13-1/osmb-bucharest-seven.geojson')
EXPECTED='f63bc4644c81dfa6c41011c6bc3f48ca33c626aa97a19cf994d7f22672a85eba'
for name in ('topology-register.json','anomalies-epsg3844.geojson'):
    file=BASE/name
    receipt=json.loads((BASE/'artifact-receipt.json').read_text())
    actual=hashlib.sha256(file.read_bytes()).hexdigest()
    assert receipt['sha256'][name]==actual,(name,actual,receipt['sha256'][name])
report=json.loads((BASE/'topology-register.json').read_text())
assert report['anomaly_count']==len(report['anomalies'])==0
assert all(report['metrics_m2'][k]==0 for k in ('gap','outside_parent','symmetric_difference','overlap_pair_sum'))
print('RECEIPT VERIFIED: archived records match SHA-256')
if not SOURCE.is_file():
    print('SOURCE REPLAY BLOCKED: canonical seven-feature OSMB source bundle not in repository',file=sys.stderr)
    sys.exit(2)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==EXPECTED
from shapely.geometry import shape
from shapely.ops import unary_union,transform
from pyproj import Transformer
features=json.loads(SOURCE.read_text())['features']
geometries={f['properties']['osm_id']:shape(f['geometry']) for f in features}
ids=[-377733,-7960954,-7960953,-7960937,-7960957,-7960956,-7960955]
assert set(geometries)==set(ids)
assert all(geometries[k].is_valid for k in ids)
proj=Transformer.from_crs(4326,3844,always_xy=True)
g={k:transform(proj.transform,geometries[k]) for k in ids}
b=g[-377733];sectors=[g[k] for k in ids[1:]];union=unary_union(sectors)
metrics={'municipality':b.area,'sectors_union':union.area,'sectors_sum':sum(a.area for a in sectors),'gap':b.difference(union).area,'outside_parent':union.difference(b).area,'symmetric_difference':b.symmetric_difference(union).area,'overlap_pair_sum':sum(a.intersection(v).area for i,a in enumerate(sectors) for v in sectors[i+1:])}
for k,value in metrics.items():
    assert abs(value-report['metrics_m2'][k])<0.01,(k,value,report['metrics_m2'][k])
print('FULL OSMB GEOMETRIC REPLAY VERIFIED',metrics)
