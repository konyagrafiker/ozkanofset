const assert = require('node:assert/strict');
const shipping = require('../assets/js/shipping');
for (const [subtotal, fee, total] of [[750, 250, 1000], [999, 250, 1249], [1000, 0, 1000], [1500, 0, 1500], ['1.000 TL', 0, 1000], ['999,50 TL', 250, 1249.5]]) {
    const result = shipping.calculate(subtotal);
    assert.equal(result.shippingFee, fee);
    assert.equal(result.total, total);
}
for (const value of [null, '', 'Fiyat Sorunuz', '13.50 ₺ + KDV']) {
    const result = shipping.calculate(value);
    assert.equal(result.total, null);
    assert.equal(result.shippingFee, null);
}
console.log('Shipping threshold, decimal amounts and unknown price checks passed.');
