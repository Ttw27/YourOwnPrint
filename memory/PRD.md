# Your Own Print — PRD

UK custom print + workwear e-commerce site at yourownprint.co.uk. Standalone (no Shopify). Stripe payments. Bulk pricing. Built-in Design Your Own canvas. Sports & Fitness team kits, leavers' hoodies, workwear, specials. UK English throughout.

## Core requirements (from user)
- Standalone e-commerce — no Shopify
- Stripe payments (test mode currently)
- Flows: Workwear, Teams & Schools, Leavers' Hoodies, Design Your Own, Specials (left-breast only), Kit Your Workforce, Get a Quote
- Custom designer (canvas, image upload, text, neck label, transparent PNG per size)
- Mobile responsive
- Custom Team Kits + Fight Night Tees
- UK English spelling everywhere (colour, personalise, bespoke, favourite)
- Portfolio with admin-managed photo uploads
- Editable navigation in admin
- Industries: Healthcare, Construction & Trades, Retail, Security, Corporate, Sports & Fitness, Industrial, Beauty & Wellness, Cleaning, Hospitality & Catering
- Sports & Fitness SEO landings: Football, Rugby, Gyms, PTs, Boxing, Thai Boxing, Kick Boxing, Dance Studios
- Garments: T-shirts, Hoodies, Polos, Sweatshirts, Jackets, Hi-Vis, Shorts, **Bottoms (joggers, trousers, leggings)**, **Aprons**, Accessories
- Admin can paste API keys for Stripe / Resend / remove.bg / Cutout.pro / Judge.me / WhatsApp / Contact email

