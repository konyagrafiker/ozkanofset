(() => {
 'use strict';
 const $ = id => document.getElementById(id), canvas = $('card'), ctx = canvas.getContext('2d');
 const modelFromUrl=new URLSearchParams(location.search).get('template');
 const chosenModel=['feather','bristol','sade22500','sade22503','sade22534'].includes(modelFromUrl)?modelFromUrl:'sade22500';
 const productId=({sade22500:1301,sade22503:1185,sade22534:1216})[chosenModel];if(productId){$('backToProduct').href='/#urun='+productId;$('backToProduct').textContent='Ürüne dön ↗';}
 const KEY = 'ozkan-invitation-demo-v1-'+chosenModel, margin = 80;
 const watermarkLogo = new Image();
 let watermarkReady = false, watermarkMark = null;
 $('download').disabled = true;
 watermarkLogo.onload = () => {
  watermarkMark=document.createElement('canvas');watermarkMark.width=320;watermarkMark.height=Math.round(320*watermarkLogo.naturalHeight/watermarkLogo.naturalWidth);
  const mark=watermarkMark.getContext('2d');mark.drawImage(watermarkLogo,0,0,watermarkMark.width,watermarkMark.height);
  const pixels=mark.getImageData(0,0,watermarkMark.width,watermarkMark.height);
  for(let i=0;i<pixels.data.length;i+=4){const ink=255-Math.min(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=90;pixels.data[i+3]=ink;}
  mark.putImageData(pixels,0,0);watermarkReady = true; $('download').disabled = false; $('downloadBottom').disabled=false; draw();
 };
 watermarkLogo.onerror = () => { status('Filigran logosu yüklenemedi. Önizlemeyi indirmek için sayfayı yenileyin.'); };
 watermarkLogo.src = '/assets/ozkan-brand-original.jpg';
 const fonts = ['SadeAkayla','SadeBerkeley','SadeMileGreen','SadeManifold','CatalogScript1','CatalogScript2','CatalogScript3','CatalogScript4','CatalogScript5','CatalogScript6','CatalogScript7','CatalogScript8','CatalogScript9','CatalogScript10','CatalogScript11','CatalogScript12','CatalogScript13','CatalogScript14','CatalogScript15','CatalogScript16','CatalogScript17','CatalogScript18','CatalogScript19','CatalogScript20','CatalogScript21','CatalogScript22','CatalogScript23','CatalogScript24','CatalogScript25','SadeNewParis','SadeCaslon','Georgia', 'Times New Roman', 'Arial', 'Verdana', 'Trebuchet MS', 'Palatino Linotype', 'Book Antiqua', 'Cambria', 'Constantia', 'Calibri', 'Segoe UI', 'Tahoma', 'Courier New', 'Comic Sans MS', 'cursive'];
 const initial = () => ({ template: 'olive', background: null, items: [
  {text:'BİRLİKTE BİR ÖMRE',x:500,y:310,size:22,font:'Arial',color:'#69755b',align:'center',style:'normal'},
  {text:'Elif & Emre',x:500,y:470,size:78,font:'Georgia',color:'#354c3d',align:'center',style:'italic'},
  {text:'Hayatımızın en güzel başlangıcında\nsizleri de aramızda görmekten\nmutluluk duyarız.',x:500,y:650,size:30,font:'Georgia',color:'#52604d',align:'center',style:'normal'},
  {text:'24 EKİM 2026 · CUMARTESİ\nSAAT 19.00',x:500,y:850,size:25,font:'Arial',color:'#354c3d',align:'center',style:'normal'},
  {text:'Çiçek Bahçesi\nKadıköy / İstanbul',x:500,y:1020,size:30,font:'Georgia',color:'#52604d',align:'center',style:'normal'}
 ]});
 let viewMode='print', inlineEdit=null;
 let state = initial(), selected = 1, bg = null, printBg=null, history = [], future = [], drag = null;
 const snapshot = () => JSON.stringify(state);
 const status = message => { $('status').textContent = message; };
 const current = () => state.items[selected];
 function remember(entry) { if(history.at(-1)?.state!==entry.state) history.push(entry); if(history.length>40) history.shift(); future=[]; }
 function checkpoint() { remember({state:snapshot(), selected}); }
 function fontString(item) { return `${item.style==='normal'?'':item.style+' '}${item.size}px ${item.font==='cursive'?'cursive':'"'+item.font+'"'}`; }
 const isPanelTemplate=()=>['sade22500','sade22503','sade22534'].includes(state.template);
 const accessoryMode=()=>isPanelTemplate()&&viewMode==='accessory';
 const areaLabel=item=>state.singlePanel?'':item.area==='accessory'?'Aksesuar · ':item.area==='inside'?'İç · ':'Kapak · ';
 const itemVisible=item=>!isPanelTemplate()||(productMode()?(state.singlePanel?item.area!=='accessory':item.area==='cover'):accessoryMode()?item.area==='accessory':item.area!=='accessory');
 const productMode=()=>isPanelTemplate()&&viewMode==='product';
 function areaBounds(item){if(!isPanelTemplate())return{x:80,y:80,width:840,height:1240};if(item.area==='accessory')return{x:270,y:470,width:460,height:460};return{x:40,y:state.canvasHeight?20:40,width:920,height:(state.canvasHeight||1400)-(state.canvasHeight?40:80)};}
 function layout(item) {
  if(item.type==='symbol')return{lines:[],width:item.size,height:item.size};
  if(item.type==='line')return{lines:[],width:item.direction==='vertical'?Math.max(16,item.thickness):item.length,height:item.direction==='vertical'?item.length:Math.max(16,item.thickness)};
  ctx.font=fontString(item);
  const lines=[];
  for (const paragraph of item.text.split('\n')) {
   let line='';
   for(const char of paragraph) { if(ctx.measureText(line+char).width>areaBounds(item).width && line) {lines.push(line);line='';} line+=char; }
   lines.push(line);
  }
  return {lines, width:Math.max(12,...lines.map(line=>ctx.measureText(line).width)),height:lines.length*item.size*(item.area==='accessory'?.8:(item.lineSpacing||1.35))};
 }
 function clamp(item) {
  const bounds=areaBounds(item);let box=layout(item);
  while(box.height>bounds.height && item.size>16) {item.size--;box=layout(item);}
  item.y=Math.max(bounds.y,Math.min(bounds.y+bounds.height-box.height,item.y));
  const left=item.align==='center'?box.width/2:item.align==='right'?box.width:0;
  item.x=Math.max(bounds.x+left,Math.min(bounds.x+bounds.width-(box.width-left),item.x));
  return {x:item.x-left,y:item.y,width:box.width,height:box.height,...box};
 }
 function decoration() {
  ctx.fillStyle=state.template==='rose'?'#fcf1ef':state.template==='plain'?'#ffffff':'#fcf9ef';ctx.fillRect(0,0,1000,canvas.height);
  if(state.template==='plain')return;
  ctx.strokeStyle=state.template==='rose'?'#c4988a':'#adac7b';ctx.lineWidth=2;ctx.strokeRect(48,48,904,1304);ctx.strokeRect(59,59,882,1282);
  if(state.template==='olive') {
   for(const [ox,oy,rotation] of [[135,150,-.6],[865,1250,2.54]]) {
    ctx.save();ctx.translate(ox,oy);ctx.rotate(rotation);ctx.strokeStyle='#7e8e67';ctx.beginPath();ctx.moveTo(-40,100);ctx.quadraticCurveTo(60,0,30,-100);ctx.stroke();
    for(let i=0;i<7;i++){ctx.fillStyle=i%2?'#9ea984':'#788d6b';ctx.beginPath();ctx.ellipse(22+(i%2?24:-15),75-i*25,12,29,i%2?.7:-.7,0,Math.PI*2);ctx.fill();}ctx.restore();
   }
  } else {ctx.strokeStyle='#c4988a';for(const y of [180,1220]){ctx.beginPath();ctx.moveTo(350,y);ctx.lineTo(650,y);ctx.stroke();ctx.save();ctx.translate(500,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#c4988a';ctx.fillRect(-8,-8,16,16);ctx.restore();}}
 }
 function watermark() {
  ctx.save();
  ctx.textAlign='center';ctx.textBaseline='top';
  const single=false;
  const marks=[];
  if(single)marks.push([500,700,2]);
  else for(let row=0;row<6;row++) for(let col=0;col<3;col++) marks.push([80+col*370+(row%2?100:0),100+row*250,.78]);
  for(const [x,y,scale] of marks) {
   ctx.save();ctx.translate(x,y);ctx.rotate(-Math.PI/6);ctx.scale(scale,scale);
   if(watermarkReady){
    ctx.globalAlpha=.28;ctx.filter='brightness(0) invert(1)';ctx.drawImage(watermarkMark,-111,-48,224,224*watermarkMark.height/watermarkMark.width);
    ctx.filter='none';ctx.globalAlpha=.34;ctx.drawImage(watermarkMark,-110,-49,224,224*watermarkMark.height/watermarkMark.width);
   }
   ctx.font='24px Arial';ctx.lineWidth=1.5;ctx.strokeStyle='#ffffff';ctx.fillStyle='#555555';
   ctx.globalAlpha=.34;ctx.strokeText('www.ozkanofset.com',0,20);ctx.globalAlpha=.38;ctx.fillText('www.ozkanofset.com',0,20);
   ctx.restore();
  }
  ctx.restore();
 }
 function draw(clean=false) {
  if(isPanelTemplate()){
   ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,canvas.height);
   // Ürün görselinin dış boşluğunu kes; iki görünüm de aynı baskı koordinatlarını kullanır.
   if(!productMode()&&printBg)ctx.drawImage(printBg,0,0,1000,canvas.height);
   if(productMode()&&bg&&state.singlePanel)ctx.drawImage(bg,0,0,1000,canvas.height);
   else if(productMode()&&bg)ctx.drawImage(bg,bg.naturalWidth*.043,bg.naturalHeight*(46/1400),bg.naturalWidth*.925,bg.naturalHeight*(1326/1400),0,0,1000,canvas.height);
  }else{decoration();if(bg)ctx.drawImage(bg,0,0,1000,canvas.height);}
  watermark();
  if(!clean&&$('guides').checked&&!productMode()){
   ctx.save();ctx.setLineDash([8,8]);ctx.strokeStyle=isPanelTemplate()?'#168bc1':'#78957577';ctx.lineWidth=2;
   if(accessoryMode()){ctx.beginPath();ctx.arc(500,700,330,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#168bc1';ctx.font='24px Arial';ctx.textAlign='center';ctx.fillText('Yuvarlak aksesuar · güvenli yazı alanı',500,300);const b=areaBounds({area:'accessory'});ctx.strokeRect(b.x,b.y,b.width,b.height);}
   else if(isPanelTemplate()){
    ctx.strokeRect(0,0,1000,canvas.height);if(!state.singlePanel){ctx.beginPath();ctx.moveTo(state.foldX,0);ctx.lineTo(state.foldX,1400);ctx.stroke();}
    const b=areaBounds({area:'cover'});ctx.strokeRect(b.x,b.y,b.width,b.height);ctx.fillStyle='#168bc1';ctx.font='20px Arial';ctx.textAlign='left';if(state.singlePanel)ctx.fillText('Kartın tamamı · baskı alanı',48,32);else{ctx.fillText('Kapak içi / iç metin',48,32);ctx.fillText('Ön kapak',state.foldX+20,32);}
   }else ctx.strokeRect(80,80,840,1240);ctx.restore();
  }
  state.items.forEach((item,index)=>{
   const box=clamp(item);if(!itemVisible(item)||(!clean&&inlineEdit?.index===index))return;
   ctx.save();
   // Kuşak kartın önündedir; görünür yazılar da kuşağın üzerine basılmaz.
   if(productMode()&&state.template==='sade22503'){
    ctx.beginPath();ctx.rect(0,0,1000,canvas.height);ctx.rect(0,712,1000,575);ctx.clip('evenodd');
   }
   ctx.font=fontString(item);ctx.fillStyle=item.color;ctx.textBaseline='top';ctx.textAlign=item.align;
   if(item.type==='symbol'){drawSymbol(item,box);}else if(item.type==='line'){ctx.strokeStyle=item.color;ctx.lineWidth=item.thickness;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(box.x+(item.direction==='vertical'?box.width/2:0),box.y+(item.direction==='vertical'?0:box.height/2));ctx.lineTo(box.x+(item.direction==='vertical'?box.width/2:box.width),box.y+(item.direction==='vertical'?box.height:box.height/2));ctx.stroke();}else box.lines.forEach((line,i)=>ctx.fillText(line,item.x,item.y+i*item.size*(item.lineSpacing||1.35)));
   if(!clean&&!productMode()&&index===selected){ctx.save();ctx.strokeStyle='#718c69';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.strokeRect(box.x-8,box.y-6,box.width+16,box.height+12);ctx.setLineDash([]);ctx.beginPath();ctx.arc(box.x+box.width+8,box.y+box.height+6,handleRadius(),0,Math.PI*2);ctx.fillStyle='#304f40';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();ctx.restore();}ctx.restore();
  });
 }
 $('printView').onclick=()=>{viewMode='print';sync();};
 $('accessoryView').onclick=()=>{viewMode='accessory';selected=state.items.findIndex(item=>item.area==='accessory');sync();};
 $('productView').onclick=()=>{viewMode='product';sync();};
 $('area').onchange=()=>{if(!current()||!isPanelTemplate()||productMode())return;checkpoint();current().area=$('area').value;if(current().area==='accessory'){current().x=500;current().y=600;viewMode='accessory';}else viewMode='print';clamp(current());sync();};
 const palettes={olive:['#69755b','#354c3d','#52604d'],rose:['#69755b','#354c3d','#52604d'],plain:['#69755b','#354c3d','#52604d'],feather:['#191919'],bristol:['#191919'],sade22534:['#191919'],sade22503:['#191919'],sade22500:['#191919']};
 const palette=()=>palettes[state.template]||['#191919'];
 const presets=[
  {name:'Zarif isimler',lines:[['Elif & Emre',94,'Georgia','italic'],['BİRLİKTE BİR ÖMRE',22,'Arial','normal']]},
  {name:'Modern isimler',lines:[['ELİF & EMRE',70,'Arial','bold'],['Mutluluğumuza ortak olun',29,'Georgia','normal']]},
  {name:'Davet metni',lines:[['Düğünümüze Davetlisiniz',48,'Georgia','italic'],['Bu özel günümüzde sizleri de aramızda\ngörmekten mutluluk duyarız.',28,'Georgia','normal']]},
  {name:'Kına gecesi',lines:[['Kına Gecesi',56,'Georgia','italic'],['01 Ocak 2030 Salı Günü\nSaat 19.00',30,'Arial','normal'],['Mekân adı ve adresi',27,'Arial','normal']]},
  {name:'Nikâh töreni',lines:[['Nikâh Töreni',56,'Georgia','italic'],['01 Ocak 2030 Salı Günü\nSaat 19.00',30,'Arial','normal'],['Mekân adı ve adresi',27,'Arial','normal']]},
  {name:'Düğün daveti',lines:[['Düğün',60,'Georgia','italic'],['01 Ocak 2030 Salı Günü\nSaat 19.00',30,'Arial','normal'],['Mekân adı ve adresi',27,'Arial','normal']]},
  {name:'Aileler',lines:[['Gelin ailesi & Damat ailesi',38,'Georgia','italic'],['SOYADI                         SOYADI',23,'Arial','normal']]}
 ];
 presets.forEach(preset=>{
  const button=document.createElement('button');button.className='preset';button.type='button';button.setAttribute('aria-label',preset.name+' grubunu ekle');
  for(const [text,size,font,style] of preset.lines){const line=document.createElement('span');line.textContent=text;line.style.fontFamily=font;line.style.fontSize=Math.max(10,Math.min(23,size/4))+'px';line.style.fontStyle=style==='italic'?'italic':'normal';line.style.fontWeight=style==='bold'?'bold':'normal';button.append(line);}
  const label=document.createElement('small');label.textContent='+ '+preset.name;button.append(label);
  button.onclick=()=>{
   if(state.items.length+preset.lines.length>20){status('Bu grup için yeterli alan yok. En fazla 20 yazı alanı kullanılabilir.');return;}
   const preferredArea=accessoryMode()?'accessory':current()?.area==='inside'?'inside':'cover';
   const areas=isPanelTemplate()&&!accessoryMode()?[preferredArea,preferredArea==='cover'?'inside':'cover']:[preferredArea];
   let placement=null;
   for(const area of areas){
    let offset=0;
    const additions=preset.lines.map(([text,size,font,style])=>{const item={text,size,font,style,x:500,y:offset,color:palette()[0],align:'center',...(isPanelTemplate()?{area}:{})};offset+=layout(item).height+20;return item;});
    const available=areaBounds(additions[0]);const groupHeight=offset-20,groupWidth=Math.max(...additions.map(item=>layout(item).width));
    const occupied=state.items.filter(item=>!isPanelTemplate()||(area==='accessory'?item.area==='accessory':item.area!=='accessory')).map(item=>clamp(item));const gap=12;
    // Tam orta ve nesne kenarları adaydır; geniş metinler tarama adımının arasına takılmaz.
    const xs=new Set([available.x+available.width/2,available.x+groupWidth/2,available.x+available.width-groupWidth/2]);
    const ys=new Set([available.y,available.y+available.height-groupHeight]);
    for(const o of occupied){xs.add(o.x-gap-groupWidth/2);xs.add(o.x+o.width+gap+groupWidth/2);ys.add(o.y+o.height+gap);ys.add(o.y-gap-groupHeight);}
    for(let y=available.y;y+groupHeight<=available.y+available.height;y+=10)ys.add(y);
    let position=null;
    for(const y of [...ys].sort((a,b)=>a-b)){
     if(y<available.y||y+groupHeight>available.y+available.height+.01)continue;
     for(const x of xs){
      const boxes=additions.map(item=>{const box=layout(item);return{x:x-box.width/2,y:y+item.y,width:box.width,height:box.height};});
      if(boxes.every(box=>box.x>=available.x-.01&&box.x+box.width<=available.x+available.width+.01&&occupied.every(o=>box.x+box.width+gap<=o.x||o.x+o.width+gap<=box.x||box.y+box.height+gap<=o.y||o.y+o.height+gap<=box.y))){position={x,y};break;}
     }if(position)break;
    }
    if(position){placement={additions,position,area};break;}
   }
   if(!placement){status('Bu grubu baskı sınırları içinde, diğer öğelerle çakışmadan yerleştirecek alan bulunamadı. Daha küçük bir grup seçin veya öğeleri taşıyın.');return;}
   checkpoint();selected=state.items.length;placement.additions.forEach(item=>{item.x=placement.position.x;item.y+=placement.position.y;state.items.push(item);});sync();status(preset.name+' grubu '+(isPanelTemplate()?(placement.area==='inside'?'iç bölümdeki':placement.area==='accessory'?'aksesuardaki':'kapaktaki')+' boş alana':'boş alana')+' eklendi.');

  };

  $('presets').append(button);
 });
 function sync() {
  if(canvas.height!==(state.canvasHeight||1400))canvas.height=state.canvasHeight||1400;
  document.querySelector('.paper').classList.toggle('landscape',canvas.height<canvas.width);
  document.querySelector('.paper').style.setProperty('--card-ratio',canvas.width/canvas.height);
  if(inlineEdit)finishInline(true,false);
  $('viewModes').hidden=!isPanelTemplate();$('accessoryView').hidden=!!state.singlePanel;$('viewNote').hidden=!isPanelTemplate();$('areaControl').hidden=!isPanelTemplate()||!!state.singlePanel;
  $('printView').setAttribute('aria-pressed',String(viewMode==='print'));$('accessoryView').setAttribute('aria-pressed',String(viewMode==='accessory'));$('productView').setAttribute('aria-pressed',String(viewMode==='product'));
  $('viewNote').textContent=state.template==='sade22534'?'Yatay iç kart · yazılar ürün üzerinde aynı konumda görünür.':state.singlePanel?(productMode()?'Ürün görünümü: yazıların yalnızca kuşağın örttüğü kısmı gizlenir. Kuşağın dışına taşıdığınız yazılar görünür.':'Baskı görünümü: isimler, aileler, tarih, etkinlik ve salon bilgileri düzenlenebilir.'):accessoryMode()?'Mührün harflerini burada düzenleyin. Aksesuar ayrı olarak düzenlenir; ürün görseline yerleştirilmez.':productMode()?'Kapalı ürün görünümü: yalnızca ön kapak yazıları görünür. İç yazılar baskı düzeninde saklanır.':'Ortadaki mavi çizgi katlama referansıdır; yazı ve simgeleri çizginin iki tarafına da taşıyabilirsiniz. Ürün görünürlüğünü sağdaki baskı alanı seçimi belirler.';
  $('size').max=current()?.area==='accessory'?900:300;
  $('addLine').disabled=productMode();document.querySelectorAll('#symbolTools button').forEach(button=>button.disabled=productMode());for(const id of ['lineDirection','lineLength','lineWeight'])$(id).disabled=productMode();
  if(current()?.type==='line'){$('lineDirection').value=current().direction;$('lineLength').value=current().length;$('lineWeight').value=current().thickness;}
  $('area').querySelector('[value=cover]').textContent=state.singlePanel?'Ürün üzerinde görünür':'Ön kapak · ürün görselinde görünür';$('area').querySelector('[value=inside]').textContent=state.singlePanel?'Kuşak altında · ürün görselinde gizli':'Kapak içi / iç metin · kapalı görselde görünmez';$('area').querySelector('[value=accessory]').hidden=!!state.singlePanel;
  $('area').disabled=!current()||productMode();if(current())$('area').value=current().area||'cover';
  document.querySelectorAll('#presets button').forEach(button=>button.disabled=productMode());$('add').disabled=productMode();

  const colors=palette();$('color').replaceChildren(...colors.map((color,index)=>{const option=document.createElement('option');option.value=color;option.textContent=colors.length===1?'Orijinal yazı rengi':'Şablon rengi '+(index+1);option.style.color=color;return option;}));
  state.items.forEach(item=>{if(!colors.includes(item.color))item.color=colors[0];});
  const item=current();$('layers').replaceChildren();
  state.items.forEach((item,index)=>{const button=document.createElement('button');button.textContent=(isPanelTemplate()?areaLabel(item):'')+(item.label||item.text.replace(/\n/g,' ')||'Boş yazı');button.className=index===selected?'active':'';button.onclick=()=>{selected=index;if(isPanelTemplate())viewMode=item.area==='accessory'?'accessory':'print';sync();};$('layers').append(button);});
  for(const id of ['text','font','size','color','align','style']){$(id).disabled=!item||productMode()||(item.type==='line'&&id!=='color')||(item.type==='symbol'&&!['size','color'].includes(id));if(item)$(id).value=id==='size'?Math.round(item.size*10)/10:item[id];}
  $('delete').disabled=!item||productMode();$('selectedModel').textContent=({sade22534:'Sade · 22 534',sade22503:'Sade · 22 503',sade22500:'Sade · 22 500',bristol:'Sade Bristol',feather:'Tüylü davetiye'})[chosenModel];$('undo').disabled=!history.length;$('redo').disabled=!future.length;draw();
 }
 for(const id of ['text','font','size','color','align','style']) {
  let editing=false;
  $(id).addEventListener('input',()=>{const item=current();if(!item)return;if(!editing){checkpoint();editing=true;}let value=$(id).value;if(id==='size'){value=Number(value);if(!Number.isFinite(value))return;value=Math.max(16,Math.min(item.area==='accessory'?900:300,value));}if(id==='color'&&!palette().includes(value))return;item[id]=value;clamp(item);draw();$('undo').disabled=false;$('redo').disabled=true;const layer=$('layers').children[selected];if(layer)layer.textContent=(isPanelTemplate()?areaLabel(item):'')+(item.label||item.text.replace(/\n/g,' ')||'Boş yazı');});
  $(id).addEventListener('change',()=>{editing=false;sync();});
  $(id).addEventListener('blur',()=>{editing=false;});
 }
 $('font').addEventListener('change',()=>{const font=$('font').value;document.fonts.load('40px '+font).then(()=>draw()).catch(()=>status('Font yüklenemedi.'));});
 $('add').onclick=()=>{if(state.items.length>=20){status('En fazla 20 yazı alanı ekleyebilirsiniz.');return;}checkpoint();state.items.push({...initial().items[2],text:'Yeni yazınız',y:canvas.height/2,color:palette()[0],...(isPanelTemplate()?{area:(accessoryMode()?'accessory':current()?.area==='accessory'?'inside':current()?.area)||'inside'}:{})});selected=state.items.length-1;sync();$('text').focus();};
 $('delete').onclick=()=>{if(!current())return;checkpoint();state.items.splice(selected,1);selected=Math.min(selected,state.items.length-1);sync();};
 const symbolDefinitions=[
  ['heart','Kalp','M50 90 C-10 50 0 6 28 12 C40 12 48 22 50 28 C52 22 60 12 72 12 C100 6 110 50 50 90 Z'],
  ['heartOutline','İçi boş kalp','M50 90 C-10 50 0 6 28 12 C40 12 48 22 50 28 C52 22 60 12 72 12 C100 6 110 50 50 90 Z'],
  ['star','Yıldız','M50 5 L61 36 L95 36 L68 56 L78 90 L50 70 L22 90 L32 56 L5 36 L39 36 Z'],
  ['flower','Çiçek',null],['infinity','Sonsuzluk',null],['rings','Alyans',null]
 ];
 function drawSymbol(item,box){
  ctx.save();ctx.translate(box.x,box.y);ctx.scale(box.width/100,box.height/100);ctx.fillStyle=item.color;ctx.strokeStyle=item.color;ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';
  const shape=symbolDefinitions.find(s=>s[0]===item.symbol);
  if(shape?.[2]){const path=new Path2D(shape[2]);if(item.symbol==='heartOutline')ctx.stroke(path);else ctx.fill(path);}
  else if(item.symbol==='flower'){
   for(let i=0;i<6;i++){ctx.save();ctx.translate(50,50);ctx.rotate(i*Math.PI/3);ctx.beginPath();ctx.ellipse(0,-24,11,21,0,0,Math.PI*2);ctx.fill();ctx.restore();}ctx.beginPath();ctx.arc(50,50,8,0,Math.PI*2);ctx.fill();
  }else if(item.symbol==='infinity'){
   ctx.beginPath();ctx.moveTo(50,50);ctx.bezierCurveTo(15,0,-15,65,18,72);ctx.bezierCurveTo(42,82,60,16,82,28);ctx.bezierCurveTo(115,38,85,100,50,50);ctx.stroke();
  }else if(item.symbol==='rings'){
   for(const x of [35,65]){ctx.beginPath();ctx.ellipse(x,52,25,32,x===35?-.3:.3,0,Math.PI*2);ctx.stroke();}
  }ctx.restore();
 }
 for(const [key,label,path] of symbolDefinitions){
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',label+' ekle');
  const marks={heart:'♥',heartOutline:'♡',star:'★',flower:'✿',infinity:'∞',rings:'⚭'};
  const span=document.createElement('span');span.textContent=marks[key];span.setAttribute('aria-hidden','true');button.append(span,document.createTextNode(label));
  button.onclick=()=>{
   if(productMode()||state.items.length>=20){status('En fazla 20 öğe eklenebilir.');return;}
   const area=accessoryMode()?'accessory':current()?.area==='inside'?'inside':'cover',b=areaBounds({area});
   const size=accessoryMode()?120:90;const occupied=state.items.filter(item=>!isPanelTemplate()||(area==='accessory'?item.area==='accessory':item.area!=='accessory')).map(item=>clamp(item));let spot=null;
   for(let y=b.y+20;y+size<=b.y+b.height&&!spot;y+=30)for(let x=b.x+size/2+10;x+size/2<=b.x+b.width;x+=30){const left=x-size/2;if(occupied.every(o=>left+size+12<=o.x||o.x+o.width+12<=left||y+size+12<=o.y||o.y+o.height+12<=y)){spot={x,y};break;}}
   if(!spot){status('Simge için boş alan bulunamadı. Önce diğer öğeleri taşıyın.');return;}
   checkpoint();state.items.push({type:'symbol',symbol:key,text:label,size,font:'Arial',style:'normal',align:'center',color:palette()[0],area,...spot});selected=state.items.length-1;sync();status(label+' eklendi. Taşıyabilir ve köşesinden boyutlandırabilirsiniz.');
  };$('symbolTools').append(button);
 }
 for(const [font,label] of [['SadeAkayla','Akayla'],['SadeMileGreen','Mile Green'],['SadeNewParis','NewParis'],['Georgia','Klasik']]){
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',label+' & ekle');
  const span=document.createElement('span');span.textContent='&';span.style.fontFamily=font;button.append(span,document.createTextNode(label));
  button.onclick=async()=>{if(productMode()||state.items.length>=20)return;await document.fonts.load('60px '+font);checkpoint();const area=accessoryMode()?'accessory':'cover';state.items.push({text:'&',x:500,y:canvas.height/2,size:60,font,style:'normal',align:'center',color:palette()[0],area});selected=state.items.length-1;sync();status(label+' & işareti eklendi.');};$('symbolTools').append(button);
 }
 function lineValues(){return{direction:$('lineDirection').value,length:Math.max(20,Math.min(840,Number($('lineLength').value)||200)),thickness:Math.max(1,Math.min(12,Number($('lineWeight').value)||2))};}
 $('addLine').onclick=()=>{
  if(productMode()||state.items.length>=20){status('En fazla 20 öğe eklenebilir.');return;}
  checkpoint();const area=accessoryMode()?'accessory':current()?.area==='inside'?'inside':'cover';const bounds=areaBounds({area});const values=lineValues();values.length=Math.min(values.length,values.direction==='vertical'?bounds.height:bounds.width);
  state.items.push({type:'line',text:'Çizgi',area,x:bounds.x+bounds.width/2,y:bounds.y+(bounds.height-(values.direction==='vertical'?values.length:16))/2,size:16,font:'Arial',style:'normal',align:'center',color:palette()[0],...values});selected=state.items.length-1;sync();status('Çizgi eklendi. Sürükleyerek yerini değiştirebilirsiniz.');
 };
 for(const id of ['lineDirection','lineLength','lineWeight'])$(id).addEventListener('change',()=>{if(current()?.type!=='line'||productMode())return;checkpoint();Object.assign(current(),lineValues());const b=areaBounds(current());current().length=Math.min(current().length,current().direction==='vertical'?b.height:b.width);clamp(current());sync();});
 const templateCache={};
 async function openTemplate(name){
  if(name!==chosenModel)return;
  try{
   if(!templateCache[name]){const response=await fetch('/assets/davetiye/'+name+'-editor-template.json');if(!response.ok)throw new Error();templateCache[name]=await response.json();}
   if(name==='sade22534')await Promise.all([document.fonts.load('40px SadeAkayla'),document.fonts.load('40px SadeBerkeley')]);
   if(name==='sade22503')await Promise.all([document.fonts.load('40px SadeMileGreen'),document.fonts.load('40px SadeManifold')]);
   if(name==='sade22500')await Promise.all([document.fonts.load('30px SadeNewParis'),document.fonts.load('30px SadeCaslon')]);
   if(state.template===name)checkpoint();else{history=[];future=[];}state=JSON.parse(JSON.stringify(templateCache[name]));viewMode='print';selected=name==='feather'?7:name==='sade22500'?5:0;loadBackground();status(name==='sade22534'?'22 534 yatay kartı açıldı. Yazıları düzenleyebilir, yeni metin ve simge ekleyebilirsiniz.':name==='sade22503'?'22 503 açıldı. Katalogdaki Mile Green ve Manifold fontlarıyla düzenleyebilirsiniz.':name==='sade22500'?'22 500: iç metin ve ön kapak alanları açıldı. Ürün önizlemesinde yalnızca kapak yazıları görünür.':'Şablon açıldı. Metinler düzenlenebilir; orijinal yazıların yerine deneme fontları kullanılıyor.');
  }catch{status('Şablon yüklenemedi.');}
 }
 $('guides').onchange=()=>draw();

 function restore(entry){state=JSON.parse(entry.state);selected=Math.min(Math.max(entry.selected,0),state.items.length-1);loadBackground();}
 $('undo').onclick=()=>{while(history.length && history.at(-1).state===snapshot())history.pop();if(history.length){future.push({state:snapshot(),selected});restore(history.pop());status('Son değişiklik geri alındı.');}else sync();};
 $('redo').onclick=()=>{if(future.length){history.push({state:snapshot(),selected});restore(future.pop());status('Değişiklik yeniden uygulandı.');}};
 $('reset').onclick=()=>{if(['feather','bristol','sade22500','sade22503','sade22534'].includes(state.template)){openTemplate(state.template);return;}checkpoint();state=initial();selected=1;bg=null;sync();status('İlk tasarıma dönüldü. Geri al ile önceki düzeni getirebilirsiniz.');};
 function loadBackground(){printBg=null;if(state.printBackground){const image=new Image(),source=state.printBackground;image.onload=()=>{if(state.printBackground===source){printBg=image;draw();}};image.src=source;}Promise.all([...new Set(state.items.map(item=>item.font))].map(font=>document.fonts.load('40px '+font))).then(()=>draw()).catch(()=>status('Bir font yüklenemedi.'));bg=null;sync();if(state.background){const source=state.background,img=new Image();img.onload=()=>{if(state.background===source){bg=img;draw();}};img.onerror=()=>status('Şablon görseli açılamadı.');img.src=source;}}
 function finishInline(commit=true,refresh=true){
  if(!inlineEdit)return;
  const edit=inlineEdit;inlineEdit=null;$('inlineText').hidden=true;
  if(commit){if(snapshot()!==edit.before)remember({state:edit.before,selected:edit.index});}
  else state=JSON.parse(edit.before);
  selected=edit.index;if(refresh)sync();
 }
 function positionInline(){
  if(!inlineEdit)return;
  const input=$('inlineText'),item=state.items[inlineEdit.index],box=clamp(item),scale=canvas.getBoundingClientRect().width/1000;
  const width=Math.min(1000-box.x,Math.max(120/scale,box.width+24));
  input.style.left=box.x*scale+'px';input.style.top=box.y*scale+'px';input.style.width=width*scale+'px';
  input.style.font=fontString(item);input.style.fontSize=item.size*scale+'px';input.style.lineHeight=String(item.lineSpacing||1.35);input.style.color=item.color;input.style.textAlign=item.align;
  input.style.height='0px';input.style.height=(input.scrollHeight+2)+'px';
 }
 function hitItem(p,textOnly=false){
  const hits=[];
  state.items.forEach((item,index)=>{
   if(!itemVisible(item)||(textOnly&&['line','symbol'].includes(item.type)))return;
   const box=clamp(item);let boxes=[box];
   if(!['line','symbol'].includes(item.type)){
    ctx.save();ctx.font=fontString(item);ctx.textBaseline='top';ctx.textAlign=item.align;
    boxes=box.lines.map((line,n)=>{const m=ctx.measureText(line||' ');return{x:item.x-m.actualBoundingBoxLeft,y:item.y+n*item.size*(item.lineSpacing||1.35)-m.actualBoundingBoxAscent,width:Math.max(8,m.actualBoundingBoxLeft+m.actualBoundingBoxRight),height:Math.max(8,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)};});ctx.restore();
   }
   for(const b of boxes)if(p.x>=b.x-6&&p.x<=b.x+b.width+6&&p.y>=b.y-6&&p.y<=b.y+b.height+6){hits.push({index,distance:Math.hypot((p.x-b.x-b.width/2)/Math.max(1,b.width),(p.y-b.y-b.height/2)/Math.max(1,b.height))});}
  });
  hits.sort((a,b)=>a.distance-b.distance||b.index-a.index);return hits[0]?.index??-1;
 }
 canvas.ondblclick=e=>{
  if(productMode())return;
  const p=point(e);
  const i=hitItem(p,true);if(i>=0){const item=state.items[i];
   selected=i;sync();inlineEdit={index:i,before:snapshot()};const input=$('inlineText');input.value=item.text;input.hidden=false;positionInline();draw();input.focus();input.select();status('Enter: kaydet · Shift+Enter: yeni satır · Esc: iptal');e.preventDefault();
  }

 };
 $('inlineText').addEventListener('input',()=>{if(!inlineEdit)return;state.items[inlineEdit.index].text=$('inlineText').value;positionInline();draw();});
 $('inlineText').addEventListener('blur',()=>finishInline());
 $('inlineText').addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();finishInline(false);canvas.focus();}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();finishInline();canvas.focus();}});
 window.addEventListener('resize',positionInline);
 const point=e=>{const rect=canvas.getBoundingClientRect();return{x:(e.clientX-rect.left)*1000/rect.width,y:(e.clientY-rect.top)*canvas.height/rect.height};};
 function handleRadius(){return 12*1000/(canvas.getBoundingClientRect().width||460);}
 canvas.onpointerdown=e=>{if(productMode())return;
  const p=point(e);
  if(current()&&itemVisible(current())){
   const box=clamp(current()),hx=box.x+box.width+8,hy=box.y+box.height+6;
   if(Math.hypot(p.x-hx,p.y-hy)<=handleRadius()*1.6){drag={before:snapshot(),selection:selected,mode:'resize',size:current().size,length:current().length,box,distance:Math.max(1,Math.hypot(p.x-box.x,p.y-box.y))};canvas.setPointerCapture(e.pointerId);canvas.focus();return;}
  }
  const i=hitItem(p);if(i>=0){selected=i;drag={before:snapshot(),selection:selected,mode:'move',x:p.x-current().x,y:p.y-current().y};canvas.setPointerCapture(e.pointerId);sync();canvas.focus();return;}

  selected=-1;sync();
 };
 canvas.onpointermove=e=>{if(productMode()){canvas.style.cursor='default';return;}
  const p=point(e);
  if(!drag){let resize=false;if(current()&&itemVisible(current())){const box=clamp(current());resize=Math.hypot(p.x-box.x-box.width-8,p.y-box.y-box.height-6)<=handleRadius()*1.6;}canvas.style.cursor=resize?'nwse-resize':'grab';return;}
  if(drag.mode==='resize'&&current().type==='line'){const bounds=areaBounds(current());current().length=Math.round(Math.max(20,Math.min(current().direction==='vertical'?bounds.height:bounds.width,drag.length*Math.hypot(p.x-drag.box.x,p.y-drag.box.y)/drag.distance)));$('lineLength').value=current().length;
  }else if(drag.mode==='resize'){
   current().size=Math.max(16,Math.min(current().area==='accessory'?900:300,Math.round(drag.size*Math.hypot(p.x-drag.box.x,p.y-drag.box.y)/drag.distance)));
   const box=layout(current());current().x=drag.box.x+box.width*(current().align==='center'?.5:current().align==='right'?1:0);current().y=drag.box.y;$('size').value=current().size;
  }else{current().x=p.x-drag.x;current().y=p.y-drag.y;}
  draw();
 };
 canvas.onpointerup=canvas.onpointercancel=()=>{if(drag){if(drag.before!==snapshot())remember({state:drag.before,selected:drag.selection});drag=null;sync();}};
 canvas.onkeydown=e=>{if(productMode()||!current()||!itemVisible(current())||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();checkpoint();const step=e.shiftKey?10:2;current().x+=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;current().y+=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;clamp(current());sync();};
 const staffDraftId=new URLSearchParams(location.search).get('draft');
 const staffMode=new URLSearchParams(location.search).get('staff')==='1'&&!!staffDraftId;
 let serverDraft=null;
 try{serverDraft=JSON.parse(localStorage.getItem(KEY+'-server'));}catch{}
 function makeToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
 if(!serverDraft||serverDraft.model!==chosenModel)serverDraft={model:chosenModel,token:makeToken()};
 function draftLabel(){
  $('draftReference').textContent=serverDraft.id?'Tasarım numaranız: '+serverDraft.id+' · '+(serverDraft.status||'Taslak')+' · Baskı onayı değildir.':'Henüz sunucuya kaydedilmedi.';
  $('newDraft').hidden=staffMode||!serverDraft.submittedAt;
 }
 function storeLocal(){if(staffMode)return;try{localStorage.setItem(KEY,snapshot());if(!staffMode)localStorage.setItem(KEY+'-server',JSON.stringify(serverDraft));}catch{}}
 async function draftApi(url,method,data){const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});const result=await response.json();if(!response.ok)throw Error(result.error||'Taslak kaydedilemedi.');return result;}
 function smallPreview(){
  draw(true);const output=document.createElement('canvas');output.width=700;output.height=Math.round(canvas.height*.7);const c=output.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,700,output.height);c.drawImage(canvas,0,0,700,output.height);draw();return output;
 }
 async function persistServer(){
  finishInline();if(state.background&&!bg)throw Error('Şablon görselinin yüklenmesini bekleyin.');
  await Promise.all([...new Set(state.items.map(item=>item.font))].map(font=>document.fonts.load('40px '+font)));
  const body={state:JSON.parse(snapshot()),version:serverDraft.version,preview:smallPreview().toDataURL('image/jpeg',.72)};
  if(!staffMode)Object.assign(body,{id:serverDraft.id,token:serverDraft.token});
  storeLocal();
  const result=await draftApi(staffMode?'/api/admin/invitation-drafts/'+encodeURIComponent(staffDraftId):'/api/invitation-drafts',staffMode?'PATCH':'POST',body);
  Object.assign(serverDraft,result);storeLocal();draftLabel();return result;
 }
 $('save').onclick=async()=>{const button=$('save');button.disabled=true;try{await persistServer();status('Düzenlenebilir taslak sunucuya kaydedildi: '+serverDraft.id);}catch(error){status(error.message);}finally{button.disabled=false;}};
 $('newDraft').onclick=()=>{serverDraft={model:chosenModel,token:makeToken()};storeLocal();draftLabel();status('Yeni taslak kopyası hazır. Önceki gönderiminiz korunuyor.');};
 $('submitDraftForm').onsubmit=async event=>{
  event.preventDefault();const button=$('submitDraft');button.disabled=true;
  try{if(!productId)throw Error('Bu taslağın ürün bağlantısı henüz hazır değil.');await persistServer();
   const previous=JSON.parse(sessionStorage.getItem('ozkan-editor-checkout')||'null');
   sessionStorage.setItem('ozkan-editor-checkout',JSON.stringify({...(previous?.productId===productId?previous:{}),productId,template:chosenModel,draftId:serverDraft.id,token:serverDraft.token,version:serverDraft.version}));
   location.assign('/?invitationCheckout=1');
  }catch(error){status(error.message);}finally{button.disabled=false;}
 };
 if(staffMode){$('submitDraftForm').hidden=true;$('save').textContent='Yönetim değişikliklerini kaydet';}
 draftLabel();
 $('downloadBottom').onclick=()=>$('download').click();
 $('download').onclick=async()=>{
  finishInline();if(state.background&&!bg){status('Şablon görseli yükleniyor. Biraz sonra tekrar deneyin.');return;}
  $('download').disabled=true;$('downloadBottom').disabled=true;
  try{
   await persistServer();
   draw(true);const output=document.createElement('canvas');output.width=700;output.height=Math.round(canvas.height*700/canvas.width);const exportContext=output.getContext('2d');exportContext.fillStyle='#fff';exportContext.fillRect(0,0,output.width,output.height);exportContext.drawImage(canvas,0,0,output.width,output.height);const contentHeight=output.height;const stamped=document.createElement('canvas');stamped.width=output.width;stamped.height=contentHeight+28;const stamp=stamped.getContext('2d');stamp.fillStyle='#fff';stamp.fillRect(0,0,stamped.width,stamped.height);stamp.drawImage(output,0,0);stamp.fillStyle='#444';stamp.font='12px Arial';stamp.textAlign='center';stamp.fillText(serverDraft.id+' · ÖZKAN OFSET · Baskı onayı değildir',350,contentHeight+18);draw();
   const blob=await new Promise(resolve=>stamped.toBlob(resolve,'image/jpeg',.82));if(!blob)throw new Error();
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=serverDraft.id+'-'+viewMode+'.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Davetiyeniz Özkan Ofset filigranlı küçük JPG görseli olarak indirildi.');
  }catch(error){draw();status(error.message||'Görsel kaydedilemedi. Lütfen tekrar deneyin.');}
  finally{$('download').disabled=!watermarkReady;$('downloadBottom').disabled=!watermarkReady;}
 };

 try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&saved.template===chosenModel&&(saved.template!=='sade22500'||saved.schemaVersion===2)&&['olive','rose','plain','feather','bristol','sade22500','sade22503','sade22534'].includes(saved.template)&&Array.isArray(saved.items)&&saved.items.length<=20&&saved.items.every(i=>typeof i.text==='string'&&i.text.length<=400&&fonts.includes(i.font)&&['normal','bold','italic'].includes(i.style)&&['left','center','right'].includes(i.align)&&/^#[0-9a-f]{6}$/i.test(i.color)&&[i.x,i.y,i.size].every(Number.isFinite)&&i.size>=16&&i.size<=900)&&(!saved.background||['/assets/davetiye/feather-editor-template.svg','/assets/davetiye/bristol-editor-background.png','/assets/davetiye/sade22500-editor-background.png','/assets/davetiye/sade22503-product.svg','/assets/davetiye/sade22534-background.svg'].includes(saved.background)||/^data:image\/png;base64,/.test(saved.background))){state=saved;selected=state.items.length?0:-1;status('Kaydettiğiniz taslak açıldı.');}}catch{/* Tarayıcı depolaması kapalı olabilir. */}
 if(state.template==='sade22500'&&!state.items.some(item=>item.area==='accessory')){state.items.push(...['S','Y'].map((text,index)=>({text,x:index?590:410,y:index?700:510,size:220,lineSpacing:1,font:'SadeNewParis',style:'normal',color:'#191919',align:'center',area:'accessory',label:index?'Mühür · ikinci harf':'Mühür · ilk harf'})));}
 window.addEventListener('resize',()=>draw());
 async function loadStaffDraft(){
  try{const record=await draftApi('/api/admin/invitation-drafts/'+encodeURIComponent(staffDraftId),'GET');if(record.state.template!==chosenModel)throw Error('Taslağın modeli ile açılan model eşleşmiyor.');await Promise.all([...new Set(record.state.items.map(item=>item.font))].map(font=>document.fonts.load('40px '+font)));state=record.state;serverDraft={id:record.id,version:record.version,status:record.status};selected=0;history=[];future=[];draftLabel();loadBackground();status('Yönetim düzenlemesi: müşterinin ilk gönderimi ayrıca korunur.');}catch(error){status(error.message);$('save').disabled=true;$('download').disabled=true;$('downloadBottom').disabled=true;}
 }
 const requestedTemplate=chosenModel;
 if(staffMode)loadStaffDraft();else if(requestedTemplate===state.template&&state.schemaVersion===2){Promise.all([document.fonts.load('30px SadeNewParis'),document.fonts.load('30px SadeCaslon')]).then(()=>loadBackground());}else if(['feather','bristol','sade22500','sade22503','sade22534'].includes(requestedTemplate))openTemplate(requestedTemplate);else loadBackground();
})();
