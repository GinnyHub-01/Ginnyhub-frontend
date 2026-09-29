# Ginnys Hub Shopfront

Modern responsive e-commerce storefront for Ginnys Hub, styled from the supplied flyer.

## Pages
- Home: polished editorial landing page with restrained motion, hero carousel, featured products and category sections.
- Shop: dedicated product catalogue with search, category filters, favorites and quick add-to-bag.
- Cart: dedicated full shopping cart page with quantity controls, removal and order summary.
- Checkout: dedicated checkout flow with customer details, delivery address, payment method and order notes.

## Run
```bash
npm install
npm run dev
```

Set `VITE_API_URL` in `.env` to point to the backend API. If the API can't be reached, the shop shows an error with a **Try again** button (and retries automatically when the shopper navigates back or comes back online). Demo products are only used in `npm run dev`.

The visual direction intentionally uses the flyer palette and imagery as inspiration while keeping the interface modern, clean, spacious and not overly decorative.

## Navigation & authentication
The shopfront is a single-page app: Home, Shop, Cart, Checkout, Sign in and Sign up change views without a browser refresh. It uses the History API for clean URLs (`/shop`, `/cart`, `/checkout`, `/signin`, `/signup`). The included `vercel.json` and `public/_redirects` keep those routes working on common static hosts.

The authentication screens are wired to `POST /auth/login` and `POST /auth/register` on the configured API. If your backend uses different auth routes, update those two endpoints in `src/main.jsx`.

## Performance & deployment notes
- Only files in `public/` are copied into the build. Put anything referenced by an absolute path (`/flyer.webp`, `/ginnys-logo.webp`) there. Originals live in `design-source/` and are not shipped.
- Always deploy a fresh `npm run build` (don't upload an old `dist/`); set `VITE_API_URL` in your host's environment settings.
- Delivery pricing comes from the backend (`GET /api/config`), so the storefront and stored orders always agree.

## Product pages
Each product has its own page at `/product/<slug>` (gallery, price and "was" price, stock status, quantity selector capped at stock, related products, WhatsApp enquiry). Cards, cart items and related products link to it. The SPA host must serve `index.html` for unknown paths (already set up in `vercel.json` and `public/_redirects`).
