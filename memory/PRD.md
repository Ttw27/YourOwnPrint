# Your Own Print — PRD

## Stack
- React 19 + Tailwind + Shadcn + sonner + react-router 7
- FastAPI + MongoDB
- emergentintegrations Stripe checkout (test mode)

## Implemented

### Iter 18 — PDP layout v2 + thumbnails + tier highlight + Workforce uploads (Feb 2026)
- **PDP layout restructured**: description + size-guide table moved to the LEFT column under the image. Right column keeps buy-form (title, bulk pricing, colour, sizes, placements).
- **Image gallery + thumbnails**: new `image_gallery` field on `ProductMeta` (max 8 URLs). Thumbnails strip renders under the main image when gallery has >1 entry; click swaps the main image. Admin can add/remove via `/admin/product-settings → aps-gallery-{id}`.
- **Live bulk-tier highlight on PDP**: BulkTierLadder now receives `currentQty` from the sizes-and-quantity total. The active tier tile lights up bright green with a ring + scale-up effect; "Your qty: X" badge appears next to the heading. Each tile carries `data-active="true|false"`.
- **Kit Your Workforce uploads**: new "2. Upload your prints" section (breast logo required; back-print required only when any row has back-print ticked). Reusable `ArtworkUploader` component (file → base64 data URL, 6 MB cap, image-only mime check). Sticky summary disables Checkout until artwork is uploaded and shows an amber inline warning.
- **Backend**: `WorkforceCheckoutRequest` now accepts `breast_logo_data_url` + `back_print_data_url`; `/workforce/checkout` validates artwork presence and saves to a new `workforce_artwork` Mongo collection linked to the payment_transaction. Also validates 6 MB per image and rejects checkout when needed back-print artwork is missing.

### Iter 17 — Default product-meta seed (Feb 2026)
- **Auto-populates** `description_full`, `size_guide_table`, and `bulk_pricing_enabled=true` for all 39 products on startup (non-destructive: only fills empty values; admin overrides survive).
- **Garment classifier** picks the right size-guide template per product type: tee/polo/vest (chest + length), hoodie/sweatshirt/jacket (+ sleeve), shorts (waist + inseam), tracksuit (chest + waist). UK sizing in cm.
- **One-time blanket enable** of bulk pricing across the catalogue (guarded by `settings.product_meta_seed_v1` flag — admins can disable per product after).
- Now visible on every PDP: long description card, "Size guide" badge → modal, and bulk-tier ladder.
- Cleaned `**markdown**` literals from already-saved descriptions.

### Iter 16 — PDP reorder + "Match with" strip (Feb 2026)
- **New PDP order** (above the footer): Customers also bought → Match with → Questions & answers → Reviews.
- **"Match with" strip** — admin-curated complementary items (max 4 per product, no auto-fallback). Amber-styled to distinguish from green "also bought".
- Backend: `match_with` field on `ProductMeta`, public `GET /api/products/{id}/match-with`, admin meta validation (no self-ref, max 4).
- Admin: new "Match with" picker added to `/admin/product-settings` accordion (`aps-match-with-{id}`).
- Refactor: `AlsoBoughtWith.jsx` replaced by generic `RelatedProductsStrip` used by both strips.
- Smoke-tested: backend validations + frontend ordering confirmed at heading y=2092/2517/2941.

