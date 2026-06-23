# Your Own Print — PRD

## Tech Stack
- React 19 + Tailwind + Shadcn UI + sonner + react-router 7
- FastAPI + MongoDB (motor)
- emergentintegrations Stripe checkout (test mode)

## Implemented

### Iter 1 — 4-theme showcase + core pages
### Iter 2 — Theme 3 chosen + native reviews + Judge.me importer
### Iter 3 — Price Promise + colour swatches + multi-size + placements + review filter chips
### Iter 4 — Buy Blank prominence + Required upload-before-checkout + WhatsApp + Sports + Team Kit Builder + Fight Night Tee
- **Buy Blank** as bold segmented control (`Add Custom Print` / `Buy Blank — No Print`)
- **Section 4 "Upload your prints"** — required artwork slot per placement, auto-resized, checkout locked until all uploaded
- **WhatsApp FAB** site-wide (placeholder `+44 7000 000000` — swap in `/app/frontend/src/lib/data.js`)
- **BespokeQuoteCard** on every product page (WhatsApp + contact link for unusual prints)
- **/sports** — 8 sports products (football jersey/shorts, rugby shirt, training tracksuit/tee, boxing fight tee, muay thai shorts, MMA fight shorts) + 6 sport-group cards
- **/team-kit-builder** — 5-step builder (club + badge + sponsors + roster + notes); under 10 kits → Stripe direct checkout; 10+ → quote request with free proof
- **/fight-night-tee** — dual flow: "Design yourself" (existing designer) or "Let us do it for you" (upload all logos → free proof → quote)
- **/api/quote-request** — generic quote endpoint (kind: team_kit | fight_night | bespoke_print | general) with artwork array (12 limit, 1.5MB each)
- **33/33 backend tests pass**, 100% frontend e2e on new flows

## Backlog

### P1
- Per-placement artwork preview shown on the product image
- Real WhatsApp number (swap placeholder)
- Real product images per colour variant
- Wire **remove.bg** API
- **Resend** email — review-request + quote acknowledgement + free-proof delivery
- Multi-product cart (currently 1 product per Stripe session)
- Admin UI to manage products / quote requests / reviews
- Object storage for review/quote photos when volume grows

### P2
- SEO + sitemap + OG images
- Customer accounts + order history
- Live chat alongside WhatsApp
- Bulk-quote calculator on product pages
- Wishlist + saved designs
- Public Judge.me reviews JSON push (so new reviews flow back to Judge.me too)
