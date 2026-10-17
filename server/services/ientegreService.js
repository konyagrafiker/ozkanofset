const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const DATABASE_DIR = path.resolve(__dirname, '../../database');
const SETTINGS_FILE = path.join(DATABASE_DIR, 'ientegre_settings.json');
const STARTER_PACK_DIR = process.env.IENTEGRE_STARTER_DIR || path.join(DATABASE_DIR, 'ientegre-starter');
const PRODUCTS_FILE = path.join(DATABASE_DIR, 'products.json');
const CATEGORIES_PRM_FILE = path.join(DATABASE_DIR, 'categories_promosyon.json');

function getSettings() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) return {};
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8').replace(/^\uFEFF/, '');
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

function saveSettings(newSettings) {
    const current = getSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
}

function postJson(urlStr, postData, userAgent) {
    return new Promise((resolve) => {
        try {
            const urlObj = new URL(urlStr);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const payload = JSON.stringify(postData);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + (urlObj.search || ''),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'User-Agent': userAgent || 'ozkanofset.com',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 15000
            };

            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data.replace(/^\uFEFF/, ''));
                        resolve({ success: true, data: parsed, statusCode: res.statusCode });
                    } catch (err) {
                        resolve({ success: false, raw: data, error: 'JSON parse error' });
                    }
                });
            });

            req.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ success: false, error: 'Request timeout' });
            });

            req.write(payload);
            req.end();
        } catch (e) {
            resolve({ success: false, error: e.message });
        }
    });
}

async function queryApi(tip, extra = {}, allowFallback = true) {
    const settings = getSettings();
    if (settings.hash && settings.ebayi_eposta) {
        const postData = {
            ebayi_eposta: settings.ebayi_eposta,
            hash: settings.hash,
            tip: tip,
            ...extra
        };
        const res = await postJson(settings.apiUrl || 'http://www.birikimpromosyon.com/api/json/', postData, settings.website_url);
        if (res.success && res.statusCode >= 200 && res.statusCode < 300 && res.data) {
            return res.data;
        }
    }

    if (!allowFallback) return null;
    // Fallback to starter pack json if API credentials not yet active or offline
    const localFile = path.join(STARTER_PACK_DIR, `${tip}.json`);
    if (fs.existsSync(localFile)) {
        try {
            const raw = fs.readFileSync(localFile, 'utf8').replace(/^\uFEFF/, '');
            return JSON.parse(raw);
        } catch (e) {
            console.error('Local JSON parse error:', e.message);
        }
    }
    return null;
}

