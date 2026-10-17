const fs = require('fs');
const https = require('https');
const path = require('path');

const categories = [
  { id: 1, name: 'Beyaz Zarflı Davetiyeler', url: 'https://www.simaydavetiye.com/Davetiye-zarflari/Beyaz-zarfli-davetiye-modelleri/1' },
  { id: 3, name: 'Renkli Zarflı Davetiyeler', url: 'https://www.simaydavetiye.com/Davetiye-zarflari/Renkli-zarfli-davetiye-modelleri/3' },
  { id: 2, name: 'Kraft Zarflı Davetiyeler', url: 'https://www.simaydavetiye.com/Davetiye-zarflari/Kraft-zarfli-davetiye-modelleri/2' },
  { id: 4, name: 'Kese Zarflı Davetiyeler', url: 'https://www.simaydavetiye.com/Davetiye-zarflari/Kese-zarfli-davetiye-modelleri/4' },
  { id: 6, name: 'Üçlü Set (Zarfsız) Davetiyeler', url: 'https://www.simaydavetiye.com/Davetiye-zarflari/Uclu-set-davetiye-modelleri/6' },
  { id: 11, name: 'Ekonomik Tekli Set (Zarfsız) Davetiyeler', url: 'https://www.simaydavetiye.com/Davetiye-zarflari/ikili-set-davetiye-modelleri/11' }
];

function fetchPage(u) {
  return new Promise((resolve, reject) => {
    https.get(u.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ ...u, html: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching SimayDavetiye category pages...');
  const catData = [];
  for (const c of categories) {
    try {
      const page = await fetchPage(c);
      const imgMatches = [...page.html.matchAll(/\/davetiye\/([^\s"'<>]+\.(?:jpg|jpeg|png|webp))/gi)].map(m => m[1]);
      const uniqueImgs = [...new Set(imgMatches)];
      const codeMatches = [...page.html.matchAll(/Davetiye\s*Kodu\s*:\s*([^<\r\n]+)/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      console.log(`[${c.name}] Found ${uniqueImgs.length} images, ${codeMatches.length} codes`);
      catData.push({
        ...c,
        images: uniqueImgs,
        codes: codeMatches
      });
    } catch (err) {
      console.error(`Error fetching ${c.name}:`, err.message);
    }
  }

  // Save scraped data for inspection
  fs.writeFileSync(path.join(__dirname, 'simay_cats.json'), JSON.stringify(catData, null, 2), 'utf8');
  console.log('Saved simay_cats.json');
}

main();
