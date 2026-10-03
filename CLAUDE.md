# YourOwnPrint — Project Guide for Claude Code

UK custom-print & workwear e-commerce platform (yourownprint.co.uk), Leicester-based.
A purpose-built standalone site replacing a previous Shopify + Qtomiser setup, for lower
platform cost and full control. Owner: Tim (TEZL GROUP LTD).

This file is the working brief. Read it before making changes.

---

## 1. Tech stack & where things run

| Layer     | Tech                              | Host                                                        |
|-----------|-----------------------------------|-------------------------------------------------------------|
| Frontend  | React + Tailwind (CRA + **craco**)| **Vercel** — root dir `frontend`                            |
| Backend   | FastAPI (Python)                  | **Railway** — root dir `backend`, URL `https://yourownprint-production.up.railway.app` |
| Database  | MongoDB Atlas                     |                                                             |
| Storage   | Cloudflare R2                     | Public base e.g. `https://pub-b995388ef13c4c14a498c874668ad48e.r2.dev` |
| Payments  | Stripe (hosted Checkout)          |                                                             |
| Other     | remove.bg (designer bg-removal), Judge.me (imported reviews) |                                  |

Suppliers/catalogue: **PenCarrie** (API) + **Ralawise** (xlsm import). ~3,400 products.
Live frontend: `https://your-own-print.vercel.app`.

---

## 2. THE most important principle: content lives in the DB, not in code

Admin-editable content — product colours, per-colour designer photos, print areas,
portfolio items, page copy, nav config, MediaBlock media, site images — is stored in
**MongoDB / R2**, NOT in code files.

**Consequences:**
- Editing code **never** touches this content. Deploys are safe; Tim's admin edits persist.
- You often **cannot fix a "live data" problem by editing code** — the data is in Mongo.
- Code changes to defaults (e.g. `DEFAULT_NAV_CONFIG`, garment colour defaults) only take
  effect where the DB has no stored override, or via a version-gate rollout.

When something "isn't updating," first ask: *is this value coming from code or from the DB?*

---

## 3. Build & deploy

### Frontend (Vercel)
- `cd frontend`
- Build script: `craco build` (via `npm run build`).
- **Quirk:** `package.json` devDependency `@emergentbase/visual-edits` is a leftover from the
  Emergent prototyping phase and can break clean installs. When building locally, strip it
  first, and build with lint disabled:
  ```bash
  # remove the visual-edits dep if present, then:
  echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env
  npm install --legacy-peer-deps --no-audit --no-fund
  CI=false DISABLE_ESLINT_PLUGIN=true npm run build
  ```
- **Env:** `REACT_APP_BACKEND_URL` must point at the Railway backend in production
  (Vercel env). All API calls go through `frontend/src/lib/api.js` (`api` axios instance,
  baseURL `${REACT_APP_BACKEND_URL}/api`).

### Backend (Railway)
- `cd backend`; entry is `server.py` (FastAPI app), ~6,800 lines.
- Routers live in `backend/routers/` and are imported at the bottom of `server.py` (~line 6760).
- Verify compiles with `python3 -m py_compile server.py routers/*.py services/*.py`.
- **Env vars used:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `CORS_ORIGINS`, `SENDER_EMAIL`, `SITE_BASE_URL`, `YOP_APP_ORIGIN`.
- Healthy boot log line: `Loaded NNNN imported products from Mongo.`
- To force a Railway rebuild when a web-UI upload didn't trigger one: push a trivial change
  to `requirements.txt`.

### Deploy reality (historically manual — Claude Code should improve this)
- Tim has been uploading files **by hand via the GitHub web UI**, in bulk batches, with no
  local dev/terminal. **Claude Code can and should replace this** with direct edits + commits.
- GitHub web-UI uploads don't reliably trigger Vercel/Railway rebuilds — always confirm both
  platforms deployed the newest commit.
