# Your Own Print — PRD

## Original Problem Statement
Build a complete modern e-commerce website for UK custom print & workwear "Your Own Print" (yourownprint.co.uk). 4 theme variations on a showcase, then implement everything in the chosen theme (default Industrial Dark; later switched to **Theme 3 Bold & Bright** by user).

## User Personas
- **Small business owner / trades** — branded workwear, no minimums
- **School / sports / dance group leader** — leavers hoodies, kit, dance apparel
- **Marketing manager** — branded staff/event apparel

## Tech Stack
- React 19 + Tailwind + Shadcn UI + sonner toasts + react-router 7
- FastAPI + MongoDB (motor)
- emergentintegrations Stripe checkout (test mode)

## Implemented (2026-02 / iter 2)

### Iteration 1
- [x] 4-theme showcase (Industrial, Clean Professional, Bold & Bright, Premium Dark) + bonus YOP Brand Edition (Theme 2B) at `/themes`
- [x] Workwear & Teams/Schools category pages
- [x] Designer tool (upload/text/filters/drag-resize-rotate, size, qty)
- [x] Stripe test-mode checkout
- [x] Contact / Get a Quote form

### Iteration 2 — Theme 3 Bold & Bright pick + Reviews
- [x] **Theme 3 Bold & Bright** rebuilt as canonical theme — all inner pages restyled (Home, Workwear, Teams, Designer, Contact, CheckoutSuccess)
- [x] **Native review system** — POST /api/reviews with photos (base64 data URLs, auto-resized client-side to ~1000px, max 4 per review). Per-product aggregate + 5-star distribution bars.
- [x] **Product detail pages** at `/product/:id` with reviews block + "Customise this product" CTA → Designer
- [x] **/reviews** index page: product grid + most-recent reviews
- [x] **/admin/import-reviews** — paste Judge.me JSON, map product titles → our IDs, default fallback. Imported reviews tagged `verified=true`, `source='judgeme'`.
- [x] Star ratings shown on every product card across the site
- [x] 24/24 backend tests passing, full frontend e2e verified

## Backlog

### P1
- Wire real **remove.bg** API for one-click background removal
- **Email order confirmations** + **review-request emails** via Resend (close the loop on new orders → reviews)
- Real **product catalogue admin** UI to add/edit products & images
- **Multi-product cart** (currently 1 product per checkout session)
- **Photo storage** — switch base64-in-Mongo to object storage when review photo volume grows

### P2
- SEO meta + sitemap + Open Graph images
- **Bulk quote calculator** (50+ tee tiered pricing) — high conversion on workwear sites
- Customer accounts / order history (Emergent Google Auth)
- Reviews moderation queue + spam filter
- Wishlist & saved designs
- Live chat widget integration
