"""Read-only dependency planning; no spatial verdict or source promotion."""
import sys,pathlib,json,hashlib,importlib.util,collections
ROOT=pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'work/gis-runtime'))
def module(name,p):
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
audit=module('cached_audit',ROOT/'outputs/OSM-ACQ2b-EXACT-20261022/acq2a_audit.py')
core=module('epoch_core',ROOT/'work/doc-supplement/scripts/audit/osm_acq2c_selected_epoch_core.py')
sys.path.insert(0,str(ROOT/'work/doc-supplement/scripts/audit'))
from osm_acq2c_frontier import normalize_regional, verify_overlay, frontier as checked_frontier
T={'node':'n','way':'w','relation':'r'}
def normalize(o):
 c=T[o['type']]+str(o['id']);r=dict(code=c,version=o['version'],timestamp=core.moment(o['timestamp']).isoformat().replace('+00:00','Z'),visible=o.get('visible',True),tags=sorted([list(x) for x in o.get('tags',{}).items()]))
 if c[0]=='n':r.update(x=core.coordinate(str(o['lon']),180),y=core.coordinate(str(o['lat']),90))
 if c[0]=='w':r['nodes']=o['nodes']
 if c[0]=='r':r['members']=[[T[x['type']],x['ref'],x.get('role','')] for x in o['members']]
 return r
def refs(o):
 if o['code'][0]=='w':return ['n'+str(n) for n in o['nodes']]
 if o['code'][0]=='r':return [t+str(n) for t,n,role in o['members']]
 return []
def frontier(roots,get):
 seen=set();missing=collections.defaultdict(set);parents=collections.defaultdict(set);stack=list(roots)
 while stack:
  c=stack.pop()
  if c in seen:continue
  seen.add(c);o=get(c)
  if o is None:continue
  if not o['visible']:raise ValueError('Deleted object referenced: '+c)
  for child in refs(o):
   parents[child].add(c)
   if get(child) is None:missing[child].add(c)
   elif child not in seen:stack.append(child)
 return seen,missing,parents
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 base=pathlib.Path((ROOT/'work/current-osm-resume-20261022.txt').read_text().strip())/'extract-replay-v2'
 report=base/'report.json';descriptors=json.loads(report.read_bytes())['reports'];graphs={};inputs=[]
 for d in descriptors:
  p=base/d['raw_file'];raw,elements=audit.decode_graph(p.read_bytes(),d);graphs[d['country']]=elements;inputs.append(dict(path=str(p),sha256=d['raw_gzip_sha256'],body_sha256=d['raw_body_sha256'],epoch=d['header']['osmosis_replication_timestamp']));del raw
 graph,origins=audit.merge_graphs(graphs);del graphs
 folder=ROOT/'work/osm-acq2c-bulk/selected-epoch-published-20261023';p=folder/'selected-target.json';manifest=json.loads((folder/'manifest-sha256.json').read_bytes())
 for item in manifest['files']:
  if pathlib.Path(item['name']).name!=item['name']:raise ValueError('Invalid manifest name')
  item_path=folder/item['name']
  if item_path.stat().st_size!=item['bytes'] or digest(item_path)!=item['sha256']:raise ValueError('Private replay manifest mismatch')
 selected=json.loads(p.read_bytes())
 if digest(p)!='a61b2366e6c55762a2e8056c5dc082bfd2f8cd7b6ae75fe8fa376819f8982798':raise ValueError('Selected payload checksum')
 def regional(code):return graph.get(({'n':'node','w':'way','r':'relation'}[code[0]],int(code[1:])))
 overlap=verify_overlay(selected,regional,audit.EPOCH)
 def get(code):
  if code in selected:return selected[code]
  o=regional(code);return None if o is None else normalize_regional(o,audit.EPOCH)
 roots=sorted(c for c in selected if c[0]=='r')
 if len(roots)!=242:raise ValueError('Unexpected cohort')
 seen,missing,parents=checked_frontier(roots,get)
 out=ROOT/'outputs/ROADMAP-20261023/recursive-frontier-validated-20261023';out.mkdir(exist_ok=False)
 result=dict(epoch=audit.EPOCH,roots=roots,available_regional_objects=len(graph),selected_objects=len(selected),identical_overlaps=overlap,reachable_available=len(seen),missing_counts=dict(collections.Counter(c[0] for c in missing)),missing=[dict(code=c,parents=sorted(missing[c])) for c in sorted(missing)],inputs=inputs+[dict(path=str(p),sha256=digest(p)),dict(path=str(report),sha256=digest(report))],source_qualified=False,spatial_unknown_adjudicated=0,history_gaps_unresolved=8,scope='Recursive member and way-node frontier only; not spatial acceptance or proof of full graph closure')
 (out/'frontier.json').write_text(json.dumps(result,sort_keys=True,indent=2)+'\n',encoding='utf8')
 (out/'missing-ids.txt').write_text(''.join(c+'\n' for c in sorted(missing)),encoding='ascii')
 old=ROOT/'outputs/ROADMAP-20261023/recursive-frontier-20261023/missing-ids.txt'
 if old.read_bytes()!=(out/'missing-ids.txt').read_bytes():raise ValueError('Frontier differs from independent prototype')
 print(json.dumps(dict(root_count=len(roots),available_regional_objects=len(graph),selected_objects=len(selected),identical_overlaps=overlap,reachable_available=len(seen),missing_counts=result['missing_counts'],independent_frontier_byte_identity=True)),flush=True)
if __name__=='__main__':main()
