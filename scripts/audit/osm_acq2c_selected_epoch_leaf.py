"""Prove closure of a frozen relation-root frontier by authentic leaf nodes only."""
from osm_acq2c_selected_epoch_core import moment
from osm_acq2c_frontier import typed

def close_leaf_frontier(prior,recovered,epoch):
 missing=prior['missing'];codes=[typed(r['code']) for r in missing]
 if prior.get('source_qualified') is not False or type(prior['missing_count']) is not int:raise ValueError('Invalid source/scope flags')
 if not codes or len(set(codes))!=len(codes) or prior['missing_count']!=len(codes) or prior['recursive_member_graph_closed'] is not False:raise ValueError('Invalid open frontier')
 if set(codes)!=set(recovered) or any(not c.startswith('n') for c in codes):raise ValueError('Only exact missing leaf node set can close this frontier')
 if moment(prior['epoch'])!=moment(epoch):raise ValueError('Frontier epoch differs')
 for item in missing:
  c=item['code'];row=recovered[c]
  if any(typed(parent)[0] not in 'wr' for parent in item['parents']):raise ValueError('Invalid parent kind')
  if not item['parents'] or row['code']!=c or row['visible'] is not True or type(row['version']) is not int or row['version']<1 or moment(row['timestamp'])>moment(epoch):raise ValueError('Unproved leaf identity/version/epoch')
  if any(type(row.get(k)) is not int or abs(row[k])>limit for k,limit in [('x',1800000000),('y',900000000)]):raise ValueError('Invalid exact E7 coordinate')
  if 'nodes' in row or 'members' in row:raise ValueError('Leaf has dependencies')
 return dict(epoch=epoch,prior_missing=len(codes),new_missing_count=0,recovered_leaf_ids=sorted(codes),recursive_member_graph_closed=True,scope='Conditional structural closure of unchanged relation-root graph plus exact authenticated missing leaf nodes; no topology or history certification',topology_certified=False,source_qualified=False,unknown_adjudicated=0)
