"""Achizitie OSM GET limitata; originale private, dovezi sanitizate, fara ACTUAL."""
import datetime,gzip,hashlib,json,pathlib,re,subprocess,time,urllib.request,urllib.error,xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[2]
DEST=ROOT/'docs/audits/rt-audit1-2/evidence'
EPOCH='2026-10-05T23:50:05.218Z'
ALLOWED={'type','id','version','timestamp','changeset','visible','tags','members','nodes','lat','lon'}
def digest(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads((ROOT/p).read_bytes())
def save(name,value):
 DEST.mkdir(parents=True,exist_ok=True);b=(json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode();(DEST/(name+'.gz' if name=='history-observations.json' else name)).write_bytes(gzip.compress(b,mtime=0) if name=='history-observations.json' else b)
def main():
 rows=read('outputs/RT-AUDIT.1.2/forensics-254-per-id.json');equal=read('outputs/RT-AUDIT.1.2/semantics-3-equalities.json')
 ids={int(x[k][5:]) for x in rows+equal for k in ['child_id','parent_id'] if x[k].startswith('osm-r')}
 ways={n for x in rows for field in ['common_way_refs','child_only_way_refs','parent_only_way_refs'] for n in x['way_membership'].get(field,[])}
 priority=[]
 def add(id):
  if id.startswith('osm-r') and int(id[5:]) not in priority:priority.append(int(id[5:]))
 for x in equal:
  for k in ['child_id','parent_id']:add(x[k])
 for id in ['osm-r12104636','osm-r19090918']:add(id)
 for x in rows:
  if x['way_membership'].get('shared_way_count',0)>0:
   for k in ['child_id','parent_id']:add(x[k])
 for x in sorted(rows,key=lambda x:-x['child_outside_parent_m2'])[:4]:
  for k in ['child_id','parent_id']:add(x[k])
 for id in ['osm-r18967570','osm-r19076879','osm-r18968043','osm-r19117344']:add(id)
 for e in read('public/data/actual-entities.json')['entities']:
  if (e.get('legal') or {}).get('registry')=='CUATM' and (e.get('legal') or {}).get('id') in ['8960','9629']:add(e['id'])
 priority=list(dict.fromkeys(priority[:28]+sorted(ids)))
 tracked=subprocess.check_output(['git','ls-files'],cwd=ROOT,text=True).splitlines();cached={};inventory=[];prior_requests=[];sessions=[]
 own=DEST/'history-observations.json.gz'
 if own.exists():
  previous=json.loads(gzip.decompress(own.read_bytes()));cached={r['path']:r for r in previous['responses']};prior_requests=previous['requests'];sessions=previous.get('capture_sessions',[{'scope':'Captura initiala','requests':len(prior_requests)}])
 for p in tracked:
  if p.endswith('.json') and ('observation' in p and '/osm-fix' in p):
   b=(ROOT/p).read_bytes();doc=json.loads(b);covered=[]
   for r in doc.get('rows',[]):
    m=re.fullmatch(r'(relation|way|node)/(\d+)/history.json',r.get('path',''))
    if m and r.get('http_status')==200 and not r.get('error'):
     t,n=m.group(1),int(m.group(2))
     if (t=='relation' and n in ids) or (t=='way' and n in ways):
      k=f'{t}/{n}/history.json';cached[k]={'path':k,'status':200,'elements':r['elements'],'source':p,'source_sha256':digest(b),'raw_sha256_recorded':r['raw_sha256'],'raw_original_reverified':False};covered.append(k)
   inventory.append({'path':p,'sha256':digest(b),'bytes':len(b),'covered':covered,'limitation':'Payload sanitizat arhivat; hashul originalului este istoric, nu reverificat aici'})
  m=re.search(r'(relation|way|node)-(\d+)-history.response$',p)
  if m and ((m[1]=='relation' and int(m[2]) in ids) or (m[1]=='way' and int(m[2]) in ways)):
   b=(ROOT/p).read_bytes();elements=[]
   try:
    if b.lstrip().startswith(b'{'):elements=json.loads(b).get('elements',[])
    else:
     for e in ET.fromstring(b):
      if e.tag not in ['node','way','relation']:continue
      r={'type':e.tag,**{k:int(e.attrib[k]) for k in ['id','version','changeset'] if k in e.attrib},'timestamp':e.get('timestamp'),'visible':e.get('visible','true')=='true','tags':{t.get('k'):t.get('v') for t in e.findall('tag')}}
      if e.tag=='way':r['nodes']=[int(x.get('ref')) for x in e.findall('nd')]
      if e.tag=='relation':r['members']=[{'type':x.get('type'),'ref':int(x.get('ref')),'role':x.get('role','')} for x in e.findall('member')]
      if e.tag=='node':r.update({k:float(e.get(k)) for k in ['lat','lon'] if e.get(k) is not None})
      elements.append(r)
    if elements:cached[f'{m[1]}/{m[2]}/history.json']={'path':f'{m[1]}/{m[2]}/history.json','status':200,'elements':[{k:v for k,v in e.items() if k in ALLOWED} for e in elements],'source':p,'source_sha256':digest(b),'raw_sha256_recorded':digest(b),'raw_original_reverified':True}
    inventory.append({'path':p,'sha256':digest(b),'bytes':len(b),'covered':[f'{m[1]}/{m[2]}'],'limitation':'Original arhivat verificat; continuitatea se valideaza separat'})
   except (ValueError,ET.ParseError,TypeError):inventory.append({'path':p,'sha256':digest(b),'bytes':len(b),'covered':[],'limitation':'Raspuns arhivat neutilizabil ca istoric complet'})
 # Read only previously extracted, small JSONL caches. Never the 164GB PBF.
 bulk=ROOT.parent/'osm-acq2c-bulk';local=[];code=re.compile(br'"code"\s*:\s*"r(\d+)"');cached_versions={}
 old_local=read(str((DEST/'local-history-cache.json').relative_to(ROOT))) if (DEST/'local-history-cache.json').exists() else None
 reuse_local=old_local and old_local.get('searched_relation_ids')==sorted(ids)
 if reuse_local:local=old_local['sources'];cached_versions={int(k):v for k,v in old_local['relations'].items()}
 for folder in ([] if reuse_local else ['selected-epoch-published-20261023','relation-closure-batch1-epoch-20261024','relation-closure-batch2-epoch-20261024','relation-ranges-epoch-20261023']):
  base=bulk/folder;f=base/'selected-history.jsonl';m=base/'manifest-sha256.json'
  if not f.exists() or not m.exists():continue
  metadata=json.loads(m.read_bytes());expected=next((x for x in metadata['files'] if x.get('name')==f.name),None)
  if not expected:continue
  h=hashlib.sha256();count=0
  with f.open('rb') as handle:
   for line in handle:
    h.update(line);match=code.search(line)
    if match and int(match[1]) in ids:
     e=json.loads(line);n=int(match[1]);cached_versions.setdefault(n,[]).append({'version':e['version'],'timestamp':e['timestamp'],'visible':e.get('visible',True),'tags':dict(e.get('tags',[])),'members':e.get('members',[]),'changeset':e.get('changeset')});count+=1
  assert h.hexdigest()==expected['sha256'] and f.stat().st_size==expected['bytes'],str(f)
  local.append({'source':folder+'/'+f.name,'bytes':f.stat().st_size,'sha256':h.hexdigest(),'manifest_sha256':digest(m.read_bytes()),'matching_versions':count,'source_qualified':False,'limitation':'Cache extras; changeset poate lipsi; nu este admitere a full-history'})
 save('local-history-cache.json',{'sources':local,'relations':{str(k):v for k,v in sorted(cached_versions.items())},'searched_relation_ids':sorted(ids),'no_pbf_reader_started':True})
 private=ROOT/'outputs'/('RT-AUDIT-HISTORY-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));private.mkdir(parents=True,exist_ok=False)
 deadline=time.monotonic()+900;requests=list(prior_requests);responses={};budget=600;session_start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,*args,**kwargs):return None
 opener=urllib.request.build_opener(NoRedirect)
 def fetch(path):
  assert re.fullmatch(r'(relation|way|node)/[1-9][0-9]*/history.json|changeset/[1-9][0-9]*.json',path)
  if path in responses:return responses[path]
  if path in cached:responses[path]=cached[path];return responses[path]
  for attempt in range(1,3):
   if len(requests)>=budget or time.monotonic()>=deadline:return None
   body=b'';status=None;error=None;headers={};at=datetime.datetime.now(datetime.timezone.utc).isoformat()
   try:
    with opener.open(urllib.request.Request('https://api.openstreetmap.org/api/0.6/'+path,headers={'User-Agent':'ReformaTeritoriala-RT-AUDIT1.2/1.0 bounded-read-only'}),timeout=min(15,max(1,deadline-time.monotonic()))) as r:body=r.read(8*1024*1024+1);status=r.status;headers=dict(r.headers)
   except urllib.error.HTTPError as e:status=e.code;body=e.read(8*1024*1024+1);headers=dict(e.headers)
   except (urllib.error.URLError,TimeoutError,OSError) as e:error=type(e).__name__+': '+str(e)
   assert len(body)<=8*1024*1024,'Limita raspuns depasita'
   raw=digest(body);(private/(digest((path+at+str(attempt)).encode())+'.private.response')).write_bytes(body)
   row={'path':path,'url':'https://api.openstreetmap.org/api/0.6/'+path,'accessed_at':at,'status':status,'attempt':attempt,'bytes':len(body),'raw_sha256_recorded':raw,'raw_original_reverified':True,'error':error,'elements':[]}
   if status==200:
    try:
     d=json.loads(body)
     if path.startswith('changeset/'):
      c=d['changeset'];row['changeset']={k:v for k,v in c.items() if k in {'id','created_at','closed_at','open','tags','min_lat','max_lat','min_lon','max_lon','changes_count'}}
     else:row['elements']=[{k:v for k,v in e.items() if k in ALLOWED} for e in d['elements']]
    except (ValueError,KeyError,TypeError) as e:row['error']='INVALID_RESPONSE: '+str(e)
   requests.append(row);responses[path]=row;print(path,status,row['error'] or '',flush=True)
   if status not in [429,502,503,504] and not row['error']:break
   if attempt==2:break
   try:delay=float(headers.get('Retry-After','2'))
   except ValueError:break
   if delay<0 or delay>10:break
   time.sleep(max(2,delay))
  time.sleep(.5);return responses.get(path)
 def epoch(row):
  if not row or row.get('status')!=200 or row.get('error'):return None
  elements=row.get('elements',[]);a=[e for e in elements if datetime.datetime.fromisoformat(e['timestamp'].replace('Z','+00:00'))<=datetime.datetime.fromisoformat(EPOCH.replace('Z','+00:00')) and e.get('visible',True)];return max(a,key=lambda e:e['version']) if a else None
 for n in priority:fetch(f'relation/{n}/history.json')
 chosen=[];other=[]
 for n in priority:
  e=epoch(responses.get(f'relation/{n}/history.json'))
  if e:
   members=[m['ref'] for m in e.get('members',[]) if m['type']=='way']
   if n in priority[:4]:
    for wid in members:
     if wid not in chosen:chosen.append(wid)
   elif members:other.append(members[0])
 # Equalities first, followed by one boundary way per other priority relation.
 selected=list(dict.fromkeys(chosen+other))[:30]
 for n in selected:fetch(f'way/{n}/history.json')
 nodes=[]
 for n in selected:
  e=epoch(responses.get(f'way/{n}/history.json'))
  if e:
   for v in (e.get('nodes',[])[:1]+e.get('nodes',[])[-1:]):
    if v not in nodes:nodes.append(v)
 for n in nodes[:12]:fetch(f'node/{n}/history.json')
 changes=[]
 for n in priority:
  e=epoch(responses.get(f'relation/{n}/history.json'))
  if e and e.get('changeset') and e['changeset'] not in changes:changes.append(e['changeset'])
 for n in changes[:8]:fetch(f'changeset/{n}.json')
 sessions.append({'started_at':session_start,'requests':len(requests)-len(prior_requests),'time_budget_seconds':900})
 save('history-observations.json',{'epoch':EPOCH,'scope':'Prioritati explicite; nu istoric exhaustiv pentru toate obiectele; capturi distincte, nu snapshot atomic','request_budget':budget,'time_budget_seconds_per_invocation':900,'capture_sessions':sessions,'priority_relations':priority,'priority_ways':selected,'priority_nodes':nodes[:12],'requests':requests,'responses':[responses[k] for k in sorted(responses)],'cache_sources':inventory,'raw_originals_private':True,'capture_finished':True})
 (private/'capture-index.json').write_bytes((json.dumps({'requests':len(requests),'response_paths':list(responses)},indent=2)+'\n').encode())
 print('RT_HISTORY_CAPTURE',len(requests),'cereri;',len(responses),'raspunsuri reutilizate/noi;',str(private),flush=True)
if __name__=='__main__':main()
