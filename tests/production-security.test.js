const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const runtime=require('../server/runtime'),security=require('../server/security');
(async()=>{
 const previous={...process.env},root=fs.mkdtempSync(path.join(os.tmpdir(),'ozkan-production-'));
 const server=http.createServer((req,res)=>{if(!security.middleware(req,res,new URL(req.url,'http://local').pathname,root)){res.writeHead(204);res.end();}});
 try{
  Object.assign(process.env,{NODE_ENV:'production',PUBLIC_SITE:'1',SITE_URL:'https://example.test',ADMIN_PASSWORD:'only-a-test-secret-123456789',TURNSTILE_SITE_KEY:'test-site',TURNSTILE_SECRET_KEY:'test-secret',TURNSTILE_HOSTNAME:'example.test',TRUSTED_PROXY_IPS:''});
  runtime.validate();delete process.env.ADMIN_PASSWORD;assert.throws(()=>runtime.validate());process.env.ADMIN_PASSWORD='only-a-test-secret-123456789';
  fs.mkdirSync(path.join(root,'deployment/seed'),{recursive:true});fs.writeFileSync(path.join(root,'deployment/seed/settings.json'),'{"test":"initial"}');runtime.initialize(root);
  fs.writeFileSync(path.join(root,'database/settings.json'),'{"test":"live"}');fs.writeFileSync(path.join(root,'database/quotes.json'),'[{"id":"LIVE-ORDER"}]');runtime.initialize(root);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'database/settings.json'))).test,'live');assert.equal(JSON.parse(fs.readFileSync(path.join(root,'database/quotes.json')))[0].id,'LIVE-ORDER');
  assert.equal(runtime.secure({socket:{remoteAddress:'198.51.100.1'},headers:{'x-forwarded-proto':'https'}}),false);
  assert.equal(runtime.clientAddress({socket:{remoteAddress:'198.51.100.1'},headers:{'x-forwarded-for':'1.1.1.1'}}),'198.51.100.1');
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const request=(headers={},method='GET',url='/api/admin/me')=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:url,method,headers:{Host:'example.test',...headers}},res=>{let body='';res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end();});
  assert.equal((await request({},'GET','/')).status,308);
  assert.equal((await request({'x-forwarded-proto':'https'})).status,308,'untrusted proxy cannot claim TLS');
  assert.equal((await request({authorization:'Basic '+Buffer.from('admin:'+process.env.ADMIN_PASSWORD).toString('base64')})).status,426);
  process.env.TRUSTED_PROXY_IPS='127.0.0.1';
  const trusted={'x-forwarded-proto':'https','x-forwarded-for':'192.0.2.10'};
  assert.equal((await request({...trusted,Host:'evil.test'})).status,421);
  assert.equal((await request({...trusted,'sec-fetch-site':'cross-site'},'POST','/api/homepage')).status,403);
  const auth={...trusted,authorization:'Basic '+Buffer.from('admin:'+process.env.ADMIN_PASSWORD).toString('base64')};const ok=await request(auth);assert.equal(ok.status,200);assert.equal(ok.headers['cache-control'],'no-store');assert.match(ok.headers['strict-transport-security'],/max-age/);assert.equal(ok.headers['x-frame-options'],'DENY');
  for(let i=0;i<15;i++)assert.equal((await request({...trusted,'x-forwarded-for':'192.0.2.11'})).status,401);
  assert.equal((await request({...auth,'x-forwarded-for':'192.0.2.11'})).status,429,'login blocked before authentication after failures');
  assert.equal((await request({...auth,'x-forwarded-for':'192.0.2.12'})).status,200,'other clients have separate quotas');
  assert.equal(runtime.clientAddress({socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'1.1.1.1, 192.0.2.12'}}),'192.0.2.12');
  console.log('PASS: production requirements, TLS/proxy/host validation, admin access, CSRF, login throttling, independent IP quotas and persistent records.');
 }finally{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
})().catch(error=>{console.error(error);process.exitCode=1;});

