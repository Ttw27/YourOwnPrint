# Customer quotes

Branded PDF quotes from a small JSON file per enquiry.

- `company.json` - shop details, "Included in every price" list and terms (shared by every quote).
- `clients/<date>-<name>.json` - one quote: client, title, intro, options (garments + per-item prices), extras.
- `make_quote.py` - builds `pdf/<same name>.pdf` (Chrome headless, no installs).

```bash
python3 quotes/make_quote.py quotes/clients/2026-10-21-streetwear-brand.json
```

To make a new quote, copy the last client file, bump `number`, change the date/client/options.
Each option can have any number of items; set `"recommended": true` on one to highlight it.
Prices are per item ex VAT (`"price_basis": "ex_vat"`); the set total and inc-VAT figure are worked out.
Optional per quote: `valid_days`, `included`, `terms` (override company.json), `notes`, item `note`.

`clients/` and `pdf/` are kept out of git (`.git/info/exclude`) - they hold customer details.
