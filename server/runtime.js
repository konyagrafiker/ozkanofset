const fs=require('fs'),path=require('path'),net=require('net');
function production(){return process.env.NODE_ENV==='production'||process.env.PUBLIC_SITE==='1';}
function trustedProxy(req){return String(process.env.TRUSTED_PROXY_IPS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(req.socket?.remoteAddress);}
function secure(req){return !!req.socket?.encrypted||(trustedProxy(req)&&req.headers?.['x-forwarded-proto']==='https');}
function clientAddress(req){const forwarded=String(req.headers?.['x-forwarded-for']||'').split(',').at(-1).trim();return trustedProxy(req)&&net.isIP(forwarded)?forwarded:req.socket?.remoteAddress||'local';}
function validate(){
 if(!production())return;
 if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<20||process.env.ADMIN_PASSWORD.length>128)throw Error('Canlı ortam için ADMIN_PASSWORD 20–128 karakter olmalıdır.');
 if(!process.env.SITE_URL||new URL(process.env.SITE_URL).protocol!=='https:')throw Error('Canlı ortam için HTTPS SITE_URL tanımlayın.');
 if(!process.env.TURNSTILE_SITE_KEY||!process.env.TURNSTILE_SECRET_KEY||!process.env.TURNSTILE_HOSTNAME)throw Error('Canlı ortamda Turnstile site/gizli anahtarı ve hostname gereklidir.');
}
function initialize(root){
 const db=path.join(root,'database');fs.mkdirSync(db,{recursive:true,mode:0o700});
 const seed=path.join(root,'deployment','seed');
 if(fs.existsSync(seed))for(const name of fs.readdirSync(seed))if(name.endsWith('.json')&&!fs.existsSync(path.join(db,name)))fs.copyFileSync(path.join(seed,name),path.join(db,name),fs.constants.COPYFILE_EXCL);
 for(const name of ['quotes.json','customers.json','users.json','invitation-drafts.json'])if(!fs.existsSync(path.join(db,name)))fs.writeFileSync(path.join(db,name),'[]',{flag:'wx',mode:0o600});
}
module.exports={production,trustedProxy,secure,clientAddress,validate,initialize};
