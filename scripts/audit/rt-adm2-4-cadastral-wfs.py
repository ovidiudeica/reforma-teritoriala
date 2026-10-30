#!/usr/bin/env python3
"""Read-only discovery and archival download of IPCBI WFS metadata and eligible official feature layers."""
import urllib.request,urllib.parse,xml.etree.ElementTree as ET,json,hashlib,pathlib,datetime
out=pathlib.Path("outputs/RT-ADM.2.4");out.mkdir(parents=True,exist_ok=True)
base="https://map.cadastru.md/geoserver/ows"
def get(q):
 u=base+"?"+urllib.parse.urlencode(q);req=urllib.request.Request(u,headers={"User-Agent":"reforma-teritoriala-evidence-audit/1.0","Accept":"application/xml,application/json,*/*"})
 with urllib.request.urlopen(req,timeout=35) as r:return r.read(),r.geturl(),r.headers.get("Content-Type")
result={"timestamp_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"status":"UNVERIFIED","candidate_layers":[],"downloads":[],"errors":[],"official_boundary_comparison":"NOT_AUTHORIZED_UNLESS_DATED_VECTOR_AND_OBJECT_MATCH"}
try:
 data,url,content_type=get({"service":"WFS","version":"2.0.0","request":"GetCapabilities"})
 (out/"wfs-capabilities.xml").write_bytes(data)
 root=ET.fromstring(data)
 names=[e.text for e in root.iter() if e.tag.endswith("Name") and e.text]
 layers=sorted(set(n for n in names if ":" in n))
 result["capabilities"]={"url":url,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),"layer_count":len(layers)}
 terms=["hotar","comun","localit","uat","administr","pomic","sector","boundary","limit"]
 result["candidate_layers"]=[n for n in layers if any(w in n.lower() for w in terms)]
 for name in result["candidate_layers"][:12]:
  try:
   b,u,ct=get({"service":"WFS","version":"2.0.0","request":"GetFeature","typeNames":name,"outputFormat":"application/json","count":20})
   target=out/("candidate_"+str(len(result["downloads"]))+".json");target.write_bytes(b)
   result["downloads"].append({"layer":name,"url":u,"sha256":hashlib.sha256(b).hexdigest(),"bytes":len(b),"content_type":ct,"path":str(target)})
  except Exception as e:result["errors"].append({"layer":name,"error":str(e)})
 result["status"]="CAPABILITIES_RETRIEVED" if not result["downloads"] else "CANDIDATE_FEATURES_RETRIEVED_UNCERTIFIED"
except Exception as e:result["errors"].append({"phase":"capabilities","error":str(e)});result["status"]="ACCESS_FAILED"
(out/"evidence-register.json").write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({"status":result["status"],"candidate_layers":result["candidate_layers"],"downloads":len(result["downloads"]),"errors":result["errors"]},ensure_ascii=False),flush=True)
