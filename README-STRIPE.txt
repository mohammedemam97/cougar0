COUGAR - SECURE STRIPE SETUP

IMPORTANT
- Do NOT paste an sk_live_ or sk_test_ secret into HTML, JavaScript, CSS, or any file served to the browser.
- This project uses the server environment variable STRIPE_SECRET_KEY.
- START-WEBSITE.bat prompts for the key at runtime and does not write it into the project files.

HOW TO RUN
1. Double-click START-WEBSITE.bat
2. Enter your Stripe secret key when prompted.
3. The browser opens http://localhost:8787
4. Add products and go to Checkout.
5. Place Order redirects to Stripe-hosted Checkout.

SECURITY
Because a live secret key was shared in chat, rotate/revoke that key in the Stripe Dashboard before using this integration. Then use the newly created key at the runtime prompt.

TROUBLESHOOTING FAILED TO FETCH
- Use START-WEBSITE.bat. Do not open checkout.html with file://.
- This build uses port 8787 to avoid conflicts with Vite/dev servers that commonly use 5173.
- Keep the PowerShell window open while checking out.
