import { PRODUCT_BY_ID } from './products.js';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
}

export async function stripeRequest(secretKey, method, path, body = null, idempotencyKey = null) {
  if (!secretKey) throw new Error('Stripe secret key is not configured.');

  const headers = { Authorization: `Bearer ${secretKey}` };
  if (body !== null) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers,
    body
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe request failed (${response.status})`);
  }
  return data;
}

export function buildCheckoutItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Your cart is empty.');
  }

  return rawItems.map((raw) => {
    const id = Number(raw?.id);
    const quantity = Math.max(1, Math.min(10, Number(raw?.quantity) || 1));
    const product = PRODUCT_BY_ID.get(id);
    if (!product || !product.inStock) throw new Error(`Product ${id} is unavailable.`);
    return { product, quantity };
  });
}

export function appendLineItem(params, index, name, unitAmountFils, quantity, description = '') {
  params.append(`line_items[${index}][price_data][currency]`, 'aed');
  params.append(`line_items[${index}][price_data][product_data][name]`, name);
  if (description) params.append(`line_items[${index}][price_data][product_data][description]`, description);
  params.append(`line_items[${index}][price_data][unit_amount]`, String(unitAmountFils));
  params.append(`line_items[${index}][quantity]`, String(quantity));
}
