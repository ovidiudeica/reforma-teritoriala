"""Reconcile two cached official-page text transcriptions, without legal certification."""
import re,json,hashlib,difflib,unicodedata,argparse,gzip
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--evidence-dir',type=Path,default=Path(__file__).resolve().parents[2]/'docs/audits/auto2-bucharest-text-20261031');root=ap.parse_args().evidence_dir
all_lines={};decree_lines={}
for p in root.glob('web-extracted-*.txt.gz'):
 text=gzip.decompress(p.read_bytes()).decode('utf8')
 for n,t in re.findall(r'^L(\d+): (.*)$',text,re.M):
  n=int(n)
  if 8997<=n<=9039:all_lines[n]=t
  if 48<=n<=72:decree_lines[n]=t
current='\n'.join(all_lines[n] for n in sorted(all_lines))
starts=list(re.finditer(r'(?:- )?Sectorul ([1-6])\s+Situat',current))
assert [int(m.group(1)) for m in starts]==list(range(1,7))
data=json.loads((root/'six-historical-routes.json').read_bytes())
historical='\n'.join(decree_lines[n] for n in sorted(decree_lines))
historical_starts=list(re.finditer(r'Sectorul ([1-6]) Situat',historical))
assert [int(m.group(1)) for m in historical_starts]==list(range(1,7))
for i,m in enumerate(historical_starts):
 part=historical[m.start():historical_starts[i+1].start() if i+1<len(historical_starts) else len(historical)]
 part=re.sub(r'\s*-{3,}\s*$','',part)
 assert part.strip()==data['records'][i]['full_historical_route_transcription'].strip(),f'Source transcription mismatch sector {i+1}'
normalize=lambda s:re.sub(r'\W+',' ',''.join(c for c in unicodedata.normalize('NFD',s.casefold()) if not unicodedata.combining(c))).strip()
rows=[];clauses=[]
for i,m in enumerate(starts):
 sector=int(m.group(1));text=current[m.start():starts[i+1].start() if i+1<len(starts) else len(current)].strip()
 old=data['records'][i]['full_historical_route_transcription'];a=normalize(old).split();b=normalize(text).split()
 differences=[{'op':tag,'historical_text_tokens':' '.join(a[i1:i2]),'other_form_tokens':' '.join(b[j1:j2])} for tag,i1,i2,j1,j2 in difflib.SequenceMatcher(a=a,b=b,autojunk=False).get_opcodes() if tag!='equal']
 row={'sector':sector,'historical_route_sha256':hashlib.sha256(old.encode()).hexdigest(),'other_official_form_url':'https://legislatie.just.ro/Public/FormaPrintabila/00000G006MECTABEER702U9T7T2042VK','other_form_route_text':text,'other_form_route_sha256':hashlib.sha256(text.encode()).hexdigest(),'normalized_text_equal':a==b,'lexical_differences':differences,'legal_effect_of_differences':'NOT_ADJUDICATED','source_effective_version':'NOT_CERTIFIED','legal_osmb_alignment':'NOT_EXECUTED_UNLOCATED_HISTORICAL_LANDMARKS'}
 rows.append(row)
 # Directional clauses are a textual index, not reconstructed vector boundaries.
 pieces=re.split(r'(?=-\s*(?:Spre|Limita))',old)
 for n,part in enumerate(pieces,1):
  part=part.strip()
  if not part:continue
  clauses.append({'id':f'AUTO2-S{sector}-C{n:02d}','sector':sector,'original_clause':part,'inclusion_exclusion_text':re.findall(r'\([^)]*(?:inclusiv|exclusiv)[^)]*\)',part),'water_axis_mentioned':bool(re.search(r'firul|riului|râului',part,re.I)),'conventional_line_mentioned':bool(re.search(r'conventional',normalize(part))),'historical_landmarks_modern_ids':[],'modern_geocoding':'REQUIRES_DATED_INDEPENDENT_EVIDENCE','legal_osmb_match':'NOT_CERTIFIED'})
out={'audit':'AUTO-2-TEXTUAL-CONTINUATION','source_kind':'Normalized web-tool transcriptions of official pages; original HTML/PDF not acquired','comparison':'Two visible official-page forms, not a certified complete amendment chain','sectors':rows,'directional_clause_index':clauses,'actual_modified':False,'p91_authorized':False}
(root/'six-route-text-comparison.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
manifest={p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(root.iterdir()) if p.is_file() and p.name!='sha256-manifest.json'}
(root/'sha256-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps({'sectors':len(rows),'directional_clauses':len(clauses),'normalized_equal_sectors':sum(x['normalized_text_equal'] for x in rows),'lexical_difference_groups':sum(len(x['lexical_differences']) for x in rows),'legal_effects_certified':0}))
