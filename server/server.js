// ============================================================================
// OZKAN OFSET - Yerel Web Sunucusu ve Yönetim Paneli API
// Port: 4000 (Mevcut sistemlerle çakışmayan izole port)
// ============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const security = require('./security');
const seo = require('./seo');
const { ADMIN_PATH, isAdminPage } = require('./admin-route');

const PORT = Number(process.env.PORT || 4000);
if(!Number.isInteger(PORT)||PORT<0||PORT>65535)throw Error('Geçersiz PORT.');
const runtime=require('./runtime');
runtime.validate();
const ROOT_DIR = path.resolve(__dirname, '..');
runtime.initialize(ROOT_DIR);
const DB_DIR = path.join(ROOT_DIR, 'database');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const ADMIN_DIR = path.join(ROOT_DIR, 'admin');
const traffic = require('./traffic').create(ROOT_DIR);

const ientegreService = require('./services/ientegreService');
const shipping = require('../assets/js/shipping');

// MIME tipleri
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf'
};

// Yardımcı Veritabanı Fonksiyonları
function readJsonFile(filePath, defaultValue = []) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        const data = fs.readFileSync(filePath, 'utf8');
        const clean = data.replace(/^\uFEFF/, '');
        return JSON.parse(clean);
    } catch (e) {
        console.error(`Dosya okuma hatası (${filePath}):`, e.message);
        return defaultValue;
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`Dosya yazma hatası (${filePath}):`, e.message);
        return false;
    }
}

function productVisible(product, settings) {
    if (product.catalogImportPendingPrice) return false;
    if (product.type === 'davetiye' || product.isDavetiye) {
        const cards = settings.davetiyeCategoryCards || [];
        return !cards.some(card => card.active === false && [card.name, card.id].includes(product.category));
    }
    if (product.type !== 'promosyon') return true;
    const hasPrice = !product.priceOnRequest && Number(product.price) > 0;
    return hasPrice || Number(product.stock) > 0;
}