- `main.XXXXXX.js` bundle hash in the browser console is the reliable signal of whether new
  frontend code actually reached the browser (most "still broken" reports are cache/deploy lag —
  hard-refresh, check the hash).

---

## 4. Repo layout

```
backend/
  server.py                 # main FastAPI app: models, PRODUCTS in-memory dict, startup merges,
                            # most endpoints, DEFAULT_NAV_CONFIG, pricing, catalogue seed
  routers/
    ai_classify.py          # Smart Re-classify (AI categorisation)
    find_my_kit.py          # AI kit concierge (/find-my-kit)
    image_health.py         # broken-image scan/hide (/admin/image-health/*)
    design_shop.py          # Design Shop storefront (/design-shop/*)
    design_shop_admin.py    # Design Shop upload tool (/admin/design-shop/*)
    ralawise_import.py       # Ralawise xlsm importer, job-based progress (/admin/ralawise/*)
    designer_ai.py          # remove-bg, AI effects for the designer
    cms_page_copy.py        # editable page copy (/page-copy/*, /admin/page-copy/*)
    configurator_addons.py  # sports-outfit / full-squad configurator add-ons
    customer_auth.py        # customer accounts, cart, orders, saved designs
    admin_reviews.py        # review moderation
    bundles.py              # Bundle builder (/admin/bundles/*) + public /bundles: bulk PACKS (fixed qty,
                            # size split per garment on the PDP, validated at checkout) and per-person SETS.
                            # Logo (1 position) included; discount grows with item count; prices end .99
    supplier_status.py      # Clearance check (/admin/clearance/*): reads PenCarrie's Clearance/Discontinued
                            # flags, sets supplier_status (ending/partial/gone/ok) + ending_colours
    proof_maker.py          # admin proof maker (/admin/proof/*) - serves garment photos so the
                            # browser can export a watermarked proof PNG (page: AdminProofMaker.jsx)
  services/
    r2_storage.py           # Cloudflare R2 put/get + mirror_external_image
    stripe_checkout.py       # Stripe hosted Checkout session creation
    email.py                # transactional email
frontend/src/
  lib/api.js                # ALL API calls + the `mediaUrl()` helper (see §6)
  lib/data.js               # NAV_MENU frontend fallback (real nav is DB-served, see §5)
  pages/                    # ~60 page components (public + /admin/*)
  components/bold/          # ~29 shared components (BoldLayout nav/footer, MediaBlock,
                            # GarmentSilhouette, PortfolioStrip/Carousel, SiteImage, etc.)
  hooks/                    # usePageCopy, useSiteImages, usePageTitle
```

---

## 5. Systems that trip people up (read before touching these)

- **Navigation is DB-served.** `GET /api/navigation` returns the stored config from
  `db.settings` (key `navigation_config`); `DEFAULT_NAV_CONFIG` in `server.py` is the source of
  truth for new deploys. It uses a **version gate**: bump `DEFAULT_NAV_CONFIG["version"]` and the
  endpoint auto-persists the new default over an older stored one (so nav changes roll out
  without a manual DB reset), while respecting admin edits made on the current version.
  `NAV_MENU` in `frontend/src/lib/data.js` is only a fallback if the API fails.

- **Auto-lock / Smart Re-classify.** Manual admin edits to a product's collection, industry
  tags, or print placements set `_manual_edit: true`, which makes Smart Re-classify skip that
  product. Admin has a lock filter, lock badge, and mass-unlock. Don't "helpfully" re-classify
  locked products.

- **Designer products** (`/admin/designer-products`): the Personalised Tee/Hoodie etc. Colours
  are editable per product (`designer_colors`), overriding the garment default. Per-colour
  photos (`designer_images_by_colour`) take priority over any fallback. **When saving colours,
  the endpoint must also update the in-memory `PRODUCTS[pid]["colors"]`** or the live designer
  won't reflect changes until restart (this was a real bug — keep the in-memory apply).