async function syncAll() {
    console.log('[iEntegre] Starting synchronization...');
    const settings = getSettings();
    const margin = parseFloat(settings.profitMargin) || 35;

    // 1. Kategorileri Çek
    const rawCategories = await queryApi('tum_kategoriler', {}, false);
    const rawUstCategories = await queryApi('tum_ustkategoriler', {}, false);
    const rawProducts = await queryApi('tum_urunler', {}, false);
    if (!Array.isArray(rawCategories) || !Array.isArray(rawUstCategories) || !rawProducts || typeof rawProducts !== 'object' || Object.keys(rawProducts).length === 0) {
        throw new Error('Güncel katalog alınamadı. Mevcut ürünler korunuyor; başlangıç paketiyle değiştirilmedi.');
    }
    if (!Object.values(rawProducts).every(p => p && Number(p.urun_id) > 0)) {
        throw new Error('Ürün API yanıtı geçersiz. Mevcut katalog korunuyor.');
    }

    // Kategori hiyerarşisi oluştur
    const ustMap = {};
    rawUstCategories.forEach(u => {
        ustMap[u.kategori_id] = {
            id: u.kategori_id,
            name: u.isim,
            subCategories: []
        };
    });

    rawCategories.forEach(c => {
        if (ustMap[c.ustkategori_id]) {
            ustMap[c.ustkategori_id].subCategories.push({
                id: c.kategori_id,
                name: c.isim,
                image: c.resim || '',
                icon: c.kat_icon || ''
            });
        }
    });

    fs.writeFileSync(CATEGORIES_PRM_FILE, JSON.stringify({
        topCategories: Object.values(ustMap),
        allCategories: rawCategories
    }, null, 2), 'utf8');

    // Alt kategori ID -> Üst kategori eşleme tablosu
    const subToTopMap = {};
    Object.values(ustMap).forEach(top => {
        top.subCategories.forEach(sub => {
            subToTopMap[sub.id] = {
                subId: sub.id,
                subName: sub.name,
                topId: top.id,
                topName: top.name
            };
        });
    });

    // 2. Ürünleri Çek
    const productList = Array.isArray(rawProducts) ? rawProducts : Object.values(rawProducts);
    console.log(`[iEntegre] Fetched ${productList.length} promotional products.`);

    const promoProducts = productList.map(p => {
        const parsedPrice = Number(String(p.urun_fiyat ?? '').trim().replace(',', '.'));
        const costPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : null;
        const sellPrice = costPrice === null ? null : Math.round(costPrice * (1 + margin / 100) * 100) / 100;
        const totalStock = parseInt(p.toplam_stok) || 0;

        const rawImgs = [p.resim1, p.resim2, p.resim3, p.resim4, p.resim5, p.resim6].filter(Boolean);
        const imgs = rawImgs.map(img => {
            let clean = String(img).trim();
            if (clean.startsWith('http://')) clean = clean.replace('http://', 'https://');
            return clean;
        });
        const mainImg = imgs[0] || '/assets/promosyon/categories/promosyon-termoslar-002.jpg';

        const catMapping = subToTopMap[p.kategori_id];
        const topCatName = catMapping ? catMapping.topName : 'Promosyon';
        const topCatId = catMapping ? catMapping.topId : 0;
        const subCatName = catMapping ? catMapping.subName : (p.kategori_adi || 'Genel');
        const subCatId = p.kategori_id;

        return {
            id: `prm_${p.urun_id}`,
            originalId: p.urun_id,
            code: p.urun_kodu || String(p.urun_id),
            codeGroup: p.urun_kodgrup || '',
            title: p.urun_isim || p.urun_baslik || 'Kurumsal Promosyon Ürünü',
            name: p.urun_isim || p.urun_baslik || 'Kurumsal Promosyon Ürünü',
            type: 'promosyon',
            isPromosyon: true,
            topCategory: topCatName,
            topCategoryId: topCatId,
            subCategory: subCatName,
            subCategoryId: subCatId,
            category: subCatName,
            categoryId: subCatId,
            costPrice: costPrice,
            price: sellPrice,
            sourcePrice: costPrice,
            priceOnRequest: sellPrice === null,
            priceRange: sellPrice === null ? 'Fiyat Sorunuz' : `${sellPrice.toFixed(2)} ₺ + KDV`,
            stock: totalStock,
            inStock: totalStock > 0,
            image: mainImg,
            images: imgs,
            traseUrl: p.urun_trase || '',
            color: p.urun_renk || '',
            size: p.urun_ebat || '',
            features: [
                'Firma Logosu Lazer veya UV Baskı Seçeneği',
                p.urun_renk ? `Renk: ${p.urun_renk}` : null,
                p.urun_ebat ? `Ebat: ${p.urun_ebat}` : null,
                `Toplam Depo Stoğu: ${totalStock} Adet`
            ].filter(Boolean),
            description: p.urun_aciklama || `Özkan Ofset yüksek baskı kalitesi ve toptan avantajlı fiyatlarla ${p.urun_isim || 'promosyon ürünü'}.`,
            minQuantity: null, // Tedarikçi API minimum sipariş adedi sağlamıyor.
            badge: totalStock > 500 ? 'Çok Satan' : 'Kurumsal Tercih',
            updatedAt: new Date().toISOString()
        };
    });

    // 3. Mevcut Veritabanındaki Davetiye ve Matbaa Ürünlerini Koru
    let existingProducts = [];
    if (fs.existsSync(PRODUCTS_FILE)) {
        try {
            const raw = fs.readFileSync(PRODUCTS_FILE, 'utf8').replace(/^\uFEFF/, '');
            existingProducts = JSON.parse(raw);
        } catch (e) {}
    }

    const davetiyeProducts = existingProducts.filter(p => p.type === 'davetiye' || p.isDavetiye);
    const matbaaProducts = existingProducts.filter(p => p.type === 'matbaa');

    // Özel Matbaa Ürünleri boş ise ekle
    let finalMatbaa = matbaaProducts;
    if (finalMatbaa.length === 0) {
        finalMatbaa = [
            {
                id: 'mat_gemici_1',
                code: 'MT-GM01',
                title: '3 Bloklu Gemici Takvimi (Özel Firma Logolu)',
                name: '3 Bloklu Gemici Takvimi',
                type: 'matbaa',
                category: 'Kurumsal Matbaa',
                price: 45.00,
                priceRange: '45.00 TL / Adet',
                stock: 10000,
                inStock: true,
                image: '/assets/promosyon/categories/promosyon-matbaa-urunler.jpg',
                description: 'Firma reklam alanlı, spiralli, göstergeli 3 aylık gemici takvimi. 350 gr Amerikan Bristol sıvama karton.',
                minQuantity: 100,
                badge: 'Matbaa Klasiği'
            },
            {
                id: 'mat_kup_1',
                code: 'MT-KP01',
                title: 'Özel Ahşap / Karton Kutulu Küp Bloknot',
                name: 'Kutulu Küp Bloknot',
                type: 'matbaa',
                category: 'Kurumsal Matbaa',
                price: 28.50,
                priceRange: '28.50 TL / Adet',
                stock: 15000,
                inStock: true,
                image: '/assets/promosyon/sample_PRM-DFT01.jpg',
                description: '8x8 cm 500 yaprak 1. hamur kağıt, 4 renk ofset baskılı koruyucu kutulu küp notluk.',
                minQuantity: 250,
                badge: 'Çok Satan'
            },
            {
                id: 'mat_dosya_1',
                code: 'MT-CD01',
                title: 'Lüks Cepli Kurumsal Sunum Dosyası',
                name: 'Cepli Sunum Dosyası',
                type: 'matbaa',
                category: 'Kurumsal Matbaa',
                price: 18.00,
                priceRange: '18.00 TL / Adet',
                stock: 20000,
                inStock: true,
                image: '/assets/promosyon/categories/promosyon-matbaa-urunler.jpg',
                description: 'A4 evraklar ve teklifler için kartvizit geçme yuvalı, mat kuşe selefonlu cepli dosya.',
                minQuantity: 500,
                badge: 'Kurumsal İhtiyaç'
            }
        ];
    }

    const mergedProducts = [...promoProducts, ...davetiyeProducts, ...finalMatbaa];
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(mergedProducts, null, 2), 'utf8');

    // 4. Güncel Ayarları Kaydet
    saveSettings({
        lastSync: new Date().toISOString(),
        totalSyncedProducts: promoProducts.length,
        totalSyncedCategories: rawCategories.length,
        totalDavetiyeProducts: davetiyeProducts.length,
        totalMatbaaProducts: finalMatbaa.length
    });

    console.log(`[iEntegre] Sync completed! Total Promosyon: ${promoProducts.length}, Davetiye: ${davetiyeProducts.length}, Matbaa: ${finalMatbaa.length}, Grand Total: ${mergedProducts.length}`);

    return {
        success: true,
        promosyonCount: promoProducts.length,
        davetiyeCount: davetiyeProducts.length,
        matbaaCount: finalMatbaa.length,
        categoriesCount: rawCategories.length,
        totalCount: mergedProducts.length
    };
}