### Iter 15 — Kit Your Workforce + Also-bought cross-sells (Feb 2026)
- **Kit Your Workforce builder** at `/workforce` (and `/kit-your-workforce`): mixed-garment bulk page with sticky live-total summary, tier chips, "add N more to unlock −X%" hint. Free breast-logo print included on every garment; optional back-print at +£3.50/garment (only enabled where the product allows `back-print`). Dual CTA: Stripe checkout up to the quote threshold, then quote-only.
- **Workforce-eligible** flag per product (`workforce_eligible`) — set in `/admin/product-settings`. Seeded on workwear-tshirt, workwear-sweatshirt, workwear-jacket, hi-vis-vest.
- **Workforce tiers** (admin-configurable): `GET /api/workforce/tiers` + `PATCH /api/admin/workforce-tiers` for tiers list + `quote_threshold` (default 100). Tiers fall back to the global bulk defaults if not customised.
- **Workforce checkout** `POST /api/workforce/checkout`: validates each line, computes tier discount on garment base only (snap_to_99), adds size upcharges + back-print fees, persists to `payment_transactions`, returns Stripe URL. Rejects non-eligible products + disallowed back-print. Over-threshold → 422 routing to quote.
- **Workforce quote** `POST /api/workforce/quote`: stores in `quote_requests`. Sales-team picks up within 24h.
- **Also-bought cross-sells** (`/api/products/{id}/also-bought`): admin-curated picks per product (`also_bought` field, max 6, validates no self-ref) with auto-fallback to same-category siblings (max 4). New `AlsoBoughtWith` component rendered on every PDP between reviews and Q&A.
- **AdminProductSettings** extended: top-level "Kit Your Workforce tiers" block (`aps-workforce`), per-product workforce-eligible toggle (`aps-workforce-{id}`) and Also-bought picker (`aps-also-bought-{id}`).
- **Navbar**: "Kit Workforce" link added between Workwear and Teams & Schools.
- **Tests**: 19/19 backend pytest pass (`/app/backend/tests/test_iteration15.py`). Frontend e2e verified pricing math (30 tees → £179.70 with 18% off + Add-70-more hint), over-threshold quote flow, and Stripe redirect.

### Iter 14 — Phase 2: Admin auth + Restricted placements + Customer Q&A (Feb 2026)
- **JWT admin authentication** (bcrypt + HS256 PyJWT). Admin user seeded at startup from `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`). Token in `localStorage.yop_admin_token`, attached via axios request interceptor. Cookie also set on login for SSR-friendly auth.
- **Auth endpoints**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- **Protected admin routes** via `Depends(require_admin)`: GET/PATCH `/admin/products`, `/admin/products/{id}/meta`, GET/PATCH `/admin/designer-products`, PATCH `/admin/bulk-tiers/defaults`, GET `/admin/qa`, POST `/admin/qa/{id}/answer`, DELETE `/admin/qa/{id}`, plus POST/PUT/DELETE `/team-kit-brands` and POST `/reviews/import-judgeme`.
- **Frontend admin wall**: `/admin/login` page + `RequireAdmin` wrapper around every `/admin/*` route; persistent admin top-bar with Sign out + nav.
- **Allowed print placements** per product: new `allowed_placements` field on `ProductMeta` (7 values: left-breast, right-breast, full-front, back-print, left-sleeve, right-sleeve, neck-label). Admin toggles in `/admin/product-settings` (`aps-placements-{id}`). PDP `placements-grid` now filters by this list.
- **Customer Q&A on PDP** (`pdp-qa-section`): public POST `/api/qa` immediately publishes the question; PDP shows full Q&A list with answers; admin replies/deletes via `/admin/qa` page.
- **Admin credentials**: stored in `/app/memory/test_credentials.md`.

### Iter 1–4 (summary)
- 4-theme showcase (at `/themes`), Theme 3 Bold & Bright chosen
- All inner pages in Bold & Bright style
- Native reviews + photos + Judge.me importer + filter chips
- Price Promise messaging (band/hero/card variants)
- Product detail: colour swatches, multi-size matrix, print placements with exclusivity, prominent Buy Blank, required artwork upload, bespoke quote card
- WhatsApp site-wide (placeholder number)
- Sports & Combat category (8 products), Fight Night Tee dual flow
- Generic /api/quote-request endpoint

