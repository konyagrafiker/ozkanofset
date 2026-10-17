(()=>{
 let last='',timer,entry=true;
 function page(){const product=window.OzkanSeoRoutes?.parseProductPath(location.pathname);if(product)return {type:'product',key:product.id,title:window.currentDetailProduct?.title||product.id};const hash=location.hash;const params=new URLSearchParams(location.search);if(location.pathname==='/assets/legal.html')return {type:'legal',key:params.get('sayfa')||'iletisim',title:document.title};
 if(hash.startsWith('#urun=')){const key=hash.slice(6);return {type:'product',key,title:typeof currentDetailProduct!=='undefined'&&currentDetailProduct?(currentDetailProduct.title||currentDetailProduct.name||key):key};}
 if(hash.startsWith('#kargo'))return {type:'checkout',key:'checkout',title:'Sipariş ve teslimat'};
 if(hash.startsWith('#davetiye'))return {type:'invitation',key:'order',title:'Davetiye sipariş formu'};
 const portal=params.get('portal')||(['davetiye','promosyon','matbaa'].includes(location.pathname.slice(1))?location.pathname.slice(1):'genel');if(portal==='genel')return {type:'home',key:'home',title:'Ana sayfa'};
 const category=typeof currentFilter!=='undefined'?currentFilter.category:null;if(category&&category!=='all')return {type:'category',key:portal+'/'+category,title:category};
 return {type:'portal',key:portal,title:portal==='davetiye'?'Davetiye kataloğu':portal==='promosyon'?'Promosyon kataloğu':'Matbaa kataloğu'};}
 function send(){if(document.visibilityState==='hidden')return;const data=page(),id=data.type+':'+data.key;if(id===last)return;last=id;data.entry=entry;data.referrer=entry?document.referrer:'';entry=false;
 // Sadece sayfa ve kaynak: kimlik, IP, arama metni, sepet veya form bilgisi gönderilmez.
 try{if(data.referrer&&new URL(data.referrer).origin===location.origin)data.referrer='';else if(data.referrer)data.referrer=new URL(data.referrer).origin;}catch{data.referrer='';}
 fetch('/api/traffic/view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:true}).catch(()=>{});}
 function schedule(){clearTimeout(timer);timer=setTimeout(send,400);}
 for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const result=original.apply(this,args);schedule();return result;};}
 for(const event of ['hashchange','popstate','ozkan:pageview'])window.addEventListener(event,schedule);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
})();
