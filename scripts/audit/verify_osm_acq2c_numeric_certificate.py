"""Verify real numeric selection evidence independently; never source admission."""
import argparse,gzip,json,pathlib,hashlib,datetime,collections
from osm_acq2c_integer_reference import IntegerArea,node_point,relation_has_interior

def strict_json(raw):
    def unique(pairs):
        out={}
        for key,value in pairs:
            if key in out:raise ValueError('Duplicate JSON key')
            out[key]=value
        return out
    def invalid_constant(value):raise ValueError('Non-finite JSON constant')
    return json.loads(raw,object_pairs_hook=unique,parse_constant=invalid_constant)

def packed_json(path,limit=128*1024*1024):
    with gzip.open(path,'rb') as source:raw=source.read(limit+1)
    if len(raw)>limit:raise ValueError('Certificate expansion exceeds declared format budget')
    return strict_json(raw)

def verify(certificate,selector):
    if certificate['epoch']!=selector['epoch'] or certificate['source_qualified'] is not False or certificate['topology_certified'] is not False:raise ValueError('Certificate scope changed')
    target=datetime.datetime.fromisoformat(certificate['epoch'].replace('Z','+00:00'))
    if target.tzinfo is None:raise ValueError('Naive certificate epoch')
    encoded_selector=(json.dumps(selector,sort_keys=True,ensure_ascii=False,indent=2)+'\n').encode()
    if hashlib.sha256(encoded_selector).hexdigest()!=certificate['raw_selector_sha256']:raise ValueError('Selector input digest differs')
    for kind in ('nodes','ways','relations'):
        for code,row in certificate[kind].items():
            if type(row['id']) is not int or row['id']<=0 or str(row['id'])!=code or type(row['version']) is not int or row['version']<1:raise ValueError('Invalid identity/version')
            stamp=datetime.datetime.fromisoformat(row['timestamp'].replace('Z','+00:00'))
            if stamp.tzinfo is None or stamp>target:raise ValueError('Incompatible object epoch')
            if kind=='nodes':node_point(certificate['nodes'],row['id'])
            if kind=='ways' and any(type(ref) is not int or ref<=0 for ref in row['nodes']):raise ValueError('Invalid way reference')
            if kind=='relations' and any(len(m)!=3 or m[0] not in ('n','w','r') or type(m[1]) is not int or m[1]<=0 or not isinstance(m[2],str) for m in row['members']):raise ValueError('Invalid relation member')
    areas={domain:IntegerArea(row['edges']) for domain,row in certificate['areas'].items()}
    for domain,row in certificate['areas'].items():
        encoded=(json.dumps(row['edges'],sort_keys=True,ensure_ascii=False,indent=2)+'\n').encode()
        if hashlib.sha256(encoded).hexdigest()!=selector['boundaries'][domain]['edge_sha256']:raise ValueError('Boundary input digest differs')
    counts=collections.Counter();chosen={domain:set() for domain in areas};seen=set()
    for index,case in enumerate(selector['rows'],1):
        domain=case['domains'][0];key=domain,case['id']
        if key in seen:raise ValueError('Duplicate domain/identity case')
        seen.add(key);relation=certificate['relations'].get(str(case['id']))
        if relation is None or relation['version']!=case['version'] or relation['timestamp']!=case['timestamp']:raise ValueError('Relation version differs')
        status=case['verdict'];contract=selector['query_contracts'][domain]
        if status=='EXPLICIT_QUERY_MEMBER':
            if case['id'] not in {certificate['areas'][domain]['root'],*contract['required_relations']}:raise ValueError('Not an explicit query member')
            answer=True
        else:
            if relation['tags'].get('boundary')!='administrative' or relation['tags'].get('admin_level') not in [str(n) for n in contract['levels']]:raise ValueError('Administrative tag predicate differs')
            if status=='IN_SCOPE_PROVEN':
                w=case['exact_interior_witness'];kind={'node':'n','way':'w'}.get(w['member_type'])
                if kind is None or not any(m[0]==kind and m[1]==w['member_id'] for m in relation['members']):raise ValueError('Witness is not a direct member')
                if kind=='n' and w['member_id']!=w['node']:raise ValueError('Node witness identity differs')
                if kind=='w':
                    way=certificate['ways'].get(str(w['member_id']))
                    if way is None or w['node'] not in way['nodes']:raise ValueError('Witness node not in referenced way')
                p=node_point(certificate['nodes'],w['node']);node=certificate['nodes'][str(w['node'])]
                if p!=(w['x_e7'],w['y_e7']) or node['version']!=w['version'] or node['timestamp']!=w['timestamp']:raise ValueError('Witness metadata differs')
                answer=areas[domain].point(p)=='inside'
                if not answer:raise ValueError('Interior witness is not strictly inside')
            elif status=='OUT_OF_SCOPE_PROVEN':
                answer=relation_has_interior(relation,certificate['nodes'],certificate['ways'],areas[domain])
                if answer:raise ValueError('Exterior certificate has a proper-interior witness')
            else:raise ValueError('Incomplete or unsupported mathematical case')
        if answer!=case['mathematically_selected']:raise ValueError('Decision differs')
        if answer:chosen[domain].add(case['id'])
        counts[status]+=1
        if index%1000==0:print(json.dumps(dict(verified_domain_rows=index)),flush=True)
    for domain,ids in chosen.items():
        if sorted(ids)!=selector['selection'][domain]['ids']:raise ValueError('Raw selection inventory differs')
    return dict(status='NUMERIC_DECISIONS_VERIFIED_NOT_SOURCE_ADMISSION',domain_rows=len(seen),distinct_relations=len(certificate['relations']),counts=dict(counts),source_qualified=False,topology_certified=False,overpass_equivalence_certified=False)

REPOSITORY=pathlib.Path(__file__).resolve().parents[2]
FIXED_DIRECTORY=REPOSITORY/'docs/evidence/osm-acq2c-complete-spatial-20261023'
def approved_directory(raw):
    # A frozen-proof CLI cannot grant arbitrary filesystem-read authority.
    for part in (REPOSITORY/'docs',REPOSITORY/'docs/evidence',FIXED_DIRECTORY):
        if part.is_symlink():raise ValueError('Symlink proof directory is forbidden')
    # Never interpret untrusted CLI text as a filesystem path, even for validation.
    allowed={str(FIXED_DIRECTORY),FIXED_DIRECTORY.as_posix(),FIXED_DIRECTORY.relative_to(REPOSITORY).as_posix()}
    if not isinstance(raw,str) or raw not in allowed:raise ValueError('CLI accepts only the declared repository proof packet')
    return FIXED_DIRECTORY

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--directory',required=True);args=parser.parse_args()
    result=verify(packed_json(approved_directory(args.directory)/'numeric-certificate.json.gz'),packed_json(approved_directory(args.directory)/'all-candidate-selector.json.gz'))
    print(json.dumps(result,sort_keys=True))
if __name__=='__main__':main()