- **Design Shop** is a separate store-within-a-store: products carry `design_shop: true`,
  `design_categories`, `design_garments`, `design_image`. They are **excluded** from the workwear
  catalogue (`/products`), `/search`, and Find My Kit. Don't let them leak into workwear listings.

- **Design Shop product page** is `/design/:id` (`DesignShopProduct.jsx`; `/product/:id` redirects there).
  No print options: customer picks garment type -> colour -> sizes. Each garment type (t-shirt, hoodie...)
  is linked to a real Designer product + price in Admin > Design Shop > Garments & prices
  (`db.settings` `design_shop_garments`, defaults in `routers/design_shop.DEFAULT_GARMENT_PRODUCTS`).
  The mockup lays `design_image` onto that garment's per-colour designer photo inside its print area.
  Checkout prices from `design_meta.garment` (`resolve_design_garment`); sizes/colours from the linked garment.
  Per-design size/height (`design_placement`, {"all"|garment: {scale, y}}) set via "Adjust size" in
  Admin > Design Shop; used by the mockup and noted on the order (`design_meta.print_size`).
  `design_hidden_colours` (same window): colour names a design is not sold in, on any garment;
  filtered from /design-shop/product and refused at checkout.

- **Hidden products.** Products are never deleted — they're hidden with `active: False`
  (stored on the `imported_products` doc for supplier products, or in `product_overrides`
  for built-in ones; always set it via `_set_product_active()`). Hidden products **stay in
  `PRODUCTS`** so admin can see and unhide them, so **every public endpoint must iterate
  `live_products()` / check `is_live(p)`**, never `PRODUCTS.values()` directly, or hidden
  products leak onto the site.

- **Admin edits to supplier products live outside the product record.** Designer settings
  (`designer_settings`), product settings (`product_meta`) and name/price/photo
  (`product_overrides`) are overlaid onto `PRODUCTS`. `_apply_imported_product()` rebuilds an
  entry from `imported_products` and **drops those edits**, so **always call
  `reapply_saved_settings([ids])` after it** (startup, bulk update, imports all do). Ralawise
  re-import sets `active` only on insert so it never un-hides hidden products.

- **Admin saves are PARTIAL - send only what changed.** Product settings (`/meta`), the
  name/price/photo box (`/override`) and Designer products send only fields the admin actually
  changed, and those endpoints write only fields sent. Never go back to "send the whole record":
  it pinned defaults (all 9 print placements), auto-locked products, froze supplier values and
  overwrote changes made elsewhere. An emptied override field means "back to the original".
  Re-imports set selling `price`/`category` on first insert only (never reset to trade cost).

- **Colours & sizes switched off** in Product settings are stored as `hidden_colours` /
  `hidden_sizes` in `product_meta` and filtered out of `PRODUCTS[pid]["colors"/"sizes"]` by
  `_apply_hidden_options()` (full lists kept in `_all_colors`/`_all_sizes` for admin). Anything
  that rewrites a product's colours/sizes must be followed by `reapply_saved_settings` or
  `_apply_hidden_options(pid)`.

- **Your Own Print Specials** (`specials_eligible`): ONE left-breast logo included in the price - checkout
  forces placements to ["left-breast"] at £0 print and only accepts the product's own colours.
  The 13-product range (from the old Shopify store) is created once from `backend/data/specials_range.json`
  by `routers/specials.create_specials_range()` (photos mirrored to R2). `colour_upcharges` (e.g.
  {"Black": 2.0}) adds to the garment price per colour, server + PDP. Designer products are never Specials.
- **Design Your Own products** (`designer_enabled`) are sold ONLY through the designer: `/product/:id`
  redirects to `/design?product=:id`. For a garment that should also be sold normally, duplicate it first.

