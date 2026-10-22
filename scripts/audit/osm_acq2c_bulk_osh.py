"""OSM-ACQ.2c bulk full-history ingest, never public OSM API or source promotion.

Authenticated Geofabrik RO/MD .osh.pbf originals must be supplied *privately* at
/tmp/reforma-osm-history/{RO,MD}.osh.pbf with SHA-256 in manifest.json.
Never copies source, raw metadata, or derived extracts into GitHub/public repo.
"""
import hashlib
import json
import pathlib
import subprocess
import sys
import xml.etree.ElementTree as ET
from osm_acq2c_full_batch import plan_registry, source_registry, EPOCH

PRIVATE=pathlib.Path('/tmp/reforma-osm-history')
OUT=pathlib.Path('/tmp/reforma-osm-history-replay')
SOURCES=('RO','MD')
FILE_LIMIT=16*1024*1024

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as handle:
        for part in iter(lambda:handle.read(FILE_LIMIT),b''):
            h.update(part)
    return h.hexdigest()

def source_contract(manifest):
    if manifest.get('epoch')!=EPOCH:
        raise ValueError('Frozen epoch does not match evidence')
    paths={}
    for name in SOURCES:
        entry=manifest.get('sources',{}).get(name)
        if not isinstance(entry,dict):raise ValueError('Missing required source provenance')
        expected=entry.get('sha256')
        if not isinstance(expected,str) or len(expected)!=64 or any(c not in '0123456789abcdef' for c in expected):
            raise ValueError('Missing valid SHA-256')
        if entry.get('format')!='osh.pbf' or not entry.get('authenticated',False):
            raise ValueError('Full-history source authentication not attested')
        p=PRIVATE/(name+'.osh.pbf')
        if not p.is_file():raise FileNotFoundError('Authenticated private history source unavailable')
        if digest(p)!=expected:raise ValueError('Full-history SHA-256 mismatch')
        paths[name]=p
    return paths

def expected_ids(plan):
    requested=set()
    for rid in plan['relations']:requested.add(('r',rid))
    for item in plan['ordered']:
        requested.add(('w' if item['type']=='way' else 'n', item['id']))
    for typ,oid in plan['already_piloted']:
        requested.add(('w' if typ=='way' else 'n',oid))
    if not requested:raise ValueError('Empty source ledger')
    return sorted(requested)

def write_ids(path, requested):
    path.write_text(''.join(f'{typ}{oid}\n' for typ,oid in requested),encoding='ascii')

def run_osmium(argv):
    # Always fixed literal commands, never shell=True or untrusted flags.
    subprocess.run(argv,check=True,stdin=subprocess.DEVNULL,
                   stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=14400)

def extract(source,source_label,id_file):
    history_out=OUT/(source_label+'.selected.osh.pbf')
    snapshot_out=OUT/(source_label+'.epoch.osm.pbf')
    if history_out.exists() or snapshot_out.exists():
        raise FileExistsError('Refuse overwrite of historical proof')
    run_osmium(['osmium','getid','--with-history','--add-referenced',
                '--id-file',str(id_file),str(source),'--output',str(history_out)])
    run_osmium(['osmium','time-filter',str(history_out),EPOCH,
                '--output',str(snapshot_out)])
    return {'historical_subset':history_out,'epoch_snapshot':snapshot_out,
            'original_sha256':digest(source),
            'subset_sha256':digest(history_out),'epoch_sha256':digest(snapshot_out)}

