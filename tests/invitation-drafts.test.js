const assert=require('node:assert/strict'),http=require('http'),fs=require('fs'),os=require('os'),path=require('path');
const security=require('../server/security');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ozkan-draft-test-'));fs.mkdirSync(path.join(root,'database'));fs.mkdirSync(path.join(root,'assets/davetiye'),{recursive:true});for(const file of ['sade22500','sade22503','sade22534','bristol','feather'])fs.copyFileSync(path.join(__dirname,'../assets/davetiye',file+'-editor-template.json'),path.join(root,'assets/davetiye',file+'-editor-template.json'));
 const previous=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='invitation-test-only';const auth='Basic '+Buffer.from('admin:invitation-test-only').toString('base64');
 const server=http.createServer((req,res)=>{if(!security.middleware(req,res,new URL(req.url,'http://local').pathname,root)){res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const request=async(url,data,admin=false,method='POST')=>{const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(admin?{Authorization:auth}:{})},...(data?{body:JSON.stringify(data)}:{})});return{status:response.status,data:JSON.parse((await response.text())||'{}')};};
 const state=JSON.parse(fs.readFileSync(path.join(root,'assets/davetiye/sade22500-editor-template.json'))),token='a'.repeat(64);
 try{
  assert.equal((await request('/api/admin/invitation-drafts',null,false,'GET')).status,401);
  const first=await request('/api/invitation-drafts',{state,token});assert.equal(first.status,200,JSON.stringify(first));const id=first.data.id;assert.match(id,/^DV-/);
  assert.equal((await request('/api/invitation-drafts',{state,token})).data.id,id,'retry keeps the same ID');
  assert.equal((await request('/api/invitation-drafts',{id,state,token:'b'.repeat(64)})).status,403);
  assert.equal((await request('/api/invitation-drafts',{id,state:{...state,background:'https://evil.test'},token})).status,200,'background is replaced with canonical template');
  const bad=structuredClone(state);bad.items[0].color='#ff0000';assert.equal((await request('/api/invitation-drafts',{state:bad,token:'c'.repeat(64)})).status,400);
  assert.equal((await fetch(base+'/api/invitation-drafts',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify({state,token})})).status,403);
  const customer={name:'Deneme Müşteri',phone:'05321112233',note:'Test kaydı'};
  const submitted=await request('/api/invitation-drafts/submit',{id,token,customer});assert.equal(submitted.data.status,'Gönderildi');
  const edited=structuredClone(state);edited.items[0].text='Nisan';
  assert.equal((await request('/api/invitation-drafts',{id,state:edited,token,version:1})).status,409,'customer cannot overwrite submission');
  const adminSave=await request('/api/admin/invitation-drafts/'+id,{state:edited,version:1},true,'PATCH');assert.equal(adminSave.status,200,JSON.stringify(adminSave));assert.equal(adminSave.data.version,2);
  assert.equal((await request('/api/admin/invitation-drafts/'+id,{state,version:1},true,'PATCH')).status,409,'stale admin save rejected');
  const record=await request('/api/admin/invitation-drafts/'+id,null,true,'GET');assert.equal(record.data.state.items[0].text,'Nisan');assert.equal(record.data.submission.state.items[0].text,'Mart');assert.equal(record.data.tokenHash,undefined);assert.ok(record.data.history.length);
  const list=await request('/api/admin/invitation-drafts',null,true,'GET');assert.equal(list.data.drafts.length,1);assert.equal(list.data.drafts[0].customer.phone,customer.phone);
  assert.equal((await request('/api/invitation-drafts/'+id,null,false,'GET')).status,404);
  const secondModel=JSON.parse(fs.readFileSync(path.join(root,'assets/davetiye/sade22503-editor-template.json')));const secondSaved=await request('/api/invitation-drafts',{state:secondModel,token:'d'.repeat(64)});assert.equal(secondSaved.status,200,JSON.stringify(secondSaved));const secondRecord=await request('/api/admin/invitation-drafts/'+secondSaved.data.id,null,true,'GET');assert.equal(secondRecord.data.state.items[0].font,'SadeMileGreen');assert.equal(secondRecord.data.state.printBackground,secondModel.printBackground);assert.equal(secondRecord.data.state.singlePanel,true);
  const drafts=require('../server/invitation-drafts');const checkoutInput={id:secondSaved.data.id,token:'d'.repeat(64),version:1};
  assert.throws(()=>drafts.prepareCheckout({...checkoutInput,token:'e'.repeat(64)},root,[{code:'22503'}]));
  assert.throws(()=>drafts.prepareCheckout(checkoutInput,root,[{code:'22534'}]));
  assert.throws(()=>drafts.prepareCheckout({...checkoutInput,version:2},root,[{code:'22503'}]));
  const design=drafts.prepareCheckout(checkoutInput,root,[{code:'22503'}]);assert.equal(design.state.items[0].font,'SadeMileGreen');assert.equal(design.token,undefined);
  drafts.finishCheckout(root,design,{id:'OZK-test',customerName:'Kargo Müşterisi',phone:'05321112233',notes:''});
  const linked=await request('/api/admin/invitation-drafts/'+design.id,null,true,'GET');assert.equal(linked.data.submission.quoteId,'OZK-test');assert.equal(linked.data.submission.customer.name,'Kargo Müşterisi');assert.throws(()=>drafts.prepareCheckout(checkoutInput,root,[{code:'22503'}]));
  const landscape=JSON.parse(fs.readFileSync(path.join(root,'assets/davetiye/sade22534-editor-template.json')));const thirdSaved=await request('/api/invitation-drafts',{state:landscape,token:'f'.repeat(64)});assert.equal(thirdSaved.status,200,JSON.stringify(thirdSaved));const thirdRecord=await request('/api/admin/invitation-drafts/'+thirdSaved.data.id,null,true,'GET');assert.equal(thirdRecord.data.state.canvasHeight,417);
  console.log('PASS: draft persistence, retry, private access, origin, validation, submission snapshot, editable fonts, admin revision and version conflict.');
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});if(previous===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=previous;}
})().catch(error=>{console.error(error);process.exitCode=1;});
