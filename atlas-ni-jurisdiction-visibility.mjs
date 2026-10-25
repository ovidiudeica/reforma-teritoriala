// WEB-NI-U1.4: jurisdiction filters are independent lenses on one canonical
// geometry ID. They never alter a shared geometry's checked state.
export function jurisdictionAllowsCanonicalGeometry(entity,{isChecked,isSharedNiGeometry}){
 if(!entity||typeof entity.jurisdiction!=='string')return false;
 if(isChecked(entity.jurisdiction))return true;
 return entity.jurisdiction==='MD'&&Boolean(isSharedNiGeometry(entity.id))&&isChecked('NI');
}
