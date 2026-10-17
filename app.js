const fs=require('fs'),path=require('path');
const env=path.join(__dirname,'.env');
if(fs.existsSync(env)){
 if(typeof process.loadEnvFile!=='function')throw Error('Node.js 22 veya üzeri gereklidir.');
 process.loadEnvFile(env);
}
require('./server/server');
