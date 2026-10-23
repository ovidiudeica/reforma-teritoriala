"""Bounded PBF framing index, not source qualification or an object decoder.

Schema: openstreetmap/OSM-binary osmpbf/fileformat.proto. Payloads are skipped
by their framed lengths; this does not establish global object sorting.
"""
import hashlib,struct,time

MAX_HEADER=65536
MAX_BLOB=33554432

def fields(data):
    def varint(pos):
        result=0
        for shift in range(0,70,7):
            if pos>=len(data):raise ValueError('Truncated protobuf varint')
            byte=data[pos];pos+=1
            if shift==63 and byte>1:raise ValueError('Overflowed protobuf varint')
            result|=(byte&127)<<shift
            if byte<128:return result,pos
        raise ValueError('Overflowed protobuf varint')
    pos=0;rows=[]
    while pos<len(data):
        key,pos=varint(pos);number,wire=key>>3,key&7
        if not 0<number<=536870911:raise ValueError('Invalid protobuf field')
        if wire==0:value,pos=varint(pos)
        elif wire==2:
            size,pos=varint(pos)
            if size>len(data)-pos:raise ValueError('Truncated protobuf field')
            value=data[pos:pos+size];pos+=size
        elif wire in (1,5):
            size=8 if wire==1 else 4
            if size>len(data)-pos:raise ValueError('Truncated fixed field')
            value=data[pos:pos+size];pos+=size
        else:raise ValueError('Unsupported protobuf wire type')
        rows.append((number,wire,value))
    return rows

def blob_header(raw):
    rows=fields(raw)
    kinds=[v for n,w,v in rows if n==1 and w==2]
    sizes=[v for n,w,v in rows if n==3 and w==0]
    if len(kinds)!=1 or kinds[0] not in (b'OSMHeader',b'OSMData'):raise ValueError('Missing, duplicate or unsupported block type')
    if len(sizes)!=1 or not 0<sizes[0]<=MAX_BLOB:raise ValueError('Missing, duplicate or oversized blob length')
    if any(n in (1,3) and w!=(2 if n==1 else 0) for n,w,v in rows):raise ValueError('Wrong framing field wire type')
    return kinds[0].decode('ascii'),sizes[0]

def scan(stream,length,max_blocks=None,seconds=None,clock=time.monotonic):
    if type(length) is not int or length<1:raise ValueError('Invalid source length')
    if max_blocks is not None and (type(max_blocks) is not int or max_blocks<1):raise ValueError('Invalid block budget')
    if seconds is not None and (isinstance(seconds,bool) or not isinstance(seconds,(int,float)) or not 0<seconds<=86400):raise ValueError('Invalid time budget')
    stream.seek(0,2)
    if stream.tell()!=length:raise ValueError('Source length differs from caller bound')
    start=clock();offset=0;rows=[];digest=hashlib.sha256();read=0;stop=None
    while offset<length:
        if max_blocks is not None and len(rows)>=max_blocks:stop='BLOCK_BUDGET';break
        if seconds is not None and clock()-start>=seconds:stop='TIME_BUDGET';break
        stream.seek(offset);prefix=stream.read(4);read+=len(prefix)
        if len(prefix)!=4:raise ValueError('Truncated framing prefix')
        size=struct.unpack('>I',prefix)[0]
        if not 0<size<=MAX_HEADER:raise ValueError('Invalid framing header length')
        raw=stream.read(size);read+=len(raw)
        if len(raw)!=size:raise ValueError('Truncated framing header')
        kind,blob_bytes=blob_header(raw)
        if (not rows and kind!='OSMHeader') or (rows and kind!='OSMData'):raise ValueError('Missing or repeated dataset header')
        end=offset+4+size+blob_bytes
        if end>length:raise ValueError('Blob extends beyond original')
        # Include location and framing bytes in the index digest; payloads remain
        # bound by the separately verified immutable original, not rehashed here.
        digest.update(struct.pack('>Q',offset)+prefix+raw)
        rows.append(dict(offset=offset,header_bytes=size,blob_bytes=blob_bytes,kind=kind,end=end))
        offset=end
    return dict(blocks=rows,complete=offset==length,stop_reason=stop,source_bytes=length,framing_bytes_read=read,next_offset=offset,framing_sha256=digest.hexdigest(),elapsed_seconds=clock()-start,source_qualified=False,payloads_validated=False,global_sorting_verified=False)