### Iter 5 — Team Kits redesign (combo of Option 1 + Option 4)
- **5 new team-kit bundle products** (`category=team-kits`): Football Kit Bundle £24.99, Football Premium Bundle £29.99, Rugby Kit Bundle £32.99, Training Pack £17.99, Full Squad Pack £54.99 (prices per player, badge + names included)
- **`/team-kits` gallery** (Option 1): hero "Team Kits. Sorted.", 5 visual bundle cards, "Big order? Multiple teams?" promo section, price promise hero
- **`TeamKitConfigurator` on product page** (Option 4): replaces normal size matrix on team-kit category products
  - Single team / Multi-team toggle with tabs
  - Per-team: name, contact, badge upload, roster table (Name / Number / Size / Qty)
  - Quick-add rows (5/11/15/18/22/25)
  - Shared sponsor logo uploads (+£2.50/kit each)
  - Live indicative total
- **Quote-only triggers**: totalKits >15 OR teams >1 OR sponsors >0 → "Send quote request"
- **Stripe direct checkout otherwise**
- Removed old `/team-kit-builder` from nav (route still exists as fallback)
- Sports CTA now → `/team-kits`
- **50/50 backend tests** pass, 100% frontend e2e verified

### Iter 13 — Product meta + generic bulk pricing + Fight Night gallery (Feb 2026)
- **Brand + SKU + full description + size guide** per product (admin-managed). Size guide can be an image, a measurements table, or both. New `ProductMeta` model + `product_meta` MongoDB collection (overlaid at startup).
- **Size guide modal** on PDP — opens from a "📏 Size guide" CTA next to the price. Shows image and/or measurement table (size · chest · length).
- **Generic % bulk pricing** — admin sets default tiers (1-9 = 0%, 10+ = 10%, 25+ = 18%, 100+ = 28%, 200+ = 35%) via `/admin/bulk-tiers/defaults`. Per-product overrides supported. Prices snapped to nearest £.99 via `snap_to_99()`.
- **Hybrid coexistence** — Fight Night & Leavers keep their existing absolute tier prices; all other products use the generic % system if `bulk_pricing_enabled` is ticked.
- **PDP bulk tier ladder** — visible on every product with bulk enabled (`pdp-bulk-tiers` + `pdp-tier-{min_qty}` chips with "save £X" labels).
- **PDP brand + SKU + full description** displayed under the title (`product-brand`, `product-sku`, `product-description-full`).
- **Fight Night mockup gallery** — 3-up mockup figures (`fn-gallery-0..2`) + "send us your event photos" WhatsApp panel (`fn-share-photos`).
- **New admin page `/admin/product-settings`** — per-product accordion with brand/SKU/description/size-guide rows/bulk-pricing toggle + per-product overrides. Plus a global "Default Bulk Tiers" editor at the top.
- **Validation** — per-product override min_qty ≥ 1, pct 0–90 (matches the global validation).
- **Testing**: 21/21 backend tests pass (test_iteration13.py); all critical frontend flows pass on live preview (iteration_13.json). 100% success rate.

