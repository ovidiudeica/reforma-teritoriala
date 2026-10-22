"""Independent, deterministic adversarial checks; no source promotion."""
import random
import sys
import unittest
from fractions import Fraction
from pathlib import Path
from shapely.geometry import LineString, MultiPolygon, Point, Polygon

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'osm-acq2b-exact-20261022'))
from acq2b_exact import ExactArea, cuts, grid

def edges_of(shape):
    polygons = [shape] if shape.geom_type == 'Polygon' else list(shape.geoms)
    edges = []
    for polygon in polygons:
        for boundary in [polygon.exterior, *polygon.interiors]:
            vertices = [tuple(map(int, xy)) for xy in list(boundary.coords)[:-1]]
            assert all((float(x), float(y)) == tuple(pair) for pair, (x, y) in zip(list(boundary.coords)[:-1], vertices))
            edges.extend(zip(vertices, vertices[1:] + vertices[:1]))
    return edges

SHAPES = (
    Polygon([(0, 0), (14, 0), (14, 14), (0, 14)]),
    Polygon([(0, 0), (15, 0), (15, 15), (0, 15)],
            holes=[[(5, 5), (10, 5), (10, 10), (5, 10)]]),
    Polygon([(0, 0), (18, 0), (18, 5), (12, 5), (12, 11),
             (18, 11), (18, 18), (0, 18), (0, 11), (6, 11),
             (6, 5), (0, 5)]),
    MultiPolygon([
        Polygon([(0, 0), (10, 0), (10, 10), (0, 10)]),
        Polygon([(20, 0), (30, 0), (30, 10), (20, 10)])
    ]),
)

class IndependentGeometryTests(unittest.TestCase):
    def test_shape_validity_and_48000_differential_segments(self):
        rng = random.Random(134332)
        count = 0
        for shape in SHAPES:
            self.assertTrue(shape.is_valid)
            exact = ExactArea(edges_of(shape))
            for _ in range(12000):
                p = (rng.randint(-8, 38), rng.randint(-8, 27))
                q = (rng.randint(-8, 38), rng.randint(-8, 27))
                if p == q:
                    expected = shape.contains(Point(p))
                else:
                    expected = LineString([p, q]).relate_pattern(shape, 'T********')
                actual = exact.segment(p, q)['inside']
                self.assertEqual(expected, actual, (shape.wkt, p, q))
                self.assertEqual(actual, exact.segment(q, p)['inside'])
                count += 1
        self.assertEqual(count, 48000)

    def test_rational_boundary_separation_at_sub_float_distances(self):
        square = ExactArea(edges_of(SHAPES[0]))
        epsilon = Fraction(1, 10 ** 70)
        self.assertEqual(square.point((epsilon, 7)), 'inside')
        self.assertEqual(square.point((-epsilon, 7)), 'outside')
        self.assertEqual(square.point((0, 7)), 'boundary')
        self.assertTrue(square.segment((-epsilon, 7), (epsilon, 7))['inside'])
        self.assertFalse(square.segment((-epsilon, 7), (0, 7))['inside'])

    def test_hole_interval_and_concave_notch(self):
        hole = ExactArea(edges_of(SHAPES[1]))
        epsilon = Fraction(1, 10 ** 70)
        self.assertEqual(hole.point((5 + epsilon, 7)), 'outside')
        self.assertEqual(hole.point((5 - epsilon, 7)), 'inside')
        self.assertEqual(hole.point((5, 7)), 'boundary')
        self.assertFalse(hole.segment((6, 6), (9, 9))['inside'])
        self.assertTrue(hole.segment((2, 7), (13, 7))['inside'])
        concave = ExactArea(edges_of(SHAPES[2]))
        self.assertEqual(concave.point((15, 8)), 'outside')
        self.assertEqual(concave.point((9, 8)), 'inside')
        self.assertTrue(concave.segment((15, 8), (9, 8))['inside'])

    def test_collinear_overlaps_and_corner_tangencies(self):
        square = ExactArea(edges_of(SHAPES[0]))
        self.assertFalse(square.segment((-4, 0), (18, 0))['inside'])
        self.assertFalse(square.segment((-1, 1), (1, -1))['inside'])
        self.assertTrue(square.segment((-1, -1), (15, 15))['inside'])
        self.assertEqual(cuts((0, 0), (3, 0), (1, -1), (1, 1)), [Fraction(1, 3)])

    def test_grid_fail_closed_and_large_coordinates(self):
        self.assertEqual(grid('28.858393'), 288583930)
        for coordinate in ('28.85839300000001', '0.00000001'):
            with self.assertRaises(ValueError):
                grid(coordinate)
        large = ExactArea([
            ((10 ** 9, 10 ** 8), (10 ** 9 + 100, 10 ** 8)),
            ((10 ** 9 + 100, 10 ** 8), (10 ** 9 + 100, 10 ** 8 + 100)),
            ((10 ** 9 + 100, 10 ** 8 + 100), (10 ** 9, 10 ** 8 + 100)),
            ((10 ** 9, 10 ** 8 + 100), (10 ** 9, 10 ** 8))
        ])
        self.assertTrue(large.segment((10 ** 9 - 1, 10 ** 8 + 50),
                                      (10 ** 9 + 101, 10 ** 8 + 50))['inside'])

if __name__ == '__main__':
    unittest.main(verbosity=2)
