import {readFile,mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),path='vendor/gis/jsts-2.12.1.min.js',raw=await readFile(new URL('node_modules/jsts/dist/jsts.min.js',root)),pkg=JSON.parse(await readFile(new URL('node_modules/jsts/package.json',root)));
if(pkg.version!=='2.12.1')throw Error('Versiune GIS neașteptată');
const manifest={contract:'p83-gis-vendor-v1',version:pkg.version,license:pkg.license,path,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),source:'npm jsts@2.12.1, ACTUAL offline dependency bundle',loading:'module Worker, on demand'};
const outputs=[[path,raw],['vendor/gis/manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')]];
for(const [p,b]of outputs){if(process.argv.includes('--check')){if(!b.equals(await readFile(new URL(p,root))))throw Error('Artefact GIS nereproductibil: '+p);}else{await mkdir(new URL('vendor/gis/',root),{recursive:true});await writeFile(new URL(p,root),b);}}
console.log(JSON.stringify({status:'PASS',mismatches:[],...manifest}));
