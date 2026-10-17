(function(root){
function day(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
function report(records,period='today',now=new Date()){
 const today=day(now),end=new Date(today+'T00:00:00+03:00');end.setUTCDate(end.getUTCDate()+1);let start=new Date(today+'T00:00:00+03:00');
 if(period==='yesterday'){start.setUTCDate(start.getUTCDate()-1);end.setUTCDate(end.getUTCDate()-1);}
 if(period==='week'){const weekday=new Date(today+'T12:00:00Z').getUTCDay();start.setUTCDate(start.getUTCDate()-((weekday+6)%7));}
 if(period==='month')start=new Date(today.slice(0,7)+'-01T00:00:00+03:00');
 const rows=records.filter(q=>!q.isDeleted&&Number.isFinite(Date.parse(q.createdAt))&&new Date(q.createdAt)>=start&&new Date(q.createdAt)<end);
 const offers=rows.filter(q=>q.type==='ozel_uretim');const orders=rows.filter(q=>q.type!=='ozel_uretim');const cancelled=q=>['İptal','İptal Edildi','Arşivlendi'].includes(q.status);const totals={};let unpriced=0,netUnknown=0;
 for(const q of orders.filter(q=>!cancelled(q))){const snapshot=q.pricingSnapshot;const currency=snapshot?.currency||q.currency||'TRY';const gross=snapshot?.total??q.totalEstimated;const net=snapshot?.subtotal??q.subtotal;const bucket=totals[currency]??={gross:0,net:0,count:0};if(gross===null||gross===undefined||gross===''||!Number.isFinite(Number(gross))){unpriced++;continue;}bucket.gross+=Number(gross);bucket.count++;if(net!==null&&net!==undefined&&Number.isFinite(Number(net)))bucket.net+=Number(net);else netUnknown++;}
 return {start:start.toISOString(),end:end.toISOString(),orders:orders.length,offers:offers.length,ready:orders.filter(q=>['Hazır','Tamamlandı','Teslime Hazır'].includes(q.status)).length,production:orders.filter(q=>['Baskıda','Üretimde','Taslak Hazırlanıyor'].includes(q.status)).length,cancelled:orders.filter(cancelled).length,totals,unpriced,netUnknown,rows:orders.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))};
}
if(typeof module!=='undefined')module.exports={report};else root.AdminOverview={report};
})(typeof window==='undefined'?globalThis:window);
