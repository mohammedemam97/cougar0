# COUGAR — Cloudflare Pages + Stripe

Production domain configured for this build: https://cougar0.pages.dev/

## Required Cloudflare variables

In Cloudflare Pages → Settings → Variables and Secrets, add:

- `STRIPE_SECRET_KEY` — **Secret** — your NEW Stripe live secret key (`sk_live_...`)
- `PUBLIC_SITE_URL` — Text — `https://cougar0.pages.dev`

Do not place the Stripe secret key in GitHub, HTML, CSS, or browser JavaScript.

## Deploy from GitHub

1. Put the contents of this folder at the root of your GitHub repository.
2. Make sure the `functions/` folder is committed to GitHub.
3. In Cloudflare Pages, connect the GitHub repository.
4. For a plain HTML/CSS/JS project, no framework build is needed. Use the repository root as the output directory if Cloudflare asks for one.
5. Add the variables above for Production.
6. Redeploy the project.

## Test after deployment

Open:

`https://cougar0.pages.dev/api/health`

Expected result:

`{"ok":true,"stripeConfigured":true,"environment":"cloudflare-pages"}`

Then add a product to cart and click Checkout. It should redirect directly to `https://checkout.stripe.com/...`.

## Stripe return URL

Successful payments return to:

`https://cougar0.pages.dev/checkout.html?payment=success&session_id=...`

Cancelled payments return to:

`https://cougar0.pages.dev/index.html?payment=cancelled`
