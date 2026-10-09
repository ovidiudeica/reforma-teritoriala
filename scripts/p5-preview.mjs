import {fileURLToPath} from 'node:url';
import {staticServer} from './test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const server=await staticServer(root);
console.log('P5.0 navigation preview: '+server.url+'/prototypes/p5-navigation/');
for(const signal of ['SIGINT','SIGTERM']){
 process.once(signal,()=>server.close().then(()=>process.exit(0)));
}
