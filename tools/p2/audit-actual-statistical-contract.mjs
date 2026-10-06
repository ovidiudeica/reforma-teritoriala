#!/usr/bin/env node
import {validateActualStatisticalContract} from './actual-statistical-contract.mjs';

const report=await validateActualStatisticalContract();
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
