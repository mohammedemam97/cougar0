import { json, stripeRequest } from '../_lib/stripe.js';

export async function onRequestGet(context) {
  try {
    const secretKey = context.env.STRIPE_SECRET_KEY;
    if (!secretKey) return json({ error: 'Stripe is not configured in Cloudflare.' }, 503);

    const url = new URL(context.request.url);
    const sessionId = String(url.searchParams.get('session_id') || '');
    if (!/^cs_(test_|live_)?/.test(sessionId)) return json({ error: 'Invalid session id.' }, 400);

    const session = await stripeRequest(
      secretKey,
      'GET',
      `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`
    );

    return json({
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_details: session.customer_details || null
    });
  } catch (error) {
    console.error('Stripe verification error:', error);
    return json({ error: error?.message || 'Could not verify payment.' }, 400);
  }
}
