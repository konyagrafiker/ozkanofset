const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'client/public/index.html'), 'utf8');
const checkout = html.slice(html.indexOf('function checkoutShippingTotals('), html.indexOf('function showCheckoutSuccessCard('));

function context(fetch) {
    const values = { checkoutAliciAd: 'Ayşe Yılmaz', checkoutAliciTel: '05422044699', checkoutAliciSehir: 'Konya Selçuklu', checkoutAliciAdres: 'Cumhuriyet Mahallesi Millet Caddesi No 15', checkoutContractAgree: '' };
    const state = { alerts: [], success: 0, saved: 0, opened: 0 };
    Object.assign(state, {
        document: { getElementById: id => ({ value: values[id] || '', checked: true, focus() {}, classList: { add() {} } }) },
        window: { open() { state.opened++; } },
        cart: [{ title: 'Deneme', code: 'TEST', quantity: 100, price: 100 }],
        WHATSAPP_NUM: '905422044699', fetch,
        OzkanShipping: require('../assets/js/shipping'),
        alert: message => state.alerts.push(message), console: { warn() {} },
        saveCartToStorage() { state.saved++; }, updateCartBadge() {},
        showCheckoutSuccessCard() { state.success++; }
    });
    vm.createContext(state);
    vm.runInContext(checkout, state);
    return state;
}

async function main() {
    for (const fetch of [
        async () => { throw new Error('offline'); },
        async () => ({ ok: false, json: async () => ({ success: true, quote: { id: 'TEST' } }) }),
        async () => ({ ok: true, json: async () => ({ success: false }) }),
        async () => ({ ok: true, json: async () => ({ success: true, quote: {} }) }),
        async () => ({ ok: true, json: async () => { throw new Error('invalid json'); } })
    ]) {
        const state = context(fetch);
        await state.submitFinalCheckout();
        assert.equal(state.cart.length, 1);
        assert.equal(state.success, 0);
        assert.equal(state.opened, 0);
        assert.equal(state.saved, 0);
        assert.equal(state.alerts.length, 1);
        state.fetch = async () => ({ ok: true, json: async () => ({ success: true, quote: { id: 'TEST' } }) });
        await state.submitFinalCheckout();
        assert.equal(state.success, 1, 'retry succeeds');
        assert.equal(state.cart.length, 0);
    }
    let finish, calls = 0;
    const state = context(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
    const first = state.submitFinalCheckout();
    await state.submitFinalCheckout();
    assert.equal(calls, 1, 'concurrent click does not submit twice');
    finish({ ok: true, json: async () => ({ success: true, quote: { id: 'TEST' } }) });
    await first;
    assert.equal(state.success, 1);

    // Execute the real server handler with mocked storage; no customer data is touched.
    const source = fs.readFileSync(path.join(root, 'server/server.js'), 'utf8');
    for (const writable of [false, true]) {
        let handler, callback, status, response;
        const fakeFs = { existsSync: () => true, readFileSync: file => JSON.stringify(file.endsWith('products.json') ? [{id:'test',type:'matbaa'}] : []), writeFileSync() { if (!writable) throw new Error('disk full'); } };
        const serverContext = {
            require(name) { if(name==='./runtime')return {validate(){},initialize(){}};
                if (name === './security') return { middleware(){return false;}, verify(){}, body: require('../server/security').body };
                if (name === 'http') return { createServer(fn) { handler = fn; return { listen() {} }; } };
                if (name === 'fs') return fakeFs;
                if (name === './services/ientegreService') return {};
                if (name === './traffic') return {create:()=>({handle:()=>false})};
                if (name.startsWith('./')) return require('../server/' + name.slice(2));
                return name.startsWith('./') ? require('../server/' + name.slice(2)) : require(name);
            }, process:{env:{}},__dirname: path.join(root, 'server'), console: { error() {} }, Buffer
        };
        vm.runInNewContext(source, serverContext);
        handler({ url: '/api/quotes', method: 'POST', on(event, fn) { if (event === 'data') fn(JSON.stringify({customerName:'Test User',phone:'05422044699',items:[{id:'test',quantity:1}]})); if (event === 'end') callback = fn; } },
            { setHeader() {}, writeHead(code) { status = code; }, end(body) { response = JSON.parse(body); } });
        await callback();
        assert.equal(status, writable ? 201 : 500);
        assert.equal(response.success, writable);
    }
    for (const scenario of [
        { stock: 150, expected: 201 },
        { stock: 149, expected: 409 },
        { stock: 0, expected: 409 },
        { failed: true, expected: 503 }
    ]) {
        let handler, callback, status, response, writes = 0, calls = 0;
        const product = { id: 'prm_123', originalId: 123, code: 'TEST', type: 'promosyon', stock: 1000, price: 100 };
        const service = { async getLiveStock(id) {
            calls++;
            assert.equal(id, 123);
            if (scenario.failed) throw new Error('offline');
            return { toplam_stok: scenario.stock };
        } };
        vm.runInNewContext(source, {
            require(name) { if(name==='./runtime')return {validate(){},initialize(){}};
                if (name === './security') return { middleware(){return false;}, verify(){}, body: require('../server/security').body };
                if (name === 'http') return { createServer(fn) { handler = fn; return { listen() {} }; } };
                if (name === 'fs') return {
                    existsSync: () => true,
                    readFileSync: file => JSON.stringify(file.endsWith('products.json') ? [product] : []),
                    writeFileSync() { writes++; }
                };
                if (name === './services/ientegreService') return service;
                return name.startsWith('./') ? require('../server/' + name.slice(2)) : require(name);
            }, process:{env:{}},__dirname: path.join(root, 'server'), console: { error() {} }, Buffer
        });
        handler({ url: '/api/quotes', method: 'POST', on(event, fn) {
            if (event === 'data') fn(JSON.stringify({ customerName:'Test User',phone:'05422044699',items: [
                { id: 'prm_123', quantity: 100 }, { code: 'TEST', quantity: 50 }
            ] }));
            if (event === 'end') callback = fn;
        } }, { setHeader() {}, writeHead(code) { status = code; }, end(body) { response = JSON.parse(body); } });
        await callback();
        assert.equal(status, scenario.expected);
        assert.equal(calls, 1, 'same product checked once with combined quantity');
        assert.equal(writes, scenario.expected === 201 ? 1 : 0);
        if (status === 201) assert.equal(response.quote.stockChecks[0].requested, 150);
    }
    console.log('Checkout failure, retry, concurrent submission, write failure and live stock checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
