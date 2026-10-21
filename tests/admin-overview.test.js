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
const t=report(rows,'today',now);assert.equal(t.orders,2);assert.equal(t.offers,1);assert.equal(t.ready,1);assert.equal(t.totals.EUR.gross,120);assert.equal(t.totals.EUR.net,100);assert.equal(t.unpriced,1);assert.equal(t.cancelled,1);assert.equal(report(rows,'yesterday',now).orders,1);assert.equal(report(rows,'week',now).orders,4);assert.equal(report(rows,'month',now).orders,5);assert.equal(report(rows,'month',now).totals.TRY.gross,105);console.log('Istanbul midnight, yesterday/week/month boundaries, snapshot amounts, currencies, cancellation, deleted and unpriced records passed.');
const changed=report([
{type:'ozel_uretim',status:'Siparişe Dönüştürüldü',createdAt:now},
{type:'ozel_uretim',status:'Siparişe Dönüştü',createdAt:now},
{type:'ozel_uretim',status:'Arşivlendi',createdAt:now},
{type:'ozel_uretim',status:'Yeni',orderId:'order-1',createdAt:now},
{type:'ozel_uretim',status:'Teklif Verildi',createdAt:now},
{type:'order',status:'Teslim Edildi',createdAt:now,totalEstimated:100},
{type:'order',status:'İptal',createdAt:now,totalEstimated:500}
],'today',now);
assert.equal(changed.offers,1);assert.equal(changed.orders,1);assert.equal(changed.ready,1);assert.equal(changed.rows.length,1);assert.equal(changed.cancelled,1);assert.equal(changed.totals.TRY.gross,100);
console.log('Converted/archived offers, cancelled orders and delivered orders passed.');
const vm=require('node:vm'),fs=require('node:fs');
const nodes=Object.fromEntries(['overviewMessage','overviewPeriod','overviewOrders','overviewOffers','overviewReady','overviewProduction','overviewRevenue','overviewOrdersBody','overviewNet'].map(id=>[id,{value:'today',textContent:'',innerHTML:''}]));
const context={AdminOverview:{report:records=>report(records,'today',now)},document:{getElementById:id=>nodes[id],addEventListener(){}},setInterval(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync('assets/js/admin-overview.js','utf8'),context);
context.setAdminOverviewRecords(rows);assert.equal(nodes.overviewOrders.textContent,2);
context.setAdminOverviewRecords(rows.filter(q=>q.id!=='1'));assert.equal(nodes.overviewOrders.textContent,1);assert.equal(nodes.overviewReady.textContent,0);
context.setAdminOverviewRecords([]);assert.equal(nodes.overviewOrders.textContent,0);assert.equal(nodes.overviewOffers.textContent,0);
console.log('Overview refreshes immediately after record updates and deletions.');
