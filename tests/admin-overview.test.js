const assert=require('node:assert/strict');const {report}=require('../assets/js/admin-overview-data');const now=new Date('2026-10-15T10:00:00Z');const rows=[
{id:'1',type:'order',createdAt:'2026-10-14T21:01:00Z',status:'Tamamlandı',pricingSnapshot:{currency:'EUR',total:120,subtotal:100}},
{id:'2',type:'order',createdAt:'2026-10-15T09:00:00Z',status:'İptal',totalEstimated:900},
{id:'3',type:'ozel_uretim',createdAt:'2026-10-15T08:00:00Z',totalEstimated:999},
{id:'4',type:'order',createdAt:'2026-10-14T20:59:00Z',totalEstimated:25},
{id:'5',type:'order',createdAt:'2026-10-12T01:00:00Z',totalEstimated:35},
{id:'6',type:'order',createdAt:'2026-10-01T01:00:00Z',totalEstimated:45},
{id:'7',type:'order',createdAt:'2026-10-15T09:00:00Z',totalEstimated:null},
{id:'8',type:'order',createdAt:'2026-10-15T09:00:00Z',totalEstimated:1000,isDeleted:true},
{id:'9',type:'order',createdAt:'2026-09-30T20:59:00Z',totalEstimated:400}];
const t=report(rows,'today',now);assert.equal(t.orders,3);assert.equal(t.offers,1);assert.equal(t.ready,1);assert.equal(t.totals.EUR.gross,120);assert.equal(t.totals.EUR.net,100);assert.equal(t.unpriced,1);assert.equal(t.cancelled,1);assert.equal(report(rows,'yesterday',now).orders,1);assert.equal(report(rows,'week',now).orders,5);assert.equal(report(rows,'month',now).orders,6);assert.equal(report(rows,'month',now).totals.TRY.gross,105);console.log('Istanbul midnight, yesterday/week/month boundaries, snapshot amounts, currencies, cancellation, deleted and unpriced records passed.');
