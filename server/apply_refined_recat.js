const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = 'E:/Ozkanofset/database/products.json';
const scraped = JSON.parse(fs.readFileSync('E:/Ozkanofset/server/scraped_details.json', 'utf8'));
const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

const caycumaSet = new Set(scraped.caycuma7);
const ikiliSet = new Set(scraped.ikili7);
const tekliSet = new Set(scraped.tekli11);
const ucluSet = new Set(scraped.uclu6);
const keseSet = new Set(scraped.kese4);
const kraftSet = new Set(scraped.kraft2);
const renkliSet = new Set(scraped.renkli3);
const beyazSet = new Set(scraped.beyaz1);

function categorize(p) {
  const img = path.basename(p.image || '').toLowerCase();
  const code = (p.code || '').trim().toLowerCase();

  // 1. User Rule: Caycuma 7 -> Beyaz Zarflı Davetiyeler
  if (caycumaSet.has(img) || img.includes('yeni_7') || code.includes('yeni_7')) {
    return 'Beyaz Zarflı Davetiyeler';
  }

  // 2. User Rule: Ikili Set 7 -> İkili Set (Zarfsız) Davetiyeler
  if (ikiliSet.has(img) || img.startsWith('iki') || code.startsWith('iki') || code.startsWith('adm')) {
    return 'İkili Set (Zarfsız) Davetiyeler';
  }

  // 3. User Rule: Tekli 11 -> Ekonomik Tekli Set (Zarfsız) Davetiyeler
  if (tekliSet.has(img) || img.startsWith('et') || code.startsWith('et') || code.startsWith('p11') || code.startsWith('p20')) {
    return 'Ekonomik Tekli Set (Zarfsız) Davetiyeler';
  }

  // 4. Üçlü Set 6 -> Üçlü Set (Zarfsız) Davetiyeler
  if (ucluSet.has(img) || img.startsWith('uc') || code.startsWith('uc')) {
    return 'Üçlü Set (Zarfsız) Davetiyeler';
  }

  // 5. Renkli Zarflı Davetiyeler (274 in Simay)
  if (renkliSet.has(img) || code.startsWith('rb') || code.startsWith('rs') || code.startsWith('bt')) {
    return 'Renkli Zarflı Davetiyeler';
  }

  // 6. Kese Zarflı Davetiyeler (225 in Simay)
  if (keseSet.has(img) || code.startsWith('kk') || code.startsWith('ks') || code.startsWith('rk')) {
    return 'Kese Zarflı Davetiyeler';
  }

  // 7. Kraft Zarflı Davetiyeler (224 in Simay, minus caycuma)
  if (kraftSet.has(img) || code.startsWith('ck') || code.startsWith('tuk') || code.startsWith('tu')) {
    return 'Kraft Zarflı Davetiyeler';
  }

  // 8. Beyaz Zarflı Davetiyeler (including sünnet and classic beyaz)
  return 'Beyaz Zarflı Davetiyeler';
}

let updated = 0;
const distribution = {};

for (const p of products) {
  if (p.type === 'davetiye' || p.isDavetiye) {
    const cat = categorize(p);
    p.category = cat;
    p.subCategory = cat;
    p.description = `Özkan Ofset kalitesiyle üretilen özel tasarım ${cat} modeli. 1. sınıf dokulu lüks fantezi kağıt, yüksek çözünürlüklü ofset/varak baskı seçenekleri ile sunulmaktadır.`;
    distribution[cat] = (distribution[cat] || 0) + 1;
    updated++;
  }
}

fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
console.log(`Successfully updated ${updated} products in products.json!`);
console.log('Final counts:');
console.table(distribution);
