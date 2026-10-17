const { isAdminPage } = require('./admin-route');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const areas={receivables:'Cari Hesaplar / Tahsilat',dashboard:'Genel Bakış',quotes:'Gelen Teklifler',orders:'Siparişler',customers:'Müşteriler',costs:'Maliyet Analizi',products:'Ürünler / Davetiye Fiyatları',vitrin:'Vitrin / Anasayfa',media:'Medya',ientegre:'iEntegre',settings:'Site Ayarları'};
const safe=u=>({id:u.id,username:u.username,displayName:u.displayName,active:u.active,permissions:u.permissions,createdAt:u.createdAt});
function read(root){const file=path.join(root,'database','users.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];}
function hash(password){const salt=crypto.randomBytes(16).toString('hex');return {salt,hash:crypto.scryptSync(password,salt,64,{N:32768,r:8,p:3,maxmem:67108864}).toString('hex')};}
function authenticate(req,root){if(!req.headers?.authorization?.startsWith('Basic ')||req.headers.authorization.length>1024)return null;const raw=Buffer.from(req.headers.authorization.slice(6),'base64').toString('utf8'),colon=raw.indexOf(':');if(colon<0)return null;const username=raw.slice(0,colon),password=raw.slice(colon+1),adminName=process.env.ADMIN_USER||'admin';if(password.length>128||username.length>80)return null;
if(username===adminName){const file=path.join(root,'database','admin-password.txt');if(!process.env.ADMIN_PASSWORD&&!fs.existsSync(file))fs.writeFileSync(file,crypto.randomBytes(24).toString('base64url'),{flag:'wx',mode:0o600});const expected=Buffer.from(process.env.ADMIN_PASSWORD||fs.readFileSync(file,'utf8').trim()),actual=Buffer.from(password);if(expected.length===actual.length&&crypto.timingSafeEqual(expected,actual))return {id:'root',username,displayName:'Yönetici',isAdmin:true,active:true};return null;}
const user=read(root).find(u=>u.username===username&&u.active);if(!user)return null;const expected=Buffer.from(user.passwordHash,'hex'),actual=crypto.scryptSync(password,user.passwordSalt,64,{N:32768,r:8,p:3,maxmem:67108864});return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual)?{...safe(user),isAdmin:false}:null;
}
function can(user,area,action='view'){return !!user&&(user.isAdmin||user.permissions?.[area]?.[action]===true);}
function handle(req,res,pathname,root,security){if(pathname==='/api/admin/me'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({user:req.user,areas}));return true;}
const match=pathname.match(/^\/api\/admin\/users(?:\/(USR-[a-f0-9-]+))?$/);if(!match)return false;
if(!req.user?.isAdmin){security.reply(res,403,{error:'Kullanıcı yönetimi yalnızca ana yöneticiye açıktır.'});return true;}
if(req.method==='GET'&&!match[1]){security.reply(res,200,{users:read(root).map(safe),areas});return true;}
if((req.method==='POST'&&!match[1])||(req.method==='PATCH'&&match[1])){security.body(req,res,32000,data=>{const users=read(root),existing=match[1]?users.find(u=>u.id===match[1]):null;if(match[1]&&!existing)throw Error('Kullanıcı bulunamadı.');const username=String(data.username||'').trim(),displayName=String(data.displayName||'').trim();if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)||username===(process.env.ADMIN_USER||'admin')||users.some(u=>u.username===username&&u.id!==match[1]))throw Error('Kullanıcı adı geçersiz veya kullanımda.');if(!displayName||displayName.length>100)throw Error('Ad soyad giriniz.');const password=data.password;if((!existing||password)&& (typeof password!=='string'||password.length<10||password.length>128))throw Error('Parola 10–128 karakter olmalıdır.');const permissions={};for(const area of Object.keys(areas)){const input=data.permissions?.[area]||{};permissions[area]={view:input.view===true,edit:input.view===true&&input.edit===true,delete:input.view===true&&input.delete===true};}const user=existing||{id:'USR-'+crypto.randomUUID(),createdAt:new Date().toISOString()};Object.assign(user,{username,displayName,active:data.active!==false,permissions,updatedAt:new Date().toISOString()});if(password){const h=hash(password);user.passwordSalt=h.salt;user.passwordHash=h.hash;}if(!existing)users.push(user);const file=path.join(root,'database','users.json');fs.writeFileSync(file+'.tmp',JSON.stringify(users,null,2),{mode:0o600});fs.renameSync(file+'.tmp',file);security.reply(res,existing?200:201,{success:true,user:safe(user)});});return true;}return false;
}
function requirement(pathname,method,req,root){
 const write=!['GET','HEAD','OPTIONS'].includes(method),action=method==='DELETE'||pathname.endsWith('/bulk-delete')||pathname.endsWith('/restore')?'delete':write?'edit':'view';
 if(isAdminPage(pathname)||pathname.startsWith('/admin')||pathname==='/api/admin/me')return null;
 if(pathname==='/api/admin/receivables/link-order')return ['receivables','edit','orders','edit'];
 if(pathname.startsWith('/api/admin/receivables'))return ['receivables',pathname.endsWith('/void')?'delete':action];
 if(pathname.startsWith('/api/admin/users'))return ['users','edit'];
 if(pathname.startsWith('/api/admin/customers'))return ['customers',action];
 if(pathname.startsWith('/api/admin/invitation-drafts'))return ['quotes',action];
 if(pathname==='/api/quotes'&&method==='GET')return ['records','view'];
 const recordMatch=pathname.match(/^\/api\/(?:admin\/(quotes|orders)|quotes)\/([^/]+)(?:\/(.*))?$/);
 if(recordMatch){const records=JSON.parse(fs.readFileSync(path.join(root,'database','quotes.json'),'utf8').replace(/^\uFEFF/,'')),record=records.find(q=>q.id===recordMatch[2]),area=recordMatch[1]==='orders'||record&&record.type!=='ozel_uretim'?'orders':'quotes',operation=recordMatch[3];if(operation==='analysis'||operation==='supplier'||operation==='cost')return [area,'view','costs','edit'];if(operation==='convert')return ['quotes','edit','orders','edit'];return [area,action];}
 if(pathname==='/api/admin/quotes')return ['quotes','edit'];
 if(pathname.startsWith('/api/quote-files/'))return ['files','view'];
 if(pathname==='/api/stats'||pathname==='/api/admin/traffic')return ['dashboard','view'];
 if(pathname.startsWith('/api/ientegre/')||pathname==='/api/my-ip')return ['ientegre',action];
 if(pathname==='/api/upload'||pathname==='/api/media')return ['media',action];
 if(pathname==='/api/settings')return ['settings',action];
 if(pathname==='/api/homepage')return ['vitrin',action];
 if(pathname.startsWith('/api/products')||pathname.startsWith('/api/categories')||pathname.startsWith('/api/davetiye/'))return ['products',action];
 return ['unknown',action];
}
function allowed(user,required,pathname,root){if(user.isAdmin||!required)return true;if(required[0]==='records')return can(user,'quotes')||can(user,'orders')||can(user,'costs');if(required[0]==='files'){const fileId=pathname.split('/').at(-1),records=JSON.parse(fs.readFileSync(path.join(root,'database','quotes.json'),'utf8').replace(/^\uFEFF/,''));return records.some(q=>!q.isDeleted&&(q.attachments||[]).some(a=>a.id===fileId)&&can(user,q.type==='ozel_uretim'?'quotes':'orders'));}return required.every((value,index)=>index%2||can(user,value,required[index+1]));}
function filterRecords(records,user){if(user?.isAdmin||!user)return records;return records.filter(q=>can(user,q.type==='ozel_uretim'?'quotes':'orders')).map(q=>{const result=JSON.parse(JSON.stringify(q));if(!can(user,'costs')){delete result.supplierQuotes;delete result.costAnalyses;delete result.procurementCostRevisions;result.activity=(result.activity||[]).filter(a=>!/tedarikçi|maliyet/i.test(a.action));for(const r of [...(result.priceRevisions||[]),...(result.pricingSnapshot?[result.pricingSnapshot]:[])])for(const key of ['costAnalysis','supplier','internalUnitCost','extraCost','costTotal','estimatedMargin','internalNotes'])delete r[key];}return result;});}
module.exports={areas,authenticate,can,handle,requirement,allowed,filterRecords};
