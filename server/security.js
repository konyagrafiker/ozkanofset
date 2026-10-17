const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isAdminPage } = require('./admin-route');
const {execFile} = require('child_process');
const runtime=require('./runtime');
const limits = new Map(), challenges = new Map();
function reply(res, code, data) { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); }
function rate(req, res, key, max) {
 const now = Date.now(); for (const [k,v] of limits) if (v.until < now) limits.delete(k);
 const id = key + ':' + (runtime.clientAddress(req));
 const v = limits.get(id) || {count:0,until:now+600000}; limits.set(id,v);
 if (++v.count > max) { res.setHeader('Retry-After','600'); reply(res,429,{error:'Çok fazla işlem yapıldı. Lütfen daha sonra tekrar deneyiniz.'}); return false; } return true;
}
function authorized(req) { return !!require('./users').authenticate(req,path.join(__dirname,'..')); }
function body(req, res, max, callback) {
 let chunks=[], size=0, rejected=false;
 req.on('data',chunk=>{size+=Buffer.byteLength(chunk); if(size>max){if(!rejected) reply(res,413,{error:'Dosya veya form boyutu sınırı aşıldı.'}); rejected=true; chunks=[];} else if(!rejected) chunks.push(Buffer.from(chunk));});
 req.on('end',async()=>{if(rejected)return;try{await callback(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){if(!res.writableEnded)reply(res,400,{error:e.message});}});
}
async function verify(req, data) {
 const proof = data.security || {}; const c = challenges.get(proof.token); challenges.delete(proof.token);
 if (!c || c.ip !== runtime.clientAddress(req) || c.expires < Date.now() || Date.now()-c.created < 1000 || String(proof.answer)!==String(c.answer) || proof.website) throw Error('Güvenlik doğrulaması başarısız. Lütfen tekrar deneyiniz.');
 if(runtime.production() && !process.env.TURNSTILE_SECRET_KEY) throw Error('Bot doğrulama hizmeti yapılandırılmadı.');
 if(process.env.TURNSTILE_SECRET_KEY){
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:proof.turnstileToken||'',remoteip:runtime.clientAddress(req)}),signal:AbortSignal.timeout(10000)});
 const result=await response.json();if(!response.ok || !result.success || result.action!=='quote_submit' || result.hostname!==process.env.TURNSTILE_HOSTNAME)throw Error('Bot doğrulaması başarısız. Lütfen tekrar deneyiniz.');
 }
}
function clean(value, max=2000) { if(typeof value !== 'string' || value.length > max) throw Error('Form alanlarını kontrol ediniz.'); return value.trim(); }
async function scan(file) {
 let scanner=process.env.ANTIVIRUS_SCANNER;
 if(!scanner && process.platform==='win32') {
 const platform=path.join(process.env.ProgramData||'C:/ProgramData','Microsoft','Windows Defender','Platform');
 if(fs.existsSync(platform)) {const versions=fs.readdirSync(platform).sort().reverse();for(const version of versions){const candidate=path.join(platform,version,'MpCmdRun.exe');if(fs.existsSync(candidate)){scanner=candidate;break;}}}
 }
 const args=scanner && path.basename(scanner).toLowerCase()==='mpcmdrun.exe'?['-Scan','-ScanType','3','-File',file,'-DisableRemediation']:['--no-summary',file];
 if(!scanner) throw Error('Dosya tarama hizmeti henüz yapılandırılmadı. Dosya eklemeden talebinizi gönderebilirsiniz.');
 await new Promise((resolve,reject)=>execFile(scanner,args,{timeout:60000,windowsHide:true},error=>error?reject(Error('Dosya güvenli bulunmadı veya tarama tamamlanamadı.')):resolve()));
 if(!fs.existsSync(file)) throw Error('Dosya güvenli bulunmadı.');
}
function middleware(req,res,pathname,root) {
 const write = !['GET','HEAD','OPTIONS'].includes(req.method);
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 if(runtime.production()){
  const canonical=new URL(process.env.SITE_URL);const hosts=[canonical.hostname,...String(process.env.ALLOWED_HOSTS||'').split(',').map(x=>x.trim()).filter(Boolean)];
  let host;try{host=new URL('http://'+req.headers.host).hostname;}catch{reply(res,400,{error:'Geçersiz sunucu adresi.'});return true;}
  if(!hosts.includes(host)){reply(res,421,{error:'Sunucu adresi eşleşmiyor.'});return true;}
  if(!runtime.secure(req)){if(write||req.headers.authorization){reply(res,426,{error:'HTTPS bağlantısı gerekli.'});return true;}res.writeHead(308,{Location:canonical.origin+req.url});res.end();return true;}
  res.setHeader('Strict-Transport-Security','max-age=31536000');
 }
 if(write&&req.headers?.['sec-fetch-site']==='cross-site'){reply(res,403,{error:'İstek kaynağı geçersiz.'});return true;}

 if(write && req.headers?.origin && req.headers.origin !== 'http://'+req.headers.host && req.headers.origin !== 'https://'+req.headers.host){reply(res,403,{error:'İstek kaynağı geçersiz.'});return true;}
 const publicInvitationDraft=['/api/invitation-drafts','/api/invitation-drafts/submit'].includes(pathname)&&req.method==='POST';
 const admin = pathname.startsWith('/api/admin/') || ['/api/stats','/api/ientegre/settings','/api/my-ip','/api/media'].includes(pathname) || /[?&](?:admin|includeHidden)=/.test(req.url) || isAdminPage(pathname) || pathname.startsWith('/admin') || pathname.startsWith('/api/quote-files/') || (pathname.startsWith('/api/quotes') && !(pathname==='/api/quotes' && req.method==='POST')) || (pathname.startsWith('/api/') && write && !publicInvitationDraft && !['/api/quotes','/api/custom-quotes','/api/traffic/view'].includes(pathname));
 if(admin){
  res.setHeader('Cache-Control','no-store');
  const blocked=limits.get('admin-login:'+runtime.clientAddress(req));
  if(blocked&&blocked.until>Date.now()&&blocked.count>=15){res.setHeader('Retry-After',String(Math.ceil((blocked.until-Date.now())/1000)));reply(res,429,{error:'Çok fazla giriş denemesi. Daha sonra tekrar deneyiniz.'});return true;}
  req.user=require('./users').authenticate(req,root);
 }
 if(admin && !req.user){if(!rate(req,res,'admin-login',15))return true;res.setHeader('WWW-Authenticate','Basic realm="Ozkan Ofset Admin", charset="UTF-8"');reply(res,401,{error:'Yönetici girişi gerekli.'});return true;}
 if(admin){const users=require('./users');if(!users.allowed(req.user,users.requirement(pathname,req.method,req,root),pathname,root)){reply(res,403,{error:'Bu işlem için yetkiniz yok.'});return true;}if(users.handle(req,res,pathname,root,module.exports))return true;}
 if(require('./invitation-drafts').handle(req,res,pathname,root,module.exports))return true;
 if(pathname.startsWith('/api/admin/receivables') && require('./receivables').handle(req,res,pathname,root,module.exports)) return true;
 if(pathname.startsWith('/api/admin/customers') && require('./customers').handle(req,res,pathname,root,module.exports)) return true;
 if((pathname.startsWith('/api/admin/quotes') || pathname.startsWith('/api/admin/orders')) && require('./quote-workflow').handle(req,res,pathname,root,module.exports)) return true;
 if(pathname==='/api/security-challenge' && req.method==='GET') {
 if(!rate(req,res,'challenge',30)) return true;
 const now=Date.now();for(const[k,c]of challenges)if(c.expires<now)challenges.delete(k);
 const a=crypto.randomInt(2,20),b=crypto.randomInt(2,20),token=crypto.randomUUID();
 challenges.set(token,{answer:a+b,ip:runtime.clientAddress(req),created:now,expires:now+300000});reply(res,200,{token,siteKey:process.env.TURNSTILE_SITE_KEY||'',question:`${a} + ${b} = ?`});return true;
 }
 if(pathname==='/api/quotes' && req.method==='POST') { if(!rate(req,res,'submit',8))return true; }
 if(pathname==='/api/custom-quotes' && req.method==='POST') {
 if(!rate(req,res,'submit',8))return true;
 body(req,res,22000000,async data=>{
 await verify(req,data);
 const customerName=clean(data.customerName,100),phone=clean(data.phone,30),notes=clean(data.notes,5000),email=clean(data.email||'',200),companyName=clean(data.companyName||'',200),productCode=clean(data.productCode||'',80);
 if(customerName.length<3 || !/^[+0-9 ()-]{10,30}$/.test(phone) || notes.length<10 || !Number.isSafeInteger(Number(data.quantity)) || Number(data.quantity)<1 || Number(data.quantity)>10000000)throw Error('Ad, telefon, adet ve ürün açıklamasını kontrol ediniz.');
 if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('E-posta adresini kontrol ediniz.');
 const files=data.files||[];if(!Array.isArray(files)||files.length>3)throw Error('En fazla 3 dosya ekleyebilirsiniz.');
 const dir=path.join(root,'database','private-quote-files');fs.mkdirSync(dir,{recursive:true});
 const attachments=[],written=[];
 try {
 for(const f of files){
 const name=clean(f.name,150),ext=path.extname(name).toLowerCase();
 if(!['.png','.jpg','.jpeg','.pdf'].includes(ext)||typeof f.data!=='string'|| !/^[A-Za-z0-9+/]*={0,2}$/.test(f.data))throw Error('Yalnızca JPG, PNG ve PDF dosyaları kabul edilir.');
 const bytes=Buffer.from(f.data,'base64');if(!bytes.length||bytes.length>5*1024*1024)throw Error('Her dosya en fazla 5 MB olabilir.');
 const valid=ext==='.pdf'?bytes.subarray(0,5).toString()==='%PDF-':ext==='.png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!valid)throw Error('Dosyanın içeriği dosya türüyle uyuşmuyor.');
 const id=crypto.randomUUID()+ext,file=path.join(dir,id);written.push(file);fs.writeFileSync(file,bytes,{flag:'wx'});await scan(file);attachments.push({id,name,size:bytes.length,scanStatus:'clean'});
 }
 const file=path.join(root,'database','quotes.json'),quotes=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
 const quote={id:'OZK-'+crypto.randomUUID(),createdAt:new Date().toISOString(),type:'ozel_uretim',source:'web',jobId:'IS-'+crypto.randomUUID(),customerName,phone,email,companyName,productCode,notes,quantity:Number(data.quantity),attachments,status:'Yeni',items:[],totalEstimated:null};quotes.unshift(quote);fs.writeFileSync(file,JSON.stringify(quotes,null,2));reply(res,201,{success:true,quote:{id:quote.id}});
 }catch(e){for(const file of written)fs.rmSync(file,{force:true});throw e;}
 });return true;
 }
 const match=pathname.match(/^\/api\/quote-files\/([a-f0-9-]+\.(?:png|jpg|jpeg|pdf))$/);
 if(match && req.method==='GET'){
 const id=match[1],quotes=JSON.parse(fs.readFileSync(path.join(root,'database','quotes.json'),'utf8').replace(/^\uFEFF/,''));
 if(!quotes.some(q=>(q.attachments||[]).some(a=>a.id===id&&a.scanStatus==='clean'))){reply(res,404,{error:'Dosya bulunamadı.'});return true;}
 const file=path.join(root,'database','private-quote-files',id);if(!fs.existsSync(file)){reply(res,404,{error:'Dosya bulunamadı.'});return true;}
 res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${id}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);return true;
 }
 return false;
}
module.exports={middleware,verify,body,rate,authorized,reply};
