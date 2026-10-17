const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'server/server.js'), 'utf8');
const products = [
    { id: 'closed', category: 'Renkli Zarflı Davetiyeler', type: 'davetiye' },
    { id: 'open', category: 'Eko', type: 'davetiye' }
];
let handler;
const settings = { davetiyeCategoryCards: [{ name: 'Renkli Zarflı Davetiyeler', active: false }] };
vm.runInNewContext(source, { require(name) { if(name==='./runtime')return {validate(){},initialize(){}};
    if (name === './seo') return require('../server/seo');
    if (name === './traffic') return { create: () => ({ handle: () => false }) };
    if (name === './admin-route') return require('../server/admin-route');
    if (name === './security') return { middleware(){return false;}, verify(){}, body: require('../server/security').body };
                if (name === 'http') return { createServer(fn) { handler = fn; return { listen() {} }; } };
    if (name === 'fs') return { existsSync: () => true,
        readFileSync: file => JSON.stringify(file.endsWith('products.json') ? products : settings),
        writeFileSync() { throw new Error('Must preserve data'); }
    };
    if (name === './services/ientegreService') return {};
    return require(name);
}, process:{env:{}},__dirname: path.join(root, 'server'), console, Buffer });
function get(url) {
    let status, data;
    handler({ url, method: 'GET' }, { setHeader() {}, writeHead(code) { status = code; }, end(body) { data = JSON.parse(body); } });
    return { status, data };
}
assert.equal(get('/api/products').data.total, 1);
assert.equal(get('/api/products?q=Renkli').data.total, 0);
assert.equal(get('/api/categories?type=davetiye').data.totalProducts, 1);
assert.equal(get('/api/products/closed').status, 404);
assert.equal(get('/api/products/closed?includeUnavailable=true').status, 200);
assert.equal(get('/api/products?includeUnavailable=true').data.total, 2);
settings.davetiyeCategoryCards[0].active = true;
assert.equal(get('/api/products').data.total, 2);
assert.equal(get('/api/products/closed').status, 200);
assert.equal(products.length, 2);
settings.davetiyeCategoryCards = [
    { name: 'Yeni', active: true }, { name: 'Kapalı', active: false },
    { name: 'Eko', active: true }, { name: 'Beyaz', active: true },
    { name: 'Sade', active: true }, { name: 'Kraft', active: true }
];
for (const category of ['Yeni', 'Eko', 'Beyaz', 'Sade', 'Kraft', 'Kapalı']) {
    for (let i = 0; i < 5; i++) products.push({ id: category + i, category, type: 'davetiye' });
}
const showcase = get('/api/products?type=davetiye&priorityCatalogs=true&random=true&limit=12').data.items;
assert.equal(showcase.length, 12);
assert.deepEqual(showcase.slice(0, 4).map(p => p.category), ['Yeni', 'Eko', 'Beyaz', 'Sade']);
for (const category of ['Yeni', 'Eko', 'Beyaz', 'Sade']) assert.equal(showcase.filter(p => p.category === category).length, 3);
assert(!showcase.some(p => ['Kraft', 'Kapalı'].includes(p.category)));
console.log('Catalog hiding, search, counts, direct access, admin access and reopening checks passed.');