### Iter 12 — Fight Night cleanup + Sports expansion + Leavers' group orders (Feb 2026)
- **Fight Night Tee simplified** — removed back-mode sub-options (large vs sponsors); now a single full-back toggle with one upload slot. Cleaner UX matching what actually prints.
- **Fight Night bulk pricing** — tiers 10+ £10.99/tee, 25+ £9.99/tee (base £11.99). Visible ladder + "add N more to drop to £X" nudge on the page; server-side via `FIGHT_NIGHT_BULK_TIERS` + `tier_unit_price()` helper.
- **Sports expansion** — 5 new standalone products (basketball-vest £19.99, cricket-polo £21.99, hockey-shirt £22.99, athletics-vest £14.99, cycling-jersey £32.99) in category=team-kits with the full configurator.
- **Leavers' Hoodies / Varsity** — new dedicated `/leavers-hoodies` landing with hero, **bulk tier ladder** (20+ £19.99, 30+ £17.99, 60+ £16.99, 100+ £15.99), 4 garments (pullover, zip, varsity jacket, sweatshirt), 3 ready-to-go design templates, **printed drawstring bag addon (+£3.99/garment)**.
- **Group Order link feature** — rep creates a shared link via `/leavers-hoodies/start`, gets a unique URL `/leavers/{token}` plus a private manage URL `/leavers/{token}/manage` (manage_token stored in localStorage). Classmates open the link and add their own name + nickname + size + qty. Rep dashboard shows live roster, total with bulk tier auto-applied, "Copy link", remove member, close order, and one-click checkout for the whole group.
- **Backend**: 9 new endpoints (`/bulk-tiers/fight-night`, `/bulk-tiers/leavers`, `/leavers/products`, `/group-orders` POST/GET/join/manage/close/member-DELETE), `LEAVERS_BAG_PRICE` constant, leavers + drawstring-bag pricing branches in checkout (drawstring-bag flat £3.99/garment as a placement on leavers products; standalone leavers-drawstring-bag product NOT bulk-priced).
- **Nav**: added "Leavers'" entry.
- **Testing**: 27/27 backend tests pass (test_iteration12.py); all 15 critical frontend flows pass on live preview (iteration_12.json). Verified e2e: 30 hoodies + bag = £659.40 with bulk tier auto-applied; group-order lifecycle (create → 3 join → DELETE one → close → join-after-close blocked) all green.
- **Polish**: clipboard fallback to `document.execCommand('copy')` in iframed contexts.

### Iter 11 — Neck label add-on + product info card (Feb 2026)
- **Neck label add-on** (`+£1.50/garment` flat, DTF heat-transfer) — third canvas tab next to Front/Back with a 2:1 landscape aspect that mimics a real ~60×30 mm sewn-in label
- **`{SIZE}` token** — special locked text item in the neck-label canvas (`designer-add-size-token`, only one allowed per design). On checkout the client composes one transparent neck-label PNG **per unique size** in the order (M.png, L.png, XL.png…) with the actual size baked in — production gets a ready-to-print queue per size variant
- **Backend storage** — DesignerArtwork model extended with `neck_label_pngs` + `neck_label_preview_pngs` (dicts keyed by size) + `neck_label_items_count`; checkout designer branch now adds back-print + neck-label upcharges additively (server-side `NECK_LABEL_PRICE = 1.50` constant)
- **Product info card** in the Designer's Product panel — shows `composition` (e.g. "180 GSM · 100% ring-spun cotton"), `description_long` (2–3 sentences), and `use_cases[]` badges (Workwear / Branded to sell / Daily use / Sports / Kids / Eco). Helps brand-starters pick the right blank
- **Admin** (`/admin/designer-products`) — extra inputs: composition, description textarea, and 6 use-case toggle buttons per product. `/api/admin/designer-products` PATCH validates use_cases against allow-list
- **Per-product info defaults** seeded for all 8 designer-enabled products (tee, hoodie, kids tee, polo, workwear tee, workwear sweat, school hoodie, sports tee)
- **Testing**: 9/9 backend tests pass (test_iteration11.py); all 25 critical frontend checks pass on live preview (iteration_11.json). Verified e2e: 2×M + 1×L with back + neck = £37.44 on Stripe.

### Iter 10 — Designer polish (Feb 2026)
- **Removed Filters panel** (Vintage/B&W/Warm/Cool) and the `filter` state — AI effects (Cutout.pro placeholders) remain for proper image effects
- **Per-layer reorder** — every row in the Layers panel now has its own `layer-up-{id}` / `layer-down-{id}` buttons (boundary buttons are disabled), so customers can reorder layers inline without selecting first
- **Size breakdown chips** under the total — when sizes are picked, a chip strip shows the per-size breakdown (e.g. "6 × L · 2 × XL · 2 × M"), so customers see exactly what they configured before checkout. Testids `size-breakdown` + `size-breakdown-{sz}`
- **Testing**: 17/17 frontend checks pass on live preview (iteration_10.json); backend unchanged.

