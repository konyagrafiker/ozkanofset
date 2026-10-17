const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

async function inspectDetail() {
  const url = 'https://www.simaydavetiye.com/EKONOMIK-DAVETIYE-KRAFT-MODELI/2398';
  const html = await fetch(url);
  const idx = html.indexOf('class="dvty_aciklama"');
  if (idx !== -1) {
    const raw = html.substring(idx + 1500, idx + 6000);
    const textLines = raw.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 5);
    console.log('--- After Prices ---');
    console.log(textLines.slice(0, 50).join('\n'));
  }
}

inspectDetail();
