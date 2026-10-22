import pathlib,json,urllib.request,urllib.error,datetime,hashlib,xml.etree.ElementTree as ET,sys
from acq2b_exact import grid,EPOCH
now=datetime.datetime.now(datetime.timezone.utc);stamp=now.strftime('%Y%m%dT%H%M%SZ')
batch2='--remaining-node-only' in sys.argv
if batch2:
    out=pathlib.Path(pathlib.Path('work/current-acq2b-node-history.txt').read_text(encoding='utf8').strip())
    if (out/'capture-batch2.json').exists():raise FileExistsError('Do not repeat an existing API batch')
    rows=json.loads((out/'capture.json').read_text(encoding='utf8'))['rows']
    completed={r['node_id']for r in rows}
    plan=json.loads(pathlib.Path('outputs/OSM-ACQ2b-EXACT-20261022/dependency-plan.json').read_text(encoding='utf8'))
    targets=[(c['missing'][0]['id'],c['id'])for c in plan['candidates']if len(c['missing'])==1 and c['missing'][0]['type']=='node' and c['missing'][0]['id']not in completed]
else:
    out=pathlib.Path('outputs')/('OSM-ACQ2b-NODE-HISTORY-'+stamp);out.mkdir(exist_ok=False)
    pathlib.Path('work/current-acq2b-node-history.txt').write_text(str(out.resolve()),encoding='utf8')
    rows=[];targets=[(30848693,1025098),(354700504,1026139)]
target=datetime.datetime.fromisoformat(EPOCH.replace('Z','+00:00'))
def parse_time(t):return datetime.datetime.fromisoformat(t.replace('Z','+00:00'))
def fetch(node_id,kind):
    url=f'https://api.openstreetmap.org/api/0.6/node/{node_id}'+('/history' if kind=='history' else '')
    req=urllib.request.Request(url,headers={'User-Agent':'ReformaTeritoriala-OSM-ACQ2b-evidence/1.0 (https://github.com/ovidiudeica/reforma-teritoriala)','Accept':'application/xml'})
    receipt={'url':url,'requested_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        with urllib.request.urlopen(req,timeout=25) as r:
            receipt.update(status=r.status,final_url=r.url,headers=dict(r.headers))
            body=r.read(2*1024*1024+1)
        if len(body)>2*1024*1024:raise ValueError('Response exceeds bounded audit size')
        file=f'node-{node_id}-{kind}.response';(out/file).write_bytes(body)
        receipt.update(file=file,bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
        if urllib.parse.urlparse(receipt['final_url']).hostname!='api.openstreetmap.org':raise ValueError('Unexpected source host')
        root=ET.fromstring(body)
        if root.tag!='osm' or root.get('version')!='0.6':raise ValueError('Not an OSM API original')
        objects=root.findall('node')
        if not objects or any(int(n.get('id'))!=node_id for n in objects):raise ValueError('Wrong/missing object')
        receipt['verified_xml']=True
        return objects,receipt
    except Exception as e:
        receipt['error']=str(e);receipt['verified_xml']=False
        return None,receipt

for node_id,candidate in targets:
    history,hr=fetch(node_id,'history');row={'node_id':node_id,'candidate_relation':candidate,'history_receipt':hr,'verdict':'BLOCKED_EVIDENCE'}
    rows.append(row)
    if history:
        current,cr=fetch(node_id,'current');row['current_receipt']=cr
        try:
            versions=[int(n.get('version')) for n in history]
            if versions!=list(range(1,max(versions)+1)):raise ValueError('Incomplete/reordered version history')
            times=[parse_time(n.get('timestamp')) for n in history]
            if times!=sorted(times):raise ValueError('Nonmonotonic version timestamps')
            if not current or len(current)!=1 or current[0].attrib!=history[-1].attrib or ET.tostring(current[0])!=ET.tostring(history[-1]):
                # Whitespace between XML elements is not object content.
                def canonical(n):return dict(n.attrib),sorted((x.get('k'),x.get('v'))for x in n.findall('tag'))
                if not current or len(current)!=1 or canonical(current[0])!=canonical(history[-1]):raise ValueError('History/current observation mismatch')
            eligible=[(i,n)for i,n in enumerate(history)if times[i]<=target]
            if not eligible:raise ValueError('Object did not yet exist at target epoch')
            i,n=eligible[-1]
            if n.get('visible','true')!='true' or not n.get('lon') or not n.get('lat'):raise ValueError('Target version deleted/redacted')
            lon=float(n.get('lon'));lat=float(n.get('lat'));grid(n.get('lon'));grid(n.get('lat'))
            if not(-180<=lon<=180 and -90<=lat<=90):raise ValueError('Invalid coordinates')
            obj={'type':'node','id':node_id,'version':int(n.get('version')),'timestamp':n.get('timestamp'),
                 'lon':lon,'lat':lat,'tags':{x.get('k'):x.get('v')for x in n.findall('tag')}}
            row.update(verdict='HISTORICAL_VERSION_PROVEN',object=obj,history_versions=versions,
                effective_from=n.get('timestamp'),effective_until=history[i+1].get('timestamp') if i+1<len(history)else None,
                latest_verified_version=versions[-1],observation_upper_bound_utc=cr.get('requested_at_utc'))
        except Exception as e:row['validation_error']=str(e)
    (out/('capture-batch2.json'if batch2 else'capture.json')).write_text(json.dumps({'target_epoch':EPOCH,'source':'Official OpenStreetMap API read-only history and current observations','rows':rows,'source_promoted':False},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'node_id':node_id,'verdict':row['verdict'],'error':row.get('validation_error') or hr.get('error'),'version':row.get('object',{}).get('version')}),flush=True)
print(json.dumps({'output':str(out)}))
