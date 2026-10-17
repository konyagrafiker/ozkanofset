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

async function inspectOtherDetails() {
  const urls = [
    { cat: 'Renkli', url: 'https://www.simaydavetiye.com/Davetiye-zarflari/Renkli-zarfli-davetiye-modelleri/3' },
    { cat: 'Kese', url: 'https://www.simaydavetiye.com/Davetiye-zarflari/Kese-zarfli-davetiye-modelleri/4' }
  ];

  for (const u of urls) {
    const page = await fetch(u.url);
    const linkMatch = page.match(/<div class="liste"><a href='([^']+)'/i);
    if (linkMatch) {
      const prodUrl = 'https://www.simaydavetiye.com' + linkMatch[1];
      const prodHtml = await fetch(prodUrl);
      const h1 = prodHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      console.log(`\n=== ${u.cat} (${prodUrl}) ===`);
      console.log('H1:', h1 ? h1[1].trim() : 'none');
      const idx = prodHtml.indexOf('class="dvty_aciklama"');
      if (idx !== -1) {
        const text = prodHtml.substring(idx, idx + 4000)
          .replace(/<[^>]+>/g, '\n')
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 5);
        console.log('Features & Description:');
        console.log(text.slice(0, 30).join(' | '));
      }
    }
  }
}

inspectOtherDetails();
