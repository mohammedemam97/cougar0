// ==========================================================================
// LaptopZone - Shopping Cart Logic (localStorage based)
// ==========================================================================

const CART_STORAGE_KEY = 'laptopzone_cart';

window.Cart = {
  // Get all items in cart
  getItems() {
    try {
      const items = localStorage.getItem(CART_STORAGE_KEY);
      return items ? JSON.parse(items) : [];
    } catch (e) {
      console.error('Error reading cart from localStorage', e);
      return [];
    }
  },

  // Save items to cart
  saveItems(items) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      this.updateCartBadge();
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items } }));
    } catch (e) {
      console.error('Error saving cart to localStorage', e);
    }
  },

  // Add item or increment quantity
  addItem(product, quantity = 1) {
    const items = this.getItems();
    const existingIndex = items.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
      items[existingIndex].quantity += quantity;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        specs: product.specs ? {
          processor: product.specs.processor,
          ram: product.specs.ram,
          storage: product.specs.storage
        } : null,
        quantity: quantity
      });
    }

    this.saveItems(items);
    if (window.showToast) {
      window.showToast('Added to cart', 'success');
    }
    return items;
  },

  // Remove item by id
  removeItem(id) {
    let items = this.getItems();
    const removedItem = items.find(item => item.id === id);
    items = items.filter(item => item.id !== id);
    this.saveItems(items);
    if (window.showToast && removedItem) {
      window.showToast('Removed from cart', 'info');
    }
    return items;
  },

  // Update item quantity
  updateQuantity(id, quantity) {
    let items = this.getItems();
    if (quantity <= 0) {
      return this.removeItem(id);
    }

    const item = items.find(item => item.id === id);
    if (item) {
      item.quantity = quantity;
      this.saveItems(items);
    }
    return items;
  },

  // Get total price
  getSubtotal() {
    const items = this.getItems();
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  // Get shipping fee ($0 if >= $500, else $29)
  getShipping() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0) return 0;
    return subtotal >= 500 ? 0 : 29;
  },

  // Get estimated tax (8%)
  getTax() {
    const subtotal = this.getSubtotal();
    return Math.round(subtotal * 0.08 * 100) / 100;
  },

  // Get grand total
  getTotal() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0) return 0;
    return Math.round((subtotal + this.getShipping() + this.getTax()) * 100) / 100;
  },

  // Get total count of units in cart
  getCount() {
    const items = this.getItems();
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },

  // Empty cart
  clear() {
    localStorage.removeItem(CART_STORAGE_KEY);
    this.updateCartBadge();
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items: [] } }));
  },

  // Update badge UI across navbar
  updateCartBadge() {
    const count = this.getCount();
    const badges = document.querySelectorAll('.cart-count');
    badges.forEach(badge => {
      badge.textContent = count;
      badge.classList.remove('pulse');
      // trigger reflow
      void badge.offsetWidth;
      badge.classList.add('pulse');
      if (count > 0) {
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'inline-flex'; // show 0
      }
    });
  }
};

// Initialize badge when script loads
document.addEventListener('DOMContentLoaded', () => {
  window.Cart.updateCartBadge();
});



// ========================================================================== 
// Direct Stripe Checkout
// Opens Stripe-hosted Checkout immediately, without an intermediate form page.
// ========================================================================== 
window.startStripeCheckout = async function startStripeCheckout(event) {
  if (event) event.preventDefault();

  const items = window.Cart ? window.Cart.getItems() : [];
  if (!items.length) {
    if (window.showToast) window.showToast('Your cart is empty.', 'error');
    if (window.openCartDrawer) window.openCartDrawer();
    return;
  }

  const trigger = event ? (event.target?.closest?.('a, button, [data-direct-checkout]') || (event.currentTarget instanceof HTMLElement ? event.currentTarget : null)) : null;
  const originalHtml = trigger ? trigger.innerHTML : '';
  if (trigger) {
    trigger.style.pointerEvents = 'none';
    trigger.setAttribute('aria-busy', 'true');
    trigger.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Opening Stripe...</span>';
  }

  try {
    const healthResponse = await fetch('/api/health', { cache: 'no-store' });
    const health = await healthResponse.json().catch(() => ({}));
    if (!healthResponse.ok || !health.ok) throw new Error('Checkout server is not available.');
    if (!health.stripeConfigured) throw new Error('Stripe is not configured on the server. Restart with START-WEBSITE.bat and enter your Stripe secret key.');

    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(item => ({ id: item.id, quantity: item.quantity }))
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.url) throw new Error(result.error || 'Could not start Stripe Checkout.');

    window.location.assign(result.url);
  } catch (error) {
    console.error('Stripe Checkout error:', error);
    if (window.showToast) window.showToast(error.message || 'Could not open Stripe Checkout.', 'error');
    else alert(error.message || 'Could not open Stripe Checkout.');

    if (trigger) {
      trigger.style.pointerEvents = '';
      trigger.removeAttribute('aria-busy');
      trigger.innerHTML = originalHtml;
    }
  }
};

