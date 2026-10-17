const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
if(fs.existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
try{
 if(!require('../server/runtime').production())throw Error('NODE_ENV=production ayarlanmalı.');
 require('../server/runtime').validate();
 for(const file of ['server/server.js','client/public/index.html','admin/public/index.html','assets/js/custom-quotes.js'])if(!fs.existsSync(path.join(root,file)))throw Error('Eksik dosya: '+file);
 console.log('Canlı ortam ayarları ve giriş dosyaları kontrol edildi.');
 console.log('Ayrıca hosting üzerinde HTTPS, proxy başlıkları, kalıcı disk ve dosya izinlerini doğrulayın.');
}catch(error){console.error('Yayın ayarı eksik: '+error.message);process.exitCode=1;}
