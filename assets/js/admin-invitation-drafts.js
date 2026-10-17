(()=>{
 const $=id=>document.getElementById(id);let records=[];
 function draw(){
  const query=$('search').value.trim().toLocaleLowerCase('tr'),filter=$('filter').value;$('records').replaceChildren();
  const rows=records.filter(r=>(filter==='all'||(filter==='draft'?r.status==='Taslak':r.status!=='Taslak'))&&[r.id,r.customer?.name,r.customer?.phone].join(' ').toLocaleLowerCase('tr').includes(query));
  for(const r of rows){const card=document.createElement('article');card.style.cssText='background:white;border:1px solid #dce1d7;padding:18px;margin:16px 0;border-radius:12px;display:flex;gap:20px;flex-wrap:wrap';
   const img=document.createElement('img');img.src='/api/admin/invitation-drafts/'+encodeURIComponent(r.id)+'/preview';img.alt='Kaydedilen önizleme';img.style.cssText='width:100px;height:140px;object-fit:contain';card.append(img);
   const info=document.createElement('div');const title=document.createElement('h2');title.textContent=r.id+' · '+r.status;const details=document.createElement('p');details.textContent=(r.customer?r.customer.name+' · '+r.customer.phone:'İndirme / kayıt taslağı')+' · '+r.template+' · Sürüm '+r.version;const date=document.createElement('p');date.textContent=new Date(r.updatedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});const note=document.createElement('p');note.textContent=r.customer?.note||'';
   const edit=document.createElement('a');edit.className='primary';edit.style.cssText='display:inline-block;padding:10px;border-radius:6px;margin-right:10px';edit.textContent='Düzenlenebilir taslağı aç';edit.href='/assets/davetiye-editor.html?template='+encodeURIComponent(r.template)+'&staff=1&draft='+encodeURIComponent(r.id);
   const json=document.createElement('button');json.textContent='Tasarım verisini indir';json.onclick=async()=>{try{const response=await fetch('/api/admin/invitation-drafts/'+encodeURIComponent(r.id));if(!response.ok)throw Error();const data=await response.json();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=r.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{$('message').textContent='Tasarım verisi indirilemedi.';}};
   info.append(title,details,date,note,edit,json);card.append(info);$('records').append(card);
  }$('message').textContent=rows.length+' kayıt gösteriliyor.';
 }
 async function load(){try{const response=await fetch('/api/admin/invitation-drafts');if(!response.ok)throw Error(response.status===401?'Yönetici girişi gerekli.':'Taslaklara erişilemedi.');records=(await response.json()).drafts;draw();}catch(error){$('message').textContent=error.message;}}
 $('search').oninput=draw;$('filter').onchange=draw;$('refresh').onclick=load;load();
})();
