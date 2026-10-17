const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const security=require('../server/security');
async function main(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ozkan-security-'));fs.mkdirSync(path.join(root,'database'));fs.writeFileSync(path.join(root,'database','quotes.json'),'[]');
 const previous=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='security-test-only';
 const server=http.createServer((req,res)=>{if(!security.middleware(req,res,new URL(req.url,'http://localhost').pathname,root)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 async function proof(){const c=await (await fetch(base+'/api/security-challenge')).json();await new Promise(r=>setTimeout(r,1100));const numbers=c.question.match(/\d+/g).map(Number);return {token:c.token,answer:numbers[0]+numbers[1]};}
 async function post(data){const r=await fetch(base+'/api/custom-quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};}
 const valid={customerName:'Test Customer',phone:'05422044699',notes:'Kraft kartona tek renk baskı',quantity:500};
 try {
 assert.equal((await fetch(base+'/api/quotes')).status,401);
 assert.equal((await fetch(base+'/admin',{headers:{Authorization:'Basic '+Buffer.from('admin:security-test-only').toString('base64')}})).status,404);
 assert.equal((await post(valid)).status,400,'missing proof rejected');
 const token=await proof();const saved=await post({...valid,security:token});assert.equal(saved.status,201);assert.equal((await post({...valid,security:token})).status,400,'token cannot replay');
 const duplicate=await post({...valid,phone:'+90 (542) 204 46 99',security:await proof()});assert.equal(duplicate.status,201,'same person can request another quote');assert.notEqual(duplicate.data.quote.id,saved.data.quote.id);
 valid.phone='05321112233';
 const records=JSON.parse(fs.readFileSync(path.join(root,'database','quotes.json'),'utf8'));assert.equal(records.length,2);assert.equal(records[0].type,'ozel_uretim');assert.equal(records[0].quantity,500);
 assert.equal((await post({...valid,security:await proof(),files:[{name:'design.exe',data:Buffer.from('MZ').toString('base64')}]})).status,400);
 assert.equal((await post({...valid,security:await proof(),files:[{name:'design.pdf',data:Buffer.from('not a pdf').toString('base64')}]})).status,400);
 assert.equal((await post({...valid,security:{...await proof(),website:'spam'}})).status,400);
 assert.equal((await fetch(base+'/api/custom-quotes',{method:'POST',headers:{Origin:'https://attacker.example'},body:'{}'})).status,403);
 const previousScanner=process.env.ANTIVIRUS_SCANNER;process.env.ANTIVIRUS_SCANNER=path.join(root,'scanner-not-installed.exe');
 try {assert.equal((await post({...valid,security:await proof(),files:[{name:'design.pdf',data:Buffer.from('%PDF-1.4\nTest only').toString('base64')}]})).status,400);assert.equal(fs.readdirSync(path.join(root,'database','private-quote-files')).length,0,'failed scan removes private file');}finally{if(previousScanner===undefined)delete process.env.ANTIVIRUS_SCANNER;else process.env.ANTIVIRUS_SCANNER=previousScanner;}
 assert.equal((await post(valid)).status,429);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'database','quotes.json'),'utf8')).length,2);
 console.log('Admin authorization, custom quote persistence, challenge/replay, honeypot, origin, file rejection and rate limit checks passed.');
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});if(previous===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=previous;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
