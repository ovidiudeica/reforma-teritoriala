#!/usr/bin/env node
import {validateRoStatisticalLayer} from './actual-ro-statistical-layer.mjs';
const report=await validateRoStatisticalLayer();
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
