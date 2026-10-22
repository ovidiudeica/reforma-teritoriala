"""OSM-UPSTREAM.2: audit current Horesti/Buneti way endpoints; NO OSM EDITS.
Verify original history/current XML, version drift, OSM node identity and relations.
"""
import hashlib
import json
import pathlib
import time
import urllib.error
import xml.etree.ElementTree as ET
from osm_acq2c_priority import fetch, verify_history, objects, sha

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT/'outputs'/'osm-upstream2-readonly'
TARGETS = (
    {'name':'Horesti', 'relation':18967493, 'relation_version':6,
     'way':1376179876, 'way_version':8, 'members':458,
     'old':12318728194, 'replacement':12318728593},
    {'name':'Buneti', 'relation':18968082, 'relation_version':7,
     'way':1376180731, 'way_version':6, 'members':228,
     'old':11649857778, 'replacement':8265822008},
)

def evaluate(target,way_current,old_epoch,new_epoch,relation_xml):
    nodes=way_current['nodes']
    if len(nodes)!=target['members']:
        return {'verdict':'BLOCKED_WAY_LENGTH_CHANGED'}
    if way_current['version']!=target['way_version']:
        return {'verdict':'BLOCKED_WAY_VERSION_DRIFT'}
    if old_epoch['type']!='node' or new_epoch['type']!='node':
        return {'verdict':'BLOCKED_NON_NODE_PROOF'}
    old=old_epoch['epoch_object'];new=new_epoch['epoch_object']
    if (old['lat'],old['lon'])!=(new['lat'],new['lon']):
        return {'verdict':'BLOCKED_COORDINATE_MISMATCH'}
    root=ET.fromstring(relation_xml)
    relations=[e for e in root.findall('relation') if e.get('id')==str(target['relation'])]
    if len(relations)!=1 or int(relations[0].get('version','0'))!=target['relation_version']:
        return {'verdict':'BLOCKED_RELATION_VERSION_DRIFT'}
    if not any(e.get('type')=='way' and e.get('ref')==str(target['way'])
               for e in relations[0].findall('member')):
        return {'verdict':'BLOCKED_MISSING_PARENT_MEMBERSHIP'}
    if nodes[-1]==target['old']:
        verdict='UNCHANGED_UPSTREAM_REQUIRES_AUTHORIZED_MAPPER_REVIEW'
    elif nodes[-1]==target['replacement']:
        verdict='REPLACEMENT_PRESENT_NEEDS_FULL_TOPOLOGY_RECHECK'
    else:
        verdict='BLOCKED_UNEXPECTED_ENDPOINT'
    return {'verdict':verdict,'current_last_node':nodes[-1],
            'length':len(nodes),'coordinates_identical_at_frozen_epoch':True,
            'public_osm_edit_performed':False,'source_promoted':False}

def audit():
    if OUTPUT.exists(): raise FileExistsError('Immutable evidence output already exists')
    OUTPUT.mkdir(parents=True)
    entries=[];ledger=[]
    def save(index,stage,raw):
        filename=f'original-{index:02d}-{stage}.xml'
        (OUTPUT/filename).write_bytes(raw)
        ledger.append({'name':filename,'bytes':len(raw),'sha256':sha(raw)})
        return filename
    def capture(index,stage,path):
        time.sleep(1.0)
        raw,receipt=fetch(path)
        return raw,{**receipt,'file':save(index,stage,raw)}
    for i,target in enumerate(TARGETS):
        originals={};receipts={};error=None;proofs={}
        paths={
            'way-history':f"way/{target['way']}/history",
            'way-current':f"way/{target['way']}",
            'old-history':f"node/{target['old']}/history",
            'old-current':f"node/{target['old']}",
            'replacement-history':f"node/{target['replacement']}/history",
            'replacement-current':f"node/{target['replacement']}",
            'parent-current':f"relation/{target['relation']}"}
        for j,(mode,path) in enumerate(paths.items()):
            try:
                originals[mode],receipts[mode]=capture(i*8+j,mode,path)
            except (urllib.error.URLError,TimeoutError,ValueError) as e:
                error=f'{type(e).__name__}: {e}'
                receipts[mode]={'error':error}
                break
        verdict={'verdict':'RETRIEVAL_INCOMPLETE','error':error}
        if error is None:
            try:
                for typ,key,oid in (('way','way',target['way']),
                                    ('node','old',target['old']),
                                    ('node','replacement',target['replacement'])):
                    proofs[key]=verify_history(originals[key+'-history'],
                                               originals[key+'-current'],typ,oid)
                latest_way=objects(originals['way-current'],'way',target['way'],False)[0]
                verdict=evaluate(target,latest_way,proofs['old'],
                                 proofs['replacement'],originals['parent-current'])
            except (ValueError,ET.ParseError) as e:
                verdict={'verdict':'HISTORY_OR_XML_REJECTED','error':str(e)}
        entries.append({'target':target,'result':verdict,
                        'historical_proofs':proofs,'original_receipts':receipts})
    report={'scope':'OSM-UPSTREAM.2 direct read-only verification of two conditional mapper suggestions',
            'epoch':'2026-10-20T20:23:47Z','results':entries,
            'public_osm_edit_performed':False,'source_promoted':False,
            'acceptance':'BLOCKED_PENDING_AUTHORIZED_MAPPER_AND_SOURCE_REQUALIFICATION'}
    raw=(json.dumps(report,sort_keys=True,indent=2)+'\n').encode()
    (OUTPUT/'report.json').write_bytes(raw)
    ledger.append({'name':'report.json','bytes':len(raw),'sha256':sha(raw)})
    (OUTPUT/'manifest-sha256.json').write_text(
        json.dumps({'files':sorted(ledger,key=lambda x:x['name'])},indent=2,sort_keys=True)+'\n',
        encoding='utf8')
    print(json.dumps({r['target']['name']:r['result']['verdict'] for r in entries},sort_keys=True))
    if any(r['result']['verdict'].startswith(('BLOCKED_','HISTORY_','RETRIEVAL_')) for r in entries):
        raise SystemExit('Fail-closed upstream recheck; inspect original archive')

if __name__=='__main__':
    audit()
