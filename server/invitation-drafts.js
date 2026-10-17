const fs=require('fs'),path=require('path'),crypto=require('crypto');
const templates={sade22534:'sade22534-editor-template.json',sade22503:'sade22503-editor-template.json',sade22500:'sade22500-editor-template.json',bristol:'bristol-editor-template.json',feather:'feather-editor-template.json'};
const systemFonts=['SadeAkayla','SadeBerkeley','SadeMileGreen','SadeManifold','SadeNewParis','SadeCaslon','Georgia','Times New Roman','Arial','Verdana','Trebuchet MS','Palatino Linotype','Book Antiqua','Cambria','Constantia','Calibri','Segoe UI','Tahoma','Courier New','Comic Sans MS','cursive'];
const symbols=['heart','heartOutline','star','flower','infinity','rings'];
const digest=token=>crypto.createHash('sha256').update(token).digest('hex');
function validateState(input,root){
 if(!input||!templates[input.template]||!Array.isArray(input.items)||input.items.length>20)throw Error('Geçersiz tasarım.');
 const base=JSON.parse(fs.readFileSync(path.join(root,'assets/davetiye',templates[input.template]),'utf8'));
 const items=input.items.map(item=>{
  if(typeof item.text!=='string'||item.text.length>400||![item.x,item.y,item.size].every(Number.isFinite)||item.x<0||item.x>1000||item.y<0||item.y>1400||item.size<16||item.size>900)throw Error('Yazı alanını kontrol edin.');
  if(!systemFonts.includes(item.font)&&!/^CatalogScript(?:[1-9]|1\d|2[0-5])$/.test(item.font))throw Error('Geçersiz font.');
  if(item.color!=='#191919'||!['normal','italic','bold'].includes(item.style)||!['left','center','right'].includes(item.align))throw Error('Yazı rengi veya biçimi geçersiz.');
  if(item.type&&!['line','symbol'].includes(item.type))throw Error('Geçersiz öğe.');
  if(['sade22500','sade22503','sade22534'].includes(input.template)&&!['cover','inside','accessory'].includes(item.area))throw Error('Baskı alanını seçin.');
  const result={text:item.text,x:item.x,y:item.y,size:item.size,font:item.font,color:item.color,style:item.style,align:item.align};
  if(['sade22500','sade22503','sade22534'].includes(input.template))result.area=item.area;
  if(item.label)result.label=String(item.label).slice(0,80);
  if(item.lineSpacing!==undefined){if(!Number.isFinite(item.lineSpacing)||item.lineSpacing<.5||item.lineSpacing>3)throw Error('Satır aralığı geçersiz.');result.lineSpacing=item.lineSpacing;}
  if(item.type==='symbol'){if(!symbols.includes(item.symbol))throw Error('Simge geçersiz.');Object.assign(result,{type:'symbol',symbol:item.symbol});}
  if(item.type==='line'){if(!['horizontal','vertical'].includes(item.direction)||!Number.isFinite(item.length)||item.length<20||item.length>1400||!Number.isFinite(item.thickness)||item.thickness<1||item.thickness>12)throw Error('Çizgi geçersiz.');Object.assign(result,{type:'line',direction:item.direction,length:item.length,thickness:item.thickness});}
  return result;
 });
 return {...base,items};
}
function handle(req,res,pathname,root,security){
 const publicSave=pathname==='/api/invitation-drafts',publicSubmit=pathname==='/api/invitation-drafts/submit';
 const match=pathname.match(/^\/api\/admin\/invitation-drafts(?:\/(DV-[A-F0-9-]+)(?:\/(preview))?)?$/);
 if(!publicSave&&!publicSubmit&&!match)return false;
 res.setHeader('Cache-Control','no-store');
 if((publicSave||publicSubmit)&&req.method!=='POST'){security.reply(res,405,{error:'İşlem desteklenmiyor.'});return true;}
 if(match&&!req.user){security.reply(res,401,{error:'Yönetici girişi gerekli.'});return true;}
 if((publicSave||publicSubmit)&&!security.rate(req,res,'invitation-draft',100))return true;
 const file=path.join(root,'database','invitation-drafts.json');
 const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):[];
 const write=records=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(records,null,2));fs.renameSync(tmp,file);};
 const summary=r=>({id:r.id,template:r.state.template,status:r.status,createdAt:r.createdAt,updatedAt:r.updatedAt,version:r.version,customer:r.submission?.customer||null});
 if(match&&req.method==='GET'){
  const records=read();if(!match[1]){security.reply(res,200,{drafts:records.map(summary).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});return true;}
  const record=records.find(r=>r.id===match[1]);if(!record){security.reply(res,404,{error:'Taslak bulunamadı.'});return true;}
  if(match[2]){if(!record.preview){security.reply(res,404,{error:'Önizleme yok.'});return true;}res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(Buffer.from(record.preview,'base64'));return true;}
  const {tokenHash,preview,...safe}=record;security.reply(res,200,safe);return true;
 }
 if(!['POST','PATCH'].includes(req.method)){security.reply(res,405,{error:'İşlem desteklenmiyor.'});return true;}
 security.body(req,res,900000,data=>{
  const records=read();let record;
  if(publicSave||publicSubmit){
   if(typeof data.token!=='string'||! /^[a-f0-9]{64}$/.test(data.token))throw Error('Taslak erişim anahtarı eksik.');
   const hash=digest(data.token);record=data.id?records.find(r=>r.id===data.id):records.find(r=>r.tokenHash===hash);
   if((data.id&&!record)||(record&&record.tokenHash!==hash)){security.reply(res,403,{error:'Taslağa erişilemiyor.'});return;}
  }else record=records.find(r=>r.id===match[1]);
  if(publicSubmit){
   if(!record)throw Error('Önce taslağı kaydedin.');
   if(record.submission){security.reply(res,200,{id:record.id,status:record.status,submittedAt:record.submission.at});return;}
   const name=String(data.customer?.name||'').trim().slice(0,100),phone=String(data.customer?.phone||'').trim().slice(0,30),note=String(data.customer?.note||'').trim().slice(0,1500);
   if(name.length<2||!/^[+0-9 ()-]{10,30}$/.test(phone)||phone.replace(/\D/g,'').length<10)throw Error('Adınızı ve telefon numaranızı kontrol edin.');
   record.submission={at:new Date().toISOString(),version:record.version,customer:{name,phone,note},state:structuredClone(record.state)};record.status='Gönderildi';record.updatedAt=record.submission.at;write(records);security.reply(res,200,{id:record.id,status:record.status,submittedAt:record.submission.at});return;
  }
  if(match&&!record){security.reply(res,404,{error:'Taslak bulunamadı.'});return;}
  const state=validateState(data.state,root);
  if(record&&record.state.template!==state.template)throw Error('Taslağın modeli değiştirilemez.');
  if(record&&JSON.stringify(record.state)!==JSON.stringify(state)){
   if(publicSave&&record.submission){security.reply(res,409,{error:'Gönderilmiş taslak değiştirilemez. Yeni taslak oluşturun.'});return;}
   if(data.version!==record.version){security.reply(res,409,{error:'Taslak başka bir yerde güncellendi. Sayfayı yeniden açın.'});return;}
   record.history=(record.history||[]).concat({version:record.version,state:record.state,at:record.updatedAt,by:match?'admin':'customer'}).slice(-20);record.version++;record.state=state;
   if(match)record.status=record.submission?'İncelemede':'Taslak';
  }
  if(!record){record={id:'DV-'+crypto.randomBytes(6).toString('hex').toUpperCase(),tokenHash:digest(data.token),createdAt:new Date().toISOString(),version:1,status:'Taslak',state,history:[]};records.push(record);}
  if(data.preview!==undefined){if(typeof data.preview!=='string'||data.preview.length>500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.preview))throw Error('Önizleme geçersiz.');const bytes=Buffer.from(data.preview.split(',')[1],'base64');if(bytes[0]!==255||bytes[1]!==216)throw Error('Önizleme geçersiz.');record.preview=bytes.toString('base64');}
  record.updatedAt=new Date().toISOString();write(records);security.reply(res,200,{...summary(record),submittedAt:record.submission?.at||null});
 });return true;
}
function prepareCheckout(input,root,items){
 if(!input||!/^DV-[A-F0-9]{12}$/.test(input.id||'')||!/^[a-f0-9]{64}$/.test(input.token||''))throw Error('Tasarım bağlantısı geçersiz.');
 const file=path.join(root,'database','invitation-drafts.json');const records=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):[];
 const record=records.find(r=>r.id===input.id);
 if(!record||record.tokenHash!==digest(input.token))throw Error('Taslağa erişilemiyor.');
 if(record.version!==input.version)throw Error('Tasarım değişmiş. Tasarım sayfasından tekrar devam edin.');
 const code={sade22500:'22500',sade22503:'22503',sade22534:'22534'}[record.state.template];
 if(!code||items.length!==1||String(items[0].code)!==code)throw Error('Tasarım ile seçilen model eşleşmiyor.');
 if(record.submission)throw Error('Bu tasarım daha önce gönderilmiş. Yeni bir taslak kopyası oluşturun.');
 return {id:record.id,version:record.version,state:structuredClone(record.state)};
}
function finishCheckout(root,design,quote){
 const file=path.join(root,'database','invitation-drafts.json'),records=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));const record=records.find(r=>r.id===design.id);
 if(!record)return;
 const at=new Date().toISOString();record.submission={at,version:design.version,quoteId:quote.id,customer:{name:quote.customerName,phone:quote.phone,note:quote.notes},state:design.state};record.status='Gönderildi';record.updatedAt=at;const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(records,null,2));fs.renameSync(tmp,file);
}
module.exports={handle,validateState,prepareCheckout,finishCheckout};
