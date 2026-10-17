(function(){
 function followAdminRow(event){
  const row=event.target.closest('[data-admin-row-kind]');if(!row)return;
  if(event.type==='keydown'){if(event.target!==row||!['Enter',' '].includes(event.key))return;}
  else if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  if(event.target.closest('button,a,input,select,textarea,label,summary,[contenteditable="true"]'))return;
  event.preventDefault();event.stopPropagation();
  const id=row.dataset.adminRowId;
  if(row.dataset.adminRowKind==='product')openSingleProductPricingPage(id);
  else if(row.dataset.adminRowKind==='quote')viewCustomQuote(id);
  else if(row.dataset.adminRowKind==='cost')openCostAnalysis(id);
  else if(row.dataset.adminRowKind==='customer')viewCustomerHistory(id);
 }
 document.addEventListener('click',followAdminRow,true);
 document.addEventListener('keydown',followAdminRow,true);
})();
