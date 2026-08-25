COUGAR LAPTOP STORE - HOW TO OPEN

Recommended method (fixes cart/localStorage consistency across pages):
1. Double-click START-WEBSITE.bat
2. Your browser opens http://localhost:5173
3. Keep the black command window open while using the website.

Why not file:///.../index.html?
Browsers do not guarantee shared localStorage behavior for file:// pages. Since the cart uses localStorage, opening through localhost is the reliable way to keep the cart shared between Home, Products, Cart, and Checkout.

Checkout note:
The included Stripe key is a placeholder. The current checkout is a demo flow until a real Stripe publishable key + secure backend PaymentIntent endpoint are configured.
