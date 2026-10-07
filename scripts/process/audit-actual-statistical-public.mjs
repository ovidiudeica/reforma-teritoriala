#!/usr/bin/env node
import {validateActivatedStatisticalPublic} from '../lib/actual-statistical-public.mjs';
const report=await validateActivatedStatisticalPublic();
console.log(JSON.stringify(report,null,2));
if(report.status==='FAIL')process.exit(1);
