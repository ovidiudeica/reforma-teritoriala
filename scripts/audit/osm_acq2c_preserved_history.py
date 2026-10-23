"""Read-only verification of already captured official history/current originals."""
import pathlib,hashlib,email.utils,xml.etree.ElementTree as ET,json,importlib.util,sys
from osm_acq2c_selected_epoch_core import moment

def read_receipt(receipt,directories,kind,oid,suffix,epoch):
    name=receipt.get('file','')
    if not isinstance(name,str) or not name or name in ('.','..') or any(c in name for c in ('/','\\',':','\0')):
        raise ValueError('Unsafe original basename')
    url='https://api.openstreetmap.org/api/0.6/'+kind+'/'+str(oid)+('/history' if suffix=='history' else '')
    if receipt.get('status')!=200 or receipt.get('url')!=url or receipt.get('final_url')!=url:
        raise ValueError('Original status/authority mismatch')
    headers={k.lower():v for k,v in receipt.get('headers',{}).items()}
    try:observed=email.utils.parsedate_to_datetime(headers['date'])
    except (KeyError,TypeError,ValueError) as error:raise ValueError('Missing observation date') from error
    if observed.tzinfo is None or observed<moment(epoch):raise ValueError('Observation before frozen epoch')
    if not headers.get('content-type','').lower().startswith(('application/xml','text/xml')):
        raise ValueError('Original MIME mismatch')
    candidates=[pathlib.Path(d)/name for d in directories];path=next((p for p in candidates if p.is_file()),None)
    if path is None:raise ValueError('Original missing')
    raw=path.read_bytes()
    if len(raw)!=receipt.get('bytes') or hashlib.sha256(raw).hexdigest()!=receipt.get('sha256'):
        raise ValueError('Original length/digest mismatch')
    root=ET.fromstring(raw)
    if root.tag!='osm' or root.get('version')!='0.6':raise ValueError('Wrong/placeholder original')
    elements=root.findall(kind)
    if not elements or any(n.get('id')!=str(oid) for n in elements):raise ValueError('Mixed/missing original identity')
    if suffix=='current' and len(elements)!=1:raise ValueError('Ambiguous current observation')
    return elements

def recover_row(row,directories,kind,validator,epoch):
    oid=row['object']['id']
    history=read_receipt(row['history_receipt'],directories,kind,oid,'history',epoch)
    current=read_receipt(row['current_receipt'],directories,kind,oid,'current',epoch)
    proof=validator(history,current,epoch)
    if proof['object']!=row['object']:raise ValueError('Captured/derived object mismatch')
    return proof

def load_preserved(node_dir,way_dir,epoch):
    from osm_acq2c_selected_epoch_replay import verify_manifest
    from osm_acq2c_frontier import normalize_regional
    node_dir,way_dir=pathlib.Path(node_dir),pathlib.Path(way_dir)
    for folder in (node_dir,way_dir):verify_manifest(folder)
    validator=load_validator(way_dir)
    objects={};proofs={};validated={};duplicates=0;unused=[]
    batches=[(node_dir,'capture.json','node'),(node_dir,'capture-batch2.json','node'),
             (way_dir,'capture.json','way'),(way_dir,'capture-waynodes.json','node')]
    for folder,name,kind in batches:
        capture=json.loads((folder/name).read_bytes())
        for row in capture['rows']:
            if row.get('verdict',row.get('status'))!='HISTORICAL_VERSION_PROVEN':
                unused.append(dict(batch=name,kind=kind,status=row.get('verdict',row.get('status'))));continue
            key=kind,row['object']['id'];pair=key+(row['history_receipt']['sha256'],row['current_receipt']['sha256'])
            if pair not in validated:
                fn=validator.validate_history if kind=='node' else validator.validate_way_history
                validated[pair]=recover_row(row,[folder,node_dir,way_dir],kind,fn,epoch)
            proof=validated[pair];obj=proof['object']
            if key in objects:
                if normalize_regional(objects[key],epoch)!=normalize_regional(obj,epoch):raise ValueError('Conflicting preserved historical object')
                duplicates+=1
            else:objects[key]=obj
            proofs[key]=dict(type=kind,id=key[1],version=obj['version'],timestamp=obj['timestamp'],effective_from=proof['effective_from'],effective_until=proof['effective_until'],history_sha256=row['history_receipt']['sha256'],current_sha256=row['current_receipt']['sha256'],source_directory=str(folder),capture_file=name)
    return list(objects.values()),dict(proofs=list(proofs.values()),distinct_objects=len(objects),duplicate_observations=duplicates,unused_nonproof_rows=unused,source_qualified=False)


def load_validator(way_dir):
    """Load manifest-verified historical siblings with normal GIS dependencies."""
    way_dir=pathlib.Path(way_dir).resolve()
    names=('acq2b_exact','acq2a_audit');previous={n:sys.modules.get(n) for n in names}
    for name,module in previous.items():
        if module is not None:
            origin=getattr(module,'__file__',None)
            if not origin or hashlib.sha256(pathlib.Path(origin).read_bytes()).digest()!=hashlib.sha256((way_dir/(name+'.py')).read_bytes()).digest():
                raise ValueError('Conflicting cached historical module')
    old_path=sys.path[:]
    try:
        sys.path.insert(0,str(way_dir))
        spec=importlib.util.spec_from_file_location('preserved_way_history_validator',way_dir/'acq2b_history_validation.py')
        validator=importlib.util.module_from_spec(spec);spec.loader.exec_module(validator)
        return validator
    finally:
        sys.path[:]=old_path
        for name,module in previous.items():
            if module is None:sys.modules.pop(name,None)
