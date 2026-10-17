'use strict';
(async () => {
 const pages = window.OzkanLegalContent;
 const escape = value => String(value || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key = new URLSearchParams(location.search).get('sayfa') || 'iletisim';
 const page = Object.hasOwn(pages,key) ? pages[key] : null;
 const nav=document.getElementById('legalNav');
 for(const [id,[title]] of Object.entries(pages)){const link=document.createElement('a');link.href='?sayfa='+id;link.textContent=title;if(id===key)link.setAttribute('aria-current','page');nav.append(link);}
 if(!page){document.getElementById('legalContent').textContent='Sayfa bulunamadı.';return;}
 try {
 const res=await fetch('/api/settings',{cache:'no-store'});if(!res.ok)throw Error('Firma bilgileri alınamadı.');const s=await res.json();
 const fields=[['Ticari unvan',s.companyName],['Adres',s.address],['Telefon',s.phone],['E-posta',s.email],['Çalışma saatleri',s.workHours],['Vergi dairesi',s.taxOffice],['Vergi numarası',s.taxNumber],['MERSİS',s.mersisNumber],['Ticaret sicil no',s.tradeRegistryNumber]];
 const identity='<div class="identity">'+fields.filter(([,v])=>v).map(([name,value])=>'<p><strong>'+name+':</strong> '+escape(value)+'</p>').join('')+'</div>';
 document.title=page[0]+' | Özkan Ofset';
 document.getElementById('legalContent').innerHTML='<h1>'+page[0]+'</h1>'+identity+page[1]+'<a class="back" href="/">← Ana sayfaya dön</a>';
 }catch(error){document.getElementById('legalContent').textContent=error.message;}
})();