### Iter 9 — Designer back print + dual transparent PNG (Feb 2026)
- **Back-print toggle in Designer** — adds upcharge per unit = **60% of unit price rounded to nearest £0.99 (£0.99 floor)**. Calculated server-side via `designer_back_print_price()` helper. Per-product values exposed via `/api/designer/products[].back_print_price`: tee £3.99, hoodie £8.99, kids-tee £4.99, polo £4.99, workwear-tee £3.99, workwear-sweat £7.99, school-hoodie £9.99, sports-tee £4.99.
- **Front/Back canvas tabs** — separate item lists per side (`frontItems` / `backItems`), `designer-view-front` / `designer-view-back` toggle. Clicking the Back tab auto-enables back-print.
- **Side badge** on canvas (`designer-side-badge`) shows "FRONT VIEW" / "BACK VIEW".
- **Layers panel** is view-aware — shows current side count + "front/back N" hint for the other side.
- **Dual transparent PNG export** — both front and (when back enabled) back composed at 2000×2000 (print) + 1000×1000 (preview) and POSTed in a single `/api/designer/artwork` doc with new fields `back_png`, `back_preview_png`, `back_items_count`. Independent 6 MB caps per side.
- **Designer-flow checkout branch** in `/api/checkout/session` — adds back-print upcharge only when `design_meta.flow=='designer'` and `'back-print'` is in placements; placed before PLACEMENT_BY_ID catch-all so existing PDP flows are untouched.
- **Edge case** — backEnabled with empty backItems raises a toast and aborts before any network calls.
- **State reset** on product change — clears front/back items, sizeQtys, backEnabled, view → 'front'.
- **Testing**: 85/85 backend tests pass (10 new in test_iteration9.py); all 6 critical iter-9 frontend flows verified end-to-end on live preview (iteration_9.json).

### Iter 8 — Designer overhaul v2 + Admin-managed designer products (Feb 2026)
- **Text auto-fit**: text items now use `inline-block` + `white-space: nowrap` with no fixed width — bounding box hugs the rendered text exactly. Resize handle is always reachable.
- **Size-quantity matrix in designer**: replaces single size+qty with per-size buckets (S/M/L/XL/...) each with own quantity, matching the Fight-Night UX. Totals computed accurately, not lumped.
- **Layers panel**: lists every text/image layer in the right rail with per-layer remove + click-to-select. "Clear all layers" replaces the global clear.
- **Designer-enabled products via admin**:
  - 8 products enabled by default (tees, hoodies, polos, workwear basics): personalised-tee, personalised-hoodie, kids-tee, polo-shirt, workwear-tshirt, workwear-sweatshirt, school-hoodie, sports-tee
  - Each product carries `designer_image` (the canvas backdrop) + `designer_print_area` ({x,y,w,h} %)
  - New `/admin/designer-products` page — per-product toggle, image URL, print-area coordinates, Save button
  - Backend overrides persisted in `designer_settings` collection, merged into in-memory PRODUCTS on startup + on PATCH
- **Transparent PNG export on checkout**: client composes all layers (no garment background) onto a hidden canvas at 1000×1000 (preview) + 2000×2000 (print-ready), POSTs to `/api/designer/artwork`, and references the returned `artwork_id` in Stripe session metadata for fulfilment lookup.
- **Backend additions**: `/api/designer/products`, `/api/admin/designer-products` GET+PATCH, `/api/designer/artwork` POST+GET, startup hook merges Mongo overrides
- **TeamKitConfigurator copy**: back-print description now clearly states "Back print sits below the player's name & number — names & numbers are already included in your kit price."
- **Testing**: 75/75 backend tests pass (8 new in test_iteration8.py); all 5 critical frontend flows verified on live preview (iteration_8.json)

