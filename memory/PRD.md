# Your Own Print — PRD

## Stack
- React 19 + Tailwind + Shadcn + sonner + react-router 7
- FastAPI + MongoDB
- emergentintegrations Stripe checkout (test mode)

## Implemented

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

## Backlog

### P1
- Real WhatsApp number swap
- Real product photography (especially per colour and team-kit bundles)
- Wire **remove.bg** API
- **Resend** transactional emails (free proofs, review-request emails, quote acknowledgements)
- Multi-product cart (currently 1 product per Stripe session)
- Tiny `/admin/inbox` dashboard for quote_requests + payment_transactions + contact_submissions
- Judge.me bulk review import (paste/upload customer's JSON export)

### P2
- SEO + sitemap + OG images
- Customer accounts + order history
- Wishlist / saved designs
- Per-placement artwork preview rendered on the live garment image
- Public Judge.me API write-back so new reviews flow upstream
