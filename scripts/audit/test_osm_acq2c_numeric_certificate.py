import copy,hashlib,json,gzip,tempfile,pathlib,unittest
from verify_osm_acq2c_numeric_certificate import verify,strict_json,packed_json
E='2026-10-20T20:23:47Z'
def fixture():
 edges=[[[0,0],[10,0]],[[10,0],[10,10]],[[10,10],[0,10]],[[0,10],[0,0]]]
 digest=lambda x:hashlib.sha256((json.dumps(x,sort_keys=True,ensure_ascii=False,indent=2)+'\n').encode()).hexdigest()
 row=dict(id=2,domains=['RO'],version=1,timestamp=E,verdict='IN_SCOPE_PROVEN',mathematically_selected=True,exact_interior_witness=dict(member_type='node',member_id=1,node=1,x_e7=5,y_e7=5,version=1,timestamp=E))
 s=dict(epoch=E,boundaries={'RO':dict(edge_sha256=digest(edges))},query_contracts={'RO':dict(required_relations=[],levels=[8])},rows=[row],selection={'RO':dict(ids=[2])})
 c=dict(epoch=E,source_qualified=False,topology_certified=False,raw_selector_sha256=digest(s),areas={'RO':dict(root=100,edges=edges)},nodes={'1':dict(id=1,version=1,timestamp=E,x=5,y=5)},ways={},relations={'2':dict(id=2,version=1,timestamp=E,members=[['n',1,'']],tags=dict(boundary='administrative',admin_level='8'))})
 return c,s
class Tests(unittest.TestCase):
 def test_real_shape_fixture(self):
  c,s=fixture();self.assertEqual(verify(c,s)['domain_rows'],1)
 def reject(self,fn):
  c,s=fixture();fn(c,s);self.assertRaises((ValueError,KeyError),verify,c,s)
 def test_scope(self):self.reject(lambda c,s:c.update(source_qualified=True))
 def test_epoch(self):self.reject(lambda c,s:c.update(epoch='2026-10-21T00:00:00Z'))
 def test_digest(self):self.reject(lambda c,s:c.update(raw_selector_sha256='0'*64))
 def test_version(self):self.reject(lambda c,s:c['relations']['2'].update(version=2))
 def test_future_node(self):self.reject(lambda c,s:c['nodes']['1'].update(timestamp='2026-10-21T00:00:00Z'))
 def test_member_link(self):self.reject(lambda c,s:c['relations']['2'].update(members=[]))
 def test_coordinate(self):self.reject(lambda c,s:c['nodes']['1'].update(x=0))
 def test_missing_node(self):self.reject(lambda c,s:c.update(nodes={}))
 def test_duplicate_json(self):self.assertRaises(ValueError,strict_json,'{"x":1,"x":2}')
 def test_nonfinite(self):self.assertRaises(ValueError,strict_json,'{"x":NaN}')
 def test_budget(self):
  with tempfile.TemporaryDirectory() as t:
   p=pathlib.Path(t)/'x.gz';p.write_bytes(gzip.compress(b' '*25));self.assertRaises(ValueError,packed_json,p,24)
if __name__=='__main__':unittest.main()
