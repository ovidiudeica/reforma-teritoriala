#!/usr/bin/env node
import {validateMdStatisticalLayer} from './actual-md-statistical-layer.mjs';
const report=await validateMdStatisticalLayer();
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