## What's been implemented
- ✅ JWT Admin Auth + admin routes (`/admin/login`, all `/admin/*` JWT-protected)
- ✅ Stripe checkout sessions (test mode) + 1-product cart
- ✅ Design Your Own canvas + transparent PNG generation per size
- ✅ Product catalogue with bulk pricing, size guides, image galleries, Q&A, "Also Bought" + "Match With" strips
- ✅ Leavers' Hoodies single-order flow + drawstring bag cross-sell + WhatsApp bespoke fallback
- ✅ Kit Your Workforce mixed-garment bulk builder with breast/back artwork uploaders
- ✅ Your Own Print Specials collection (left-breast only, no MOQ)
- ✅ Mega-menu navbar (Shop by garment / collection / Sports & Fitness / Workwear / Portfolio / Design / Quote)
- ✅ Industries — 10 canonical industries + legacy alias resolution (`/api/industries/{slug}`)
- ✅ **Aprons** (bib / waist / denim) + **Bottoms** (joggers / workwear trousers / performance leggings / gym shorts)
- ✅ **Sports & Fitness SEO landings** at `/sports-teams/:slug` — 8 pages, each with H1/intro/SEO paragraph/FAQ schema/product grid
- ✅ **Portfolio** — public `/portfolio` (filters + lightbox + featured strip on homepage) + admin `/admin/portfolio` (upload/list/edit/delete/feature/hide). Object storage backed (Emergent S3-style via EMERGENT_LLM_KEY), graceful fallback to base64.
- ✅ **Admin-editable navigation** — `/admin/navigation` (add/remove/reorder items + columns + links). Navbar loads live config from `/api/navigation` with hardcoded fallback.
- ✅ **Admin Integrations page** — `/admin/integrations` stores Stripe / Resend / remove.bg / Cutout.pro / Judge.me / WhatsApp / Contact email keys (DB-first, env-fallback). Stripe key hot-applies to running process.
- ✅ **Logo swap** — uploaded PNG logo replaces text wordmark in navbar/footer/favicon.
- ✅ **WhatsApp FAB** — now reads `/api/site/whatsapp`; hides when no number configured.
- ✅ **Full Squad Configurator** (Feb 2026, roster everywhere + gym bag) — public `/full-squad-configurator`. All three sets (Match Day / Training / Tracksuit) use per-player roster (name + top/bottom/sock sizes per row). Number column only on Match Day; sock column only on sets that include socks. Optional printed **drawstring gym bag** with badge + player name at £4/bag per section (`FULL_SQUAD_ADDON_DEFAULTS.gym_bag_addon_price`). Hero advertises free per-kit name labels + gym bag upgrade. Backing endpoints: GET /api/full-squad/config (all sections `requires_per_player_roster=true`), POST /api/quote-request.
- ✅ **Sports Outfit Configurator** (Feb 2026, front+back combo + uploaders) — public `/sports-outfit-configurator`. FRONT print is a radio (unbranded/breast/full-front — mutually exclusive), BACK print is an independent checkbox (+£4, tops only) — combines with any front option. Artwork uploaders (front + back) hit `POST /api/uploads/artwork` and attach to the QuoteRequest as a persisted `attachments` array in Mongo. Section-level "Different sizes for tops & bottoms?" split toggle.
- ✅ **Teams, Schools & Clubs hub** (Feb 2026, rewritten) — public `/teams-schools`. Audience-first layout: 6 tiles route people to the right flow (Leavers, Full Squad, Sports Outfit, Group hoodies, Dance, Bespoke). Trust bar, live review score, portfolio carousel (with empty-state prompt), popular garments row, FAQ, bottom CTA.
- ✅ **Collection sidebar filter** (Feb 2026) — `/shop/:slug` now has a left-hand sidebar with auto-derived facets (Colour / Size / Gender fit / Industry / Price range). Facets ONLY appear when there's variance across the collection's products. URL-driven filters (shareable, back-forward friendly). Auto-linked from product data via `_facets_from_products` — no admin work needed to enable facets on new products.
- ✅ **Collection SEO copy** (Feb 2026, admin-editable) — `/admin/collection-seo` per-slug editor for intro / body / FAQ. Renders as an in-depth SEO block at the bottom of `/shop/:slug` for search visibility.
- ✅ **Bulk product import** (Feb 2026, PenCarrie / manual) — `/admin/products-import` accepts CSV upload / JSON paste / manual entry. Auto-categorises by keyword, applies markup% on source_price → retail price, and imported products **appear on the site instantly** in the correct collection with sidebar facets working out-of-the-box (server startup hook `_load_imported_products` hydrates them into the in-memory `PRODUCTS` registry; `_garment_type_of` now honours the stored `category` field). Persisted in Mongo `imported_products`. New admin nav links added for Bundle variants / Import / SEO copy.
- ✅ **Foundational CMS** (Feb 2026) — `/admin/page-copy` slug-based hero/H1/subtitle/body editor with per-page Revert-to-defaults. Backend: GET /api/page-copy/{slug} public, PATCH+DELETE /api/admin/page-copy/{slug} admin. Pydantic-hardened length caps (title 200, subtitle 400, body 20k chars). `usePageCopy(slug, defaults)` hook wired into 10 public pages: Home, Workwear, Specials, Contact, Leavers, Fight Night, Workforce, Design Your Own, Sports, Teams & Schools. Empty string treated as "unset" so defaults show through.
- ✅ **Configurator settings CMS** — `/admin/configurator-settings` edits Full Squad + Sports Outfit addon prices. PATCH endpoints MERGE (not replace) so saving one field retains the others. Server-side clamp 0–999 £.
- ✅ **Product override CMS** — `/admin/product-settings` inline `Basic catalogue override` panel per row edits name / price / short description / main image / active flag. Overrides persisted in `settings.key=product_meta:<id>`; applied over pristine PRODUCTS at read time and hot-reapplied to in-memory PRODUCTS registry on save. Revert (DELETE) restores from `_PRISTINE_PRODUCTS` deepcopy — no supervisor restart needed. Tested end-to-end in iter29 (16/16 CMS backend tests pass).
- ✅ **Resend transactional email** (Feb 2026) — non-blocking dispatch on `/api/leavers/bespoke` (notifies shop + confirms to customer) and `/api/contact` (notifies shop, reply-to = customer). Key resolved from `settings.integration_keys.resend_api_key` or `RESEND_API_KEY` env. Admin can hit `POST /api/admin/test-email` (button in `/admin/integrations` shown when the key is set) to send a "Resend is wired up ✅" test email.
- ✅ **remove.bg (real)** — `POST /api/designer/remove-bg` accepts data-URL or raw base64 up to 22MB, calls remove.bg /removebg with X-Api-Key, returns `{image_base64: 'data:image/png;base64,...'}`. Design Your Own canvas now calls it live (busy-state on the selected image, toast success/error).
- ✅ **Cutout.pro AI effects** — `POST /api/designer/ai-effect` supports `sketch / cartoon / poster / enhance`. Auto-normalises Cutout.pro's `imageUrl / resultImageUrl / imageBase64` response variants. Wired to the 4 effect buttons in Design Your Own.
- ✅ **Global back-print rule** — server-side strip at /api/checkout/session for `football-shorts / gym-shorts / performance-leggings / joggers / workwear-trousers` (NO_BACK_PRINT_PRODUCT_IDS).
- ✅ **Sock sizes admin** — GET /api/sock-sizes + PATCH /api/admin/sock-sizes. Editable inline on `/admin/bundle-variants` (top panel).
- ✅ **Admin Bundle Variants** (Feb 2026, rewritten) — `/admin/bundle-variants` supports the 5 new set slot IDs, colour picker (name+hex), sizes chip list, sock sizes override, included_items chips, and a size_guide free-text field. Fully e2e tested (iter24 — 18/18 backend + 5/5 frontend flows).

