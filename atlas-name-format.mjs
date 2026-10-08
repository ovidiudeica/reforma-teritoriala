// Contract permanent de prezentare: normalizează exclusiv numele afișate.
// Nu modifica numele oficiale, identitățile, codurile ori snapshot-urile ACTUAL/P2.
const particles=new Set(['a','al','ale','ai','cel','cea','cei','cele','cu','de','din','dintre','dinspre','după','în','între','la','lui','ori','pe','pentru','și','sub','spre','sau']);
const acronyms=new Set(['UAT','UTA','OSM','NUTS','SIRUTA','CUATM','BNS']);
const romanNumeral=/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI)$/;

export function formatEntityName(value){
 if(value==null)return '';
 const source=String(value);
 // Etichetele nu interpretează HTML; inputul care nu este un nume rămâne exact cum este.
 if(/[<>]/.test(source))return source;
 let position=0;
 return source.replace(/\p{L}[\p{L}\p{M}\p{N}]*/gu,word=>{
  const first=position++===0,upper=word.toLocaleUpperCase('ro-RO'),lower=word.toLocaleLowerCase('ro-RO');
  // Cazurile mixte deja intenționate (ex. McDonald) sunt autoritative.
  if(word!==upper&&word!==lower)return word;
  // Codurile nu sunt nume și trebuie să își păstreze forma.
  if(/\p{N}/u.test(word)||acronyms.has(upper)||romanNumeral.test(word))return word;
  if(!first&&particles.has(lower))return lower;
  return lower.charAt(0).toLocaleUpperCase('ro-RO')+lower.slice(1);
 });
}
