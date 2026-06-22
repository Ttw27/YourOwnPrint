# Your Own Print — PRD

## Original Problem Statement
Build a complete, modern e-commerce website for a UK custom print and workwear business "Your Own Print" (yourownprint.co.uk). Fully standalone (no Shopify). Stripe payments. Built-in custom product designer.
Build 4 distinct theme variations on a single homepage showcase so the owner can pick. After theme selection, the rest of the site (Design Your Own tool, category pages) is built in the chosen theme (default: Industrial Dark).

## User Personas
- **Small business owner / trades** — needs branded workwear in low quantities, no minimums.
- **School / sports / dance group leader** — needs personalised hoodies, tees, polos for a class or team.
- **Marketing manager** — wants premium-feel branded apparel for staff or events.

## Tech Stack
- React 19 + Tailwind + Shadcn UI (sonner toasts) + react-router 7
- FastAPI + MongoDB (motor)
- emergentintegrations Stripe checkout (test mode: `sk_test_emergent`)

## Architecture
- Backend `/app/backend/server.py` — products catalogue (in-memory), contact, theme-selection, Stripe checkout session + status + webhook
- Frontend routes: `/` (theme showcase), `/workwear`, `/teams-schools`, `/design`, `/contact`, `/checkout/success`
- Theme components: 4 independent self-contained homepages in `/app/frontend/src/components/themes/`
- Shared Industrial Dark navbar/footer in `/app/frontend/src/components/IndustrialLayout.jsx`

## Implemented (2026-02)
- [x] 4 theme showcase homepage with distinct fonts (Oswald / Plus Jakarta Sans / Nunito / Cormorant Garamond), colours and layouts
- [x] All 4 themes include sticky navbar, hero, trust bar, sector grid (10), Design Your Own feature, best sellers, reviews, footer
- [x] "Select This Theme" buttons persist to localStorage + POST to `/api/theme-selection`
- [x] Workwear category page (4 products)
- [x] Teams, Schools & Clubs category page (4 products)
- [x] Design Your Own interactive tool: upload image, add text (font + colour), 5 filters, drag/resize/rotate/delete, size selector S–XXL, quantity, live price
- [x] Stripe test-mode checkout (server-side prices, GBP, /api/checkout/session, /api/checkout/status polling, /api/webhook/stripe)
- [x] Contact / Get a Quote form persisted to MongoDB
- [x] Remove-background button — placeholder toast (remove.bg API to be wired)
- [x] Responsive mobile layouts across all themes & pages
- [x] data-testid coverage on all interactive elements
- [x] 13/13 backend tests passing, frontend critical flows verified

## Backlog
**P0 (post-theme-pick)**
- Rebuild inner pages (Workwear, Teams/Schools, Design Your Own, Contact) in the theme the owner picks (currently Industrial Dark for all inner pages by user request)

**P1**
- Wire real remove.bg API for one-click background removal
- Add cart with multi-product checkout (currently single-product per session)
- Product detail pages with size guides + fabric specs
- Real product catalogue management (admin panel) — replace in-memory PRODUCTS dict

**P2**
- SEO meta + sitemap + OG images per page
- Account login + order history (Emergent Google Auth)
- Email order confirmation via Resend
- Bulk-order quote calculator
- Reviews import from Judge.me
