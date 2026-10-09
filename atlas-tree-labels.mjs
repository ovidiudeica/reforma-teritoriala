// P5.2: presentation-only labels for hierarchy rows. Never mutate official identity.
import {formatEntityName} from './atlas-name-format.mjs';

export function compactTreeName(node){
 const official=formatEntityName(node?.display_name??'');
 if(!official)return official;
 const plain=official.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro-RO');
 if(node?.parent_id==null && node?.jurisdiction==='MD' && plain==='republica moldova')return 'Moldova';
 if(node?.jurisdiction==='MD'){
  if(/(?:unitatile administrativ.teritoriale din stanga nistrului|unitatile administrativ.teritoriale din stinga nistrului)/i.test(plain))return 'UATSN';
  if(/(?:unitatea teritoriala autonoma gagauzia|unitatea teritoriala autonoma gagauz|gagauzia)/i.test(plain))return 'UTAG';
 }
 if(node?.jurisdiction==='RO' && /^jude(?:ț|t)ul\s+/i.test(official))return official.replace(/^jude(?:ț|t)ul\s+/i,'');
 return official;
}
