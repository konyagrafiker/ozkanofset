(function (root) {
    function parseAmount(value) {
        if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
        const text = String(value ?? '').trim().replace(/\s*(TL|₺)\s*$/i, '').trim();
        if (!/^\d+(?:[.,]\d+)*$/.test(text)) return null;
        const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.')
            : /^\d{1,3}(?:\.\d{3})+$/.test(text) ? text.replace(/\./g, '') : text;
        const amount = Number(normalized);
        return Number.isFinite(amount) && amount >= 0 ? amount : null;
    }
    function calculate(subtotal, settings = {}) {
        const amount = parseAmount(subtotal);
        const limit = Number(settings.freeShippingLimit ?? 1000);
        const fee = Number(settings.shippingFee ?? 250);
        if (amount === null) return { subtotal: null, shippingFee: null, total: null, freeShippingLimit: limit };
        const shippingFee = amount >= limit ? 0 : fee;
        return { subtotal: amount, shippingFee, total: Math.round((amount + shippingFee) * 100) / 100, freeShippingLimit: limit };
    }
    const api = { parseAmount, calculate };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.OzkanShipping = api;
})(typeof window !== 'undefined' ? window : globalThis);
