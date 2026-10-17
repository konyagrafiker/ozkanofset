const adminRecordPageState={active:false,returnTab:'quotes',scrollY:0};
function adminRecordContainer(id){
 let page=document.getElementById('section-record-detail');if(!page){page=document.createElement('div');page.id='section-record-detail';page.className='hidden space-y-6';document.querySelector('main').append(page);}
 if(!adminRecordPageState.active){adminRecordPageState.returnTab=currentTab;adminRecordPageState.scrollY=window.scrollY||0;adminRecordPageState.active=true;}
 let panel=document.getElementById(id);if(!panel){panel=document.createElement('div');panel.id=id;panel.className='bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 w-full';page.append(panel);}
 const show=()=>{document.querySelectorAll('main > div').forEach(node=>node.classList.add('hidden'));page.classList.remove('hidden');for(const child of page.children)child.classList.toggle('hidden',child!==panel);panel.open=true;window.scrollTo(0,0);};
 panel.close=()=>{panel.open=false;returnToAdminRecordMenu();};panel.showModal=show;show();return panel;
}
function returnToAdminRecordMenu(message=''){
 const previous=adminRecordPageState.returnTab;const offset=adminRecordPageState.scrollY;adminRecordPageState.active=false;switchTab(previous);window.scrollTo(0,offset);
 if(message){let notice=document.getElementById('adminRecordSavedNotice');if(!notice){notice=document.createElement('p');notice.id='adminRecordSavedNotice';notice.setAttribute('role','status');notice.className='bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl p-4 mb-4';}notice.textContent=message;const section=document.getElementById('section-'+previous);if(section)section.prepend(notice);}
}
