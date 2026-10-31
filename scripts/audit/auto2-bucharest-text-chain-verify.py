"""Verify the provisional normative graph and source bytes without changing ACTUAL."""
from pathlib import Path
import json,hashlib,subprocess
from pypdf import PdfReader
repo=Path(__file__).resolve().parents[2];root=repo/'docs/audits/auto2-bucharest-chain-20261031'
load=lambda p:json.loads(p.read_bytes())
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=load(root/'sha256-manifest.json')
files={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
assert files==set(manifest)|{'sha256-manifest.json'}
for name,spec in manifest.items():
 assert not name.startswith('/') and '..' not in name and '\\' not in name
 b=(root/name).read_bytes();assert sha(b)==spec['sha256'] and len(b)==spec['bytes'],name
for name,value in load(root/'official-binary-sources.json').items():
 p=root/'originals'/name;b=p.read_bytes();assert b.startswith(b'%PDF-') and sha(b)==value['sha256']
 reader=PdfReader(p);assert len(reader.pages)==value['pdf_pages'];assert value['normative_boundary_map_acquired'] is False
 text='\n'.join(page.extract_text() or '' for page in reader.pages)
 assert text==(root/'text'/f'{name}.txt').read_text(encoding='utf8'),name
graph=load(root/'modifier-chain.json');assert graph['status']=='REVIEW_REQUIRED'
for k in ('chain_complete','original_decree284_gazette_acquired','original_law31_gazette_acquired','route_amendment_absence_certified','legal_geometry_certified','actual_mutation_allowed','p91_authorized'):assert graph[k] is False,k
assert len(graph['nodes'])==9 and len(graph['edges'])==7
ids={n['id'] for n in graph['nodes']};assert len(ids)==9
for edge in graph['edges']:
 assert edge['from'] in ids and edge['to'] in ids and edge['scope'] and edge['evidence_level']
 if edge['from']!='D284-1979':assert edge['internal_sector_route_change_demonstrated'] is False
assert any(e['from']=='L31-1979' and e['to']=='D284-1979' and e['type']=='APPROVES' for e in graph['edges'])
assert any(e['type']=='POSSIBLE_EFFECT_REQUIRES_CLAUSE_COMPARISON' for e in graph['edges'])
pins=load(root/'previous-stage-pins.json')['sha256']
for p,digest in pins.items():assert sha((repo/p).read_bytes())==digest,'Previous evidence mutated '+p
original=load(repo/'docs/audits/auto2-bucharest-text-20261031/six-historical-routes.json')['records']
records=load(root/'six-sector-decision-register.json')['records'];assert len(records)==6 and {r['sector'] for r in records}==set(range(1,7))
assert sum(len(r['existing_clause_ids']) for r in records)==24
for r in records:
 assert r['status']=='REVIEW_REQUIRED' and r['missing_evidence'] and r['existing_clause_ids']
 assert r['existing_route_sha256']==next(v['route_transcription_sha256'] for v in original if v['sector']==r['sector'])
 for k in ('original_gazette_acquired','complete_modifiers_certified','legal_geometry_certified','actual_mutation_allowed','p91_authorized'):assert r[k] is False
git=lambda *a:subprocess.check_output(['git','-c','safe.directory='+repo.as_posix(),'-C',str(repo),*a],text=True).strip()
protected=['public','data','views','schemas'];assert not git('diff','--name-only','f38e6b81c2da03644e5558b9b25c0481c3f17dbd','HEAD','--',*protected)
assert not git('diff','--name-only','HEAD','--',*protected)
print(json.dumps({'status':'PASS','official_publisher_binaries':2,'normative_nodes':9,'typed_edges':7,'sector_cases':6,'full_chain_certified':False,'actual_changes':0,'p91_authorized':False}))
