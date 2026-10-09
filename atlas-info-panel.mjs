// P6.1 — supplementary information is an on-demand modal, not part of the entity navigator.
export function createAtlasInfoPanel({document,onOpen=()=>{},getReturnFocus=()=>document.getElementById('info-toggle')}={}){
 const trigger=document.getElementById('info-toggle');
 const dialog=document.getElementById('atlas-info-dialog');
 const closeButton=document.getElementById('info-close');
 if(!trigger||!dialog||!closeButton)throw new Error('Incomplete P6.1 information panel');
 function open(){
  if(dialog.open)return;
  onOpen();
  dialog.showModal();
  closeButton.focus();
 }
 function close(){if(dialog.open)dialog.close();}
 trigger.addEventListener('click',open);
 closeButton.addEventListener('click',close);
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const bounds=dialog.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();
 });
 dialog.addEventListener('close',()=>getReturnFocus()?.focus?.());
 return {open,close,get isOpen(){return dialog.open;}};
}
