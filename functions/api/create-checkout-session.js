import { appendLineItem, buildCheckoutItems, json, stripeRequest } from '../_lib/stripe.js';

const ALLOWED_COUNTRIES = ['AE', 'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES'];

export async function onRequestPost(context) {
  try {
    const secretKey = context.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return json({ error: 'Stripe is not configured in Cloudflare.' }, 503);
    }

    const payload = await context.request.json().catch(() => ({}));
    const items = buildCheckoutItems(payload.items);
    const email = String(payload.email || '').trim();

    const requestUrl = new URL(context.request.url);
    const configuredSiteUrl = String(context.env.PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
    const siteUrl = configuredSiteUrl || requestUrl.origin;

    const subtotal = items.reduce((sum, entry) => sum + Number(entry.product.price) * entry.quantity, 0);
    const shipping = subtotal >= 500 ? 0 : 29;
    const tax = Math.round(subtotal * 0.08 * 100) / 100;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('locale', 'auto');
    params.append('submit_type', 'pay');
    // Explicitly allow card payments. Stripe wallets such as Apple Pay and Google Pay
    // are presented through the card payment method when they are enabled and eligible.
    params.append('payment_method_types[0]', 'card');
    params.append('success_url', `${siteUrl}/checkout.html?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${siteUrl}/index.html?payment=cancelled`);
    params.append('phone_number_collection[enabled]', 'true');
    ALLOWED_COUNTRIES.forEach((country, index) => {
      params.append(`shipping_address_collection[allowed_countries][${index}]`, country);
    });
    if (email) params.append('customer_email', email);

    let lineIndex = 0;
    for (const { product, quantity } of items) {
      appendLineItem(
        params,
        lineIndex++,
        product.name,
        Math.round(Number(product.price) * 100),
        quantity,
        `${product.brand} • ${product.category}`
      );
    }

    if (shipping > 0) {
      appendLineItem(params, lineIndex++, 'Shipping', Math.round(shipping * 100), 1, 'Express shipping');
    }
    if (tax > 0) {
      appendLineItem(params, lineIndex++, 'Estimated Tax', Math.round(tax * 100), 1, '8% estimated tax');
    }

    params.append('metadata[store]', 'COUGAR');
    params.append('metadata[item_count]', String(items.reduce((sum, entry) => sum + entry.quantity, 0)));

    const session = await stripeRequest(
      secretKey,
      'POST',
      '/v1/checkout/sessions',
      params.toString(),
      crypto.randomUUID()
    );

    return json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe Checkout error:', error);
    return json({ error: error?.message || 'Could not start Stripe Checkout.' }, 400);
  }
}
