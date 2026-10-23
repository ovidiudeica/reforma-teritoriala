"""Bind an immutable historical test receipt to exact archived source bytes."""
import hashlib

def verify_sources(receipt,sources):
    expected=receipt.get('code_sha256')
    if not isinstance(expected,dict) or not expected or set(expected)!=set(sources):raise ValueError('Incomplete source binding')
    for name,digest in expected.items():
        if not isinstance(name,str) or '/' in name or '\\' in name or name in ('.','..'):raise ValueError('Unsafe source name')
        if not isinstance(sources[name],bytes) or hashlib.sha256(sources[name]).hexdigest()!=digest:raise ValueError('Receipt source digest differs: '+name)
    if receipt.get('source_qualified') is not False or receipt.get('unknown_adjudicated')!=0:raise ValueError('Source admission changed')
    return {'bound_sources':len(expected),'source_qualified':False}