def parse_snapshot(root,source_name):
    """Stream XML converted locally by osmium; preserve explicit member references."""
    if not root.is_file():raise FileNotFoundError(root)
    proc=subprocess.Popen(['osmium','cat',str(root),'--output-format','osm'],
        stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    result={}
    try:
        for _,element in ET.iterparse(proc.stdout,events=('end',)):
            if element.tag not in ('node','way','relation'):continue
            typ={'node':'n','way':'w','relation':'r'}[element.tag]
            oid=int(element.attrib['id'])
            ver=int(element.attrib['version'])
            refs=tuple(
                ((m.attrib['type'][0],int(m.attrib['ref'])) for m in element.findall('member'))
                if typ=='r' else
                (('n',int(m.attrib['ref'])) for m in element.findall('nd'))
                if typ=='w' else ()
            )
            key=(typ,oid)
            value={'version':ver,'timestamp':element.attrib['timestamp'],'refs':refs}
            if key in result and result[key]!=value:
                raise ValueError('Multiple conflicting objects in epoch snapshot')
            result[key]=value
            element.clear()
        if proc.wait(timeout=60):raise RuntimeError('osmium cat failed')
        return result
    finally:
        if proc.poll() is None:proc.kill()

def reconcile(graphs,plan):
    merged={}
    conflicts=[]
    for country in SOURCES:
        for key,entry in graphs[country].items():
            if key in merged and merged[key]!=entry:
                conflicts.append((key,country))
            else:merged[key]=entry
    if conflicts:raise ValueError('Cross-domain epoch version/member conflict')
    rows=[]
    for rid,original in sorted(plan['relations'].items()):
        entry=merged.get(('r',rid))
        if entry is None:
            rows.append({'id':rid,'verdict':'UNKNOWN_RELATION_NOT_IN_HISTORY_EXTRACT'})
            continue
        pending=[];seen=set();queue=list(entry['refs'])
        while queue:
            typ,oid=queue.pop()
            key=(typ,oid)
            if key in seen:continue
            seen.add(key)
            obj=merged.get(key)
            if obj is None:pending.append([typ,oid]);continue
            if typ in ('w','r'):queue.extend(obj['refs'])
        if pending:
            rows.append({'id':rid,'verdict':'UNKNOWN_INCOMPLETE_DEPENDENCIES',
                         'missing':sorted(pending)})
        else:
            rows.append({'id':rid,'verdict':'DEPENDENCY_CLOSURE_CANDIDATE',
                         'object_count':len(seen)+1})
    return rows

def main():
    plan=plan_registry(source_registry())
    if (plan['unknown_distinct'],plan['unknown_domain_rows'])!=(242,244):
        raise ValueError('Frozen ID cardinality drift')
    if '--plan-only' in sys.argv:
        print(json.dumps({'epoch':EPOCH,'requested_unique':len(expected_ids(plan)),
            'unknown':plan['unknown_distinct'],'requires_private_authenticated_osh':True}))
        return
    if OUT.exists():raise FileExistsError('Refuse overwriting prior bulk candidate')
    # Check all provenance/bytes BEFORE creating any output directory.
    contract=json.loads((PRIVATE/'manifest.json').read_text(encoding='utf8'))
    sources=source_contract(contract)
    OUT.mkdir(mode=0o700)
    id_file=OUT/'requested.ids'
    write_ids(id_file,expected_ids(plan))
    result={};graphs={}
    for country in SOURCES:
        result[country]=extract(sources[country],country,id_file)
        graphs[country]=parse_snapshot(result[country]['epoch_snapshot'],country)
    rows=reconcile(graphs,plan)
    report={'epoch':EPOCH,'status':'DEPENDENCY_AUDIT_ONLY_NOT_SPATIAL_SELECTION',
        'source_promoted':False,'overpass_equivalence_certified':False,
        'source_sha256':{k:v['original_sha256'] for k,v in result.items()},
        'subset_sha256':{k:v['subset_sha256'] for k,v in result.items()},
        'epoch_sha256':{k:v['epoch_sha256'] for k,v in result.items()},
        'rows':rows,'unknown_remaining':sum(r['verdict'].startswith('UNKNOWN') for r in rows)}
    (OUT/'report.json').write_text(json.dumps(report,indent=2,sort_keys=True)+'\n',encoding='utf8')
    print(json.dumps({'total':len(rows),'unclosed':report['unknown_remaining'],
        'closed_dependency_candidates':len(rows)-report['unknown_remaining'],
        'spatial_acceptances':0}))
if __name__=='__main__':main()
