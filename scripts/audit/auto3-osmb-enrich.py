"""Attach targeted official-code lookups and reused hierarchy observations, no inventory rerun.
Run after auto3-osmb-reconcile.py, with --baseline pointing at the prior audit directory.
"""
import argparse,csv,gzip,hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];BASE='f38e6b81c2da03644e5558b9b25c0481c3f17dbd'
sha=lambda b:hashlib.sha256(b).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--baseline',type=Path,required=True);a=ap.parse_args();out=ROOT/'docs/audits/auto3-osmb'
 load=lambda p:json.loads(p.read_bytes())
 reg=load(out/'register.json');inputs=load(out/'input-sha256.json');base=load(out/'baseline-exceptions.json');manifest=load(a.baseline/'manifest-rezultate-sha256.json')
 def source(p):
  b=subprocess.check_output(['git','-c',f'safe.directory={ROOT.as_posix()}','-C',str(ROOT),'show',BASE+':'+p]);inputs[p]={'sha256':sha(b),'bytes':len(b),'git_commit':BASE};return json.loads(b)
 cat=source('public/data/actual-entities.json');ents={e['id']:e for e in cat['entities']};cuatm=source('data/sources/cuatm-current.json');siruta=source('data/sources/ro-siruta-current.json')
 bycode={x['code']:x for x in cuatm['records']};sbycode={x['siruta']:x for x in siruta['records']}
 meta={}
 for line in (a.baseline/'metadata-originale.jsonl').read_text(encoding='utf8').splitlines():
  x=json.loads(line);meta[x['derived_osm_key']]=x['feature_members_except_geometry']['properties']
 def rows(p):
  raw=(a.baseline/p).read_bytes();assert sha(raw)==manifest[p]['sha256'];base['baseline_files'][p]=manifest[p]
  with (a.baseline/p).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
 prior=rows('ierarhii-osmb.csv');actualprior=rows('actual-relatii-5846.csv');bychild={}
 for x in prior:bychild.setdefault(x['child'],[]).append(x)
 actualedges={x['child']:x for x in actualprior}
 for r in reg['records']:
  if r['exception_kind']!='ACTUAL_ONLY':
   sid=r['osm']['signed_osmb_id'];key=f'osm-r{-sid}' if sid<0 else f'osm-w{sid}';props=r['osm']['metadata_original'];context=[]
   for parent in props.get('parents_administrative') or []:
    pk=f'osm-r{-parent}' if parent<0 else f'osm-w{parent}';pm=meta.get(pk);e=ents.get(pk)
    context.append({'original_parent_osm_id':parent,'osm_key':pk,'source_name':pm.get('name') if pm else None,'source_admin_level':pm.get('admin_level') if pm else None,'in_actual':bool(e),'accepted_actual_legal_identity':e.get('legal') if e else None})
   r['hierarchy']['osmb_parent_context']=context;r['hierarchy']['reused_osmb_geometric_observations']=bychild.get(key,[])
   if r['jurisdiction']=='MD':
    code=props.get('tags',{}).get('ref:cuatm:codunic');found=bycode.get(str(code)) if code is not None else None
    r['official_code_lookup']={'registry':'CUATM','registry_source':'data/sources/cuatm-current.json','snapshot_fetched_at':cuatm.get('fetched_at'),'explicit_osm_ref_cuatm_codunic':code,'exact_code_match':found,'interpretation':'Only an exact code lookup in this cached edition; absence is not a complete current legal-status certification and no name is inferred.'}
   elif r['admin_level']==10:
    parents=[x['osm_key'] for x in context];legalparents={str(ents[x]['legal']['id']) for x in parents if x in ents and (ents[x].get('legal') or {}).get('id')}
    nominal=[x for x in siruta['records'] if x.get('name','').casefold()==r['name'].casefold() and str(x.get('parent_siruta')) in legalparents]
    r['official_nominal_lookup']={'registry':'SIRUTA','source':'data/sources/ro-siruta-current.json','reference_year':siruta.get('reference_year'),'exact_name_with_accepted_parent_matches':nominal,'interpretation':'Nominal identity candidates only; no footprint equivalence or identity binding is authorized.'}
  if r.get('actual_id'):r['hierarchy']['reused_actual_topology_edge']=actualedges.get(r['actual_id'])
 reg['policy']['official_lookup_scope']='Cached official edition and exact codes/names only; no inferred legal geometry or current-law certification.'
 for name,data in [('register.json',reg),('input-sha256.json',inputs),('baseline-exceptions.json',base)]: (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
 report=(out/'README.md').read_text(encoding='utf8').split('\n## Completare probatorie per-ID')[0].replace('geometry/*.json.gz','geometry-cases.json.gz (indexat per-ID)')
 report+='\n## Completare probatorie per-ID\n\nPărinții sursă sunt contextualizați nominal și pe nivel, cu bindingurile ACTUAL existente păstrate distinct. Rezultatele geometrice părinte–copil se reutilizează din registrele auditului anterior, cu SHA-256; inventarul și topologia globală nu sunt repetate. Pentru MD se consemnează lookup-ul exact al codului explicit CUATM în ediția cache, inclusiv lipsa codului. Pentru cele trei obiecte RO de nivel 10 se consemnează numai potriviri nominale exacte cu părintele acceptat în SIRUTA. Niciun rezultat negativ nu este tratat drept dovadă de inexistență juridică.\n\nCele 95 de way-uri MD cu boundary=administrative au toate place=allotments; această contradicție de rol este vizibilă per-ID și nu este convertită automat în statut de UAT. Singurul contur OSMB-only egal topologic cu ACTUAL este regiunea statistică UTA Găgăuzia (relația 18972669) față de relația administrativă 1699032: egalitatea geometriilor nu comasează identitățile și rolurile.\n\nControlul Ojdula/Brețcu găsește zero suprapunere interioară și un reziduu de aproximativ 0,0124 m² între reuniunea ACTUAL și anvelopa OSMB. Reziduul nenul este păstrat, fără certificare de egalitate exactă sau juridică. Diferențele Săvinești/Roznov au exact același footprint modificat (283,5825 m²); Condrița/Chișinău și Scoreni/Strășeni au, de asemenea, arii modificate comune, documentate în raportul de cuplare. Aceste relații explică mecanismul cartografic, fără a certifica istoricul necunoscut al exportului OSMB.\n'
 (out/'README.md').write_text(report,encoding='utf8',newline='\n')
 # Bundle integrity includes the updated evidence, not a recursive hash of the manifest itself.
 m={p.relative_to(out).as_posix():{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in sorted(out.rglob('*')) if p.is_file() and p.name!='sha256-manifest.json'}
 (out/'sha256-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf8',newline='\n')
 print(json.dumps({'status':'PASS','cases_enriched':len(reg['records']),'official_inputs':len(inputs),'manifest_files':len(m)}))
if __name__=='__main__':main()