// HTTP İstek Yöneticisi
const server = http.createServer((req, res) => {
    const visibilitySettings = readJsonFile(path.join(DB_DIR, 'settings.json'), {});
    const customerVisibleProduct = product => productVisible(product, visibilitySettings);
    const parsedUrl = url.parse(req.url, true);
    let pathname;
    try { pathname = decodeURIComponent(parsedUrl.pathname); } catch { res.writeHead(400); res.end('Geçersiz adres.'); return; }
    const query = parsedUrl.query;

    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (isAdminPage(pathname) || pathname.startsWith('/api/')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    // Eski yönetim adresleri yönlendirme veya giriş ekranı göstermez.
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Sayfa bulunamadı.');
        return;
    }
    if (security.middleware(req, res, pathname, ROOT_DIR)) return;
    if (traffic.handle(req, res, pathname)) return;

    // CORS ve UTF-8 Başlıkları
    // API yalnızca aynı kaynaktan kullanılır.
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // ==========================================
    // 1. STATIK VARLIKLAR (Görseller: /assets/*)
    // ==========================================
    if (pathname === '/assets/legal.html') {
        const result = seo.renderLegal(fs.readFileSync(path.join(ASSETS_DIR,'legal.html'),'utf8'), query, visibilitySettings, req);
        res.writeHead(result.status, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache, no-store'});res.end(result.html);return;
    }
    if (pathname.startsWith('/assets/')) {
        const relativePath = pathname.substring(8);
        const filePath = path.join(ASSETS_DIR, relativePath);

        if (path.relative(ASSETS_DIR, filePath).startsWith('..') || path.isAbsolute(path.relative(ASSETS_DIR, filePath))) {
            res.writeHead(403);
            res.end('Erişim engellendi.');
            return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mime = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': mime,
                'Cache-Control': 'no-cache, must-revalidate'
            });
            fs.createReadStream(filePath).pipe(res);
            return;
        } else {
            res.writeHead(404);
            res.end('Görsel bulunamadı');
            return;
        }
    }

    // ==========================================
    // 2. REST API ENDPOINTLERİ (/api/*)
    // ==========================================
    if (pathname.startsWith('/api/')) {
        const productsFile = path.join(DB_DIR, 'products.json');
        const quotesFile = path.join(DB_DIR, 'quotes.json');
        const settingsFile = path.join(DB_DIR, 'settings.json');

        // GET /api/categories
        if (pathname === '/api/categories' && req.method === 'GET') {
            const categoriesPrmFile = path.join(DB_DIR, 'categories_promosyon.json');
            const products = readJsonFile(productsFile, []).filter(customerVisibleProduct);
            
            if (query.type === 'promosyon') {
                const catData = readJsonFile(categoriesPrmFile, { topCategories: [] });
                const promos = products.filter(p => p.type === 'promosyon');

                // Count subcategory and category products
                const subCounts = {};
                const topCounts = {};
                promos.forEach(p => {
                    const kId = p.categoryId || p.subCategoryId;
                    if (kId) subCounts[kId] = (subCounts[kId] || 0) + 1;
                    const cName = p.category || p.topCategory;
                    if (cName) topCounts[cName] = (topCounts[cName] || 0) + 1;
                });

                // Compute tree with counts
                const tree = (catData.topCategories || []).map(top => {
                    let totalTopCount = topCounts[top.name] || 0;
                    let subsTotal = 0;
                    const subs = (top.subCategories || []).map(sub => {
                        const count = subCounts[sub.id] || 0;
                        subsTotal += count;
                        return {
                            id: sub.id,
                            name: sub.name,
                            image: sub.image || '',
                            count
                        };
                    });

                    return {
                        id: top.id,
                        name: top.name,
                        count: Math.max(totalTopCount, subsTotal),
                        subCategories: subs
                    };
                });

                const flatList = Object.entries(topCounts).map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ categories: tree, flatList, totalProducts: promos.length }));
                return;
            } else if (query.type === 'davetiye') {
                const davs = products.filter(p => p.type === 'davetiye' || p.isDavetiye);
                const counts = {};
                davs.forEach(p => {
                    const c = p.category || 'Diğer';
                    counts[c] = (counts[c] || 0) + 1;
                });
                const list = Object.entries(counts).map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ categories: list, totalProducts: davs.length }));
                return;
            } else if (query.type === 'matbaa') {
                const mats = products.filter(p => p.type === 'matbaa' || (p.category && p.category.includes('Matbaa')));
                const counts = {};
                mats.forEach(p => {
                    const c = p.subCategory || p.category || 'Kurumsal Matbaa';
                    counts[c] = (counts[c] || 0) + 1;
                });
                const list = Object.entries(counts).map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ categories: list, totalProducts: mats.length }));
                return;
            }

            // Parametresiz veya type=all durumunda tüm sektörleri ayrıştırılmış olarak dön
            const davs = products.filter(p => p.type === 'davetiye' || p.isDavetiye);
            const davCounts = {};
            davs.forEach(p => { const c = p.category || 'Diğer'; davCounts[c] = (davCounts[c] || 0) + 1; });

            const promos = products.filter(p => p.type === 'promosyon');
            const promoCounts = {};
            promos.forEach(p => { const c = p.category || p.topCategory || 'Genel Promosyon'; promoCounts[c] = (promoCounts[c] || 0) + 1; });

            const mats = products.filter(p => p.type === 'matbaa' || (p.category && p.category.includes('Matbaa')));
            const matCounts = {};
            mats.forEach(p => { const c = p.subCategory || p.category || 'Kurumsal Matbaa'; matCounts[c] = (matCounts[c] || 0) + 1; });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                davetiye: {
                    total: davs.length,
                    categories: Object.entries(davCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
                },
                promosyon: {
                    total: promos.length,
                    categories: Object.entries(promoCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
                },
                matbaa: {
                    total: mats.length,
                    categories: Object.entries(matCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
                },
                totalProducts: products.length
            }));
            return;
        }

        // GET /api/products
        if (pathname === '/api/products' && req.method === 'GET') {
            const products = readJsonFile(productsFile, []);
            let filtered = query.includeUnavailable === 'true' ? products : products.filter(customerVisibleProduct);

            if (query.q) {
                const q = query.q.toLowerCase().trim();
                filtered = filtered.filter(p => 
                    (p.title && p.title.toLowerCase().includes(q)) ||
                    (p.code && p.code.toLowerCase().includes(q)) ||
                    (p.subCategory && p.subCategory.toLowerCase().includes(q)) ||
                    (p.category && p.category.toLowerCase().includes(q)) ||
                    (p.topCategory && p.topCategory.toLowerCase().includes(q))
                );
            }

            if (query.category && query.category !== 'all') {
                const catSearch = query.category.trim().toLowerCase();
                filtered = filtered.filter(p => 
                    (p.category && p.category.toLowerCase() === catSearch) ||
                    (p.subCategory && p.subCategory.toLowerCase() === catSearch) ||
                    (p.topCategory && p.topCategory.toLowerCase() === catSearch) ||
                    (p.categoryId && String(p.categoryId) === query.category) ||
                    (p.topCategoryId && String(p.topCategoryId) === query.category)
                );
            }

            if (query.topCategory && query.topCategory !== 'all') {
                const topSearch = query.topCategory.trim().toLowerCase();
                filtered = filtered.filter(p =>
                    (p.topCategory && p.topCategory.toLowerCase() === topSearch) ||
                    (p.topCategoryId && String(p.topCategoryId) === query.topCategory)
                );
            }

            if (query.subCategory && query.subCategory !== 'all') {
                const subSearch = query.subCategory.trim().toLowerCase();
                filtered = filtered.filter(p =>
                    (p.subCategory && p.subCategory.toLowerCase() === subSearch) ||
                    (p.subCategoryId && String(p.subCategoryId) === query.subCategory)
                );
            }

            if (query.type === 'davetiye' || (query.filterType === 'type' && query.category === 'davetiye')) {
                filtered = filtered.filter(p => p.type === 'davetiye' || p.isDavetiye);
            } else if (query.type === 'matbaa' || (query.filterType === 'type' && query.category === 'matbaa')) {
                filtered = filtered.filter(p => p.type === 'matbaa' || (p.category && p.category.includes('Matbaa')));
            } else if (query.type === 'promosyon' || (query.filterType === 'type' && query.category === 'promosyon')) {
                filtered = filtered.filter(p => (p.type === 'promosyon' || (!p.isDavetiye && p.type !== 'davetiye')) && p.type !== 'matbaa' && !(p.category && p.category.includes('Matbaa')));
            }

            if (query.featured === 'true' || query.filterType === 'featured') {
                filtered = filtered.filter(p => p.isFeatured || p.badge === 'Çok Satan');
            }

            if (query.type === 'davetiye' && !query.random && !query.featured && (!query.category || query.category === 'all')) {
                const catalogOrder = (visibilitySettings.davetiyeCategoryCards || []).filter(c => c.active !== false).map(c => c.name);
                const rank = category => { const index = catalogOrder.indexOf(category); return index < 0 ? catalogOrder.length : index; };
                filtered = [...filtered].sort((a, b) => rank(a.category) - rank(b.category));
            }

            if (query.filterType === 'newest') {
                filtered = [...filtered].sort((a, b) => (b.id > a.id ? 1 : -1));
            }

            if (query.random === 'true') {
                filtered = [...filtered];
                for (let i = filtered.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
                }
            }

            if (query.priorityCatalogs === 'true' && query.type === 'davetiye') {
                const catalogs = (visibilitySettings.davetiyeCategoryCards || []).filter(c => c.active !== false).slice(0, 4);
                const groups = catalogs.map(c => filtered.filter(p => p.category === c.name));
                const selection = [];
                const requestedLimit = Math.min(12, Math.max(1, parseInt(query.limit) || 12));
                for (let index = 0; selection.length < requestedLimit && groups.some(group => index < group.length); index++) {
                    for (const group of groups) {
                        if (group[index] && selection.length < requestedLimit) selection.push(group[index]);
                    }
                }
                filtered = selection;
            }

            const page = parseInt(query.page) || 1;
            const limit = parseInt(query.limit) || 24;
            const total = filtered.length;
            const totalPages = Math.ceil(total / limit);
            const startIndex = (page - 1) * limit;
            const paginated = filtered.slice(startIndex, startIndex + limit);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                total,
                page,
                limit,
                totalPages,
                items: paginated
            }));
            return;
        }

        // POST /api/products/bulk-delete (Toplu Ürün Silme)
        if (pathname === '/api/products/bulk-delete' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const ids = Array.isArray(data.ids) ? data.ids.map(String) : [];
                    if (ids.length === 0) {
                        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: 'Silinecek ürün ID listesi boş olamaz' }));
                        return;
                    }
                    const products = readJsonFile(productsFile, []);
                    const idSet = new Set(ids);
                    const beforeCount = products.length;
                    const remainingProducts = products.filter(p => !idSet.has(String(p.id)) && (!p.code || !idSet.has(p.code.toLowerCase())));
                    const deletedCount = beforeCount - remainingProducts.length;
                    writeJsonFile(productsFile, remainingProducts);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, count: deletedCount, message: `${deletedCount} adet ürün başarıyla silindi.` }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // GET /api/products/:id
        const productDetailMatch = pathname.match(/^\/api\/products\/([a-zA-Z0-9_-]+)$/);
        if (productDetailMatch && productDetailMatch[1] !== 'bulk-delete' && req.method === 'GET') {
            const id = productDetailMatch[1];
            const products = readJsonFile(productsFile, []);
            const product = products.find(p => String(p.id) === id || (p.code && p.code.toLowerCase() === id.toLowerCase()) || (p.oldCode && p.oldCode.toLowerCase() === id.toLowerCase()));
            if (product && (query.includeUnavailable === 'true' || customerVisibleProduct(product))) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(product));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ürün bulunamadı' }));
            }
            return;
        }

        // PATCH & POST /api/products/:id (Tekil Ürün Güncelleme)
        if (productDetailMatch && productDetailMatch[1] !== 'bulk-delete' && (req.method === 'PATCH' || req.method === 'POST')) {
            const id = productDetailMatch[1];
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const products = readJsonFile(productsFile, []);
                    const idx = products.findIndex(p => String(p.id) === id || (p.code && p.code.toLowerCase() === id.toLowerCase()));
                    if (idx === -1) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Ürün bulunamadı' }));
                        return;
                    }
                    products[idx] = { ...products[idx], ...data };
                    if (products[idx].price100 !== undefined && products[idx].price100 !== null) {
                        if (data.options !== undefined || data.price100 !== undefined || !data.priceTiers) {
                            const optConfig = readJsonFile(path.join(DB_DIR, 'davetiye_options_config.json'), { kliseFee: 200, davetiyeYaldizFee: 2000, zarfYaldizFee: 2000, ozelBaskiFee: 1500, aksesuarUnitFee: 2.5 });
                            calculatePolenProductTiers(products[idx], optConfig);
                        }
                    }
                    writeJsonFile(productsFile, products);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, product: products[idx] }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // DELETE /api/products/:id (Tekil Ürün Silme)
        if (productDetailMatch && productDetailMatch[1] !== 'bulk-delete' && req.method === 'DELETE') {
            const id = productDetailMatch[1];
            const products = readJsonFile(productsFile, []);
            const idx = products.findIndex(p => String(p.id) === id || (p.code && p.code.toLowerCase() === id.toLowerCase()));
            if (idx === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Ürün bulunamadı' }));
                return;
            }
            const deletedProduct = products.splice(idx, 1)[0];
            writeJsonFile(productsFile, products);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: 'Ürün başarıyla silindi', deleted: deletedProduct }));
            return;
        }

        const davetiyeConfigFile = path.join(DB_DIR, 'davetiye_config.json');
        const davetiyeOptionsFile = path.join(DB_DIR, 'davetiye_options_config.json');

        function calculatePolenProductTiers(p, optConfig) {
            if (!p.price100) return;
            const p100 = parseFloat(p.price100) || 0;
            const options = p.options || {};
            const quantities = [300, 400, 500, 600, 700, 800, 900, 1000];

            const hasKlise = options.davetiyeYaldiz || options.zarfYaldiz || options.aksesuar;
            const kliseCost = hasKlise ? Number(optConfig.kliseFee ?? 200) : 0;

            const tiers = quantities.map(qty => {
                const rawCost = (p100 / 100) * qty;
                const multiplier = Math.ceil(qty / 1000);

                const davetiyeYaldizCost = options.davetiyeYaldiz ? (multiplier * Number(optConfig.davetiyeYaldizFee ?? 2000)) : 0;
                const zarfYaldizCost = options.zarfYaldiz ? (multiplier * Number(optConfig.zarfYaldizFee ?? 2000)) : 0;
                const ozelBaskiCost = options.ozelBaski ? (multiplier * Number(optConfig.ozelBaskiFee ?? 1500)) : 0;
                const aksesuarCost = options.aksesuar ? (qty * Number(optConfig.aksesuarUnitFee ?? 2.5)) : 0;

                const total = Math.round(rawCost + kliseCost + davetiyeYaldizCost + zarfYaldizCost + ozelBaskiCost + aksesuarCost);
                const perUnitVal = (total / qty).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL / Adet';
                const labelVal = total.toLocaleString('tr-TR') + ' TL';

                return {
                    qty: qty,
                    price: total,
                    label: labelVal,
                    perUnit: perUnitVal
                };
            });

            p.priceTiers = tiers;
            if (tiers.length > 0) {
                p.price = String(tiers[0].price);
                p.minOrder = `${tiers[0].qty} Adet`;
                p.priceRange = `${tiers[0].label} / ${tiers[0].qty} Adet`;
            }
        }

        // GET /api/davetiye/options
        if (pathname === '/api/davetiye/options' && req.method === 'GET') {
            const opts = readJsonFile(davetiyeOptionsFile, {
                kliseFee: 200,
                davetiyeYaldizFee: 2000,
                zarfYaldizFee: 2000,
                ozelBaskiFee: 1500,
                aksesuarUnitFee: 2.5
            });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(opts));
            return;
        }

        // POST /api/davetiye/options (Ekstra Baskı & Aksesuar Genel Fiyat Güncellemesi)
        if (pathname === '/api/davetiye/options' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const newOpts = JSON.parse(body);
                    const currentOpts = readJsonFile(davetiyeOptionsFile, {});
                    const mergedOpts = { ...currentOpts, ...newOpts };
                    for(const key of ['kliseFee','davetiyeYaldizFee','zarfYaldizFee','ozelBaskiFee','aksesuarUnitFee'])if(mergedOpts[key]!==undefined&&(!Number.isFinite(Number(mergedOpts[key]))||Number(mergedOpts[key])<0))throw Error('Geçerli, sıfır veya pozitif ücret giriniz.');
                    if(!writeJsonFile(davetiyeOptionsFile, mergedOpts))throw Error('Ek ücretler kaydedilemedi.');

                    const products = readJsonFile(productsFile, []);
                    const feeDefaults={kliseFee:200,davetiyeYaldizFee:2000,zarfYaldizFee:2000,ozelBaskiFee:1500,aksesuarUnitFee:2.5};
                    const changedFees=Object.keys(feeDefaults).filter(key=>Number(currentOpts[key]??feeDefaults[key])!==Number(mergedOpts[key]??feeDefaults[key]));
                    const checked=products.filter(p=>p.price100!==undefined&&p.price100!==null);
                    const updatedProducts=[];
                    for(const p of checked){
                        const opt=p.options||{};
                        const affected=changedFees.some(key=>key==='kliseFee'?(opt.davetiyeYaldiz||opt.zarfYaldiz||opt.aksesuar):key==='davetiyeYaldizFee'?opt.davetiyeYaldiz:key==='zarfYaldizFee'?opt.zarfYaldiz:key==='ozelBaskiFee'?opt.ozelBaski:opt.aksesuar);
                        if(!affected)continue;
                        const before=JSON.stringify([p.priceTiers,p.price,p.minOrder,p.priceRange]);
                        calculatePolenProductTiers(p,mergedOpts);
                        if(before!==JSON.stringify([p.priceTiers,p.price,p.minOrder,p.priceRange]))updatedProducts.push({id:p.id,code:p.code||p.id,title:p.title||p.name||'',category:p.category||''});
                    }
                    if(updatedProducts.length && !writeJsonFile(productsFile, products))throw Error('Ürün fiyatları kaydedilemedi.');
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, options: mergedOpts, checkedProductsCount:checked.length,updatedProductsCount:updatedProducts.length,updatedProducts }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // POST /api/davetiye/product-options (Tekil Ürün Ekstra Baskı/Aksesuar Kutucukları Güncelleme)
        if (pathname === '/api/davetiye/product-options' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { id, options } = JSON.parse(body);
                    const products = readJsonFile(productsFile, []);
                    const idx = products.findIndex(p => String(p.id) === String(id) || (p.code && p.code.toLowerCase() === String(id).toLowerCase()));
                    if (idx === -1) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Ürün bulunamadı' }));
                        return;
                    }
                    const optConfig = readJsonFile(davetiyeOptionsFile, {
                        kliseFee: 200,
                        davetiyeYaldizFee: 2000,
                        zarfYaldizFee: 2000,
                        ozelBaskiFee: 1500,
                        aksesuarUnitFee: 2.5
                    });
                    products[idx].options = { ...(products[idx].options || {}), ...options };
                    calculatePolenProductTiers(products[idx], optConfig);
                    writeJsonFile(productsFile, products);

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, product: products[idx] }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // GET /api/davetiye/config
        if (pathname === '/api/davetiye/config' && req.method === 'GET') {
            const cfg = readJsonFile(davetiyeConfigFile, {});
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(cfg));
            return;
        }

        // POST /api/davetiye/config (Toplu Fiyat & Teknik Özellik Güncelleme)
        if (pathname === '/api/davetiye/config' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { category, config, updateProducts } = JSON.parse(body);
                    if (!category || !config) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'category ve config alanları gereklidir' }));
                        return;
                    }
                    const allConfigs = readJsonFile(davetiyeConfigFile, {});
                    allConfigs[category] = config;
                    writeJsonFile(davetiyeConfigFile, allConfigs);

                    let updatedProductCount = 0;
                    if (updateProducts) {
                        const products = readJsonFile(productsFile, []);
                        const catClean = category.trim().toLowerCase();
                        products.forEach(p => {
                            const pCat = (p.category || '').trim();
                            const isMatch = pCat === category.trim() || 
                                            pCat.toLowerCase() === catClean || 
                                            pCat.toLocaleLowerCase('tr-TR') === category.trim().toLocaleLowerCase('tr-TR');
                            if (isMatch) {
                                if (config.hasDualSize && config.sizes && config.sizes.length > 0) {
                                    const s1 = config.sizes[0];
                                    const s2 = config.sizes[1] || s1;
                                    const p1 = s1.priceTiers[0].price;
                                    const p2 = s2.priceTiers[0].price;
                                    p.price = String(p1);
                                    p.minOrder = `${s1.priceTiers[0].qty} Adet`;
                                    p.priceRange = `${p1.toLocaleString('tr-TR')} TL (${s1.name}) - ${p2.toLocaleString('tr-TR')} TL (${s2.name})`;
                                } else if (config.priceTiers && config.priceTiers.length > 0) {
                                    const base = config.priceTiers[0];
                                    p.price = String(base.price);
                                    p.minOrder = `${base.qty} Adet`;
                                    p.priceRange = `${base.price.toLocaleString('tr-TR')} TL / ${base.qty} Adet`;
                                }
                                updatedProductCount++;
                            }
                        });
                        writeJsonFile(productsFile, products);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, updatedProductCount, config: allConfigs[category] }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // GET /api/settings
        if (pathname === '/api/settings' && req.method === 'GET') {
            const settings = readJsonFile(settingsFile, {});
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(settings));
            return;
        }

        // POST /api/settings
        if (pathname === '/api/settings' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const current = readJsonFile(settingsFile, {});
                    const updated = { ...current, ...data };
                    writeJsonFile(settingsFile, updated);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, settings: updated }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // GET /api/my-ip (iEntegre Dış Bacak IP Tespiti)
        if (pathname === '/api/my-ip' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                ip: "185.152.124.148",
                provider: "iEntegre (ipbul.ientegre.com)",
                queryUrl: "https://ipbul.ientegre.com/",
                description: "Sunucunuzun dışarıya bıraktığı dış bacak IP adresi"
            }));
            return;
        }

        // GET /api/ientegre/settings
        if (pathname === '/api/ientegre/settings' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(ientegreService.getSettings()));
            return;
        }

        // POST /api/ientegre/settings
        if (pathname === '/api/ientegre/settings' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const updated = ientegreService.saveSettings(data);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, settings: updated }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        if (pathname === '/api/ientegre/refresh-stock-prices' && req.method === 'POST') {
            ientegreService.refreshStockPrices().then(result => {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(result));
            }).catch(error => {
                res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            });
            return;
        }

        // POST /api/ientegre/sync
        if (pathname === '/api/ientegre/sync' && req.method === 'POST') {
            ientegreService.syncAll().then(result => {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(result));
            }).catch(err => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            });
            return;
        }

        // GET /api/ientegre/categories
        if (pathname === '/api/ientegre/categories' && req.method === 'GET') {
            const prmCatFile = path.join(DB_DIR, 'categories_promosyon.json');
            const data = readJsonFile(prmCatFile, { topCategories: [], allCategories: [] });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/ientegre/live-stock/:id
        const liveStockMatch = pathname.match(/^\/api\/ientegre\/live-stock\/([^\/]+)$/);
        if (liveStockMatch && req.method === 'GET') {
            const id = liveStockMatch[1];
            ientegreService.getLiveStock(id).then(stockData => {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, id, stockData }));
            }).catch(err => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            });
            return;
        }

        // GET /api/homepage
        const homepageConfigFile = path.join(DB_DIR, 'homepage_config.json');
        if (pathname === '/api/homepage' && req.method === 'GET') {
            const config = readJsonFile(homepageConfigFile, { sliders: [], popularCategories: [], showcaseSections: [], references: [] });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(config));
            return;
        }

        // POST /api/homepage
        if (pathname === '/api/homepage' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const current = readJsonFile(homepageConfigFile, {});
                    const updated = { ...current, ...data };
                    writeJsonFile(homepageConfigFile, updated);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, config: updated }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // POST /api/upload (Base64 görsel yükleme)
        if (pathname === '/api/upload' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const payload = JSON.parse(body);
                    const { filename, base64Data, folder } = payload;
                    if (!filename || !base64Data) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'filename ve base64Data gereklidir.' }));
                        return;
                    }
                    if (folder && folder !== 'banners') throw Error('Geçersiz yükleme klasörü.');
                    if (!/\.(png|jpe?g|webp)$/i.test(filename) || base64Data.length > 14000000) throw Error('Geçersiz görsel veya dosya boyutu.');
                    const targetDir = path.join(ASSETS_DIR, 'banners');
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(cleanBase64, 'base64');
                    const safeName = Date.now() + '-' + path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
                    const filePath = path.join(targetDir, safeName);
                    fs.writeFileSync(filePath, buffer);
                    const publicUrl = `/assets/${folder || 'banners'}/${safeName}`;
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, url: publicUrl, filename: safeName }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // POST /api/quotes
        if (pathname === '/api/quotes' && req.method === 'POST') {
            security.body(req, res, 256000, async quoteData => {
                try {
                    await security.verify(req, quoteData);
                    if (!Array.isArray(quoteData.items) || !quoteData.items.length || quoteData.items.length > 100 || typeof quoteData.customerName !== 'string' || quoteData.customerName.length < 3 || quoteData.customerName.length > 100 || !/^[+0-9 ()-]{10,30}$/.test(quoteData.phone || '')) throw Error('Sipariş bilgilerini kontrol ediniz.');
                    if (JSON.stringify(quoteData).length > 200000 || /[<>]/.test(JSON.stringify(quoteData))) throw Error('Geçersiz form içeriği.');
                    const shippingTotals = shipping.calculate(quoteData.productSubtotal ?? null, readJsonFile(settingsFile, {}));
                    const products = readJsonFile(productsFile, []);
                    const requested = new Map();
                    for (const item of quoteData.items || []) {
                        const product = products.find(p => (item.id && String(p.id) === String(item.id)) || (item.code && p.code === item.code));
                        if (!product) {
                            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: false, error: 'Sepetteki ürün bulunamadı. Lütfen sepetinizi güncelleyiniz.' }));
                            return;
                        }
                        if (!customerVisibleProduct(product)) {
                            res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: false, error: 'Sepetinizde şu anda satışa kapalı bir ürün var. Lütfen sepetinizi güncelleyiniz.' }));
                            return;
                        }
                        if (product.fixedQuantityTiers && !(product.priceTiers || []).some(t => Number(t.qty) === Number(item.quantity ?? item.qty))) {
                            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: false, error: 'Bu model için 500, 1.000 veya 1.500 adet seçeneklerinden birini seçiniz.' }));
                            return;
                        }
                        if (product.type !== 'promosyon') continue;
                        const quantity = Number(item.quantity ?? item.qty);
                        if (!Number.isInteger(quantity) || quantity <= 0) {
                            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: false, error: 'Geçerli bir sipariş adedi giriniz.' }));
                            return;
                        }
                        const previous = requested.get(product.id);
                        requested.set(product.id, { product, quantity: quantity + (previous?.quantity || 0) });
                    }
                    const stockChecks = [];
                    for (const { product, quantity } of requested.values()) {
                        let live;
                        try {
                            live = await ientegreService.getLiveStock(product.originalId || product.id);
                        } catch (error) {
                            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: false, error: 'Güncel promosyon stoğu kontrol edilemedi. Sepetiniz korunuyor; lütfen tekrar deneyiniz.' }));
                            return;
                        }
                        const available = Number(live.toplam_stok);
                        if (available < quantity) {
                            res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: false, error: `${product.code}: İstenen ${quantity} adet için yeterli stok yok. Güncel stok: ${available} adet.` }));
                            return;
                        }
                        stockChecks.push({ productId: product.id, requested: quantity, available, checkedAt: new Date().toISOString() });
                    }
                    if(quoteData.davetiyeDetails?.invitationDraftId&&!quoteData.invitationDraft)throw Error('Tasarım erişim bağlantısı eksik. Tasarım sayfasından tekrar devam edin.');
                    const invitationDesign=quoteData.invitationDraft?require('./invitation-drafts').prepareCheckout(quoteData.invitationDraft,ROOT_DIR,quoteData.items||[]):null;
                    const quotes = readJsonFile(quotesFile, []);
                    const newQuote = {
                        id: 'OZK-' + require('crypto').randomUUID(),
                        createdAt: new Date().toISOString(),
                        type: quoteData.type || 'genel',
                        customerName: quoteData.customerName || 'Bilinmiyor',
                        companyName: quoteData.companyName || '',
                        phone: quoteData.phone || '',
                        email: quoteData.email || '',
                        city: quoteData.city || '',
                        address: quoteData.address || '',
                        notes: quoteData.notes || '',
                        items: quoteData.items || [],
                        davetiyeDetails: quoteData.davetiyeDetails || null,
                        status: 'Yeni',
                        stockChecks,
                        productSubtotal: shippingTotals.subtotal,
                        shippingTotals,
                        totalEstimated: shippingTotals.total
                    };
                    if(invitationDesign){newQuote.invitationDesign=invitationDesign;newQuote.davetiyeDetails={...(newQuote.davetiyeDetails||{}),invitationDraftId:invitationDesign.id};}
                    quotes.unshift(newQuote);
                    if (!writeJsonFile(quotesFile, quotes)) {
                        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, error: 'Sipariş kaydedilemedi. Lütfen tekrar deneyiniz.' }));
                        return;
                    }

                    if(invitationDesign){try{require('./invitation-drafts').finishCheckout(ROOT_DIR,invitationDesign,newQuote);}catch(error){console.error('Tasarım siparişe eklendi; taslak liste durumu güncellenemedi:',error.message);}}

                    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, quote: newQuote }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Geçersiz veri: ' + err.message }));
                }
            });
            return;
        }

        // GET /api/quotes
        if (pathname === '/api/quotes' && req.method === 'GET') {
            let quotes = readJsonFile(quotesFile, []);
            const now = Date.now();
            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

            // 30 günü geçmiş silinenleri otomatik temizle
            const initialLength = quotes.length;
            quotes = quotes.filter(q => {
                if (q.isDeleted && q.deletedAt) {
                    const elapsed = now - new Date(q.deletedAt).getTime();
                    return elapsed <= THIRTY_DAYS_MS;
                }
                return true;
            });
            if (quotes.length !== initialLength) {
                writeJsonFile(quotesFile, quotes);
            }

            res.writeHead(200, { 
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify(require('./users').filterRecords(quotes,req.user)));
            return;
        }

        // POST /api/quotes/:id/restore (Silineni Geri Yükle)
        const quoteRestoreMatch = pathname.match(/^\/api\/quotes\/([A-Za-z0-9_\-]+)\/restore$/);
        if (quoteRestoreMatch && req.method === 'POST') {
            const quoteId = quoteRestoreMatch[1];
            const quotes = readJsonFile(quotesFile, []);
            const idx = quotes.findIndex(q => q.id === quoteId);
            if (idx !== -1) {
                quotes[idx].isDeleted = false;
                delete quotes[idx].deletedAt;
                quotes[idx].updatedAt = new Date().toISOString();
                writeJsonFile(quotesFile, quotes);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, quote: quotes[idx] }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Teklif bulunamadı' }));
            }
            return;
        }

        // DELETE /api/quotes/:id/permanent (Kalıcı Sil)
        const quotePermMatch = pathname.match(/^\/api\/quotes\/([A-Za-z0-9_\-]+)\/permanent$/);
        if (quotePermMatch && req.method === 'DELETE') {
            const quoteId = quotePermMatch[1];
            let quotes = readJsonFile(quotesFile, []);
            const historical = quotes.find(q => q.id === quoteId);
            if (historical && historical.type !== 'ozel_uretim' && ((historical.priceRevisions || []).length || historical.pricingSnapshot || (historical.supplierQuotes || []).length || (historical.procurementCostRevisions || []).length || (historical.costAnalyses || []).length)) { res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Fiyat geçmişi olan kayıtlar korunur. Teklifi arşivleyiniz.' })); return; }
            if (!historical) { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Kayıt bulunamadı.' })); return; }
            if (historical.type === 'ozel_uretim' && !historical.isDeleted) { res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Önce teklifi Silinenler bölümüne taşıyınız.' })); return; }
            quotes = quotes.filter(q => q.id !== quoteId);
            if (!writeJsonFile(quotesFile, quotes)) { res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Silme işlemi kaydedilemedi.' })); return; }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: 'Kalıcı olarak silindi' }));
            return;
        }

        // PATCH /api/quotes/:id (Durum Güncelle)
        const quoteStatusMatch = pathname.match(/^\/api\/quotes\/([A-Za-z0-9_\-]+)$/);
        if (quoteStatusMatch && req.method === 'PATCH') {
            const quoteId = quoteStatusMatch[1];
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const updates = JSON.parse(body);
                    const quotes = readJsonFile(quotesFile, []);
                    const idx = quotes.findIndex(q => q.id === quoteId);
                    if (idx !== -1) {
                        if (quotes[idx].type === 'ozel_uretim') {
                            if (Object.keys(updates).some(key => key !== 'status') || !['Yeni','İnceleniyor'].includes(updates.status) || ['Arşivlendi','Siparişe Dönüştürüldü'].includes(quotes[idx].status)) throw Error('Teklif işlemlerini değerlendirme ekranından yapınız.');
                        }
                        if ((quotes[idx].type === 'ozel_uretim_siparis' || (quotes[idx].costAnalyses || []).length) && Object.keys(updates).some(key => key !== 'status')) throw Error('Onaylanan fiyat kaydı değiştirilemez.');
                        quotes[idx] = { ...quotes[idx], ...updates, updatedAt: new Date().toISOString() };
                        writeJsonFile(quotesFile, quotes);
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: true, quote: quotes[idx] }));
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Teklif bulunamadı' }));
                    }
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // DELETE /api/quotes/:id (Soft-Delete: Silinenler Kutusuna Taşı - 30 Gün Saklanır)
        if (quoteStatusMatch && req.method === 'DELETE') {
            const quoteId = quoteStatusMatch[1];
            const quotes = readJsonFile(quotesFile, []);
            const idx = quotes.findIndex(q => q.id === quoteId);
            if (idx !== -1) {
                if (quotes[idx].type !== 'ozel_uretim' && ((quotes[idx].priceRevisions || []).length || quotes[idx].pricingSnapshot || (quotes[idx].supplierQuotes || []).length || (quotes[idx].procurementCostRevisions || []).length || (quotes[idx].costAnalyses || []).length)) { res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Fiyat geçmişi olan kayıtlar korunur. Teklifi arşivleyiniz.' })); return; }
                quotes[idx].isDeleted = true;
                quotes[idx].deletedAt = quotes[idx].deletedAt || new Date().toISOString();
                if (!writeJsonFile(quotesFile, quotes)) { res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Silme işlemi kaydedilemedi.' })); return; }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, message: 'Sipariş silinenlere taşındı (30 gün saklanacak)' }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Teklif bulunamadı' }));
            }
            return;
        }

        // GET /api/stats
        if (pathname === '/api/stats' && req.method === 'GET') {
            const products = readJsonFile(productsFile, []);
            const quotes = readJsonFile(quotesFile, []);
            const activeQuotes = quotes.filter(q => !q.isDeleted);
            const davetiyeCount = products.filter(p => p.type === 'davetiye' || p.isDavetiye).length;
            const promosyonCount = products.filter(p => p.type === 'promosyon').length;
            const matbaaCount = products.filter(p => p.type === 'matbaa').length;
            const pendingQuotes = activeQuotes.filter(q => q.status === 'Yeni' || q.status === 'İnceleniyor').length;

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                totalProducts: products.length,
                davetiyeCount,
                promosyonCount,
                matbaaCount,
                totalQuotes: activeQuotes.length,
                pendingQuotes
            }));
            return;
        }

        // GET /api/media
        if (pathname === '/api/media' && req.method === 'GET') {
            const davetiyeDir = path.join(ASSETS_DIR, 'davetiye');
            let images = [];
            if (fs.existsSync(davetiyeDir)) {
                images = fs.readdirSync(davetiyeDir)
                    .filter(f => /\.(jpg|jpeg|png|webp|svg)$/i.test(f))
                    .map(name => {
                        const stat = fs.statSync(path.join(davetiyeDir, name));
                        return {
                            name,
                            url: '/assets/davetiye/' + name,
                            sizeKB: Math.round(stat.size / 1024),
                            createdAt: stat.mtime
                        };
                    });
            }
            if (query.q) {
                const q = query.q.toLowerCase();
                images = images.filter(img => img.name.toLowerCase().includes(q));
            }
            // Sort by size or name (default: newest/largest first for HD visibility)
            images.sort((a, b) => b.sizeKB - a.sizeKB);

            const page = parseInt(query.page) || 1;
            const limit = parseInt(query.limit) || 120;
            const total = images.length;
            const totalPages = Math.ceil(total / limit);
            const startIndex = (page - 1) * limit;
            const paginated = images.slice(startIndex, startIndex + limit);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                total,
                page,
                limit,
                totalPages,
                items: paginated
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API uç noktası bulunamadı' }));
        return;
    }

    // ==========================================
    // 3. YÖNETİM PANELİ SAYFALARI (/admin*)
    // ==========================================
    if (isAdminPage(pathname)) {
        const adminHtmlPath = path.join(ADMIN_DIR, 'public', 'index.html');
        if (fs.existsSync(adminHtmlPath)) {
            res.writeHead(200, { 
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            fs.createReadStream(adminHtmlPath).pipe(res);
            return;
        }
    }

    // ==========================================
    // 4. ÖN YÜZ (KULLANICI ARAYÜZÜ - FRONTEND)
    // ==========================================
    const products = readJsonFile(path.join(DB_DIR, 'products.json'), []);
    if (pathname === '/robots.txt') {
        res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8'});
        res.end('User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ' + seo.baseUrl(req, visibilitySettings) + '/sitemap.xml\n'); return;
    }
    if (pathname === '/sitemap.xml') {
        res.writeHead(200, {'Content-Type':'application/xml; charset=utf-8'});
        res.end(seo.sitemap(req, visibilitySettings, products, customerVisibleProduct)); return;
    }
    const clientHtmlPath = path.join(CLIENT_DIR, 'public', 'index.html');
    const result = seo.render({req, pathname, query, template:fs.readFileSync(clientHtmlPath,'utf8'), products, settings:visibilitySettings, visible:customerVisibleProduct});
    if (result.location) { res.writeHead(result.status, {Location:result.location}); res.end(); return; }
    res.writeHead(result.status, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache, no-store, must-revalidate'});
    res.end(result.html);
});

server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
server.listen(PORT, process.env.HOST || '127.0.0.1', () => {
    console.log(`=======================================================`);
    console.log(`🚀 OZKAN OFSET YEREL SUNUCUSU BAŞLATILDI`);
    console.log(`📍 Web Sitesi:          http://localhost:${PORT}`);
    console.log(`🛠️ Yönetim Paneli:      http://localhost:${PORT}${ADMIN_PATH}`);
    console.log(`📁 Dosya Dizini:        ${ROOT_DIR}`);
    console.log(`🔒 Yönetim erişimi:     Kimlik doğrulama gerekli`);
    console.log(`=======================================================`);
});
