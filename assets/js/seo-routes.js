(function(root){
function slug(value){return String(value||'urun').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'urun';}
function sector(p){return p.type==='davetiye'||p.isDavetiye?'davetiye':p.type==='matbaa'?'matbaa':'promosyon';}
function productPath(p){return '/'+sector(p)+'/'+encodeURIComponent(String(p.id))+'/'+slug(p.title||p.name||p.code);}
function parseProductPath(path){const m=path.match(/^\/(davetiye|promosyon|matbaa)\/([^/]+)\/([^/]+)\/?$/);if(!m)return null;try{return {sector:m[1],id:decodeURIComponent(m[2])};}catch{return null;}}
const api={slug,sector,productPath,parseProductPath};if(typeof module!=='undefined')module.exports=api;else root.OzkanSeoRoutes=api;
})(typeof window==='undefined'?globalThis:window);
