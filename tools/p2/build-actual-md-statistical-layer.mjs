#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {buildMdStatisticalLayer,MD_LAYER_PATH} from './actual-md-statistical-layer.mjs';
const layer=await buildMdStatisticalLayer();
await mkdir(dirname(MD_LAYER_PATH),{recursive:true});
await writeFile(MD_LAYER_PATH,JSON.stringify(layer,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',output:MD_LAYER_PATH,counts:layer.counts,fingerprint:layer.layer_fingerprint_sha256},null,2));
