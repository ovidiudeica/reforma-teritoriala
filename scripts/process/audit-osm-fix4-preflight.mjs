#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assessFix4,changesetElement} from '../lib/osm-fix4-preflight.mjs';
const root=new URL('../../docs/osm-fix4/',import.meta.url);
const input=JSON.parse(await readFile(new URL('current-observations.json',root)));
const targets=[{relation:18967493,relation_version:6,way:1376179876,way_version:8,index:457,from:12318728194,to:12318728593},{relation:18968082,relation_version:7,way:1376180731,way_version:6,index:227,from:11649857778,to:8265822008}];
const report=assessFix4(input.rows,targets);
const metadata=JSON.parse(await readFile(new URL('changesets.json',root)));
report.changeset_metadata=metadata.records.map(r=>changesetElement(r.payload,r.payload.changeset.id));
report.evidence_sha256={};
for(const name of ['current-observations.json','changesets.json','history-reuse.json','additional-way-histories.json','intent-review.json','discussion-review.json'])report.evidence_sha256[name]=createHash('sha256').update(await readFile(new URL(name,root))).digest('hex');
await writeFile(new URL('preflight.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({inverse:report.INVERSE_REFERENCES_VALIDATED,simulation:report.CONDITIONAL_SIMULATION_PASS,before:report.before.map(x=>[x.id,x.geometry_valid,x.error]),after:report.after.map(x=>[x.id,x.geometry_valid,x.error]),mapper_intent:false,publication:false}));
