// ==========================================================================
// COUGAR - Secure Stripe-hosted Checkout
// The Stripe secret key stays on the server in STRIPE_SECRET_KEY.
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  renderCheckoutSummary();
  initCheckoutForm();
  handleStripeReturn();
});

function renderCheckoutSummary() {
  const items = window.Cart.getItems();
  const summaryContainer = document.getElementById('checkout-items-list');
  const emptyNotice = document.getElementById('checkout-empty-notice');
  const formSection = document.getElementById('checkout-form-container');

  if (!summaryContainer) return;

  if (items.length === 0) {
    if (emptyNotice) emptyNotice.style.display = 'block';
    if (formSection) formSection.style.opacity = '0.55';
    const submitBtn = document.getElementById('place-order-btn');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  if (emptyNotice) emptyNotice.style.display = 'none';
  if (formSection) formSection.style.opacity = '1';

  summaryContainer.innerHTML = items.map(item => `
    <div class="checkout-item-row">
      <div class="checkout-item-img-wrapper">
        <img src="${item.image}" alt="${item.name}" class="checkout-item-img" />
        <span class="checkout-item-badge">${item.quantity}</span>
      </div>
      <div class="checkout-item-details">
        <div class="checkout-item-name">${item.name}</div>
        <div class="checkout-item-brand">${item.brand} &bull; ${item.category}</div>
      </div>
      <div class="checkout-item-price">${window.formatCurrency(item.price * item.quantity)}</div>
    </div>
  `).join('');

  const subtotal = window.Cart.getSubtotal();
  const shipping = window.Cart.getShipping();
  const tax = window.Cart.getTax();
  const total = window.Cart.getTotal();

  document.getElementById('checkout-subtotal').textContent = window.formatCurrency(subtotal);
  document.getElementById('checkout-shipping').textContent = shipping === 0 ? 'FREE' : window.formatCurrency(shipping);
  document.getElementById('checkout-tax').textContent = window.formatCurrency(tax);
  document.getElementById('checkout-total').textContent = window.formatCurrency(total);
}

function initCheckoutForm() {
  const form = document.getElementById('checkout-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = window.Cart.getItems();
    if (!items.length) {
      window.showToast('Your cart is empty. Please add a laptop first.', 'error');
      return;
    }

    const submitBtn = document.getElementById('place-order-btn');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const email = document.getElementById('email')?.value?.trim() || '';

    submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnSpinner) btnSpinner.style.display = 'inline-block';

    try {
      if (window.location.protocol === 'file:') {
        throw new Error('Open the store with START-WEBSITE.bat, not by double-clicking the HTML file.');
      }

      const healthResponse = await fetch('/api/health', { cache: 'no-store' });
      if (!healthResponse.ok) {
        throw new Error('The COUGAR checkout server is not running on this address. Start the website with START-WEBSITE.bat.');
      }
      const health = await healthResponse.json();
      if (!health.stripeConfigured) {
        throw new Error('Stripe is not configured on the local server. Restart with START-WEBSITE.bat and enter your Stripe secret key.');
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          email,
          items: items.map(item => ({ id: item.id, quantity: item.quantity }))
        })
      });

      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json') ? await response.json() : { error: await response.text() };
      if (!response.ok || !result.url) throw new Error(result.error || 'Could not start Stripe Checkout.');
      window.location.assign(result.url);
    } catch (error) {
      const message = (error && error.message === 'Failed to fetch')
        ? 'Checkout server is unreachable. Close other localhost servers and start this project using START-WEBSITE.bat.'
        : (error.message || 'Stripe Checkout could not be started.');
      window.showToast(message, 'error');
      submitBtn.disabled = false;
      if (btnText) btnText.style.display = 'inline-block';
      if (btnSpinner) btnSpinner.style.display = 'none';
    }
  });
}

async function handleStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get('payment');
  if (state === 'cancelled') {
    window.showToast('Payment was cancelled. Your cart is still saved.', 'error');
    history.replaceState({}, '', 'checkout.html');
    return;
  }
  if (state !== 'success') return;

  const sessionId = params.get('session_id');
  if (!sessionId) return;

  try {
    const response = await fetch('/api/checkout-session?session_id=' + encodeURIComponent(sessionId));
    const session = await response.json();
    if (!response.ok) throw new Error(session.error || 'Could not verify payment.');

    if (session.payment_status === 'paid') {
      const amount = (Number(session.amount_total || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: String(session.currency || 'usd').toUpperCase() });
      window.Cart.clear();
      showOrderSuccessModal({
        orderId: session.id,
        customerName: session.customer_details?.name || 'Customer',
        email: session.customer_details?.email || '',
        amount
      });
      history.replaceState({}, '', 'checkout.html');
    } else {
      window.showToast('Stripe returned successfully, but payment is not marked as paid yet.', 'error');
    }
  } catch (error) {
    window.showToast(error.message || 'Could not verify Stripe payment.', 'error');
  }
}

function showOrderSuccessModal(orderData) {
  const modal = document.createElement('div');
  modal.className = 'order-modal-backdrop animate-fade-in';
  modal.innerHTML = `
    <div class="order-modal-content animate-scale-up">
      <div class="success-icon-circle"><i class="fa-solid fa-check"></i></div>
      <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 8px;">Payment Successful</h2>
      <p class="order-subtext" style="color: var(--text-secondary); font-size: 0.95rem;">Your Stripe payment has been verified.</p>
      <div class="order-receipt-box">
        <div class="receipt-row"><span>Stripe Session:</span><strong>${orderData.orderId}</strong></div>
        <div class="receipt-row"><span>Customer:</span><strong>${orderData.customerName}</strong></div>
        ${orderData.email ? `<div class="receipt-row"><span>Email:</span><strong>${orderData.email}</strong></div>` : ''}
        <div class="receipt-row"><span>Total Paid:</span><strong class="receipt-highlight">${orderData.amount}</strong></div>
        <div class="receipt-row"><span>Status:</span><span class="badge-status-paid">Paid</span></div>
      </div>
      <div class="modal-actions" style="display:flex;flex-direction:column;gap:10px;">
        <a href="index.html" class="btn btn-primary btn-block">Back to Home</a>
        <a href="products.html" class="btn btn-glass btn-block">Explore More Laptops</a>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
