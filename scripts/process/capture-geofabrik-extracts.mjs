import {downloadDatedExtract} from '../lib/geofabrik-acquisition.mjs';
// Explicit dated originals only. This command never writes source manifests.
const date=process.argv[2];if(!date)throw Error('Supply an explicit YYYYMMDD; no latest alias or inferred current timestamp');
for(const country of ['RO','MD'])console.log(JSON.stringify(await downloadDatedExtract({country,date,output:'outputs/geofabrik-extracts/'+date})));
