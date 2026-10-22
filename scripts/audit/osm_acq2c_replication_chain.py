"""Offline transport evidence audit; never qualifies the historical OSM source."""
import datetime as dt,hashlib,json,pathlib,re,gzip,io,xml.etree.ElementTree as ET

def extract_versions(data,ids):
    raw=gzip.decompress(data)
    if b'<!DOCTYPE' in raw or b'<!ENTITY' in raw:raise ValueError('Unexpected XML declaration')
    root=ET.fromstring(raw)
    if root.tag!='osmChange' or root.attrib.get('version')!='0.6':raise ValueError('Not OSM replication XML')
    found=[];seen=set()
    for action in root:
        if action.tag not in ('create','modify','delete'):raise ValueError('Unknown change action')
        for e in action:
            if e.tag not in ('node','way','relation'):raise ValueError('Unknown entity type')
            oid=int(e.attrib['id']);version=int(e.attrib['version'])
            if oid<=0 or version<=0:raise ValueError('Invalid identity/version')
            if e.tag[0]+str(oid) not in ids:continue
            t=moment(e.attrib['timestamp'])
            visible=e.attrib.get('visible','false' if action.tag=='delete' else 'true')
            if visible not in ('true','false') or (action.tag=='delete')!=(visible=='false'):raise ValueError('Action/visibility conflict')
            key=(e.tag,oid,version)
            if key in seen:raise ValueError('Duplicate object version')
            seen.add(key)
            found.append({'type':e.tag,'id':oid,'version':version,'timestamp':e.attrib['timestamp'],'action':action.tag,'visible':visible,'lon':e.attrib.get('lon'),'lat':e.attrib.get('lat'),'tags':sorted([[x.attrib['k'],x.attrib['v']] for x in e.findall('tag')]),'nodes':[int(x.attrib['ref'])for x in e.findall('nd')],'members':[dict(x.attrib)for x in e.findall('member')]})
    return sorted(found,key=lambda x:(x['type'],x['id'],x['version']))

def moment(value):
    if not isinstance(value,str):raise ValueError('Timestamp type')
    t=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
    if t.tzinfo is None:raise ValueError('Naive timestamp')
    return t.astimezone(dt.timezone.utc)

def parse_state(raw):
    fields={}
    for line in raw.decode('ascii').splitlines():
        if not line or line.startswith('#'):continue
        k,v=line.split('=',1)
        if k in fields:raise ValueError('Duplicate state key')
        fields[k]=v.replace('\\:',':')
    s=fields['sequenceNumber']
    if not s.isdigit():raise ValueError('Invalid sequence')
    return int(s),moment(fields['timestamp'])

def audit(states,base_epoch,target_epoch,read_state,read_diff,receipts):
    base,target=moment(base_epoch),moment(target_epoch)
    if base>=target or len(states)<2:raise ValueError('Invalid interval')
    seen=set();previous=None;versions=0;total=0
    if len(receipts)!=len(states)-1:raise ValueError('Missing or duplicate diff receipt')
    receipt_map={r['sequence']:r for r in receipts}
    if len(receipt_map)!=len(receipts):raise ValueError('Duplicate receipt sequence')
    for i,s in enumerate(states):
        seq=s['sequence']
        if type(seq) is not int or seq in seen:raise ValueError('Duplicate or invalid sequence')
        seen.add(seq)
        raw=read_state(seq)
        actual_seq,t=parse_state(raw)
        if actual_seq!=seq or hashlib.sha256(raw).hexdigest()!=s['sha256'] or t!=moment(s['timestamp']):raise ValueError('State integrity mismatch')
        if previous and (seq!=previous[0]+1 or t<=previous[1]):raise ValueError('Noncontiguous states')
        if not i and t>base:raise ValueError('Initial state follows base')
        if i:
            r=receipt_map.get(seq)
            if not r or r.get('gzip_xml_complete') is not True:raise ValueError('Unvalidated diff')
            data=read_diff(seq)
            if type(r['bytes']) is not int or len(data)!=r['bytes'] or hashlib.sha256(data).hexdigest()!=r['sha256']:raise ValueError('Diff integrity mismatch')
            if not re.fullmatch(r'https://planet\.openstreetmap\.org/replication/hour/\d{3}/\d{3}/\d{3}\.osc\.gz',r['url']):raise ValueError('Unexpected publisher')
            expected=f'{seq//1000000:03}/{seq//1000%1000:03}/{seq%1000:03}.osc.gz'
            if not r['url'].endswith('/'+expected):raise ValueError('Sequence URL mismatch')
            total+=len(data);versions+=len(r['selected_versions'])
        previous=seq,t
    if previous[1]<target:raise ValueError('Tail does not cover target')
    return {'transport_chain':'CONTIGUOUS_STATE_AND_DIFF_BYTES_VERIFIED','diff_count':len(receipts),'diff_bytes':total,'selected_versions_observed':versions,'base_original_verified':False,'source_qualified':False,'unknown_adjudicated':0,'limits':['GZIP/XML completion is checked during capture; this audit independently checks original byte hashes.','Base full-history original is still required.','No per-object temporal completeness, dependency closure, topology or spatial equivalence is certified.']}

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence-directory',type=pathlib.Path,required=True)
    parser.add_argument('--original-directory',type=pathlib.Path,required=True)
    parser.add_argument('--output',type=pathlib.Path,required=True)
    args=parser.parse_args()
    if args.output.exists():raise FileExistsError('Refuse to overwrite prior evidence')
    root=args.evidence_directory
    doc=json.loads((root/'states.json').read_bytes())
    receipts=[json.loads((root/(str(s['sequence'])+'-receipt.json')).read_bytes()) for s in doc['states'][1:]]
    read_original=lambda seq:(args.original_directory/(str(seq)+'.osc.gz')).read_bytes()
    result=audit(doc['states'],doc['base_epoch'],doc['target_epoch'],lambda seq:(root/(str(seq)+'.state.txt')).read_bytes(),read_original,receipts)
    from osm_acq2c_bulk_preflight import plan
    ids=set(plan()['required_history_object_ids'])
    selected=[]
    for s in doc['states'][1:]:
        for row in extract_versions(read_original(s['sequence']),ids):
            selected.append(dict(row,replication_sequence=s['sequence'],at_or_before_target=moment(row['timestamp'])<=moment(doc['target_epoch'])))
    result['independent_gzip_xml_replay']=True
    result['selected_versions']=selected
    result['source_qualified']=False
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_bytes((json.dumps(result,sort_keys=True,indent=2)+'\n').encode())
    print(json.dumps({k:v for k,v in result.items() if k!='selected_versions'}))
