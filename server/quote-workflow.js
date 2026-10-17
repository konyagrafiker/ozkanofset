const fs=require('fs'),path=require('path'),crypto=require('crypto');
const quoteTools=require('../assets/js/quote-tools');
const id=prefix=>prefix+'-'+crypto.randomUUID();
function text(v,max=2000){if(typeof v!=='string'||v.length>max)throw Error('Alan uzunluğu veya veri türü geçersiz.');return v.trim();}
function amount(v){if(v===''||v===null||typeof v==='boolean')throw Error('Fiyat giriniz.');const n=Number(v);if(!Number.isFinite(n)||n<0||n>100000000)throw Error('Geçerli bir fiyat giriniz.');return Math.round(n*100)/100;}
function quantity(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>10000000)throw Error('Geçerli adet giriniz.');return n;}
function mutate(records,quoteId,action,data){
 const now=new Date().toISOString();
 if(action==='manual'){
 const customerName=text(data.customerName,100),phone=text(data.phone||'',30),email=text(data.email||'',200),notes=text(data.notes,5000),source=data.source;
 if(customerName.length<3||notes.length<10||(!phone&&!email)||!['mail','isyeri','telefon','diger'].includes(source))throw Error('Müşteri, iletişim, kaynak ve iş açıklamasını kontrol ediniz.');
 if(phone&&!/^[+0-9 ()-]{10,30}$/.test(phone))throw Error('Telefon geçersiz.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('E-posta geçersiz.');
 const q={id:id('OZK'),jobId:id('IS'),type:'ozel_uretim',source,customerId:text(data.customerId||'',80),city:text(data.city||'',100),address:text(data.address||'',1000),customerName,phone,email,companyName:text(data.companyName||'',200),productCode:text(data.productCode||'',80),productName:text(data.productName||'',200),currency:quoteTools.currency(data.currency),notes,quantity:quantity(data.quantity),createdAt:now,status:'Yeni',items:[],attachments:[],supplierQuotes:[],priceRevisions:[],activity:[{at:now,action:'Talep elle kaydedildi'}]};records.unshift(q);return {quote:q};
 }
 if(action==='metadata'||action==='analysis'||action==='product'){
 const q=records.find(q=>q.id===quoteId&&!q.isDeleted);if(!q)throw Error('Kayıt bulunamadı.');q.activity=q.activity||[];
 if(action==='product'){
 const productName=text(data.productName||'',200),productCode=text(data.productCode||'',80);if(!productName&&!productCode)throw Error('Ürün adı veya ürün numarası giriniz.');Object.assign(q,{productName,productCode});
 }else if(action==='metadata'){
 const customerName=text(data.customerName,100),companyName=text(data.companyName||'',200),phone=text(data.phone||'',30),email=text(data.email||'',200),productCode=text(data.productCode||'',80);
 if(customerName.length<3||(!phone&&!email))throw Error('Müşteri ve iletişim bilgilerini kontrol ediniz.');if(phone&&!/^[+0-9 ()-]{10,30}$/.test(phone))throw Error('Telefon geçersiz.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('E-posta geçersiz.');
 Object.assign(q,{customerName,companyName,phone,email,productCode,productName:text(data.productName??q.productName??'',200)});
 }else{
 if(q.type==='ozel_uretim'&&(q.status==='Arşivlendi'||q.orderId))throw Error('Kapalı teklif için yeni teklif oluşturunuz.');
 const types=['Malzeme','Baskı','İşçilik','Dış hizmet','Bitmiş ürün','Nakliye','Diğer'];
 if(!Array.isArray(data.lines))throw Error('Maliyet kalemlerini giriniz.');
 const lines=data.lines.map(line=>{if(!types.includes(line.category))throw Error('Maliyet türü geçersiz.');const description=text(line.description,300);if(!description)throw Error('Kalem açıklaması giriniz.');const quotedAt=text(line.quotedAt||'',10);if(quotedAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(quotedAt)||!Number.isFinite(Date.parse(quotedAt))||new Date(quotedAt).toISOString().slice(0,10)!==quotedAt))throw Error('Kalem tarihi geçersiz.');return {category:line.category,description,supplierName:text(line.supplierName||'',200),quotedAt,unit:text(line.unit||'adet',30),quantity:line.quantity,unitCost:line.unitCost,totalCost:line.totalCost,priceInputMode:line.priceInputMode,currency:line.currency,conversionRate:line.conversionRate,notes:text(line.notes||'',1000)};});
 const calculated=quoteTools.calculateCosts(lines,quoteTools.currency(data.currency));q.costAnalyses=q.costAnalyses||[];q.costAnalyses.push({id:id('ANL'),version:q.costAnalyses.length+1,createdAt:now,...calculated,internalNotes:text(data.internalNotes||'',4000)});
 }
 q.updatedAt=now;q.activity.push({at:now,action:action==='product'?'Ürün adı / numarası güncellendi':action==='metadata'?'Firma / ürün bilgileri güncellendi':'Genel maliyet analizi revizyonu kaydedildi'});return {quote:q};
 }
 if(action==='order-supplier'||action==='order-cost'){
 const order=records.find(q=>q.id===quoteId&&q.type!=='ozel_uretim'&&!q.isDeleted);if(!order)throw Error('Sipariş bulunamadı.');
 order.supplierQuotes=order.supplierQuotes||[];order.procurementCostRevisions=order.procurementCostRevisions||[];order.activity=order.activity||[];
 if(action==='order-supplier'){
 const supplierName=text(data.supplierName,200);if(!supplierName)throw Error('Tedarikçi adı giriniz.');
 order.supplierQuotes.push({id:id('TED'),supplierName,unitCost:amount(data.unitCost),quantity:quantity(data.quantity),extraCost:amount(data.extraCost||0),notes:text(data.notes||'',3000),createdAt:now});
 }else{
 const qty=quantity(data.quantity),supplier=data.supplierId?order.supplierQuotes.find(b=>b.id===data.supplierId):null;
 if(data.supplierId&&!supplier)throw Error('Tedarikçi teklifi bulunamadı.');if(supplier&&supplier.quantity!==qty)throw Error('Tedarikçi adedini kontrol ediniz.');
 const own=supplier?null:amount(data.internalUnitCost),extraCost=amount(data.extraCost||0);
 order.procurementCostRevisions.push({id:id('MAL'),version:order.procurementCostRevisions.length+1,createdAt:now,quantity:qty,supplier:supplier?JSON.parse(JSON.stringify(supplier)):null,internalUnitCost:own,extraCost,costTotal:Math.round((qty*(supplier?supplier.unitCost:own)+(supplier?.extraCost||0)+extraCost)*100)/100,internalNotes:text(data.internalNotes||'',4000)});
 }
 order.updatedAt=now;order.activity.push({at:now,action:action==='order-supplier'?'Sipariş için tedarikçi teklifi kaydedildi':'Sipariş maliyet revizyonu kaydedildi'});return {quote:order};
 }
 const q=records.find(q=>q.id===quoteId&&q.type==='ozel_uretim'&&!q.isDeleted);if(!q)throw Error('Teklif bulunamadı.');
 q.jobId=q.jobId||q.id;q.supplierQuotes=q.supplierQuotes||[];q.priceRevisions=q.priceRevisions||[];q.activity=q.activity||[];
 const log=action=>{q.updatedAt=now;q.activity.push({at:now,action});};
 if(action==='renew'){
 const next={id:id('OZK'),jobId:q.jobId,previousQuoteId:q.id,type:'ozel_uretim',source:'tekrar',customerId:q.customerId||'',city:q.city||'',address:q.address||'',customerName:q.customerName,companyName:q.companyName||'',phone:q.phone||'',email:q.email||'',productCode:q.productCode||'',productName:q.productName||'',currency:q.currency||q.priceRevisions.at(-1)?.currency||'TRY',notes:q.notes,quantity:q.quantity,createdAt:now,status:'Yeni',items:[],attachments:JSON.parse(JSON.stringify(q.attachments||[])),supplierQuotes:[],priceRevisions:[],activity:[{at:now,action:'Önceki işten yeni teklif talebi oluşturuldu: '+q.id}]};records.unshift(next);log('Yeni teklif talebi oluşturuldu: '+next.id);return {quote:next};
 }
 if(q.status==='Arşivlendi'||q.orderId)throw Error('Bu teklif kapalı. Aynı iş için yeni teklif oluşturunuz.');
 if(action==='supplier'){
 const supplierName=text(data.supplierName,200);if(!supplierName)throw Error('Tedarikçi adı giriniz.');
 const bid={id:id('TED'),supplierName,unitCost:amount(data.unitCost),quantity:quantity(data.quantity),extraCost:amount(data.extraCost||0),notes:text(data.notes||'',3000),createdAt:now};q.supplierQuotes.push(bid);q.status='İnceleniyor';log('Tedarikçi teklifi kaydedildi: '+supplierName);return {quote:q};
 }
 if(action==='price'){
 const qty=quantity(data.quantity),pricing=quoteTools.calculatePrice(qty,data.unitPrice,data.subtotal,data.priceInputMode||'unit'),unitPrice=pricing.unitPrice,extraCost=amount(data.extraCost||0),vatRate=Number(data.vatRate??20);
 if(![0,1,10,20].includes(vatRate)||unitPrice<=0)throw Error('Satış fiyatını ve KDV oranını kontrol ediniz.');
 const supplier=data.supplierId?(q.supplierQuotes.find(b=>b.id===data.supplierId)):null;if(data.supplierId&&!supplier)throw Error('Tedarikçi teklifi bulunamadı.');if(supplier&&supplier.quantity!==qty)throw Error('Tedarikçi teklif adedi ile müşteri teklif adedi aynı olmalı. Yeni adet için tedarikçi teklifi ekleyiniz.');
 const hasInternalCost=data.internalUnitCost!==undefined&&data.internalUnitCost!==null&&data.internalUnitCost!=='';
 const internalUnitCost=(supplier||data.costAnalysisId||!hasInternalCost)?null:amount(data.internalUnitCost),costUnit=supplier?supplier.unitCost:internalUnitCost;
 const currency=quoteTools.currency(data.currency||q.currency),analysis=data.costAnalysisId?(q.costAnalyses||[]).find(a=>a.id===data.costAnalysisId):null;
 if(data.costAnalysisId&&!analysis)throw Error('Maliyet analizi bulunamadı.');if(analysis&&analysis.currency!==currency)throw Error('Maliyet analizi ile müşteri teklifinin para birimi aynı olmalıdır.');
 const round=quoteTools.round,subtotal=pricing.subtotal,costTotal=analysis?analysis.costTotal:(supplier||hasInternalCost||extraCost>0)?round(qty*(costUnit||0)+(supplier?.extraCost||0)+extraCost):null,vatTotal=round(subtotal*vatRate/100);
 const validUntil=text(data.validUntil||'',10);if(validUntil&&!/^\d{4}-\d{2}-\d{2}$/.test(validUntil))throw Error('Geçerlilik tarihi geçersiz.');
 const revision={id:id('FIY'),version:q.priceRevisions.length+1,createdAt:now,quantity:qty,unitPrice,priceInputMode:pricing.priceInputMode,currency,costAnalysis:analysis?JSON.parse(JSON.stringify(analysis)):null,customerSnapshot:{customerId:q.customerId||'',customerName:q.customerName,companyName:q.companyName||'',phone:q.phone||'',email:q.email||'',productCode:q.productCode||'',productName:q.productName||'',notes:q.notes},vatRate,subtotal,vatTotal,total:round(subtotal+vatTotal),supplier:supplier?JSON.parse(JSON.stringify(supplier)):null,internalUnitCost,extraCost,costTotal,estimatedMargin:costTotal===null?null:round(subtotal-costTotal),validUntil,deliveryTime:text(data.deliveryTime??'5 iş günü',200),quoteTerms:text(data.quoteTerms??'Üretim, yazılı sipariş ve baskı/tasarım onayından sonra başlatılır.\nOnaylanan baskı bilgileri esas alınır; değişiklikler fiyat ve teslim süresini etkileyebilir.\nÖdeme, sevkiyat ve varsa ek hizmet koşulları sipariş onayı sırasında ayrıca teyit edilir.',5000),sellerProfile:data.sellerProfile?JSON.parse(JSON.stringify(data.sellerProfile)):null,customerNotes:text(data.customerNotes||'',4000),internalNotes:text(data.internalNotes||'',4000)};
 q.priceRevisions.push(revision);q.quantity=qty;q.status='Fiyatlandırıldı';q.totalEstimated=revision.total;q.currency=currency;log('Fiyat revizyonu kaydedildi: V'+revision.version);return {quote:q};
 }
 const revision=q.priceRevisions.at(-1);
 if(action==='sent'){if(!revision)throw Error('Önce müşteri fiyatı oluşturunuz.');if(data.revisionId!==revision.id)throw Error('Fiyat değişti. Son revizyonu kontrol ediniz.');q.status='Teklif Verildi';log('Müşteriye teklif verildi: V'+revision.version);return {quote:q};}
 if(action==='archive'){const reason=text(data.reason||'',2000);q.status='Arşivlendi';q.archivedAt=now;q.archiveReason=reason;log('Arşivlendi'+(reason?': '+reason:''));return {quote:q};}
 if(action==='convert'){
 if(!revision)throw Error('Önce müşteri fiyatı oluşturunuz.');
 if(data.approvalConfirmed!==true)throw Error('Müşteri onayını doğrulayınız.');
 if(data.revisionId!==revision.id)throw Error('Fiyat değişti. Müşteri onayını son revizyon için kontrol ediniz.');
 const order={id:id('SIP'),type:'ozel_uretim_siparis',source:q.source||'web',productCode:revision.customerSnapshot?.productCode||q.productCode||'',productName:revision.customerSnapshot?.productName||q.productName||'',currency:revision.currency||'TRY',sourceQuoteId:q.id,customerId:revision.customerSnapshot?.customerId||q.customerId||'',city:q.city||'',address:q.address||'',jobId:q.jobId,createdAt:now,status:'Onaylandı',customerName:revision.customerSnapshot?.customerName||q.customerName,companyName:revision.customerSnapshot?.companyName??q.companyName??'',phone:revision.customerSnapshot?.phone??q.phone??'',email:revision.customerSnapshot?.email??q.email??'',notes:revision.customerSnapshot?.notes||q.notes,quantity:revision.quantity,attachments:JSON.parse(JSON.stringify(q.attachments||[])),pricingSnapshot:JSON.parse(JSON.stringify(revision)),items:[{title:q.notes.slice(0,100),qty:revision.quantity,price:revision.total}],totalEstimated:revision.total,productSubtotal:revision.subtotal};
 records.unshift(order);q.orderId=order.id;q.status='Siparişe Dönüştürüldü';log('Müşteri onayıyla sipariş oluşturuldu: '+order.id);return {quote:q,order};
 }
 throw Error('Geçersiz işlem.');
}
function handle(req,res,pathname,root,security){
 const orderMatch=pathname.match(/^\/api\/admin\/orders\/([A-Za-z0-9_-]+)\/(supplier|cost|metadata|analysis|product)$/);
 const match=orderMatch||pathname.match(/^\/api\/admin\/quotes(?:\/([A-Za-z0-9_-]+)\/(supplier|price|sent|archive|renew|convert|metadata|analysis|product))?$/);if(!match||req.method!=='POST')return false;
 security.body(req,res,64000,data=>{const file=path.join(root,'database','quotes.json'),records=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));if(!orderMatch&&!match[1]&&data.customerId){const customer=require('./customers').resolve(root,data.customerId);Object.assign(data,{customerName:customer.customerName,companyName:customer.companyName,phone:customer.phone,email:customer.email,city:customer.city,address:customer.address});if(!data.currency)data.currency=customer.currency;}if(match[2]==='price'){const settingsFile=path.join(root,'database','settings.json'),settings=fs.existsSync(settingsFile)?JSON.parse(fs.readFileSync(settingsFile,'utf8').replace(/^\uFEFF/,'')):{};data.sellerProfile=Object.fromEntries(['companyName','phone','email','address'].map(key=>[key,typeof settings[key]==='string'?settings[key].slice(0,500):'']));}if(req.user&&!req.user.isAdmin&&((data.customerId&&!require('./users').can(req.user,'customers'))||((data.costAnalysisId||data.supplierId||data.internalUnitCost!==undefined)&&!require('./users').can(req.user,'costs'))))throw Error('Seçilen müşteri veya maliyet kaydına erişim yetkiniz yok.');const result=mutate(records,match[1],orderMatch?(['metadata','analysis','product'].includes(match[2])?match[2]:'order-'+match[2]):match[2]||'manual',data);const temp=file+'.workflow.tmp';try{fs.writeFileSync(temp,JSON.stringify(records,null,2),'utf8');fs.renameSync(temp,file);}catch{fs.rmSync(temp,{force:true});throw Error('Kayıt kaydedilemedi. Lütfen tekrar deneyiniz.');}res.writeHead(201,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({success:true,...Object.fromEntries(Object.entries(result).map(([key,value])=>[key,require('./users').filterRecords([value],req.user)[0]]))}));});return true;
}
module.exports={handle,mutate};
