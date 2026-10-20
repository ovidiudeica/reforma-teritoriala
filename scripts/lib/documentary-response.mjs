export function classifyDocumentResponse(status,type,bytes,{expectBinary=false}={}){
 if(status<200||status>=300)return {evidence_status:'BLOCKED_ACCESS',binary:false};
 const signature=bytes.subarray(0,8).toString('hex');
 const binary=bytes.subarray(0,4).toString()==='%PDF'||bytes.subarray(0,2).toString()==='PK'||signature==='d0cf11e0a1b11ae1';
 if(expectBinary||/pdf|msword|officedocument/.test(type))return {evidence_status:binary?'RETRIEVED_NOT_LEGAL_CERTIFICATION':'BLOCKED_CONTENT',binary};
 const html=bytes.toString('utf8');
 return {evidence_status:/<(?:!doctype|html|body)\b/i.test(html)&&!/^\s*ANTIDDOS\s*$/.test(html)?'RETRIEVED_NOT_LEGAL_CERTIFICATION':'BLOCKED_CONTENT',binary:false};
}
