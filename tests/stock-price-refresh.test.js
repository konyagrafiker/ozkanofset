const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../server/services/ientegreService.js'), 'utf8');
async function run() {
    let products = [{ id: 'prm_123', originalId: 123, type: 'promosyon', price: null, stock: 0 }, { id: 'dav', type: 'davetiye', price: 700 }];
    let writes = 0;
    const context = vm.createContext({ module: { exports: {} }, __dirname: path.resolve(__dirname, "../server/services"), process: {env:{}}, console, Buffer, fixture: {}, require(name) {
        if (name !== 'fs') return require(name);
        return { existsSync: () => true,
            readFileSync: file => JSON.stringify(file.endsWith('products.json') ? products : { profitMargin: 35 }),
            writeFileSync(file, content) { writes++; if (file.endsWith('products.json')) products = JSON.parse(content); }
        };
    } });
    vm.runInContext(source, context);
    vm.runInContext('queryApi = async () => fixture;', context);
    context.fixture = { 123: { toplam_stok: 0, urun_fiyat: '0.000', fiyat_kdv: 20 } };
    let result = await context.module.exports.refreshStockPrices();
    assert.equal(result.hidden, 1);
    assert.equal(products[0].price, null);
    context.fixture = { 123: { toplam_stok: 50, urun_fiyat: '0.000', fiyat_kdv: 20 } };
    result = await context.module.exports.refreshStockPrices();
    assert.equal(result.hidden, 0);
    assert.equal(products[0].priceRange, 'Fiyat Sorunuz');
    context.fixture = { 123: { toplam_stok: 50, urun_fiyat: '100.000', fiyat_kdv: 20 } };
    await context.module.exports.refreshStockPrices();
    assert.equal(products[0].price, 135);
    assert.equal(products[0].priceOnRequest, false);
    assert.equal(products[1].price, 700);
    context.fixture = null;
    const previousWrites = writes;
    await assert.rejects(context.module.exports.refreshStockPrices());
    assert.equal(writes, previousWrites);
    console.log('Hidden product return, price refresh, invitation preservation and API failure checks passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

