const fs=require('fs');
const path=require('path');
function dayKey(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function cleanEvent(data){
 const type=String(data.type||'');const allowed=['home','portal','category','product','legal','checkout','invitation'];if(!allowed.includes(type))return null;
 let key=String(data.key||'').trim().slice(0,120);if(type==='home')key='home';if(!key||/[<>\x00-\x1f]/.test(key))return null;
 let source='Doğrudan / bilinmiyor';if(data.entry&&data.referrer){try{const host=new URL(data.referrer).hostname.toLowerCase();if(/(^|\.)google\.[a-z.]+$/.test(host))source='Google';else if(/(^|\.)bing\.com$/.test(host))source='Bing';else if(/(^|\.)instagram\.com$/.test(host))source='Instagram';else if(/(^|\.)facebook\.com$/.test(host))source='Facebook';else source=host.slice(0,100);}catch{}}
 return {id:type+':'+key,type,key,title:String(data.title||key).replace(/[<>\x00-\x1f]/g,'').slice(0,160),entry:!!data.entry,source};
}
function create(root){
 const file=path.join(root,'database','traffic-stats.json');let days={},dirty=false,timer=null,writing=false;const limits=new Map();
 try{days=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{}
 function trim(){const cutoff=dayKey(new Date(Date.now()-89*86400000));for(const key of Object.keys(days))if(key<cutoff)delete days[key];}
 function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;flush();},30000);timer.unref?.();}
 async function flush(){if(writing){schedule();return;}if(!dirty)return;dirty=false;writing=true;trim();try{await fs.promises.writeFile(file+'.tmp',JSON.stringify(days));await fs.promises.rename(file+'.tmp',file);}catch(e){dirty=true;console.error('İstatistik kaydı yazılamadı:',e.message);schedule();}finally{writing=false;if(dirty)schedule();}}
 function record(data,now=new Date()){const event=cleanEvent(data);if(!event)return false;const date=dayKey(now);const d=days[date]??={views:0,entries:0,pages:{},sources:{},landings:{}};
 if(!d.pages[event.id]&&Object.keys(d.pages).length>=10000)return false;
 const p=d.pages[event.id]??={type:event.type,key:event.key,title:event.title,views:0};p.views++;p.title=event.title;d.views++;
 if(event.entry){d.entries++;const source=Object.keys(d.sources).length<200||d.sources[event.source]?event.source:'Diğer';d.sources[source]=(d.sources[source]||0)+1;const id=source+'|'+event.id;if(!d.landings[id]&&Object.keys(d.landings).length>=10000){dirty=true;schedule();return true;}const landing=d.landings[id]??={source,type:event.type,key:event.key,title:event.title,entries:0};landing.entries++;}
 dirty=true;schedule();return true;}
 function report(period='today',now=new Date()){const today=dayKey(now);let start=today,end=today;const date=new Date(today+'T12:00:00Z');if(period==='yesterday'){date.setUTCDate(date.getUTCDate()-1);start=end=dayKey(date);}else if(period==='week'){date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));start=dayKey(date);}else if(period==='month')start=today.slice(0,7)+'-01';
 const result={start,end,views:0,entries:0,pages:[],sources:[],landings:[],daily:[]};const pages={},sources={},landings={};for(const [key,d]of Object.entries(days)){if(key<start||key>end)continue;result.views+=d.views;result.entries+=d.entries;result.daily.push({date:key,views:d.views,entries:d.entries});for(const [id,p]of Object.entries(d.pages)){const target=pages[id]??={...p,views:0};target.views+=p.views;}for(const [source,count]of Object.entries(d.sources))sources[source]=(sources[source]||0)+count;for(const [id,l]of Object.entries(d.landings)){const target=landings[id]??={...l,entries:0};target.entries+=l.entries;}}
 result.pages=Object.values(pages).sort((a,b)=>b.views-a.views).slice(0,50);result.sources=Object.entries(sources).map(([source,entries])=>({source,entries})).sort((a,b)=>b.entries-a.entries);result.landings=Object.values(landings).sort((a,b)=>b.entries-a.entries).slice(0,50);result.daily.sort((a,b)=>a.date.localeCompare(b.date));return result;}
 function handle(req,res,pathname){if(pathname==='/api/admin/traffic'&&req.method==='GET'){const period=new URL(req.url,'http://local').searchParams.get('period');res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(report(period)));return true;}
 if(pathname!=='/api/traffic/view')return false;
 if(req.method!=='POST'){res.writeHead(405);res.end();return true;}
 const origin=req.headers.origin;if(origin&&origin!=='http://'+req.headers.host&&origin!=='https://'+req.headers.host){res.writeHead(403);res.end();return true;}
 if(/bot|crawler|spider|headless/i.test(req.headers['user-agent']||'')){res.writeHead(204);res.end();return true;}
 const now=Date.now();if(limits.size>5000)for(const [key,value]of limits)if(value.until<now)limits.delete(key);
 const ip=req.socket?.remoteAddress||'local';const count=limits.get(ip)||{count:0,until:now+60000};if(count.until<now){count.count=0;count.until=now+60000;}limits.set(ip,count);if(++count.count>120){res.writeHead(429);res.end();return true;}
 let content='',size=0;req.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size<=2048)content+=chunk;});req.on('end',()=>{if(size>2048){res.writeHead(413);res.end();return;}try{if(!record(JSON.parse(content))){res.writeHead(400);res.end();return;}res.writeHead(204);res.end();}catch{res.writeHead(400);res.end();}});return true;}
 return {handle,record,report,flush};
}
module.exports={create,dayKey,cleanEvent};
