export function roOfficialComponentLocalities(records=[]){
 return records.filter(record=>Number(record?.level)===3);
}

export function uniqueLegalIdentityIds(values=[]){
 const ids=new Set();
 for(const value of values){
  if(value===null||value===undefined)continue;
  const id=String(value).trim();
  if(id)ids.add(id);
 }
 return ids;
}
