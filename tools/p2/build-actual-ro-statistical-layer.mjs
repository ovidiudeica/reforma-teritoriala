#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {buildRoStatisticalLayer,RO_LAYER_PATH} from './actual-ro-statistical-layer.mjs';
const layer=await buildRoStatisticalLayer();
await mkdir('data/current',{recursive:true});
await writeFile(RO_LAYER_PATH,JSON.stringify(layer,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',output:RO_LAYER_PATH,counts:layer.counts,fingerprint:layer.layer_fingerprint_sha256},null,2));
