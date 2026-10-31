#!/usr/bin/env python3
"""CLEANUP-2.1: conservative reference graph; never delete anything."""
import csv, json, pathlib, re, subprocess, sys, hashlib, collections
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs'/'cleanup-2-1'
def tracked():
    return [p.decode('utf-8','surrogateescape') for p in subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).split(b'\0') if p]
paths=tracked(); names=set(paths)
sources=[p for p in paths if pathlib.PurePosixPath(p).suffix.lower() in ('.js','.mjs','.cjs','.json','.html','.css','.md','.yml','.yaml','.py','.sh','.txt') and not p.startswith(('docs/evidence/','docs/audits/','public/geo/','data/current/','data/sources/'))]
refs=collections.defaultdict(set); reads=collections.Counter(); bad=[]
for source in sources:
    full=ROOT/source
    try:
        if full.stat().st_size>3_000_000:continue
        data=full.read_text(encoding='utf-8')
    except (UnicodeError,OSError) as e:
        bad.append([source,str(e)]);continue
    # Capture exact paths, quoted import paths, manifest entries, and substrings;
    # never interpret zero matches as proof of unused code.
    for path in paths:
        if path==source:continue
        short=path.removeprefix('public/')
        if path in data or (path.startswith('public/') and ('/'+short) in data):
            refs[path].add(source)
    reads[source]+=1
def category(p):
    if p.startswith(('public/','data/current/','data/sources/')):return 'PRESERVE_PROTECTED_OR_RUNTIME'
    if p.startswith(('docs/evidence/','docs/audits/')):return 'PRESERVE_EVIDENCE'
    if p.startswith('.github/workflows/'):return 'PRESERVE_CI_UNTIL_GATE_REVIEW'
    if p.startswith('vendor/'):return 'REVIEW_OFFLINE_DEPENDENCY'
    if p.startswith(('scripts/','views/','prototypes/')):return 'REVIEW_REFERENCES'
    return 'REVIEW_OTHER'
OUT.mkdir(parents=True,exist_ok=True)
rows=[]
for p in paths:
    file=ROOT/p
    if not file.is_file():continue
    st=file.stat()
    r=sorted(refs[p])
    cls=category(p)
    if r:decision='REFERENCED_KEEP'
    elif cls.startswith('PRESERVE'):decision='PROTECTED_NO_DELETE'
    else:decision='UNPROVEN_ORPHAN_REVIEW_ONLY'
    rows.append(dict(path=p,size_bytes=st.st_size,sha256=hashlib.sha256(file.read_bytes()).hexdigest() if st.st_size<2_000_000 else 'not_calculated_large',category=cls,reference_count=len(r),reference_examples=';'.join(r[:10]),classification=decision))
with (OUT/'per-file-reference-register.csv').open('w',newline='',encoding='utf8') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
summary={'schema':'cleanup-2-1-v1','tracked_files':len(paths),'text_sources_scanned':sum(reads.values()),'unreadable_sources':bad,'references_detected':sum(len(x) for x in refs.values()),'categories':dict(collections.Counter(r['classification'] for r in rows)),'limitations':['static exact-substring references only; dynamic imports and constructed paths may be missed','directories and Git history are not candidate deletions','missing explicit references does not establish unused file','large files SHA not recomputed; Git blob identities retained by CLEANUP-1']}
(OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
