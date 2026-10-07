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
| Storage   | Cloudflare R2 (bucket `yourownprint`) | Public base `https://yourownprintimages.co.uk` (custom domain, Oct 2026; old r2.dev URLs saved in Mongo are rewritten by ImageHostMiddleware) |
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

- **Margins (Oct 2026 check).** Supplier prices are ex-VAT trade (VAT reclaimed); selling prices include 20% VAT
  (kids zero-rated). Target: ~55% on supplier cost after VAT + Stripe (1.5% + ~10p/item), for EVERY colour and size.
  `_reprice_2026_10_v1` applied backend/data/reprice_2026_10.json once: raised underpriced base prices, added
  `colour_upcharges` on dearer colours and `size_upcharges` for 3XL+ (supplier products had none). Designer tee bulk
  = one tier only (£6.99 at 10+, `_designer_tee_bulk_v1`); the designer page now shows/applies bulk tiers like checkout.
- **Team kits from real garments** (`routers/team_kits.py`, Oct 2026): kit-classic (JC001+JC080+PA016),
  kit-contrast (JC003+JC080+PA016), kit-training (classic, socks/names off by default), kit-tracksuit (JH001+JH072,
  adults only). Price table per player (adult/kids x socks x names, ~55% after VAT+Stripe) -> `team_kit_pricing()`
  in `_resolve_line_pricing` (kids sizes via negative size upcharges; per-part colours validated, incl. kids colour
  availability). PDP = TeamKitConfigurator kit mode (KitPicker: colour per part + live preview, roster). Team Kits
  page lists KIT_SECTIONS only; old placeholder kits hidden (`_hide_placeholder_kits_v1`) + redirected in
  ProductDetail. Card photos in frontend/public/kits/.
  Full Squad Configurator (/full-squad-configurator) is built on the same kits: Match Day (Classic|Contrast),
  optional Training + Tracksuit, ONE roster (name/number/size, tracksuit size) -> basket checkout of kit lines
  (createCartCheckout, server re-prices) or a quote over 25 players. Old admin "bundle variants" no longer used there.
  Rugby: no match rugby shirts at PenCarrie/Ralawise (Front Row = "for leisure use only"), so the Rugby section =
  Contrast kit (training/touch) + Front Row FR100/FR7 club & supporters shirts (`_add_front_row_rugby_v1`, data
  backend/data/front_row_rugby.json) + a match-kit quote card; old rugby-kit-* placeholders hidden + redirected.
- **Bundles are LOGO-ONLY** (Tim, Oct 2026): one logo, included, at `bundle_logo_position()` (left chest, else the
  garment's cheapest position e.g. cap front). Server forces it for any bundle with `bundle_included_print` (never
  blank, no extra positions); the PDP shows a fixed "3. Your logo" step + upload, linking to Kit Your Workforce /
  quote for more prints.
- **Hi-vis vests/waistcoats/tabards/gilets = chest + back only** (no full front - opening + tape; no sleeves except
  long-sleeve waistcoats): `_hivis_vest_prints_v1`, also applied to bundles made from them. Bundles' included logo
  value = chest logo, or the cheapest allowed position where a garment has no chest (`bundle_included_value`).
- **Micro fleece = small prints only** (DTF flattens/shines pile): `_micro_fleece_prints_v1` set
  allowed_placements to chest + sleeves (gilets/bodywarmers chest only) on micro fleece garments without hand-set
  positions; skips balaclava/Morf/bob hat and fleece-LINED shell jackets.
- **Kit Your Workforce pricing:** per garment = garment price (after workforce bulk %, snapped to .99) + £3.50 logo
  (`WORKFORCE_LOGO_PRICE`), floored at the Specials price (`workforce_min_unit`: matching `special-<id>`, else the
  cheapest live Special of the same category) so it never undercuts Specials; + size upcharge + £3.50 back print.
  Frontend (KitYourWorkforce.jsx) mirrors it using `logo_price` / `min_unit` from /workforce/products.
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

