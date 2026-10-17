const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../admin/public/index.html'),'utf8');
const source=html.slice(html.indexOf('        const recordStatusFilters ='),html.indexOf('        async function deleteQuote('));
const nodes={};const getNode=id=>nodes[id]||(nodes[id]={innerText:'',innerHTML:''});
const context={currentTab:'quotes',currentQuoteStatusFilter:'all',quotesData:[
 {id:'quote-1',type:'ozel_uretim',customerName:'Teklif Müşterisi',status:'Yeni',phone:'05420000001',items:[],quantity:500,createdAt:new Date().toISOString()},
 {id:'order-1',type:'genel',customerName:'Sipariş Müşterisi',status:'Yeni',phone:'05420000002',items:[],createdAt:new Date().toISOString()},
 {id:'order-2',type:'davetiye_on_siparis',customerName:'Davetiye Müşterisi',status:'Onaylandı',phone:'05420000003',items:[],createdAt:new Date().toISOString()},
 {id:'trash-quote',type:'ozel_uretim',isDeleted:true,status:'Yeni',items:[],createdAt:new Date().toISOString()},
 {id:'trash-order',type:'genel',isDeleted:true,status:'Yeni',items:[],createdAt:new Date().toISOString()}
],document:{getElementById:getNode},QUOTE_STATUS_CONFIG:{Yeni:{label:'Yeni'},Onaylandı:{label:'Onaylandı'}},getQuoteStatusConfig:()=>({}),escapeQuoteText:String};
vm.createContext(context);vm.runInContext(source,context);
context.updateRecordBadges();assert.equal(nodes.pendingQuotesBadge.innerText,1);assert.equal(nodes.pendingOrdersBadge.innerText,1);
context.renderQuoteFilterButtons();context.renderQuotesTable();assert.match(nodes.quotesTableBody.innerHTML,/quote-1/);assert.doesNotMatch(nodes.quotesTableBody.innerHTML,/order-1|order-2|trash-quote/);
context.setQuoteStatusFilter('trash');assert.match(nodes.quotesTableBody.innerHTML,/trash-quote/);assert.doesNotMatch(nodes.quotesTableBody.innerHTML,/trash-order/);
context.currentTab='orders';context.currentQuoteStatusFilter='all';context.renderQuoteFilterButtons();context.renderQuotesTable();assert.match(nodes.ordersTableBody.innerHTML,/order-1/);assert.match(nodes.ordersTableBody.innerHTML,/order-2/);assert.doesNotMatch(nodes.ordersTableBody.innerHTML,/quote-1|trash-order/);
context.setQuoteStatusFilter('Onaylandı');assert.match(nodes.ordersTableBody.innerHTML,/order-2/);assert.doesNotMatch(nodes.ordersTableBody.innerHTML,/order-1/);
assert.equal(vm.runInContext('recordStatusFilters.quotes',context),'trash');assert.equal(vm.runInContext('recordStatusFilters.orders',context),'Onaylandı');
context.setQuoteStatusFilter('trash');assert.match(nodes.ordersTableBody.innerHTML,/trash-order/);assert.doesNotMatch(nodes.ordersTableBody.innerHTML,/trash-quote/);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);for(const id of ['tabBtn-quotes','tabBtn-orders','section-quotes','section-orders','quotesTableBody','ordersTableBody','quoteFilterButtonsContainer','orderFilterButtonsContainer'])assert.equal(ids.filter(x=>x===id).length,1);
console.log('Separate offers/orders, invitation orders, badges, independent status filters and trash checks passed.');
