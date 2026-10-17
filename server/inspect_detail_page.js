const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

async function inspectDetail() {
  const url = 'https://www.simaydavetiye.com/EKONOMIK-DAVETIYE-KRAFT-MODELI/2398';
  const html = await fetch(url);
  console.log('HTML length:', html.length);

  // Extract title, price block, details
  const title = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  console.log('H1:', title ? title[1].trim() : 'none');

  // Look for price table or quantities (100, 200, 300, etc.)
  const prices = [...html.matchAll(/(\d+\s*Adet[\s\S]*?(?:TL|₺|\d+))/gi)].map(m => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  console.log('Prices found:', prices.slice(0, 10));

  // Look for text descriptions / features
  const desc = html.match(/<div class="aciklama"[^>]*>([\s\S]*?)<\/div>/i) ||
               html.match(/<div class="dvty_aciklama"[^>]*>([\s\S]*?)<\/div>/i);
  if (desc) {
    console.log('Description block:');
    console.log(desc[1].replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 25).join('\n'));
  }
}

inspectDetail();