- **Portfolio page galleries.** Fight Night ("See the tee in action") and Festival page galleries
  (`PortfolioCarousel`, swipes all photos) show jobs whose category IS that gallery or whose `show_on` list includes
  it (Admin > Portfolio > "Also show in:"). Gallery jobs also show on the Portfolio page (leavers design-template
  categories don't). Admin > Page copy image boxes must match what pages read (`site.image(...)` / `copy.images[...]`).
- **Full colour ranges.** The old bulk import cut every product to its first 24 colours (cap removed).
  `_restore_cut_colours_v1` (marker `pencarrie_full_colours_v1`) adds the missing ones back from
  `backend/data/pencarrie_colours.json` (PenCarrie export, styles with >24 colours, not discontinued) - add-only,
  never Ralawise/bundles; hidden colours + hand-set colours still win via reapply_saved_settings. Photos are copied
  to R2 in the background by `_mirror_restored_colour_photos` (marker `pencarrie_full_colours_photos_v1`).
- **Size guides: real measurements only.** The old generic chart template (made-up XS-4XL numbers)
  was removed site-wide (never bring it back). Automatic charts come only from
  `backend/data/pencarrie_size_charts.json` (built from PenCarrie's product export "Size
  Conversions" column: chest/waist to fit in inches, UK dress size, height...) via
  `_pencarrie_size_chart()`, and `backend/data/ralawise_size_charts.json` (Ralawise xlsm "Sizing To
  Fit" column; measurement type inferred: chest/waist inches or UK dress size) via
  `_ralawise_size_chart()`. Charts the admin types are never
  replaced. One-size / non-apparel products get no chart (`_is_one_size_or_non_apparel`).

- **Fight Night tees** (`/fight-night-tee`): two products, `boxing-fight-tee` (Standard, Gildan, £11.99) and
  `boxing-fight-performance` (AWDis Cool T JC001, £13.99), both in `FIGHT_NIGHT_IDS` (sponsor/back/sleeve add-on
  prices + bulk tiers = £1 off at 10+, £2 off at 25+ of each tee's own price, `fight_night_tiers()`). Kids sizes
  live on the same product with a -£2 size upcharge (adults + kids count together for tiers). Their /product/:id
  pages redirect to the Fight Night page. Colours = every colour the KIDS version is made in (GD01B / JC001B,
  all also in adult), from PenCarrie's export: `FIGHT_NIGHT_COLOURS_STANDARD` / `_PERFORMANCE`.
- **Prototype placeholders hidden** (`OLD_PLACEHOLDER_PRODUCTS`, `_hide_placeholder_products_v1`, Oct 2026): 27 built-in
  stock-photo products (football-jersey, aprons, hi-vis-vest, joggers...). Sports page tiles + sport landing product_ids
  point at real garments; old /product links redirect (ProductDetail PLACEHOLDER_MOVED).
- **Sports Outfit Configurator** (gyms/PTs/fight clubs) rebuilt Oct 2026 on kit-training + kit-tracksuit (reuses
  useKit/OptionalSet/ImageSlot from FullSquadConfigurator): logo included, optional back logo on top/hoodie =
  team-kit "back-print" add-on, one people list, basket checkout (server re-prices) or quote over 25 people.
  The old SPORTS_OUTFIT_SECTIONS / sports_outfit_addons settings are no longer used by the page.
- **Dance studio kit builder** (`/dance-studio-kit`, DanceStudioKit.jsx, `routers/dance_kit.py`, Oct 2026): real
  women's + kids garments per set (top: SK236/SM236, JC017, BL1019, GD01/GD01B; bottoms: SK64/SM64, SK428/SM428,
  SK427/SM427; hoodie: JH016, JH001/JH001B, JH050/JH050B; joggers JH072/JH072B; bag BG145 / W110). Garment = product's
  own price; prints whole pounds (logo £3 incl., big front +£2, name £3, back logo £5) via `dance_print()` in
  _resolve_line_pricing when design_meta.flow == "dance" (no bulk tiers). Basket checkout. Dance landing CTA points here.
  Dance bags also include mini barrel BG140S + barrel BG140.
- **School group builders** (`routers/group_kits.py` + GroupKitBuilder.jsx, Oct 2026): `/school-trips/order`
  (tee GD01/B, hoodie GD57/B, sweat GD56/B, polo SS11/B, cap BB10/B, hi-vis RS200/B, bucket BB90N/NB) and `/sports-day/order`
  (landing pages `/school-trips`, `/sports-day` (page copy `sports-day`); house colours: several colour rows per garment, house name per colour; JC001/B, GD01/B, JC007/B, JC040/B, GD57/B,
  BB10/B). Front and/or back print: upload a design or type wording; £3 a print (first shown in the price). Whole-order
  bulk % (LEAVERS tiers) - `_set_group_qty()` counts every flow "group_kit" line of a group_id server-side before pricing.
- **Kit bag add-on** (ClubBagAddon.jsx, `/club-bags`, `dance_kit.CLUB_BAG_SET`) in the Sports Outfit + Full Squad
  builders: barrel BG140, teamwear holdall BG572, Quadra holdall QS70, boot bag QD76, gymsac W110; logo £3 included,
  name +£3; one basket line with design_meta.flow "club_bag" (priced by dance_print). Per-person "Bag" tick in the roster.
- **Leavers range** (`/leavers-hoodies/start`, LeaversFlow.jsx): own products (category "leavers", own photos/prices),
  linked to real garments in `LEAVERS_GARMENTS` (GD57, JH001, JH003, JH043, GD56, GD01; zip GD58 hidden; bag = W110).
  `_link_leavers_garments()` copies colours (+ `kids` flag), sizes, 3XL+ upcharges every startup, then reapply_saved_settings.
  Kids sizes 7-8 up only (Gildan M/L/XL = 7-8/9-11/12-14), priced via negative size upcharges. Bulk = % off each size's own
  price (`LEAVERS_BULK_TIERS_PCT`, `leavers_size_prices`). Colour required at checkout; adult-only colours refused with
  kids sizes. Leavers products are kept OUT of /products, search, shop-by-type and Find My Kit; /product/:id redirects.
- **Offers ("Was" price):** `was_price` in `product_overrides` (Product settings > Name, price & main
  photo > "Offer - 'Was' price"). Shown only while above `price` (`offer_was_price()`): crossed out +
  "Offer" pill in PriceTag (cards), designer Total panel + product dropdown, basket (`on_offer` from
  /cart/price). Display only - checkout charges `price` as normal. Empty it to end the offer.
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

- **Customer print files must reach the order.** Uploads on product pages / team kits / Fight Night are sent
  with `uploadOrderArtwork()` (lib/api.js -> POST /uploads/artwork, stored in R2) and saved on the order line as
  `design_meta.art_<position>` = "/api/uploads/artwork/<id>.png". Shown as thumbnails in Admin > Orders and as
  links in the shop's order email; NOT copied into Stripe metadata (50-key cap). Before Oct 2026 the files never
  left the browser - any new checkout flow must do the same.
  Server-side backstops (Oct 2026 audit): `_order_art_links()` (end of _resolve_line_pricing) adds links for
  Design Your Own artwork (`/api/designer/artwork/<id>/<part>.png`) and a club shop's logo; leavers + workforce save
  their data-URL files with `_save_order_file()` (leavers also the picked library design); workforce orders store
  `items` like basket orders. Quote requests save files as links, email the shop, Admin > Enquiries shows them.

- **Growth features (Oct 2026):**
  - Image domain: `services/image_host.ImageHostMiddleware` rewrites saved r2.dev photo URLs to R2_PUBLIC_URL in API
    responses once R2_PUBLIC_URL is a custom domain (no-op while it is r2.dev). No DB migration needed.
  - Google Merchant feed: `routers/google_feed.py`, GET /api/feeds/google.xml (gzipped, cached 6h, colour x size
    variants, sizes with upcharges left out so prices match the PDP). PDP opens `?colour=`.
  - Tracking: `lib/tracking.js` + `CookieConsent.jsx` - Meta Pixel / GA4 / Google Ads IDs in Admin > Integrations
    (public via /api/site/tracking); NOTHING loads before "Accept all". Events: page view, view item, add to basket,
    begin checkout (api.js checkout fns), purchase (CheckoutSuccess).
  - Meta Conversions API (`services/meta_capi.py`): Purchase sent server-side when an order is paid
    (_maybe_send_order_emails), event_id = Stripe session id (same as the browser pixel's eventID, so deduped), hashed
    email/phone/name/town/postcode, ONLY if the customer accepted cookies. Checkouts store `tracking` (X-Consent,
    X-Fbp, X-Fbc, X-Page-Url headers from api.js + IP/UA). Settings: meta_capi_token, meta_test_event_code. Last
    result in db.settings `meta_capi_last`.
  - Structured data: `components/bold/JsonLd.jsx` (Product + rating on PDP/designer, Organization on home, FAQ on occasions).
  - Follow-ups: `routers/followups.py` loop every 30 min - review request REVIEW_DAYS (10) after paid_at (stamped in
    _maybe_send_order_emails) -> /review/<token>; abandoned basket reminder (unpaid cart checkouts with email after 3h,
    saved customer carts after 4h) -> /basket/restore/<token>; opt-out link /api/email/stop/<token>. Only orders/baskets
    after `followups_started_at`.
  - Sign-up offer: `routers/signup_offer.py` + `SignupOffer.jsx` popup - single-use Stripe promotion code 10% off
    (WELCOME-XXXXXX); ALL checkouts allow_promotion_codes. Admin > Email sign-ups (CSV).
  - Seasonal pages: `/occasions/:slug` (lib/occasions.js, page copy `occasion-<slug>`) + `SeasonalBanner` on home.
  - Club shops: `routers/club_shops.py` - /club-shop/new (organiser), /club/<code> (parents pay individually, lines
    flow "club_shop", priced by club_print: garment + logo £3 + name £3, free "delivered to the club" shipping),
    /club/<code>/manage/<token>, Admin > Club shops (CSV).

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
