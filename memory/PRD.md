# Your Own Print — PRD

## Original Problem Statement
UK custom print & workwear e-commerce site (no Shopify). Theme 3 Bold & Bright chosen by user. Stripe test-mode. Designer tool. Native reviews + Judge.me import.

## Tech Stack
- React 19 + Tailwind + Shadcn UI + sonner + react-router 7
- FastAPI + MongoDB (motor)
- emergentintegrations Stripe checkout (test mode)

## Implemented

### Iteration 1 — Themes + core pages
- 4 theme showcase (now at `/themes`)
- Workwear, Teams/Schools, Designer, Contact, Checkout pages
- Stripe test-mode checkout, MongoDB persistence

### Iteration 2 — Theme 3 Bold & Bright + Reviews
- Whole site restyled to Theme 3 (white + lime green #7bc67e + Nunito + rounded pills + blobs)
- Native review system with photo upload (base64, auto-resized, max 4 per review)
- Product detail pages with reviews
- Judge.me JSON importer at `/admin/import-reviews`
- `/reviews` index page

### Iteration 3 — Price Promise + Pro Product Detail + Review Filters
- **Reviews-with-photos filter chips** on every product page + rating filter chips (5★/4★/3★/2★/1★) with live counts
- **Price Promise messaging** — confident warm copy: "Looking professional shouldn't cost a fortune." Three variants:
  - `band` (compact, top of homepage)
  - `hero` (full section near footer)
  - `card` (sidebar on product page)
  - All CTAs link to `/contact` so the owner can capture quote-beat enquiries
- **Workwearexpress-style Product Detail page** with:
  - Colour swatches (per-product palette: garment, hoodie, hi-vis)
  - Multi-size matrix — each size has its own qty input, +/- buttons, row highlights green when qty>0, running summary "M×3 · L×2"
  - Size upcharges (3XL +£1.50, 4XL +£3.00) baked into pricing
  - Print placement selector (left/right breast, full-front, back, left/right sleeve)
  - Exclusivity rules — full-front auto-disables left/right breast (and vice versa)
  - "Buy blank" toggle — turns off prints, just garment
  - Live price summary with breakdown (base × qty + size upcharges + print × qty = total)
  - "Checkout" + "Design these prints" dual CTA — designer launches with product/colour/placements context
- **Backend** extended:
  - `/api/placements` (6 placements with pricing + exclusivity)
  - `/api/checkout/session` now accepts `{size_qtys, color, placements, blank}` and computes total server-side
  - `/api/products/{id}` returns colours, sizes, size_upcharges
  - Legacy single-size checkout path retained + qty=0 validation fixed
- **34/34 backend tests passing**, 100% frontend e2e on new flows

## Backlog

### P1
- Wire real **remove.bg** API
- **Review-request emails** via Resend (close-the-loop for new orders)
- **Real product images per colour** (currently single image; would need colour-specific stock photography)
- **Multi-product cart** (one product per session today)
- Real admin UI to manage products/colours/sizes (currently inline `PRODUCTS` dict)

### P2
- SEO meta + sitemap + OG images
- Bulk-quote calculator (50+ tee tiered pricing)
- Customer accounts + order history
- Photo upload → object storage when review photo volume grows
- "Recently viewed" + wishlist
