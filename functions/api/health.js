import { json } from '../_lib/stripe.js';

export async function onRequestGet(context) {
  return json({
    ok: true,
    stripeConfigured: Boolean(context.env.STRIPE_SECRET_KEY),
    environment: 'cloudflare-pages'
  });
}
