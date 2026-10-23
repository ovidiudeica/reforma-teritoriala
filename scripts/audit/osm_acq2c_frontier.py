"""Plan recursive OSM dependencies without spatial or source acceptance."""
import re
from osm_acq2c_selected_epoch_core import coordinate, moment, positive

TYPES = {'node': 'n', 'way': 'w', 'relation': 'r'}

def typed(code):
    if not isinstance(code, str) or not re.fullmatch(r'[nwr][1-9][0-9]*', code):
        raise ValueError('Invalid typed identity')
    return code

def normalize_regional(obj, epoch):
    kind = TYPES[obj['type']]
    stamp = moment(obj['timestamp'])
    if stamp > moment(epoch):
        raise ValueError('Object newer than frozen epoch')
    row = dict(code=kind+str(positive(obj['id'])), version=positive(obj['version']),
               timestamp=stamp.isoformat().replace('+00:00', 'Z'),
               visible=obj.get('visible', True),
               tags=sorted([list(pair) for pair in obj.get('tags', {}).items()]))
    if type(row['visible']) is not bool:
        raise ValueError('Visibility must be boolean')
    if kind == 'n' and row['visible']:
        row.update(x=coordinate(str(obj['lon']), 180), y=coordinate(str(obj['lat']), 90))
    if kind == 'w':
        row['nodes'] = [positive(n) for n in obj['nodes']]
    if kind == 'r':
        row['members'] = [[TYPES[m['type']], positive(m['ref']), m.get('role', '')]
                          for m in obj['members']]
    return row

def verify_overlay(selected, regional_get, epoch):
    overlaps = 0
    for code, row in selected.items():
        typed(code)
        if row['code'] != code or moment(row['timestamp']) > moment(epoch):
            raise ValueError('Invalid selected identity/epoch')
        regional = regional_get(code)
        if regional is not None:
            overlaps += 1
            if normalize_regional(regional, epoch) != row:
                raise ValueError('Selected/regional version or content conflict: '+code)
    return overlaps

def references(row):
    code = typed(row['code'])
    if code[0] == 'w':
        return ['n'+str(positive(n)) for n in row['nodes']]
    if code[0] == 'r':
        return [typed(t+str(positive(n))) for t, n, role in row['members']]
    return []

def frontier(roots, get):
    """All member roles retained; cycles terminate; missing objects stop traversal.

    This is one expansion frontier. Missing relations/ways can reveal additional
    descendants after recovery, so the frontier is not a complete geometry claim.
    """
    seen, missing, parents = set(), {}, {}
    stack = [typed(c) for c in roots]
    while stack:
        code = stack.pop()
        if code in seen:
            continue
        seen.add(code)
        row = get(code)
        if row is None:
            missing.setdefault(code, set())
            continue
        if row['code'] != code or row.get('visible') is not True:
            raise ValueError('Invalid/deleted referenced object: '+code)
        for child in references(row):
            parents.setdefault(child, set()).add(code)
            if get(child) is None:
                missing.setdefault(child, set()).add(code)
            elif child not in seen:
                stack.append(child)
    return seen, missing, parents
