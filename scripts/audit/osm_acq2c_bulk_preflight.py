"""OSM-ACQ.2c offline full-history bulk preflight, never source promotion.

No network fetches. The user supplies an authentic history .osh.pbf locally on a
sufficiently provisioned authorized machine. A digest only proves byte identity;
independent publication/provenance and full per-relation replay remain mandatory.
"""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import shutil
import subprocess
from urllib.parse import urlparse
from osm_acq2c_full_batch import (SOURCE_SHA256, PILOT_OBJECTS, PRIORITY,
                                  source_registry, plan_registry, sha)
ROOT=pathlib.Path(__file__).resolve().parents[2]
EPOCH="2026-10-20T20:23:47Z"
FIXED_SOURCE=ROOT/"work"/"osm-acq2c-bulk"/"original.osh.pbf"
FIXED_PROVENANCE=ROOT/"work"/"osm-acq2c-bulk"/"provenance.json"
OUTPUT=ROOT/"outputs"/"osm-acq2c-bulk-preflight"
APPROVED_HOSTS=frozenset({"planet.openstreetmap.org","planet.osm-hr.org"})
PILOT_ZIP_SHA256="8868e615925ee21ddd2d26272e91c53b5078da050b36205164e0e358f99f1ebe"
BATCH01_ZIP_SHA256="b13762100c9107bba0e08280a5c8efb6ebb5c546052e8d9effd4b94e929ec6ab"
BATCH02_ZIP_SHA256="b4aa2ef00237afa92b29e1785404a2b4901b8b81371f602db803598706a8c617"

def item_code(typ,id):
    if typ not in ("node","way","relation") or type(id) is not int or id<=0:
        raise ValueError("Bad immutable OSM identity")
    return {"node":"n","way":"w","relation":"r"}[typ]+str(id)

def plan():
    p=plan_registry(source_registry())
    if (p["initial_distinct"],p["unknown_distinct"],p["unknown_domain_rows"],
        p["total_unique_missing_objects"],p["remaining_missing_objects"])!=(391,242,244,2966,2958):
        raise ValueError("Cumulative verified cohort drift")
    if len(p["already_piloted"])!=8:
        raise ValueError("Prior pilot object lineage is incomplete")
    unknown_ids=set(p["relations"])
    if len(unknown_ids)!=242 or not set(PRIORITY)<=unknown_ids:
        raise ValueError("Priority or relation coverage drift")
    missing={(x["type"],x["id"]) for x in p["ordered"]}
    missing.update(PILOT_OBJECTS)
    if len(missing)!=2966:raise ValueError("Duplicate/missing direct object identities")
    request=sorted([item_code("relation",rid) for rid in unknown_ids] +
                   [item_code(typ,oid) for typ,oid in missing])
    if len(request)!=3208 or len(set(request))!=len(request):
        raise ValueError("Full-history ID requests not unique")
    return {"epoch":EPOCH,"source_gzip_sha256":SOURCE_SHA256,
       "unknown_relation_count":242, "direct_missing_unique_count":2966,
       "required_history_object_ids":request,
       "priority_relation_ids":list(PRIORITY),
       "prior_artifact_sha256":{"pilot":PILOT_ZIP_SHA256,
                                "batch01":BATCH01_ZIP_SHA256,
                                "batch02":BATCH02_ZIP_SHA256},
       "source_promoted":False, "overpass_equivalence_certified":False,
       "all_relations_adjudicated":False}

