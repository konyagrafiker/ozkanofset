const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = 'E:/Ozkanofset/database/products.json';
const BACKUP_FILE = 'E:/Ozkanofset/database/products.backup_before_recat.json';
const SIMAY_CATS_FILE = 'E:/Ozkanofset/server/simay_cats.json';

const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
const simayCats = JSON.parse(fs.readFileSync(SIMAY_CATS_FILE, 'utf8'));

// Backup
fs.writeFileSync(BACKUP_FILE, JSON.stringify(products, null, 2), 'utf8');
console.log('Backed up database to', BACKUP_FILE);

// Build image -> category map from scraped data
const imgToCat = new Map();
for (const c of simayCats) {
  for (const img of c.images) {
    const base = path.basename(img).toLowerCase();
    if (!imgToCat.has(base)) {
      imgToCat.set(base, c.name);
    }
  }
}

function getNewCategory(p) {
  const img = path.basename(p.image || '').toLowerCase();
  const code = (p.code || '').trim().toLowerCase();

  // 1. Direct scraped image match
  if (imgToCat.has(img)) {
    return imgToCat.get(img);
  }

  // 2. Sünnet davetiyeleri (sn101 - sn118) -> Beyaz Zarflı Davetiyeler
  if (code.startsWith('sn') || img.includes('sunnet')) {
    return 'Beyaz Zarflı Davetiyeler';
  }

  // 3. IKI / Ikili / Zarfsiz Katlamalı (P...) -> Ekonomik Tekli Set (Zarfsız) Davetiyeler
  if (img.startsWith('iki') || code.startsWith('iki') || code.startsWith('adm') || code.startsWith('p11') || code.startsWith('p20')) {
    return 'Ekonomik Tekli Set (Zarfsız) Davetiyeler';
  }

  // 4. Code prefix fallbacks
  if (code.startsWith('uc') || img.startsWith('uc')) {
    return 'Üçlü Set (Zarfsız) Davetiyeler';
  }
  if (code.startsWith('kk') || code.startsWith('ks') || code.startsWith('rk') || img.startsWith('kk') || img.startsWith('ks')) {
    return 'Kese Zarflı Davetiyeler';
  }
  if (code.startsWith('ck') || code.startsWith('tuk') || code.startsWith('tu') || img.startsWith('ck')) {
    return 'Kraft Zarflı Davetiyeler';
  }
  if (code.startsWith('rb') || code.startsWith('rs') || code.startsWith('bt') || img.startsWith('rb') || img.startsWith('rs')) {
    return 'Renkli Zarflı Davetiyeler';
  }
  if (code.startsWith('bk') || code.startsWith('dav') || code.startsWith('bzi') || code.startsWith('ybz')) {
    return 'Beyaz Zarflı Davetiyeler';
  }

  return 'Beyaz Zarflı Davetiyeler';
}

let updatedCount = 0;
const distribution = {};

for (const p of products) {
  if (p.type === 'davetiye' || p.isDavetiye) {
    const newCat = getNewCategory(p);
    p.category = newCat;
    p.subCategory = newCat;
    p.description = `Özkan Ofset kalitesiyle üretilen özel tasarım ${newCat} modeli. 1. sınıf dokulu lüks fantezi kağıt, yüksek çözünürlüklü ofset/varak baskı seçenekleri ile sunulmaktadır.`;
    
    distribution[newCat] = (distribution[newCat] || 0) + 1;
    updatedCount++;
  }
}

fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');

console.log(`Successfully updated ${updatedCount} davetiye products in products.json!`);
console.log('Final Category Distribution:');
console.log(JSON.stringify(distribution, null, 2));
