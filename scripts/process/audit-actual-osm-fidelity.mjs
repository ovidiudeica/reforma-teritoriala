#!/usr/bin/env node
import {auditActualOsmFidelity} from '../lib/actual-osm-fidelity.mjs';
const report=await auditActualOsmFidelity();console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
