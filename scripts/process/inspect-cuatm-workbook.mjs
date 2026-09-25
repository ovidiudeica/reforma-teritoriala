#!/usr/bin/env node
import * as XLSX from 'xlsx';
const URL=process.env.CUATM_URL||'https://statistica.gov.md/files/files/Clasificatoare/CUATM_25.xlsx';
const r=await fetch(URL,{headers:{'user-agent':'reforma-teritoriala-cuatm-schema/1.0'}});
if(!r.ok)throw new Error('HTTP '+r.status);
const buf=Buffer.from(await r.arrayBuffer());
const wb=XLSX.read(buf,{type:'buffer',cellFormula:true,cellStyles:true});
const report={source_url:URL,bytes:buf.length,sheet_names:wb.SheetNames,sheets:[]};
for(const name of wb.SheetNames){
 const ws=wb.Sheets[name];
 const ref=ws['!ref']||null;
 const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:false,blankrows:false});
 let firstNonEmpty=matrix.findIndex(row=>(row||[]).some(v=>String(v??'').trim()));
 if(firstNonEmpty<0)firstNonEmpty=0;
 const sample=[];
 for(let i=firstNonEmpty;i<Math.min(matrix.length,firstNonEmpty+20);i++) sample.push({row:i+1,cells:(matrix[i]||[]).map((v,j)=>({col:XLSX.utils.encode_col(j),value:v}))});
 report.sheets.push({name,ref,row_count:matrix.length,first_nonempty_row:firstNonEmpty+1,merges:(ws['!merges']||[]).map(m=>XLSX.utils.encode_range(m)),sample});
}
console.log(JSON.stringify(report,null,2));
