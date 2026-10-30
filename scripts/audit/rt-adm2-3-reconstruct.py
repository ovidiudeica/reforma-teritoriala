#!/usr/bin/env python3
"""RT-ADM.2.3: bounded, auditable OSM way/node historical reconstruction. No repository writes."""
import os,json,time,hashlib,urllib.request,datetime,xml.etree.ElementTree as ET,math
from pathlib import Path
O=Path("outputs/RT-ADM.2.3");O.mkdir(parents=True,exist_ok=True)
WAYS={"18967570":[1376179980],"18968043":[1376179909,1376180675],"12104636":[889101842]}
DATES={"18967570":["2025-04-09T17:48:35Z","2025-10-05T00:00:00Z","2026-01-31T14:33:41Z"],"18968043":["2025-04-09T17:48:40Z","2025-10-05T00:00:00Z","2026-02-01T22:27:39Z"],"12104636":["2020-12-28T16:51:17Z","2023-09-26T12:49:34Z","2025-10-05T00:00:00Z","2026-08-31T12:01:53Z"]}
cache={};errors=[];cap=int(os.environ.get("RT_ADM23_NODE_CAP","1200"))
def digest(b):return hashlib.sha256(b).hexdigest()
def fetch(kind,id):
 key=(kind,id)
 if key in cache:return cache[key]
 u=f"https://api.openstreetmap.org/api/0.6/{kind}/{id}/history"
 try:
  q=urllib.request.Request(u,headers={"User-Agent":"reforma-teritoriala-rt-adm2-3/1.0 (GitHub audit)","Accept":"application/xml"})
  with urllib.request.urlopen(q,timeout=25) as r: raw=r.read()
  root=ET.fromstring(raw)
  if root.tag!="osm":raise ValueError("Unexpected XML root")
  elems=root.findall(kind)
  if not elems:raise ValueError("Empty element history")
  parsed=[]
  for e in elems:
   data={"version":int(e.attrib["version"]),"timestamp":e.attrib["timestamp"],"visible":e.get("visible","true")!="false","changeset":e.get("changeset")}
   if kind=="way":data["nodes"]=[int(n.attrib["ref"]) for n in e.findall("nd")];data["tags"]={x.get("k"):x.get("v") for x in e.findall("tag")}
   if kind=="node":data["lat"]=float(e.get("lat")) if e.get("lat") else None;data["lon"]=float(e.get("lon")) if e.get("lon") else None
   parsed.append(data)
  cache[key]=sorted(parsed,key=lambda x:x["timestamp"])
  (O/f"{kind}_{id}_history.xml").write_bytes(raw)
  return cache[key]
 except Exception as ex:
  errors.append({"type":kind,"id":id,"url":u,"error":str(ex)});cache[key]=[];return []
def at(v,date):
 eligible=[x for x in v if x["timestamp"]<=date]
 return eligible[-1] if eligible else None
def shoelace(coords):
 if len(coords)<4 or coords[0]!=coords[-1]:return None
 lat0=math.radians(sum(p[1] for p in coords)/len(coords));scale_x=111320*math.cos(lat0);scale_y=110574
 return abs(sum((coords[i][0]*scale_x)*(coords[i+1][1]*scale_y)-(coords[i+1][0]*scale_x)*(coords[i][1]*scale_y) for i in range(len(coords)-1)))/2
for ids in WAYS.values():
 for id in ids:fetch("way",id)
unique_nodes=sorted({n for ids in WAYS.values() for id in ids for v in cache.get(("way",id),[]) for n in v.get("nodes",[])})
node_limit=len(unique_nodes)>cap
if not node_limit:
 for i,n in enumerate(unique_nodes):
  fetch("node",n)
  if i%25==0:print(f"nodes {i+1}/{len(unique_nodes)}",flush=True)
result={"schema":"rt-adm2-3-historical-reconstruction-v1","generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"policy":"READ_ONLY_NO_ACTUAL_NO_LEGAL_FOOTPRINT_CERTIFICATION","node_count":len(unique_nodes),"node_cap":cap,"node_cap_exceeded":node_limit,"failures":errors,"cases":[]}
for rid,ways in WAYS.items():
 case={"relation_id":rid,"way_ids":ways,"way_version_counts":{str(w):len(cache.get(("way",w),[])) for w in ways},"snapshots":[]}
 for date in DATES[rid]:
  snapshot={"time":date,"ways":[]}
  for w in ways:
   v=at(cache.get(("way",w),[]),date)
   entry={"way_id":w,"selected_version":v["version"] if v else None,"selected_way_timestamp":v["timestamp"] if v else None,"status":"NO_WAY_VERSION" if not v else "PENDING_NODES"}
   if v:
    coords=[];missing=[]
    for nid in v["nodes"]:
     node=at(cache.get(("node",nid),[]),date)
     if not node or not node["visible"] or node.get("lon") is None or node.get("lat") is None:missing.append(nid)
     else:coords.append([node["lon"],node["lat"]])
    entry.update({"node_refs":len(v["nodes"]),"missing_node_ids":missing,"coordinates_reconstructed":len(coords) if not missing else 0,"closed_ring":not missing and len(coords)>3 and coords[0]==coords[-1],"area_m2_approx":shoelace(coords) if not missing else None,"status":"COMPLETE_OSM_RING" if not missing and len(coords)>3 and coords[0]==coords[-1] else "INCOMPLETE"})
    if not missing and len(coords)>3:
     entry["geometry"]={"type":"Polygon" if entry["closed_ring"] else "LineString","coordinates":[coords] if entry["closed_ring"] else coords}
   snapshot["ways"].append(entry)
  case["snapshots"].append(snapshot)
 result["cases"].append(case)
(O/"reconstruction-register.json").write_text(json.dumps(result,ensure_ascii=False,indent=2))
(O/"primary-source-assessment.json").write_text(json.dumps({"official_primary":["docs/audits/rt-audit1-2/evidence/CUATM_25.xlsx","https://statistica.gov.md/ro/clasificatorul-unitatilor-administrativ-teritoriale-al-republicii-moldova-cuatm--12_62048.html"],"official_register_scope":"CUATM codes and parentage, not polygon boundaries","osm_scope":"time-versioned community contributed geometry, not authoritative legal boundaries","independent_official_polygon_available":False,"positive_legal_footprint_certificate":False,"decision":"NO_CHANGE_PENDING_PRIMARY_EVIDENCE"},ensure_ascii=False,indent=2))
print(json.dumps({"ways":{k:[len(cache.get(("way",w),[])) for w in v] for k,v in WAYS.items()},"node_count":len(unique_nodes),"errors":len(errors),"complete_snapshots":sum(x["status"]=="COMPLETE_OSM_RING" for c in result["cases"] for s in c["snapshots"] for x in s["ways"])},ensure_ascii=False),flush=True)
