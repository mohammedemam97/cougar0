const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { exec } = require('child_process');
const { URL } = require('url');

const root = __dirname;
const port = Number(process.env.PORT || 8787);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4'
};

function loadCatalog() {
  const code = fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'data.js' });
  return Array.isArray(sandbox.window.PRODUCTS) ? sandbox.window.PRODUCTS : [];
}

let catalog = [];
try {
  catalog = loadCatalog();
} catch (error) {
  console.error('Could not load product catalog:', error.message);
}
const productById = new Map(catalog.map((p) => [Number(p.id), p]));

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function stripeRequest(method, apiPath, formBody = null, idempotencyKey = null) {
  return new Promise((resolve, reject) => {
    if (!stripeSecretKey) return reject(new Error('Stripe secret key is not configured on the server.'));
    const headers = {
      'Authorization': 'Bearer ' + stripeSecretKey
    };
    if (formBody !== null) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(formBody);
    }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const request = https.request({
      hostname: 'api.stripe.com',
      port: 443,
      path: apiPath,
      method,
      headers
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data || '{}'); }
        catch { parsed = { raw: data }; }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(parsed);
        else reject(new Error(parsed?.error?.message || `Stripe request failed (${response.statusCode})`));
      });
    });
    request.on('error', reject);
    if (formBody !== null) request.write(formBody);
    request.end();
  });
}

function buildCheckoutItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error('Your cart is empty.');
  return rawItems.map((raw) => {
    const id = Number(raw.id);
    const quantity = Math.max(1, Math.min(10, Number(raw.quantity) || 1));
    const product = productById.get(id);
    if (!product || !product.inStock) throw new Error(`Product ${id} is unavailable.`);
    return { product, quantity };
  });
}

function appendLineItem(params, index, name, unitAmountCents, quantity, description = '') {
  params.append(`line_items[${index}][price_data][currency]`, 'aed');
  params.append(`line_items[${index}][price_data][product_data][name]`, name);
  if (description) params.append(`line_items[${index}][price_data][product_data][description]`, description);
  params.append(`line_items[${index}][price_data][unit_amount]`, String(unitAmountCents));
  params.append(`line_items[${index}][quantity]`, String(quantity));
}

async function createCheckoutSession(req, res) {
  try {
    if (!stripeSecretKey) {
      return json(res, 503, { error: 'Stripe is not configured. Start the server with STRIPE_SECRET_KEY set.' });
    }

    const payload = await readJson(req);
    const items = buildCheckoutItems(payload.items);
    const email = String(payload.email || '').trim();
    const origin = `http://${req.headers.host || `localhost:${port}`}`;

    const subtotal = items.reduce((sum, entry) => sum + Number(entry.product.price) * entry.quantity, 0);
    const shipping = subtotal >= 500 ? 0 : 29;
    const tax = Math.round(subtotal * 0.08 * 100) / 100;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/checkout.html?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${origin}/index.html?payment=cancelled`);
    params.append('billing_address_collection', 'required');
    params.append('phone_number_collection[enabled]', 'true');
    ['AE','US','GB','CA','AU','DE','FR','IT','ES'].forEach((country, i) => {
      params.append(`shipping_address_collection[allowed_countries][${i}]`, country);
    });
    params.append('payment_method_types[0]', 'card');
    if (email) params.append('customer_email', email);

    let index = 0;
    for (const { product, quantity } of items) {
      appendLineItem(
        params,
        index++,
        product.name,
        Math.round(Number(product.price) * 100),
        quantity,
        `${product.brand} • ${product.category}`
      );
    }
    if (shipping > 0) appendLineItem(params, index++, 'Shipping', Math.round(shipping * 100), 1, 'Express shipping');
    if (tax > 0) appendLineItem(params, index++, 'Estimated Tax', Math.round(tax * 100), 1, '8% estimated tax');

    params.append('metadata[store]', 'COUGAR');
    params.append('metadata[item_count]', String(items.reduce((sum, entry) => sum + entry.quantity, 0)));

    const session = await stripeRequest(
      'POST',
      '/v1/checkout/sessions',
      params.toString(),
      crypto.randomUUID()
    );

    return json(res, 200, { url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Checkout session error:', error.message);
    return json(res, 400, { error: error.message || 'Could not start Stripe Checkout.' });
  }
}

async function getCheckoutSession(req, res, url) {
  try {
    const sessionId = String(url.searchParams.get('session_id') || '');
    if (!/^cs_/.test(sessionId)) return json(res, 400, { error: 'Invalid session id.' });
    const session = await stripeRequest('GET', `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
    return json(res, 200, {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_details: session.customer_details || null
    });
  } catch (error) {
    return json(res, 400, { error: error.message || 'Could not verify payment.' });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, { ok: true, stripeConfigured: Boolean(stripeSecretKey) });
    }
    if (req.method === 'POST' && url.pathname === '/api/create-checkout-session') {
      return createCheckoutSession(req, res);
    }
    if (req.method === 'GET' && url.pathname === '/api/checkout-session') {
      return getCheckoutSession(req, res, url);
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.resolve(root, '.' + pathname);
    if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, 'index.html')) {
      res.writeHead(403); return res.end('Forbidden');
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not found');
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Close the other local server or set a different PORT.`);
  } else {
    console.error('Server error:', error && error.message ? error.message : error);
  }
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  const siteUrl = `http://localhost:${port}`;
  console.log(`COUGAR Laptop Store running at ${siteUrl}`);
  console.log(stripeSecretKey ? 'Stripe Checkout: configured' : 'Stripe Checkout: NOT configured');
  if (process.platform === 'win32' && process.env.NO_AUTO_OPEN !== '1') {
    exec(`start "" "${siteUrl}"`);
  }
});
