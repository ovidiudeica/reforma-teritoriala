// P5.2: presentation-only labels for hierarchy rows. Never mutate official identity.
import {formatEntityName} from './atlas-name-format.mjs';

export function compactTreeName(node){
 const official=formatEntityName(node?.display_name??'');
 if(!official||(node?.display_name===node?.id&&/^osm-r\d+$/.test(node.id)))return 'Entitate fără nume';
 const plain=official.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro-RO');
 if(node?.parent_id==null && node?.jurisdiction==='MD' && plain==='republica moldova')return 'Moldova';
 // P9.0.9.3: MD NUTS-2 tree-only captions. Keep full official name in entity card, tooltip and canonical corpus.
 if(node?.jurisdiction==='MD' && node?.id==='stat-MD11' && /^partea de vest\s*\(/i.test(plain))return 'Partea de Vest';
 if(node?.jurisdiction==='MD' && node?.id==='stat-MD12' && /^partea de est\s*\(/i.test(plain))return 'Partea de Est';
 if(node?.jurisdiction==='MD'){
  if(/(?:unitatile administrativ.teritoriale din stanga nistrului|unitatile administrativ.teritoriale din stinga nistrului)/i.test(plain))return 'UATSN';
  if(/(?:unitatea teritoriala autonoma gagauzia|unitatea teritoriala autonoma gagauz|gagauzia)/i.test(plain))return 'UTAG';
 }
 if(node?.jurisdiction==='RO' && /^jude(?:ț|t)ul\s+/i.test(official))return official.replace(/^jude(?:ț|t)ul\s+/i,'');
 return official;
}


// U1.3 only affects the display caption, never the 2023 documentary name,
// source alias, parent, geometry or the statutory classifications.
// Context, accessible description and the informative card retain the node kind.
export function compactNistreniaDocumentaryName(node){
 const name=String(node?.display_name??'');
 if(node?.kind==='upper_city')return name.replace(/\s+[—–-]\s*oraș\s*$/iu,'');
 return name;
}

// The visible names stay compact; assistive technology retains the documentary
// role of homonymous NI cities and districts without changing legal identity.
export function nistreniaTreeContext(node){
 if(node?.jurisdiction!=='NI')return null;
 if(node.kind==='raion')return 'Raion · organizare documentată Nistrenia, 2023';
 if(node.kind==='upper_city')return 'Oraș enumerat distinct · organizare documentată Nistrenia, 2023';
 return null;
}