## Feb 2026 — Iter 30 changelog
- 🛒 **Multi-product cart shipped end-to-end** (backend + frontend, 100% tests pass):
  - `POST /api/cart/price` reprices any cart server-side (bulk tiers + size upcharges + print upcharges — identical to `/checkout/session`).
  - `POST /api/checkout/cart-session` builds one Stripe session for the whole cart (max 20 lines).
  - Server-side `origin_url` validation — reject any host outside `yourownprint.co.uk`, `emergentagent.com`, `localhost`.
  - Frontend `<CartProvider>` + `<CartDrawer>` (slide-out right, live-repriced) + `<CartIcon>` (navbar badge). LocalStorage-persisted (`yop_cart_v1`).
  - PDP now has "Add to basket" AND "Buy now" side-by-side. Configurators (Full Squad / Sports Outfit / Kit Your Workforce) stay quote-only.
  - Verified E2E: 5×Tee + 1×Hoodie added from 2 different PDPs → drawer shows 6 items, £34.95 total, checkout redirects to real Stripe payment page.
- 🧱 **`server.py` refactor scaffolding kicked off**: created `/app/backend/deps.py` (mongo + auth + api_router as single source of truth), `/app/backend/services/email.py` (Resend helpers), `/app/backend/routers/designer_ai.py` (remove-bg + ai-effect + admin/test-email moved out). Router modules import `api_router` from `deps` so no circular imports. This is the pattern for further extraction — next targets: `routers/cms.py`, `routers/checkout.py`, `routers/products.py`, `routers/configurators.py`.

## Feb 2026 — Iter 29 changelog
- Fixed all 3 CMS blocker bugs from iter 28 (verified 26/26 backend tests + full frontend suite pass in iter 29).
- Wired **Resend** for real transactional email on leavers/bespoke + /contact.
- Wired **remove.bg** and **Cutout.pro** real APIs into the DYO canvas (previously mocked).
- Added inline product override editor at `/admin/product-settings` (basic catalogue: name / price / description / image / active).
- Wired `usePageCopy` hook into 8 additional landing pages (Home, Workwear, Specials, Contact, Leavers, Fight Night, Workforce, Design Your Own).
- Server-side hardening: length caps on PageCopyPatch (title 200 / subtitle 400 / body 20k), 0–999 clamp on all addon prices.

## Key API endpoints (added this iteration)
- `GET /api/portfolio?category=&featured_only=&limit=`
- `GET /api/portfolio/file/{filename}` (object storage proxy)
- `POST /api/admin/portfolio` / `PATCH /api/admin/portfolio/{id}` / `DELETE /api/admin/portfolio/{id}` / `GET /api/admin/portfolio`
- `GET /api/sports-teams` / `GET /api/sports-teams/{slug}`
- `GET /api/navigation` / `PATCH /api/admin/navigation` (body: `{config: {menu: [...]}}`) / `POST /api/admin/navigation/reset`
- `GET /api/admin/integrations` / `PATCH /api/admin/integrations` (body: `{values: {...}}`)
- `GET /api/site/whatsapp` (public — used by FAB)

## DB collections (new)
- `portfolio`: {id, title, category, caption, alt_text, image_url, storage_path, content_type, display_order, featured, is_hidden, created_at}
- `settings`: keyed by "navigation_config", "integration_keys", "industry_seed_v2"

## Roadmap

### P0 — Deployment
- ✅ Deployment readiness scan passed. Ready for "Save to Github" platform feature.

### P1 — Integrations (admin has the UI; user provides keys)
- ✅ **Resend** wired for bespoke leavers' quotes + /contact form (user still needs to paste RESEND_API_KEY at `/admin/integrations`)
- ✅ **remove.bg** wired real API call in Designer (user needs to paste key)
- ✅ **Cutout.pro** wired real API call for AI effects (user needs to paste key)
- Post-purchase Judge.me review-request emails via Resend (still to build)

### P2 — Commerce hygiene
- Real Stripe webhook + fulfilment pipeline (order status, dispatch emails)
- Multi-product cart (currently 1-product Stripe sessions)
- Admin order inbox at `/admin/inbox` (quotes + transactions + portfolio submissions)

### P3 — Code health
- Split `/app/backend/server.py` (3,473 lines!) into `routers/{products,admin,portfolio,navigation,integrations,industries,sports_teams,checkout,designer}.py` + `services/{storage,seed}.py`. Testing agent flagged this; not blocking.
- Promote PATCH bodies to Pydantic models for `/admin/navigation` and `/admin/integrations` so 422s have structured schemas.

### P4 — Features
- Customer accounts + order history + saved designs
- Live product reviews via Judge.me import (endpoint exists at `/admin/import-reviews`)
- Real product photography swap-in (currently Pexels stock)
- Bulk discount auto-popup when threshold approached on PDP

## Test credentials
See `/app/memory/test_credentials.md`. Admin email/password + Stripe test card.

## Files of reference
- Backend: `/app/backend/server.py` (still monolith, awaiting refactor)
- Frontend pages: `/app/frontend/src/pages/{Portfolio,SportsTeamDetail,AdminPortfolio,AdminNavigation,AdminIntegrations}.jsx`
- Navbar: `/app/frontend/src/components/bold/BoldLayout.jsx`
- Logo: `/app/frontend/public/logo.png`
- API helpers: `/app/frontend/src/lib/api.js`
