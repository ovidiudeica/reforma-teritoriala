import unittest
from osm_acq2c_selected_epoch_core import reconcile,tail_record,coordinate,validate_epochs
BASE='2026-10-19T00:00:04Z';TARGET='2026-10-20T20:23:47Z'
def base(v=1):return dict(code='w4',version=v,timestamp='2026-10-18T00:00:00Z',visible=True,tags=[],nodes=[1,2])
def tail(v=2,t='2026-10-20T00:00:00Z'):return dict(type='way',id=4,version=v,timestamp=t,visible='true',action='modify',tags=[],nodes=[1,2])
class Tests(unittest.TestCase):
    def go(self,b,t):return reconcile(b,t,{'w4'},BASE,TARGET)
    def test_latest(self):self.assertEqual(self.go([base()],[tail()])['selected']['w4']['version'],2)
    def test_overlap(self):self.assertEqual(self.go([base()],[tail(1,'2026-10-18T00:00:00Z')])['duplicate_observations_deduplicated'],1)
    def test_conflict(self):
        row=tail(1,'2026-10-18T00:00:00Z');row['nodes']=[2,1]
        self.assertRaises(ValueError,self.go,[base()],[row])
    def test_gap(self):self.assertEqual(self.go([base()],[tail(3)])['gapped_ids'],['w4'])
    def test_missing(self):self.assertEqual(self.go([],[])['missing_ids'],['w4'])
    def test_new_object(self):self.assertEqual(self.go([],[tail(1)])['gapped_ids'],[])
    def test_post_target(self):self.assertEqual(self.go([base()],[tail(2,'2026-10-20T21:00:00Z')])['selected']['w4']['version'],1)
    def test_reversed_dates(self):
        first=tail(2,'2026-10-20T02:00:00Z');last=tail(3,'2026-10-20T01:00:00Z')
        self.assertRaises(ValueError,self.go,[base()],[first,last])
    def test_deleted_tombstone(self):
        row=tail();row.update(visible='false',action='delete',nodes=[])
        self.assertFalse(self.go([base()],[row])['selected']['w4']['visible'])
    def test_exact_coordinate(self):self.assertEqual(coordinate('28.8583930',180),288583930)
    def test_coordinate_precision(self):self.assertRaises(ValueError,coordinate,'28.85839301',180)
    def test_coordinate_nan(self):self.assertRaises(ValueError,coordinate,'NaN',180)
    def test_bool_version(self):
        row=tail();row['version']=True;self.assertRaises(ValueError,tail_record,row)
    def test_visibility_conflict(self):
        row=tail();row['action']='delete';self.assertRaises(ValueError,tail_record,row)
    def test_prebase_missing_version(self):self.assertRaises(ValueError,self.go,[],[tail(1,'2026-10-18T00:00:00Z')])
    def test_future_base(self):
        row=base();row['timestamp']='2026-10-20T00:00:00Z';self.assertRaises(ValueError,self.go,[row],[])
    def test_no_qualification(self):self.assertFalse(self.go([base()],[])['source_qualified'])
    def test_inner_outer_order_is_preserved(self):
        row=dict(type='relation',id=4,version=1,timestamp=TARGET,visible='true',action='create',tags=[],members=[dict(type='way',ref='8',role='inner'),dict(type='way',ref='9',role='outer')])
        self.assertEqual(tail_record(row)['members'],[['w',8,'inner'],['w',9,'outer']])
    def test_empty_member_role(self):
        row=dict(type='relation',id=4,version=1,timestamp=TARGET,visible='true',action='create',tags=[],members=[dict(type='way',ref='8')])
        self.assertEqual(tail_record(row)['members'],[['w',8,'']])
    def test_equivalent_utc_notations(self):validate_epochs(BASE.replace('Z','+00:00'),TARGET.replace('Z','+00:00'),BASE,TARGET)
    def test_real_one_second_epoch_difference(self):self.assertRaises(ValueError,validate_epochs,BASE,'2026-10-20T20:23:48Z',BASE,TARGET)
    def test_naive_epoch_still_rejected(self):self.assertRaises(ValueError,validate_epochs,BASE[:-1],TARGET,BASE,TARGET)
if __name__=='__main__':unittest.main()
