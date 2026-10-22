import sys,pathlib,json,gzip,hashlib,datetime,collections
sys.path.insert(0,str(pathlib.Path('work/gis-runtime').resolve()))
import osmium
root=pathlib.Path(pathlib.Path('work/current-osm-resume-20261022.txt').read_text().strip()); source=root/'dated-extracts'; out=root/'extract-replay-v2';out.mkdir(exist_ok=False)
receipts=json.loads((source/'receipts.json').read_text()); baseline=json.loads(pathlib.Path('work/osmfix2/data/sources/osm-current.json').read_text()); reports=[]
def stamp(t):return t.isoformat().replace('+00:00','Z')
def obj(o,kind):
 r={'type':kind,'id':o.id,'version':o.version,'timestamp':stamp(o.timestamp),'tags':dict(o.tags)}
 if kind=='relation':r['members']=[{'type':{'n':'node','w':'way','r':'relation'}[m.type],'ref':m.ref,'role':m.role}for m in o.members]
 elif kind=='way':r['nodes']=[n.ref for n in o.nodes]
 else:r.update(lon=o.location.lon,lat=o.location.lat)
 return r
for receipt in receipts['rows']:
 if receipt['status']!='COMPLETE_ORIGINAL_EXTRACT_HASH_VERIFIED_NOT_SOURCE_ACCEPTED':raise ValueError('Incomplete original extract')
 code={'romania':'RO','moldova':'MD'}[receipt['country']]; file=source/receipt['file']; h=hashlib.sha256(); m=hashlib.md5()
 print(json.dumps({'country':code,'phase':'verify_original'}),flush=True)
 with file.open('rb')as f:
  for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b);m.update(b)
 if h.hexdigest()!=receipt['sha256']or m.hexdigest()!=receipt['published_md5']:raise ValueError('Original checksum drift')
 print(json.dumps({'country':code,'phase':'read_saved_header'}),flush=True)
 with osmium.io.Reader(str(source/(receipt['country']+'.header.osm.pbf')),osmium.osm.osm_entity_bits.NOTHING)as r:
  header=r.header(); metadata={k:header.get(k)for k in ['generator','osmosis_replication_timestamp','osmosis_replication_sequence_number','osmosis_replication_base_url','timestamp']};metadata['box']=str(header.box())
 epoch=datetime.datetime.fromisoformat(metadata['osmosis_replication_timestamp'].replace('Z','+00:00')); now=datetime.datetime.now(datetime.timezone.utc)
 if not datetime.timedelta(0)<=now-epoch<=datetime.timedelta(days=14):raise ValueError('Unverified/future/stale PBF epoch')
 levels={'RO':{'4','8','9'},'MD':{'4','6','8','9'}}[code]; required={1813306,1813297,58512,1813315,1813316,18968071,1691800,1691801,18822134}if code=='MD'else set()
 all_relations={}; counts=collections.Counter(); metadata_invalid=[]
 class Relations(osmium.SimpleHandler):
  def relation(self,r):
   all_relations[r.id]=obj(r,'relation')
 print(json.dumps({'country':code,'phase':'relations'}),flush=True)
 Relations().apply_file(str(file))
 print(json.dumps({'country':code,'phase':'relations_complete','count':len(all_relations)}),flush=True)
 selected=sorted(i for i,r in all_relations.items()if r['tags'].get('boundary')=='administrative'and(r['tags'].get('admin_level')in levels or r['tags'].get('ISO3166-1')==code or i in required))
 pending=list(selected); relations={}; missing_relations=set()
 while pending:
  i=pending.pop()
  if i in relations or i in missing_relations:continue
  if i not in all_relations:missing_relations.add(i);continue
  r=all_relations[i];relations[i]=r;pending.extend(m['ref']for m in r['members']if m['type']=='relation')
 way_ids={m['ref']for r in relations.values()for m in r['members']if m['type']=='way'}; node_ids={m['ref']for r in relations.values()for m in r['members']if m['type']=='node'};ways={};nodes={}
 class Ways(osmium.SimpleHandler):
  def way(self,w):
   if w.id in way_ids:
    ways[w.id]=obj(w,'way');node_ids.update(ways[w.id]['nodes'])
 print(json.dumps({'country':code,'phase':'ways','wanted':len(way_ids)}),flush=True)
 Ways().apply_file(str(file))
 class Nodes(osmium.SimpleHandler):
  def node(self,n):
   if n.id in node_ids:nodes[n.id]=obj(n,'node')
 print(json.dumps({'country':code,'phase':'nodes','wanted':len(node_ids)}),flush=True)
 Nodes().apply_file(str(file))
 elements=[*nodes.values(),*ways.values(),*relations.values()]
 for e in elements:
  if e['version']<=0 or datetime.datetime.fromisoformat(e['timestamp'].replace('Z','+00:00'))>epoch:metadata_invalid.append({'type':e['type'],'id':e['id']})
 elements.sort(key=lambda e:({'node':0,'way':1,'relation':2}[e['type']],e['id']))
 raw={'version':0.6,'elements':elements}; body=json.dumps(raw,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode();gz=gzip.compress(body,mtime=0);rawfile=code.lower()+'-extract-candidates.json.gz';(out/rawfile).write_bytes(gz)
 old=set(baseline['countries'][code]['selected_relation_ids']); new=set(selected)
 report={'country':code,'extract_sha256':receipt['sha256'],'header':metadata,'all_extract_relations':len(all_relations),'candidate_count':len(selected),'candidate_ids':selected,'candidate_scope':'ALL_MATCHING_RELATIONS_IN_GEOGRAPHIC_EXTRACT_NOT_CERTIFIED_OVERPASS_AREA_EQUIVALENCE','missing_previous_ids':sorted(old-new),'added_candidate_relations':[relations[i]for i in sorted(new-old)],'missing_required_ids':sorted(required-new),'missing_relations':sorted(missing_relations),'missing_ways':sorted(way_ids-set(ways)),'missing_nodes':sorted(node_ids-set(nodes)),'invalid_metadata':metadata_invalid,'raw_file':rawfile,'raw_body_sha256':hashlib.sha256(body).hexdigest(),'raw_gzip_sha256':hashlib.sha256(gz).hexdigest(),'object_counts':{'relation':len(relations),'way':len(ways),'node':len(nodes)},'source_promoted':False,'scope_acceptance':'BLOCKED_UNPROVEN_SPATIAL_SELECTION_EQUIVALENCE'}
 reports.append(report);(out/'report.json').write_text(json.dumps({'reports':reports,'actual_mutation_allowed':False,'p91_import_allowed':False,'source_promoted':False},indent=2,ensure_ascii=False)+'\n',encoding='utf8');print(json.dumps({k:report[k]for k in ['country','candidate_count','missing_previous_ids','missing_required_ids','missing_relations','missing_ways','missing_nodes','object_counts','scope_acceptance']}),flush=True)
