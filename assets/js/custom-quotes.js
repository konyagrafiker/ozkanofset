(() => {
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async function(input,options={}) {
 if(input==='/api/quotes' && options.method==='POST'){
 const data=JSON.parse(options.body); data.security=await getQuoteSecurity();options={...options,body:JSON.stringify(data)};
 }return nativeFetch(input,options);
 };
 window.getQuoteSecurity=async function(){
 const requestedAt=Date.now();const res=await nativeFetch('/api/security-challenge');const challenge=await res.json();if(!res.ok)throw Error(challenge.error);
 let turnstileToken='';
 if(challenge.siteKey){
 if(!window.turnstile) await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=resolve;script.onerror=()=>reject(Error('Bot doğrulaması yüklenemedi.'));document.head.append(script);});
 turnstileToken=await new Promise((resolve,reject)=>{const dialog=document.createElement('dialog');dialog.className='rounded-2xl p-6';const container=document.createElement('div');dialog.append(container);document.body.append(dialog);dialog.showModal();const finish=()=>{window.turnstile.remove(widget);dialog.remove();};dialog.addEventListener('cancel',()=>{finish();reject(Error('Doğrulama iptal edildi.'));});const widget=window.turnstile.render(container,{sitekey:challenge.siteKey,action:'quote_submit',callback:token=>{finish();resolve(token);},'error-callback':()=>{finish();reject(Error('Bot doğrulaması başarısız.'));},'expired-callback':()=>{finish();reject(Error('Doğrulama süresi doldu.'));}});});
 }
 const answer=prompt('Gönderimi doğrulamak için sonucu yazınız: '+challenge.question);
 if(answer===null)throw Error('Gönderim iptal edildi.');await new Promise(resolve=>setTimeout(resolve,Math.max(0,1100-(Date.now()-requestedAt))));return {token:challenge.token,answer,turnstileToken,website:document.getElementById('quoteWebsite')?.value||''};
 };
 function showReceipt(receipt){
 let notice=document.getElementById('customQuoteReceivedNotice');
 if(!notice){notice=document.createElement('section');notice.id='customQuoteReceivedNotice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.tabIndex=-1;notice.style.cssText='position:fixed;top:110px;left:50%;transform:translateX(-50%);z-index:9999;width:calc(100% - 32px);max-width:640px;padding:24px;background:#ecfdf5;border:2px solid #10b981;border-radius:20px;box-shadow:0 18px 50px #0003;color:#064e3b;';
 const title=document.createElement('h2');title.textContent='✓ Teklif talebiniz alınmıştır';title.style.cssText='font-size:24px;font-weight:900;margin-bottom:10px;';
 const message=document.createElement('p');message.textContent='En kısa zamanda sizinle iletişime geçilecektir.';message.style.cssText='font-size:16px;line-height:1.6;';
 const code=document.createElement('p');code.id='customQuoteReceiptCode';code.style.cssText='margin-top:12px;font-size:12px;overflow-wrap:anywhere;';
 const close=document.createElement('button');close.type='button';close.textContent='Tamam';close.style.cssText='margin-top:16px;padding:10px 24px;background:#047857;color:white;border-radius:10px;font-weight:700;';close.onclick=()=>{notice.remove();document.querySelector('[onclick="openCustomQuote()"]')?.focus();};notice.append(title,message,code,close);document.body.append(notice);}
 document.getElementById('customQuoteReceiptCode').textContent='Talep kodunuz: '+receipt.id;notice.focus();
 }
 window.openCustomQuote=function(){
 document.getElementById('customQuoteReceivedNotice')?.remove();
 let modal=document.getElementById('customQuoteModal');if(modal){modal.showModal();return;}
 modal=document.createElement('dialog');modal.id='customQuoteModal';modal.className='rounded-2xl p-6 w-full max-w-xl shadow-2xl';
 modal.innerHTML=`<form id="customQuoteForm" class="space-y-3"><div class="flex justify-between"><h2 class="text-xl font-black">Özel Üretim İçin Teklif Al</h2><button type="button" onclick="document.getElementById('customQuoteModal').close()" aria-label="Kapat">✕</button></div><p class="text-sm text-slate-600">İstediğiniz matbaa ürününü, ölçüsünü, malzemesini ve baskı detaylarını yazın. Resim veya çiziminizi JPG, PNG ya da PDF olarak ekleyebilirsiniz.</p>
 <label class="block">Ad Soyad *<input name="customerName" required minlength="3" maxlength="100" class="block w-full border rounded-lg p-2"></label>
 <label class="block">Firma<input name="companyName" maxlength="200" class="block w-full border rounded-lg p-2"></label>
 <label class="block">Telefon *<input name="phone" type="tel" required minlength="10" maxlength="30" class="block w-full border rounded-lg p-2"></label>
 <label class="block">E-posta<input name="email" type="email" maxlength="200" class="block w-full border rounded-lg p-2"></label>
 <label class="block">Ürün numarası (varsa)<input name="productCode" maxlength="80" class="block w-full border rounded-lg p-2"></label>
 <label class="block">Adet *<input name="quantity" type="number" required min="1" max="10000000" class="block w-full border rounded-lg p-2"></label>
 <label class="block">Ürün ve baskı detayları *<textarea name="notes" required minlength="10" maxlength="5000" rows="4" class="block w-full border rounded-lg p-2" placeholder="Örn. 500 adet, 20×30 cm, kraft karton, tek renk logo baskısı"></textarea></label>
 <label class="block">Resim / Çizim Dosyası<input name="files" type="file" multiple accept=".jpg,.jpeg,.png,.pdf" class="block w-full text-sm mt-1"></label><p class="text-xs text-slate-500">İsteğe bağlı; en fazla 3 dosya, dosya başına 5 MB. Çizimlerinizi PDF olarak dışa aktarabilirsiniz.</p>
 <div style="position:absolute;left:-10000px" aria-hidden="true"><input id="quoteWebsite" tabindex="-1" autocomplete="off"></div>
 <p class="text-xs text-slate-600">İletişim ve dosya bilgileriniz teklifinizin hazırlanması için işlenir. Ayrıntılar: <a href="/assets/legal.html?sayfa=kvkk" target="_blank" rel="noopener" class="underline text-blue-700">KVKK Aydınlatma Metni</a>.</p>
 <p id="customQuoteResult" role="status" class="text-sm"></p><button id="customQuoteSend" type="submit" class="bg-primary text-white rounded-xl px-5 py-3 font-bold">Teklif Talebini Gönder</button></form>`;
 document.body.append(modal);modal.showModal();
 modal.querySelector('form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.target,button=document.getElementById('customQuoteSend'),result=document.getElementById('customQuoteResult');if(button.disabled)return;button.disabled=true;
 try{
 const files=[...form.elements.files.files];if(files.length>3||files.some(f=>f.size>5*1024*1024))throw Error('En fazla 3 dosya; her dosya en fazla 5 MB olabilir.');
 const data=Object.fromEntries(new FormData(form));delete data.files;data.files=[];
 for(const file of files){const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Dosya okunamadı.'));reader.readAsDataURL(file);});data.files.push({name:file.name,data:base64});}
 data.security=await getQuoteSecurity();result.textContent='Talebiniz gönderiliyor; eklenen dosyalar taranıyor…';
 const res=await nativeFetch('/api/custom-quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const json=await res.json();
 if(!res.ok||!json.success||!json.quote?.id)throw Error(json.error||'Talep kaydedilemedi.');
 form.reset();modal.close();showReceipt(json.quote);
 }catch(error){result.textContent=error.message;}finally{button.disabled=false;}
 });
 };
})();
