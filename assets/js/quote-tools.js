(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OzkanQuoteTools=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const currencies=['TRY','EUR','USD'];
 const normalize=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ı/g,'i').replace(/[^a-z0-9]/g,'');
 const phone=v=>String(v||'').replace(/\D/g,'').replace(/^(?:0090|90|0)(?=5\d{9}$)/,'');
 function sameCustomerCore(a,b){if(a.customerId&&b.customerId)return a.customerId===b.customerId;const af=normalize(a.companyName),bf=normalize(b.companyName);if(af&&bf&&af===bf)return true;const ae=String(a.email||'').trim().toLowerCase(),be=String(b.email||'').trim().toLowerCase();if(ae&&be&&ae===be)return true;const ap=phone(a.phone),bp=phone(b.phone);if(ap&&bp&&ap===bp)return true;return !!(!af&&!bf&&normalize(a.customerName)&&normalize(a.customerName)===normalize(b.customerName)&&!(ae&&be&&ae!==be)&&!(ap&&bp&&ap!==bp));}
 function customerIdentities(q){return [q,...(q.priceRevisions||[]).map(r=>r.customerSnapshot),q.pricingSnapshot?.customerSnapshot].filter(Boolean);}
 function sameCustomer(a,b){if(a.customerId&&b.customerId)return a.customerId===b.customerId;return customerIdentities(a).some(ai=>customerIdentities(b).some(bi=>sameCustomerCore(ai,bi)));}
 function productCodes(q){return [...new Set([q.productCode,...(q.priceRevisions||[]).map(r=>r.customerSnapshot?.productCode),q.pricingSnapshot?.customerSnapshot?.productCode,...(q.items||[]).flatMap(i=>[i.code,i.productCode])].filter(Boolean).map(String))];}
 function sameProduct(a,b){const codes=productCodes(a).map(normalize);return productCodes(b).some(code=>codes.includes(normalize(code)));}
 const round=v=>Math.round((v+Number.EPSILON)*100)/100;
 function currency(v){const c=v||'TRY';if(!currencies.includes(c))throw Error('Para birimi TL, EUR veya USD olmalıdır.');return c;}
 function calculatePrice(qtyValue,unitValue,totalValue,mode='unit'){
 const qty=Number(qtyValue);if(qtyValue===''||!Number.isFinite(qty)||qty<=0||qty>10000000)throw Error('Geçerli miktar giriniz.');
 if(!['unit','total'].includes(mode))throw Error('Fiyat giriş biçimi geçersiz.');
 const raw=mode==='total'?totalValue:unitValue,value=Number(raw);if(raw===''||raw==null||typeof raw==='boolean'||!Number.isFinite(value)||value<0)throw Error('Geçerli fiyat giriniz.');
 const total=mode==='total'?round(value):round(qty*value),unit=mode==='total'?Number((total/qty).toFixed(8)):Number(value.toFixed(8));
 if(unit>100000000||total>1000000000000)throw Error('Fiyat sınırı aşıldı.');return {quantity:qty,unitPrice:unit,subtotal:total,priceInputMode:mode};
 }
 function calculateCosts(lines,targetCurrency){
 currency(targetCurrency);if(!Array.isArray(lines)||!lines.length||lines.length>100)throw Error('En az bir, en fazla 100 maliyet kalemi giriniz.');
 const calculated=lines.map(line=>{const source=currency(line.currency),pricing=calculatePrice(line.quantity,line.unitCost,line.totalCost,line.priceInputMode||'unit'),qty=pricing.quantity,unit=pricing.unitPrice,rate=source===targetCurrency?1:Number(line.conversionRate);
 if(line.quantity===''||((line.priceInputMode||'unit')==='unit'&&line.unitCost==='')||!Number.isFinite(qty)||qty<=0||qty>10000000||!Number.isFinite(unit)||unit<0||unit>100000000)throw Error('Maliyet miktarını ve birim fiyatını kontrol ediniz.');
 if(source!==targetCurrency && (line.conversionRate===''||!Number.isFinite(rate)||rate<=0||rate>100000000))throw Error('Farklı para birimi için dönüşüm kurunu giriniz.');
 const sourceTotal=pricing.subtotal;return {...line,priceInputMode:pricing.priceInputMode,totalCost:sourceTotal,currency:source,quantity:qty,unitCost:unit,conversionRate:rate,sourceTotal,convertedTotal:round(sourceTotal*rate)};});
 const costTotal=round(calculated.reduce((sum,line)=>sum+line.convertedTotal,0));if(costTotal>1000000000000)throw Error('Toplam maliyet sınırı aşıldı.');return {currency:targetCurrency,lines:calculated,costTotal};
 }
 function money(value,c='TRY'){if(value==null)return 'Hesaplanmadı';return Number(value).toLocaleString('tr-TR',{style:'currency',currency:currencies.includes(c)?c:'TRY'});}
 return {normalize,phone,sameCustomer,customerIdentities,productCodes,sameProduct,round,currency,calculatePrice,calculateCosts,money,currencies};
});