### Iter 7 — Team Kit print restructure + Designer overhaul (Feb 2026)
- **Team Kit print structure rebuilt**: front sponsor = FREE, single upload only. Sleeves +£3.00/kit each. Back print +£3.50/kit. Each toggled addon REQUIRES its own artwork upload before checkout (per-addon validation).
- **4 new front-print-only product variants** (cheaper, no names/numbers): football-kit-front-only £18.99, football-premium-front-only £22.99, rugby-kit-front-only £25.99, training-pack-front-only £12.99 — share TEAM_KIT_ADDONS pricing
- **Fight Night Tee** — dedicated upload slot per addon (back print, left sleeve, right sleeve) when toggled ON; checkout blocked until artwork provided
- **Designer (Design Your Own) overhaul**:
  - Multiple text + image items, fully composable layers
  - **Double-click text to edit inline** (`design-text-edit-{id}` input replaces the rendered text)
  - **In-canvas handles**: rotate knob (top centre) + resize dot (bottom-right) on selected items
  - **Selected-item properties panel** with font, colour, font-size slider, rotation slider, image-size slider
  - **Layer controls**: up/down/duplicate/delete
  - **AI effect placeholders** (Cutout.pro Poster/Sketch/Cartoon/Enhance) — toast "coming soon" until API key wired
- **Backend**: new TEAM_KIT_ADDONS dict, `/api/team-kits/addons` endpoint, checkout pricing branch for category=team-kits routes through TEAM_KIT_ADDONS
- **Testing**: 67/67 backend tests pass (9 new in test_iteration7.py); all 4 critical frontend flows verified on live preview (iteration_7.json)

### Iter 6 — Team Kit & Fight Night refinements (Feb 2026)
- **Removed** multi-team toggle from `TeamKitConfigurator` (single-team only per user request)
- **Quote threshold** simplified to `totalKits > 15` only (sponsors & brand no longer force quote)
- **Sponsor uploads** are now *upload-for-proof only* — no per-kit upcharge, no quote trigger; placement decided at proof stage
- **Optional brand picker** on team-kit products driven by new `team_kit_brands` collection
- **Admin Kit Brands CRUD** at `/admin/team-kits` — list/create/edit/delete, filter by product, image + description fields
- **Fight Night Tee** rebuilt as pay-first flow: removed design-yourself, added back-print (+£3.50) and left/right sleeve (+£3 each) addons, unified sponsor upload section, post-payment quote-request sync for proof tracking
- **Backend**: `/api/team-kit-brands` GET/POST/PUT/DELETE, `/api/fight-night/addons`, fight-night addon pricing branch in `/api/checkout/session`
- **Route alias**: `/design-your-own` → `DesignYourOwn` (in addition to `/design`)
- **Testing**: 58/58 backend tests pass; all 4 critical frontend flows verified on live preview (iteration_6.json)

## Backlog

### P1
- Real WhatsApp number swap
- Real product photography (especially per colour and team-kit bundles)
- Wire **remove.bg** API (currently placeholder toast)
- **Cutout.pro** API for AI image effects (poster, sketch, cartoon, enhance) inside Design Your Own
- Multi-placement output (front/back/sleeve mockups) saved with order for production
- Persist composed designer image to backend (S3 / object storage) for fulfilment
- **Resend** transactional emails (free proofs, review-request emails, quote acknowledgements)
- Multi-product cart (currently 1 product per Stripe session)
- Tiny `/admin/inbox` dashboard for quote_requests + payment_transactions + contact_submissions
- Judge.me bulk review import (paste/upload customer's JSON export)

### P2
- SEO + sitemap + OG images
- Customer accounts + order history
- Wishlist / saved designs (layers panel, undo/redo in designer)
- Per-placement artwork preview rendered on the live garment image
- Public Judge.me API write-back so new reviews flow upstream
- Real Stripe webhooks + fulfilment pipeline (currently test mode only)
