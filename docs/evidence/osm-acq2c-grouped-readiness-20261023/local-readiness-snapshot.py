"""Frozen exact-predicate readiness; no source or provenance admission."""
import pathlib,sys,json,hashlib,gzip,collections,decimal
ROOT=pathlib.Path(__file__).resolve().parent.parent
sys.path[:0]=[str(ROOT/'work/gis-runtime'),str(ROOT/'outputs/OSM-ACQ2b-EXACT-20261022'),str(ROOT/'work/doc-supplement/scripts/audit')]
import acq2a_audit as cache
import acq2b_exact as exact
from osm_acq2c_frontier import verify_overlay
from osm_acq2c_selected_epoch_replay import verify_manifest
from osm_acq2c_full_batch import source_registry
def main():
 base=pathlib.Path((ROOT/'work/current-osm-resume-20261022.txt').read_text().strip())/'extract-replay-v2'
 graphs={}
 for d in json.loads((base/'report.json').read_bytes())['reports']:
  raw,graphs[d['country']]=cache.decode_graph((base/d['raw_file']).read_bytes(),d);del raw
 graph,_=cache.merge_graphs(graphs)
 selected_dir=ROOT/'work/osm-acq2c-bulk/selected-epoch-published-20261023';verify_manifest(selected_dir)
 selected=json.loads((selected_dir/'selected-target.json').read_bytes())
 types={'n':'node','w':'way','r':'relation'}
 def key(c):return types[c[0]],int(c[1:])
 verify_overlay(selected,lambda c:graph.get(key(c)),cache.EPOCH)
 for c,o in selected.items():
  if not o['visible']:raise ValueError('Deleted selected dependency')
  r=dict(type=types[c[0]],id=int(c[1:]),version=o['version'],timestamp=o['timestamp'],tags=dict(o['tags']))
  if c[0]=='n':r.update(lon=str(decimal.Decimal(o['x'])/10000000),lat=str(decimal.Decimal(o['y'])/10000000))
  if c[0]=='w':r['nodes']=o['nodes']
  if c[0]=='r':r['members']=[dict(type=types[t],ref=n,role=role) for t,n,role in o['members']]
  graph[key(c)]=r
 areas={};boundaries={}
 for domain in graphs:
  own={(o['type'],o['id']):o for o in graphs[domain]};r,edges,way_hash=exact.root_boundary(own,domain)
  areas[domain]=exact.ExactArea(edges);boundaries[domain]=dict(root=r['id'],version=r['version'],edge_sha256=hashlib.sha256(cache.encode(edges)).hexdigest(),ways_sha256=way_hash)
 del graphs
 rows=[]
 for old in source_registry()['rows']:
  if old['resolved']:continue
  relation=graph['relation',old['id']];missing=set();used=set()
  for member in relation['members']:
   if member['type'] not in ('node','way'):continue
   k=member['type'],member['ref'];used.add(k);o=graph.get(k)
   if o is None:missing.add(k);continue
   if k[0]=='way':
    for n in o['nodes']:
     used.add(('node',n))
     if ('node',n) not in graph:missing.add(('node',n))
  row=dict(id=old['id'],version=relation['version'],timestamp=relation['timestamp'],domains=sorted(d['domain'] for d in old['domains']),missing_direct_geometry=sorted(missing),direct_objects_used=len(used),source_admission=False)
  if missing:row['verdict']='UNKNOWN_MISSING_DEPENDENCIES'
  else:
   row['exact_predicate']={domain:exact.audit_relation(relation,graph,areas[domain]) for domain in row['domains']}
   row['verdict']='PROVISIONAL_EXACT_PBF_PREDICATE_NOT_SOURCE_ADMISSION'
  rows.append(row)
  if len(rows)%40==0:print(json.dumps(dict(completed=len(rows))),flush=True)
 if len(rows)!=242:raise ValueError('Wrong frozen cohort')
 out=ROOT/'outputs/ROADMAP-20261023/selected-exact-readiness-20261023';out.mkdir(exist_ok=False)
 result=dict(epoch=cache.EPOCH,rows=rows,boundaries=boundaries,counts=dict(collections.Counter(r['verdict'] for r in rows)),source_qualified=False,overpass_equivalence_certified=False,history_gaps_resolved=0,scope='Exact direct node/way PBF predicate only when complete; incomplete rows retained without floating diagnostic classification')
 (out/'readiness.json').write_bytes(cache.encode(result));print(json.dumps(dict(counts=result['counts'],sha256=hashlib.sha256((out/'readiness.json').read_bytes()).hexdigest())),flush=True)
if __name__=='__main__':main()
