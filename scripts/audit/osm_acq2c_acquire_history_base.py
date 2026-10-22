"""Fixed official base acquisition; byte verification is NOT source qualification."""
import pathlib,json,hashlib,urllib.request,urllib.error,os,time,shutil,datetime,argparse,contextlib
URL='https://planet.openstreetmap.org/pbf/full-history/history-261019.osm.pbf'
TOTAL=163893678040
ETAG='"5d9fe0daa39fee0a74e78c83582be15a-9769"'
MD5='0587abc2f5a3a29a81ce3b067357933b'
ROOT=pathlib.Path(__file__).resolve().parents[2]/'work'/'osm-acq2c-bulk'

@contextlib.contextmanager
def exclusive_acquisition(root):
    root.mkdir(parents=True,exist_ok=True)
    lock=root/'history-261019-acquisition.lock'
    with lock.open('x',encoding='ascii') as f:f.write(str(os.getpid()))
    try:yield
    finally:lock.unlink()

def validate_range(status,headers,start,end):
    if status!=206 or headers.get('Content-Range')!=f'bytes {start}-{end}/{TOTAL}':raise ValueError('Not the requested complete immutable range')
    if headers.get('ETag')!=ETAG or int(headers.get('Content-Length','-1'))!=end-start+1:raise ValueError('Source version or length drift')

def acquire(resume=False):
    ROOT.mkdir(parents=True,exist_ok=True)
    part=ROOT/'history-261019.osm.pbf.partial';state=ROOT/'history-261019-acquisition.json';final=ROOT/'history-261019.osm.pbf'
    if final.exists():raise FileExistsError('Original already exists; do not replace')
    sha=hashlib.sha256();md5=hashlib.md5();offset=0
    ledger={'url':URL,'expected_bytes':TOTAL,'etag':ETAG,'published_md5':MD5,'base_epoch':'2026-10-19T00:00:04Z','target_epoch':'2026-10-20T20:23:47Z','source_qualified':False,'status':'ACQUIRING_INCOMPLETE','chunks':[],'pid':os.getpid()}
    def record():
        ledger['verified_downloaded_bytes']=offset;ledger['updated_at_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        tmp=state.with_suffix('.tmp');tmp.write_bytes((json.dumps(ledger,indent=2)+'\n').encode());os.replace(tmp,state)
    if resume:
        ledger=json.loads(state.read_bytes())
        if (ledger['url'],ledger['expected_bytes'],ledger['etag'])!=(URL,TOTAL,ETAG):raise ValueError('Resume source mismatch')
        with part.open('rb')as f:
            for chunk in ledger['chunks']:
                if chunk['offset']!=offset:raise ValueError('Noncontiguous resume checkpoint')
                raw=f.read(chunk['bytes'])
                if len(raw)!=chunk['bytes'] or hashlib.sha256(raw).hexdigest()!=chunk['sha256']:raise ValueError('Resume chunk corruption')
                sha.update(raw);md5.update(raw);offset+=len(raw)
            if f.read(1):raise ValueError('Uncommitted suffix retained; manual recovery required, never truncate silently')
        ledger['pid']=os.getpid();ledger['status']='ACQUIRING_INCOMPLETE'
    elif part.exists()or state.exists():raise FileExistsError('Prior evidence exists; explicit verified resume required')
    if shutil.disk_usage(ROOT).free<TOTAL-offset+10*1024**3:raise ValueError('Insufficient free disk plus 10GiB reserve')
    if not resume:part.touch(exist_ok=False)
    record()
    try:
        with part.open('ab')as output:
            while offset<TOTAL:
                end=min(offset+64*1024*1024,TOTAL)-1
                for attempt in range(4):
                    try:
                        req=urllib.request.Request(URL,headers={'Range':f'bytes={offset}-{end}','If-Match':ETAG,'User-Agent':'ReformaTeritoriala-authenticated-history-acquisition/1.0'})
                        with urllib.request.urlopen(req,timeout=120)as response:
                            validate_range(response.status,response.headers,offset,end);raw=response.read(end-offset+2)
                        if len(raw)!=end-offset+1:raise ValueError('Partial or oversized range')
                        break
                    except (urllib.error.URLError,TimeoutError)as error:
                        if isinstance(error,urllib.error.HTTPError)and error.code not in (408,429,500,502,503,504):raise
                        if attempt==3:raise
                        time.sleep(2**attempt)
                output.write(raw);output.flush();os.fsync(output.fileno())
                ledger['chunks'].append({'offset':offset,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
                sha.update(raw);md5.update(raw);offset+=len(raw);record()
        if offset!=TOTAL or md5.hexdigest()!=MD5:raise ValueError('Complete source MD5 or length mismatch')
        ledger.update(status='FULL_BASE_BYTES_VERIFIED_NOT_SOURCE_QUALIFIED',source_sha256=sha.hexdigest(),actual_md5=md5.hexdigest())
        part.rename(final);record()
    except BaseException as error:
        ledger.update(status='INTERRUPTED_INCOMPLETE',error=repr(error));record();raise

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--resume',action='store_true')
    parser.add_argument('--destination-directory',type=pathlib.Path,required=True)
    args=parser.parse_args();ROOT=args.destination_directory
    with exclusive_acquisition(ROOT):acquire(args.resume)