def evaluate_provenance(proof,bytes_count,actual_digest):
    if not isinstance(proof,dict): raise ValueError("Missing provenance record")
    uri=proof.get("publication_url","")
    parsed=urlparse(uri)
    if parsed.scheme!="https" or parsed.hostname not in APPROVED_HOSTS or not parsed.path.endswith(".osm.pbf"):
        raise ValueError("Unsupported provenance URL")
    expected=proof.get("source_sha256")
    if not isinstance(expected,str) or len(expected)!=64 or not all(c in "0123456789abcdef" for c in expected):
        raise ValueError("Missing published/independently verified SHA-256")
    if expected!=actual_digest:raise ValueError("Full original digest mismatch")
    if type(proof.get("source_bytes")) is not int or type(bytes_count) is not int or proof["source_bytes"]!=bytes_count or bytes_count<=0:
        raise ValueError("Original length mismatch")
    through=dt.datetime.fromisoformat(str(proof.get("history_through","")).replace("Z","+00:00"))
    if through.tzinfo is None or through.astimezone(dt.timezone.utc)<dt.datetime.fromisoformat(EPOCH.replace("Z","+00:00")):
        raise ValueError("History source predates frozen exact epoch")
    receipt=proof.get("independent_publication_receipt_sha256")
    if not isinstance(receipt,str) or len(receipt)!=64 or not all(c in "0123456789abcdef" for c in receipt):
        raise ValueError("Independent original publication receipt SHA-256 absent or malformed")
    return {"local_integrity":"PASS",
            "publisher_receipt_crosscheck":"REQUIRES_INDEPENDENT_HUMAN_OR_SIGNED_VALIDATION",
            "history_epoch_covered_as_declared":True,"source_qualified":False}

def stream_sha256(path):
    digest=hashlib.sha256();size=0
    with path.open("rb") as file:
        while chunk:=file.read(8*1024*1024):
            digest.update(chunk);size+=len(chunk)
    return size,digest.hexdigest()

def write_json(path,obj):
    path.write_bytes((json.dumps(obj,ensure_ascii=False,sort_keys=True,indent=2)+"\n").encode("utf8"))

def execute(do_process=False):
    if OUTPUT.exists():raise FileExistsError("Refuse to overwrite pinned evidence")
    OUTPUT.mkdir(parents=True)
    p=plan()
    ids="\n".join(p["required_history_object_ids"])+"\n"
    (OUTPUT/"requested-object-ids.txt").write_bytes(ids.encode("ascii"))
    write_json(OUTPUT/"plan.json",{k:v for k,v in p.items() if k!="required_history_object_ids"} |
              {"ids_sha256":sha(ids.encode("ascii")),
               "original_history_required":True,"snapshot_adjudicated":False})
    if not do_process:
        print("PREPARED_ONLY: 3208 explicit identities, 242 UNKNOWN; no bulk original loaded or assumed")
        return
    if not FIXED_SOURCE.is_file() or not FIXED_PROVENANCE.is_file():
        raise FileNotFoundError("Authentic full-history PBF plus independent provenance receipts required")
    provenance=json.loads(FIXED_PROVENANCE.read_text(encoding="utf8"))
    length,digest=stream_sha256(FIXED_SOURCE)
    receipt=evaluate_provenance(provenance,length,digest)
    write_json(OUTPUT/"source-integrity.json",{"source_sha256":digest,"source_bytes":length,**receipt})
    osmium=shutil.which("osmium")
    if not osmium:raise RuntimeError("osmium-tool is required on an authorized bulk-data host")
    history_out=OUTPUT/"selected-history.osh.pbf"
    epoch_out=OUTPUT/"selected-epoch.osm.pbf"
    # -H is critical: a history input must not be read as a current-only extract.
    subprocess.run([osmium,"getid","--with-history","--add-referenced",
        "--id-file",str(OUTPUT/"requested-object-ids.txt"),
        str(FIXED_SOURCE),"-o",str(history_out)],check=True)
    subprocess.run([osmium,"time-filter",str(history_out),EPOCH,
                    "-o",str(epoch_out)],check=True)
    manifests=[]
    for path in (history_out,epoch_out):
        size,sha256=stream_sha256(path)
        manifests.append({"name":path.name,"bytes":size,"sha256":sha256})
    write_json(OUTPUT/"derived-manifest.json",{"files":manifests,
        "no_source_promotion":True,"missing_history_detection":"NOT_YET_CERTIFIED",
        "topology_replay":"NOT_YET_EXECUTED",
        "overpass_area_equivalence":"NOT_YET_CERTIFIED"})
    print("LOCAL_EXTRACTION_FINISHED_BUT_UNQUALIFIED: validate missing versions, closure, topology, Overpass")

if __name__=="__main__":
    args=argparse.ArgumentParser()
    args.add_argument("--process-authenticated-full-history",action="store_true")
    execute(args.parse_args().process_authenticated_full_history)
