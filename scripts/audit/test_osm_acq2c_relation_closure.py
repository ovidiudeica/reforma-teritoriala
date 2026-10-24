import unittest,copy
from osm_acq2c_relation_closure import merge_relations,project_relations

def row(code='r1',members=None):return dict(code=code,type='relation',version=1,visible=True,members=members or [])
class Tests(unittest.TestCase):
 def test_normalized_code_only_schema(self):
  a=row();del a['type'];self.assertTrue(project_relations({'r1':a},['r1'])['relation_graph_closed'])
 def test_wrong_explicit_type(self):self.assertRaises(ValueError,merge_relations,{'r1':dict(row(),type='way')})
 def test_cycle(self):
  r=project_relations({'r1':row(members=[['r',2,'']]),'r2':row('r2',[['r',1,'']])},['r1'])
  self.assertTrue(r['relation_graph_closed']);self.assertEqual(r['visited_relations'],2)
 def test_missing_root(self):self.assertEqual(project_relations({},['r1'])['missing_relations'],[dict(code='r1',parents=[])])
 def test_missing_member(self):self.assertEqual(project_relations({'r1':row(members=[['r',2,'outer']])},['r1'])['missing_relations'],[dict(code='r2',parents=['r1'])])
 def test_direct_nodes_ways_not_claimed_closed(self):
  r=project_relations({'r1':row(members=[['w',2,'outer'],['n',3,'label']])},['r1']);self.assertTrue(r['relation_graph_closed']);self.assertFalse(r['dependency_closure_certified']);self.assertEqual(r['direct_way_ids'],['w2'])
 def test_duplicate_observation(self):self.assertEqual(len(merge_relations({'r1':row()},{'r1':row()})),1)
 def test_conflict_version(self):
  a=row();b=dict(a,version=2);self.assertRaises(ValueError,merge_relations,{'r1':a},{'r1':b})
 def test_conflict_members(self):self.assertRaises(ValueError,merge_relations,{'r1':row()},{'r1':row(members=[['w',2,'']])})
 def test_bool_reference(self):self.assertRaises(ValueError,project_relations,{'r1':row(members=[['w',True,'']])},['r1'])
 def test_invisible(self):self.assertRaises(ValueError,project_relations,{'r1':dict(row(),visible=False)},['r1'])
 def test_bad_identity(self):self.assertRaises(ValueError,project_relations,{},['r01'])
 def test_missing_members(self):self.assertRaises(ValueError,project_relations,{'r1':dict(row(),members=None)},['r1'])
 def test_deterministic_and_unmodified(self):
  d={'r2':row('r2'),'r1':row(members=[['r',2,'']])};old=copy.deepcopy(d);self.assertEqual(project_relations(d,['r2','r1','r1']),project_relations(dict(reversed(list(d.items()))),['r1','r2']));self.assertEqual(d,old)
if __name__=='__main__':unittest.main()
