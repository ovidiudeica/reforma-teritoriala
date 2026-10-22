"""Offline negative tests: never infer topology acceptance from endpoint equivalence."""
import unittest
from osm_upstream2_recheck import evaluate, TARGETS

T=TARGETS[0]
def node(lat='46.0',lon='29.0'):
    return {'type':'node','epoch_object':{'lat':lat,'lon':lon}}
def parent(version=6,ref=1376179876):
    return (f'<osm version="0.6"><relation id="18967493" version="{version}">'
            f'<member type="way" ref="{ref}" role="outer"/></relation></osm>').encode()
def way(last=12318728194,count=458,version=8):
    return {'nodes':[1]*(count-1)+[last],'version':version}

class UpstreamNegativeTests(unittest.TestCase):
    def test_unedited_way_requires_mapper_not_automatic_edit(self):
        self.assertEqual(evaluate(T,way(),node(),node(),parent())['verdict'],
                         'UNCHANGED_UPSTREAM_REQUIRES_AUTHORIZED_MAPPER_REVIEW')
    def test_already_changed_requires_full_topology(self):
        self.assertEqual(evaluate(T,way(T['replacement']),node(),node(),parent())['verdict'],
                         'REPLACEMENT_PRESENT_NEEDS_FULL_TOPOLOGY_RECHECK')
    def test_wrong_coordinate_fails(self):
        self.assertEqual(evaluate(T,way(),node(),node('46.00001'),parent())['verdict'],
                         'BLOCKED_COORDINATE_MISMATCH')
    def test_different_way_version_fails(self):
        self.assertEqual(evaluate(T,way(version=9),node(),node(),parent())['verdict'],
                         'BLOCKED_WAY_VERSION_DRIFT')
    def test_different_way_size_fails(self):
        self.assertEqual(evaluate(T,way(count=457),node(),node(),parent())['verdict'],
                         'BLOCKED_WAY_LENGTH_CHANGED')
    def test_relation_version_fails(self):
        self.assertEqual(evaluate(T,way(),node(),node(),parent(version=7))['verdict'],
                         'BLOCKED_RELATION_VERSION_DRIFT')
    def test_parent_member_missing_fails(self):
        self.assertEqual(evaluate(T,way(),node(),node(),parent(ref=1))['verdict'],
                         'BLOCKED_MISSING_PARENT_MEMBERSHIP')
    def test_unexpected_way_endpoint_fails(self):
        self.assertEqual(evaluate(T,way(123),node(),node(),parent())['verdict'],
                         'BLOCKED_UNEXPECTED_ENDPOINT')

if __name__=='__main__':
    unittest.main(verbosity=2)