async function getLiveStock(urunId) {
    const numId = parseInt(String(urunId).replace('prm_', ''));
    if (!numId) return null;

    const res = await queryApi('tekil_stok_fiyat', { urun_id: numId }, false);
    if (!res || res.toplam_stok === undefined || res.toplam_stok === null || String(res.toplam_stok).trim() === '' || !Number.isFinite(Number(res.toplam_stok)) || Number(res.toplam_stok) < 0) {
        throw new Error('Güncel stok doğrulanamadı. Lütfen tekrar deneyiniz.');
    }
    return res;
}

async function refreshStockPrices() {
    const data = await queryApi('tum_stok_fiyatlar', {}, false);
    if (!data || typeof data !== 'object' || !Object.keys(data).length) throw new Error('Güncel stok/fiyat verisi alınamadı. Mevcut kayıtlar korundu.');
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8').replace(/^\uFEFF/, ''));
    const margin = Number(getSettings().profitMargin ?? 35);
    let updated = 0, hidden = 0, priceOnRequest = 0;
    for (const product of products) {
        if (product.type !== 'promosyon') continue;
        const row = data[product.originalId || String(product.id).replace(/^prm_/, '')];
        if (!row || row.toplam_stok == null || !Number.isFinite(Number(row.toplam_stok)) || !Object.hasOwn(row, 'urun_fiyat')) continue;
        const price = Number(String(row.urun_fiyat ?? '').replace(',', '.'));
        const known = Number.isFinite(price) && price > 0;
        product.sourcePrice = known ? price : null;
        product.costPrice = known ? price : null;
        product.price = known ? Math.round(price * (1 + margin / 100) * 100) / 100 : null;
        product.priceOnRequest = !known;
        product.priceRange = known ? `${product.price.toFixed(2)} ₺ + KDV` : 'Fiyat Sorunuz';
        product.sourceVatRate = row.fiyat_kdv;
        product.stock = Math.max(0, Number(row.toplam_stok));
        product.inStock = product.stock > 0;
        product.updatedAt = new Date().toISOString();
        updated++;
        if (!known) priceOnRequest++;
        if (!known && !product.inStock) hidden++;
    }
    if (!updated) throw new Error('API yanıtında eşleşen geçerli ürün bulunamadı. Kayıtlar korundu.');
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
    saveSettings({ lastStockPriceSync: new Date().toISOString() });
    return { success: true, updated, hidden, priceOnRequest };
}

module.exports = {
    getSettings,
    saveSettings,
    queryApi,
    syncAll,
    refreshStockPrices,
    getLiveStock
};