- **Delivery** (`routers/delivery.py`, Admin > Configurator prices > Delivery): chosen on Stripe's
  checkout page via `shipping_options` passed by ALL 4 checkout paths (`_delivery_options_for`):
  free collection, free local (LE1-LE5, checked after payment -> warning on the order), UK by
  total weight (garment weights by name keyword) with bands + extra 25kg boxes, free over £150.
  Stripe collects address + phone; `_capture_delivery` saves them on the order (`delivery`) + emails.
  International: the basket's "Delivering to" (uk/europe/world) is sent as `delivery_region`; Stripe then
  gets ONLY that zone's price and `allowed_countries` (zones in delivery.DEFAULTS["zones"], editable).

- **Regular-customer discounts** (Admin > Customers, `customers.discount_pct`, max 50): % off the
  GARMENT price only (print full price), on top of bulk tiers, never on bundles. Applied server-side
  in `_resolve_line_pricing(account_discount_pct=...)` from `account_discount_for_request()` (reads
  the `X-Customer-Token` header the api.js interceptor sends). Frontend mirrors it via
  `useAccountDiscount()` / `discounted()` (CustomerAuthContext) in PriceTag, PDP, designer, cart.

- **Size guides: real measurements only.** The old generic chart template (made-up XS-4XL numbers)
  was removed site-wide (never bring it back). Automatic charts come only from
  `backend/data/pencarrie_size_charts.json` (built from PenCarrie's product export "Size
  Conversions" column: chest/waist to fit in inches, UK dress size, height...) via
  `_pencarrie_size_chart()`, and `backend/data/ralawise_size_charts.json` (Ralawise xlsm "Sizing To
  Fit" column; measurement type inferred: chest/waist inches or UK dress size) via
  `_ralawise_size_chart()`. Charts the admin types are never
  replaced. One-size / non-apparel products get no chart (`_is_one_size_or_non_apparel`).

- **Industry page tabs** (`/industries/:slug`): "Popular for this sector" garment-type buttons above the
  products = shortcuts to the sidebar's Product type filter (`category` URL param; sidebar unchanged).
  Defaults in `INDUSTRY_TAB_DEFAULTS` (server.py); admin overrides in Admin > Pages > "Industry: ..."
  (page copy `extras.tabs`). On "All products" the tab types are shown first, interleaved, core styles
  (many colours) before one-off cheap lines; tabs for types the sector has none of are hidden.
- **Nav default version:** bumping `DEFAULT_NAV_CONFIG["version"]` REPLACES Tim's saved menu
  (stored `default_version` < new version). Ask Tim before bumping it.

- **Image import & mirroring.** Supplier images are mirrored to R2 via
  `services/r2_storage.mirror_external_image`. **Supplier CDNs (pimber.ly, Ralawise) block bot
  user-agents** — mirror requests and the health scanner MUST send real browser headers
  (User-Agent + Referer), or downloads fail and working images get false-flagged as broken.
  The health scanner only flags **definitive 404/410** as broken (not blocks/timeouts).

---

## 6. Known gotchas / debugging lessons (all learned the hard way)

- **Backend-served image paths need the backend prefix.** Portfolio (and some other) images are
  served at a relative `/api/portfolio/file/...` path. On the live site the frontend is on Vercel
  and the API on Railway, so a bare `/api/...` src resolves to Vercel and 404s. **Always wrap such
  srcs in `mediaUrl()`** (in `lib/api.js`) — it prefixes `/api/...` with the backend origin and
  passes absolute/data URLs through. Product images use full R2 URLs and don't need it.

- **ESLint is disabled in the build** (`DISABLE_ESLINT_PLUGIN=true`), so **use-before-declaration
  (TDZ) errors are NOT caught at build time** — they compile fine and crash at runtime, often
  blanking an entire group of pages with no warning. Be careful placing hooks/consts in order;
  render-test after big edits.

- **Substring category matching is dangerous** — e.g. "short" matches "Short Sleeve" and
  miscategorises into Shorts. Keep keyword→category matching precise/word-boundaried.

- **Mobile overflow regressions:** grid/carousel changes can introduce `min-width: auto` issues
  causing horizontal overflow / zoom-out on mobile. Test mobile after layout changes.

- **`str_replace` on non-unique strings** lands in the wrong place and breaks JSX silently.
  Always include enough surrounding context to be unique.

- The sandbox/CI **cannot reach the live Railway backend, Mongo, or R2** (allowlist). Live-data
  checks (image counts, real URLs, whether an import worked) need Tim to look. Code is verifiable;
  live data is not.

---

## 7. Conventions Tim cares about

- **Plain-English admin labels** — describe *where something appears on the site*, not the code
  concept (e.g. "Where it shows on the site", not "industry_tags"). He dislikes technical jargon
  in admin.
- **Shopify-style admin UX** as the reference. Product editor is organised into grouped
  "Section" cards with clear headings + one-line hints. Extend that pattern to other admin screens.
- Design/competitor references: workwearexpress.com, workwear.co.uk (workwear), Shopify (admin UX).
- Brand green `#7bc67e`; Design Shop purple `#a855f7` / `#7c3aed`.

---

## 8. Current status & outstanding work

### Code: complete and deployed. Everything built in prior sessions is in the repo.

### The ONE real go-live blocker:
- **Stripe live keys.** Swap test → live:
  - `STRIPE_API_KEY` on Railway: `sk_test_...` → `sk_live_...` (or set via Admin → Integrations)
  - Vercel publishable key if used: `pk_test_...` → `pk_live_...` (note: site uses **hosted
    Checkout**, so the publishable key may not be needed)
  - Create a **live** webhook at `…/api/webhook/stripe`, event `checkout.session.completed`,
    and set `STRIPE_WEBHOOK_SECRET` to its `whsec_...` (**required** — the webhook refuses all
    events without it; orders still complete via the success page's direct Stripe check)
  - Test a real card for a small amount; confirm the order lands in admin (proves the webhook)
  - Remove any hardcoded "Test mode" label if one still shows at checkout

### Admin/content tasks (no code needed — Tim does these):
- Run the two bulk passes in `/admin/products-import` (category + tagging fixes) — highest priority
- Hide the ~58 genuinely-imageless Ralawise products via Image Health
- Upload per-colour designer photos; compress + upload the promo video ("Good" 720p/25fps, no audio);
  upload festival gallery photos under the right category slug

### Known gaps not yet built (backlog):
- Per-product social share images (parked due to prior deploy risk)
- Portfolio items can have extra photos (`extra_images`, served at /api/portfolio/file/{id}__{xid}.ext); cards + lightbox use `ImageSwiper`; each photo has a `focus` {x,y,zoom,fit} set by dragging/zooming in Admin > Photo gallery > Move photo (`photoStyle()`); `PUT /admin/portfolio/{id}/photo-order` reorders (first = main); file lookup is by URL so photos can move. Each photo also gets WebP web copies (`thumb_url` ~800px for cards, `web_url` ~1800px for the full view) served straight from R2; made on upload + backfilled at startup (`_backfill_portfolio_web_versions`); originals untouched
- Plain-English rewording of the remaining admin screens
- (Optional) serve portfolio images directly from the R2 public URL instead of proxying through
  the backend — would remove the need for `mediaUrl()` on portfolio, but existing items are saved
  with the `/api/...` path so they'd need a migration; not worth it pre-launch.

---

## 9. How to work in this repo (for Claude Code)

1. Make changes directly, then **build the frontend** and **`py_compile` the backend** before
   committing — this repo has no CI catching errors (ESLint is off).
2. Prefer small, targeted commits now that direct git access is available (the old bulk-batch
   habit was a web-UI limitation, not a preference).
3. After a change that affects live behaviour, tell Tim exactly what to check on the live site,
   and remind him to confirm Vercel/Railway deployed the newest commit (bundle hash).
4. Respect the DB-vs-code split (§2) and the systems in §5 — most bugs here come from forgetting
   one of them.
