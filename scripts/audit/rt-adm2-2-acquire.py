#!/usr/bin/env python3
"""Targeted primary-source evidence acquisition. Never edits ACTUAL."""
import hashlib,json,os,time,urllib.request,urllib.error,zipfile,io,datetime
from pathlib import Path
from openpyxl import load_workbook
from xml.etree import ElementTree as ET
OUT=Path("outputs/RT-ADM.2.2");OUT.mkdir(parents=True,exist_ok=True)
SRC=Path("docs/audits/rt-audit1-2/evidence/CUATM_25.xlsx")
URL="https://statistica.gov.md/files/files/Clasificatoare/CUATM_25.xlsx"
ids=[18967570,18968043,12104636]
def sha(b): return hashlib.sha256(b).hexdigest()
def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":"reforma-teritoriala-rt-adm2-2-evidence/1.0 (research; GitHub Actions)","Accept":"application/xml,application/octet-stream,*/*"})
    with urllib.request.urlopen(req,timeout=35) as res:return res.read(),res.status,res.geturl()
def rows(data):
    wb=load_workbook(io.BytesIO(data),read_only=True,data_only=True)
    sheets={}
    for ws in wb:
        out=[]
        for i,row in enumerate(ws.values,1):
            vals=[str(v).strip() if v is not None else "" for v in row]
            if any(vals):out.append({"row":i,"cells":vals})
        sheets[ws.title]=out
    return sheets
def key_row(r):return tuple(r["cells"])
report={"schema":"rt-adm2-2-execution-v1","generated_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"cuatm":{},"osm_history":[]}
old=SRC.read_bytes()
report["cuatm"]["archived"]={"sha256":sha(old),"size":len(old),"path":str(SRC)}
old_rows=rows(old)
report["cuatm"]["archived_sheet_rows"]={k:len(v) for k,v in old_rows.items()}
try:
    new,status,final=get(URL)
    if not zipfile.is_zipfile(io.BytesIO(new)):raise ValueError("Downloaded file is not XLSX ZIP")
    (OUT/"CUATM_25_official_download.xlsx").write_bytes(new)
    report["cuatm"]["official"]={"url":URL,"final_url":final,"http_status":status,"sha256":sha(new),"size":len(new)}
    newer=rows(new)
    report["cuatm"]["official_sheet_rows"]={k:len(v) for k,v in newer.items()}
    diffs=[]
    for sheet in sorted(set(old_rows)|set(newer)):
        left=old_rows.get(sheet,[]);right=newer.get(sheet,[])
        for n in range(max(len(left),len(right))):
            a=left[n] if n<len(left) else None;b=right[n] if n<len(right) else None
            if a is None or b is None or key_row(a)!=key_row(b):diffs.append({"sheet":sheet,"row_index":n+1,"archived":a,"official":b})
    report["cuatm"]["comparison"]={"method":"per-sheet row-by-row, normalized display values, positional","changed_rows":len(diffs),"same_binary":old==new}
    (OUT/"CUATM_row_differences.json").write_text(json.dumps(diffs,ensure_ascii=False,indent=2))
    for code in ["8961","8960","7433","9639","9629","9621","3136"]:
        report["cuatm"].setdefault("code_hits",{})[code]={
           name:[{"sheet":s,**r} for s,entries in book.items() for r in entries if code in r["cells"]][:30]
           for name,book in [("archived",old_rows),("official",newer)]}
except Exception as e:report["cuatm"]["official_error"]=repr(e)
for id in ids:
    item={"relation_id":id,"attempts":[]}
    paths=[
        f"https://api.openstreetmap.org/api/0.6/relation/{id}/history",
        f"https://www.openstreetmap.org/api/0.6/relation/{id}/history",
    ]
    for url in paths:
        try:
            b,status,final=get(url);root=ET.fromstring(b)
            if root.tag!="osm":raise ValueError("not osm XML")
            versions=[{"version":x.get("version"),"timestamp":x.get("timestamp"),"changeset":x.get("changeset"),"tags":{t.get("k"):t.get("v") for t in x.findall("tag")},"members":[{"type":m.get("type"),"ref":m.get("ref"),"role":m.get("role")} for m in x.findall("member")]} for x in root.findall("relation")]
            if not versions:raise ValueError("no relation versions")
            (OUT/f"relation_{id}_history.xml").write_bytes(b)
            item.update({"success":True,"source":final,"sha256":sha(b),"bytes":len(b),"version_count":len(versions),"versions":versions})
            break
        except Exception as e:item["attempts"].append({"url":url,"error":repr(e)})
    if not item.get("success"):item["success"]=False
    report["osm_history"].append(item)
(OUT/"execution-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({"cuatm":report["cuatm"].get("comparison",report["cuatm"].get("official_error")),"osm":[{"id":v["relation_id"],"success":v["success"],"versions":v.get("version_count",0)} for v in report["osm_history"]]},ensure_ascii=False))
