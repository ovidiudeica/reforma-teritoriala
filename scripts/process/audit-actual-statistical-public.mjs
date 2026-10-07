#!/usr/bin/env node
import {validateStatisticalPublicActivation} from '../lib/actual-statistical-public.mjs';
const report=await validateStatisticalPublicActivation();
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
