import assert from 'node:assert/strict';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const extractor=String.raw`import zipfile,pathlib,re,stat,sys
target=pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(sys.argv[1]) as archive:
 entries=archive.infolist()
 assert len(entries)<5000
 assert sum(e.file_size for e in entries)<1024*1024*1024
 for e in entries:
  name=e.filename.rstrip('/')
  assert not stat.S_ISLNK(e.external_attr>>16)
  assert re.fullmatch(r'(capture-attempt\.json|http|http/(receipts\.jsonl|[a-f0-9]{64}\.response\.gz)|RO|MD|(RO|MD)/(latest\.json|session-[0-9]+)|(RO|MD)/session-[0-9]+/(state-[a-f0-9]{64}\.json|[a-f0-9]{64}\.json\.gz))',name),name
  destination=(target/name).resolve()
  assert target in destination.parents
  if not e.is_dir():
   destination.parent.mkdir(parents=True,exist_ok=True)
   with archive.open(e) as source,destination.open('wb') as output:
    while True:
     block=source.read(1024*1024)
     if not block: break
     output.write(block)
`;
export function extractCaptureCheckpoint(zip,{directory='outputs/osm-capture-checkpoint',python='python3'}={}){
 assert.ok(path.resolve(directory).startsWith(path.resolve('outputs')+path.sep),'Checkpoint extraction must stay inside outputs');
 execFileSync(python,['-c',extractor,zip,directory],{stdio:['ignore','pipe','pipe']});
}