// ========================================================================== 
// Side Cart Drawer
// ========================================================================== 
(function () {
  function money(value) {
    if (typeof window.formatCurrency === 'function') return window.formatCurrency(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(value || 0);
  }

  function ensureDrawer() {
    if (document.getElementById('cartDrawer')) return;

    const overlay = document.createElement('div');
    overlay.className = 'cart-drawer-overlay';
    overlay.id = 'cartDrawerOverlay';
    overlay.setAttribute('aria-hidden', 'true');

    const drawer = document.createElement('aside');
    drawer.className = 'cart-drawer';
    drawer.id = 'cartDrawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('aria-label', 'Shopping cart');
    drawer.innerHTML = `
      <div class="cart-drawer-head">
        <div class="cart-drawer-title"><i class="fa-solid fa-bag-shopping"></i><span>Your Cart</span></div>
        <button type="button" class="cart-drawer-close" aria-label="Close cart"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="cart-drawer-body" id="cartDrawerBody"></div>
      <div class="cart-drawer-foot">
        <div class="cart-drawer-total"><span>Total</span><strong id="cartDrawerTotal">$0.00</strong></div>
        <a href="checkout.html" class="cart-drawer-checkout"><i class="fa-solid fa-credit-card"></i><span>Checkout</span></a>
      </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    overlay.addEventListener('click', closeDrawer);
    drawer.querySelector('.cart-drawer-close').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDrawer();
    });
  }

  function renderDrawer() {
    ensureDrawer();
    const body = document.getElementById('cartDrawerBody');
    const total = document.getElementById('cartDrawerTotal');
    if (!body || !total || !window.Cart) return;

    const items = window.Cart.getItems();
    total.textContent = money(window.Cart.getTotal());

    if (!items.length) {
      body.innerHTML = `
        <div class="cart-drawer-empty">
          <div class="cart-drawer-empty-inner">
            <i class="fa-solid fa-basket-shopping"></i>
            <h3>Your cart is empty</h3>
            <p>Add a laptop and it will appear here.</p>
          </div>
        </div>`;
      return;
    }

    body.innerHTML = `<div class="cart-drawer-list">${items.map(item => `
      <div class="cart-drawer-item">
        <img src="${item.image}" alt="${item.name}">
        <div class="cart-drawer-item-info">
          <h4>${item.name}</h4>
          <p>${item.brand || ''}${item.category ? ' • ' + item.category : ''}</p>
          <div class="cart-drawer-qty">
            <button type="button" aria-label="Decrease quantity" data-cart-action="decrease" data-id="${item.id}"><i class="fa-solid fa-minus"></i></button>
            <span>${item.quantity}</span>
            <button type="button" aria-label="Increase quantity" data-cart-action="increase" data-id="${item.id}"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
        <div class="cart-drawer-item-end">
          <span class="cart-drawer-price">${money(item.price * item.quantity)}</span>
          <button type="button" class="cart-drawer-remove" aria-label="Remove ${item.name}" data-cart-action="remove" data-id="${item.id}"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>`).join('')}</div>`;
  }

  function openDrawer(event) {
    if (event) event.preventDefault();
    ensureDrawer();
    renderDrawer();
    const overlay = document.getElementById('cartDrawerOverlay');
    const drawer = document.getElementById('cartDrawer');
    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-drawer-open');
  }

  function closeDrawer() {
    const overlay = document.getElementById('cartDrawerOverlay');
    const drawer = document.getElementById('cartDrawer');
    if (!overlay || !drawer) return;
    overlay.classList.remove('is-open');
    drawer.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-drawer-open');
  }

  window.openCartDrawer = openDrawer;
  window.closeCartDrawer = closeDrawer;
  window.renderCartDrawer = renderDrawer;

  document.addEventListener('DOMContentLoaded', () => {
    ensureDrawer();
    renderDrawer();

    document.addEventListener('click', (event) => {
      const checkoutLink = event.target.closest('a[href="checkout.html"], .cart-drawer-checkout, [data-direct-checkout]');
      if (checkoutLink) {
        window.startStripeCheckout(event);
        return;
      }

      const cartLink = event.target.closest('a[href="cart.html"], .nav-cart-btn');
      if (cartLink) {
        openDrawer(event);
        return;
      }

      const control = event.target.closest('[data-cart-action]');
      if (!control || !window.Cart) return;
      const id = Number(control.dataset.id);
      const item = window.Cart.getItems().find(entry => Number(entry.id) === id);
      if (!item) return;

      if (control.dataset.cartAction === 'decrease') window.Cart.updateQuantity(item.id, item.quantity - 1);
      if (control.dataset.cartAction === 'increase') window.Cart.updateQuantity(item.id, item.quantity + 1);
      if (control.dataset.cartAction === 'remove') window.Cart.removeItem(item.id);
      renderDrawer();
    });

    window.addEventListener('cart-updated', renderDrawer);
  });
})();
