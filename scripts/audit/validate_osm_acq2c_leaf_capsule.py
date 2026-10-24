"""Replay a sparse leaf-closure proof; never qualify a source."""
import pathlib,sys,json,hashlib
from osm_acq2c_selected_epoch_replay import verify_manifest
from osm_acq2c_selected_epoch_core import moment
from osm_acq2c_selected_epoch_leaf import close_leaf_frontier

def validate(root):
 verify_manifest(root)
 read=lambda name:json.loads((root/name).read_bytes())
 prior=read('prior-frontier.json');tail=read('four-tail-report.json');nodes=read('four-target-nodes.json');hist=read('four-histories.json');cert=read('certificate.json')
 for name,key in [('prior-frontier.json','parent_frontier_sha256'),('prior-frontier-manifest.json','parent_frontier_manifest_sha256'),('four-tail-manifest.json','leaf_recovery_manifest_sha256')]:
  if hashlib.sha256((root/name).read_bytes()).hexdigest()!=cert[key]:raise ValueError('Proof input binding differs')
 mappings=[('prior-frontier-manifest.json',{'report.json':'prior-frontier.json'}),('four-tail-manifest.json',{'report.json':'four-tail-report.json','selected-target.json':'four-target-nodes.json','selected-history.json':'four-histories.json'})]
 for manifest,names in mappings:
  rows=read(manifest)['files']
  if {r['name'] for r in rows}!=set(names):raise ValueError('Sparse original manifest coverage differs')
  for row in rows:
   raw=(root/names[row['name']]).read_bytes()
   if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('Sparse original payload differs')
 if tail['missing_ids'] or tail['gapped_ids'] or set(hist)!=set(nodes):raise ValueError('Incomplete leaf history')
 for code,rows in hist.items():
  if rows[0]['version']!=1 or moment(rows[0]['timestamp'])<=moment('2026-10-19T00:00:04Z'):raise ValueError('Not a post-base version1 history')
  eligible=[r for r in rows if moment(r['timestamp'])<=moment(cert['epoch'])]
  if not eligible or eligible[-1]!=nodes[code]:raise ValueError('Leaf target selection differs')
  creates=[r for origin in tail['origins'] for r in origin['versions'] if 'n'+str(r['id'])==code and r['version']==1]
  if len(creates)!=1 or creates[0]['action']!='create':raise ValueError('Missing authentic creation observation')
 if any(row['parents']!=['w359905797'] for row in prior['missing']) or not set(nodes)<={'n'+str(n) for n in tail['parent_way']['nodes']}:raise ValueError('Parent references differ')
 actual=close_leaf_frontier(prior,nodes,cert['epoch'])
 if any(cert[k]!=v for k,v in actual.items()) or cert['publication_validation_pending'] is not True or cert['overpass_equivalence_certified'] is not False:raise ValueError('Certificate replay/acceptance guards differ')
 return dict(status='PASS_CONDITIONAL_STRUCTURAL_PROOF',missing=0,topology_certified=False,source_qualified=False,unknown_adjudicated=0)
if __name__=='__main__':print(json.dumps(validate(pathlib.Path(sys.argv[1]))))
