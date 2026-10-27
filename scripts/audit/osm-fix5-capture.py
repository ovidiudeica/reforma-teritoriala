"""Bounded official OSM GET evidence. No upload, ACTUAL write or source promotion."""
import datetime, hashlib, json, pathlib, re, time, urllib.error, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=None
BASE='https://api.openstreetmap.org/api/0.6/'
ALLOWED={'type','id','version','timestamp','changeset','visible','tags','members','nodes','lat','lon'}
retired=[18966859,18966939,18967312,18967475,18967641,18967824,18967907,18967934,18968041,18968051,18968093,18968144]
rows=[];deadline=0
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect)
def get(path):
 assert re.fullmatch(r'(relation|way|node)/[1-9][0-9]*(/(history|full|ways|relations))?\.json|changeset/164736346\.json\?include_discussion=true',path)
 if len(rows)>=80 or time.monotonic()>=deadline:raise RuntimeError('BOUNDED_CAPTURE_BUDGET_EXHAUSTED')
 for attempt in range(1,3):
  if len(rows)>=80 or time.monotonic()>=deadline:raise RuntimeError('BOUNDED_CAPTURE_BUDGET_EXHAUSTED')
  started=datetime.datetime.now(datetime.timezone.utc).isoformat();status=None;body=b'';headers={};error=None
  try:
   with opener.open(urllib.request.Request(BASE+path,headers={'User-Agent':'ReformaTeritoriala-OSM-FIX5/1.0 bounded read-only audit'}),timeout=min(20,max(1,deadline-time.monotonic()))) as response:
    status=response.status;headers=dict(response.headers);body=response.read(8*1024*1024+1)
  except urllib.error.HTTPError as e:status=e.code;body=e.read(8*1024*1024+1);headers=dict(e.headers)
  except (urllib.error.URLError,TimeoutError,OSError) as e:error=type(e).__name__+': '+str(e)
  if len(body)>8*1024*1024:raise RuntimeError('OFFICIAL_RESPONSE_EXCEEDS_BOUNDED_SCOPE')
  digest=hashlib.sha256(body).hexdigest();name=hashlib.sha256((path+str(attempt)+started).encode()).hexdigest()+'.private.response';(OUT/name).write_bytes(body)
  elements=[];discussion=None
  if status==200:
   try:
    data=json.loads(body)
    if path.startswith('changeset/'):
     cs=data['changeset'];assert cs['id']==164736346 and len(cs['comments'])==cs['comments_count']
     discussion={'id':cs['id'],'comments_count':cs['comments_count'],'comments':[{'id':c['id'],'date':c['date'],'visible':c.get('visible'),'text_sha256':hashlib.sha256(c.get('text','').encode()).hexdigest()} for c in cs['comments']]}
    else:
     assert isinstance(data.get('elements'),list);elements=[{k:e[k] for k in e if k in ALLOWED} for e in data['elements']]
   except (ValueError,AssertionError,KeyError,TypeError) as e:error='INVALID_OFFICIAL_JSON: '+str(e)
  row={'path':path,'url':BASE+path,'accessed_at':started,'http_status':status,'attempt':attempt,'date':headers.get('Date'),'content_type':headers.get('Content-Type'),'bytes':len(body),'raw_sha256':digest,'private_original':name,'error':error,'elements':elements}
  if discussion is not None:row['discussion']=discussion
  rows.append(row);(OUT/'observations.json').write_bytes((json.dumps({'scope':'Per-ID official observations; not an atomic RO/MD snapshot','rows':rows},ensure_ascii=False,indent=2)+'\n').encode())
  print(path,status,error or '',flush=True)
  if status not in [429,502,503,504] and error is None:break
  if attempt==2 or time.monotonic()+2>=deadline:break
  try:delay=float(headers.get('Retry-After','2'))
  except ValueError:break
  if not 0<=delay<=10:break
  time.sleep(max(2,delay))
 time.sleep(.15)
 return row

def main():
 global OUT,rows,deadline
 OUT=ROOT/'outputs'/('OSM-FIX5-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));OUT.mkdir(exist_ok=False,parents=True)
 rows=[];deadline=time.monotonic()+180
 try:
  for rid in retired+[21515245]:
   get(f'relation/{rid}.json');get(f'relation/{rid}/history.json')
  for rid in [18967493,18968082,21515245]:
   row=get(f'relation/{rid}/full.json')
   if rid==21515245:(OUT/'addition-full-observation.json').write_bytes((json.dumps(row,ensure_ascii=False,indent=2)+'\n').encode())
  ways=set()
  for nid in [12318728194,12318728593,11649857778,8265822008]:ways.update(e['id'] for e in get(f'node/{nid}/ways.json')['elements'] if e['type']=='way')
  if len(ways)>64:raise RuntimeError('INVERSE_WAY_FRONTIER_EXCEEDS_SCOPE')
  parents={};byway={}
  for wid in sorted(ways):
   row=get(f'way/{wid}/relations.json');byway[wid]=[e['id'] for e in row['elements'] if e['type']=='relation']
   for e in row['elements']:
    if e['type']=='relation':parents[e['id']]=e
  if len(parents)>32:raise RuntimeError('INVERSE_RELATION_FRONTIER_EXCEEDS_SCOPE')
  for rid,e in sorted(parents.items()):
   if rid not in [18967493,18968082] and (e.get('tags',{}).get('boundary')=='administrative' or e.get('tags',{}).get('type') in ['boundary','multipolygon']):get(f'relation/{rid}/full.json')
  pending=sorted(set(byway.get(1376179876,[])+byway.get(1376180731,[])));seen=set()
  while pending:
   rid=pending.pop(0)
   if rid in seen:continue
   if len(seen)>=32:raise RuntimeError('INVERSE_ANCESTOR_FRONTIER_EXCEEDS_SCOPE')
   seen.add(rid)
   for e in get(f'relation/{rid}/relations.json')['elements']:
    if e['type']=='relation' and e['id'] not in seen:get(f'relation/{e["id"]}/full.json');pending.append(e['id'])
  get('changeset/164736346.json?include_discussion=true')
  (OUT/'capture-complete.json').write_bytes((json.dumps({'complete':True,'requests':len(rows),'atomic_snapshot':False,'public_edit_executed':False},indent=2)+'\n').encode())
 finally:
  (ROOT/'outputs/osm-fix5-current-location.txt').write_bytes(str(OUT).encode())
  print('EVIDENCE_DIRECTORY',str(OUT),flush=True)

if __name__=='__main__':main()
