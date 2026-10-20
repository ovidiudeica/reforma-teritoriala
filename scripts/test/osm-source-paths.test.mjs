import test from 'node:test';
import assert from 'node:assert/strict';
import {osmManifestPath,osmEvidencePath,osmSnapshotPath,officialOsmUrl} from '../lib/osm-source-paths.mjs';
test('OSM manifests accept only the two independent committed source contracts',()=>{
 for(const path of ['data/sources/osm-current.json','data/sources/osm-source-current.json'])assert.equal(osmManifestPath(path),path);
 for(const path of ['../../secrets','data/current/actual-release-manifest.json','/tmp/x','data/sources/../current/x','data\\sources\\osm-current.json'])assert.throws(()=>osmManifestPath(path),/Forbidden/);
});
test('OSM report paths cannot escape their fixed evidence destinations',()=>{
 assert.equal(osmEvidencePath('outputs/osm-fix2-per-id-forensics.json','forensics'),'outputs/osm-fix2-per-id-forensics.json');
 for(const kind of ['policy','continuity','transition','forensics'])assert.throws(()=>osmEvidencePath('../../x',kind),/Forbidden/);
 assert.throws(()=>osmEvidencePath('x','__proto__'),/Forbidden/);
});
test('snapshot staging refuses traversal and country/hash substitution',()=>{
 const e={semantic_sha256:'a'.repeat(64),snapshot_path:'data/sources/osm-snapshots/md-'+'a'.repeat(64)+'.json.gz'};
 assert.equal(osmSnapshotPath(e,'MD'),e.snapshot_path);
 for(const change of [{snapshot_path:'../../x'},{snapshot_path:e.snapshot_path.replace('md-','ro-')},{semantic_sha256:'../../x'}])assert.throws(()=>osmSnapshotPath({...e,...change},'MD'));
 assert.throws(()=>osmSnapshotPath(e,'../MD'));
});
test('official API evidence fetch rejects host, credentials, redirect and path injection',()=>{
 assert.equal(officialOsmUrl('https://api.openstreetmap.org/api/0.6/relation/18967907/history.json').hostname,'api.openstreetmap.org');
 for(const url of ['http://api.openstreetmap.org/api/0.6/relation/1.json','https://api.openstreetmap.org.evil.test/api/0.6/relation/1.json','https://evil.test/api/0.6/relation/1.json','https://api.openstreetmap.org@evil.test/api/0.6/relation/1.json','https://user@api.openstreetmap.org/api/0.6/relation/1.json','https://api.openstreetmap.org/api/0.6/relation/1.json?redirect=evil','https://api.openstreetmap.org/api/0.6/relation/../../user.json','https://api.openstreetmap.org/api/0.6/relation/1%2fother.json'])assert.throws(()=>officialOsmUrl(url),/Forbidden/);
});
