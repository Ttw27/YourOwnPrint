#!/usr/bin/env python3
"""Turn a quote JSON (quotes/clients/*.json) into a branded PDF in quotes/pdf/.

    python3 quotes/make_quote.py quotes/clients/2026-10-21-streetwear-brand.json

Company details, included items and terms come from quotes/company.json; each
client file holds only that quote (options, garments, prices). Prices in the
client file are per item, ex VAT (or inc VAT with "price_basis": "inc_vat").
Needs Google Chrome (used headless to print the PDF). No pip installs.
"""
import base64
import datetime as dt
import html
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
VAT = 0.20


def esc(s) -> str:
    return html.escape(str(s or ""))


def money(v: float) -> str:
    return f"£{v:,.2f}"


def nice_date(d: dt.date) -> str:
    return d.strftime("%-d %B %Y")


def option_html(opt: dict, ex_vat: bool) -> str:
    rows = []
    total = 0.0
    for it in opt["items"]:
        total += float(it["price"])
        note = f' · <span class="note">{esc(it["note"])}</span>' if it.get("note") else ""
        code = f' <span class="code">{esc(it["code"])}</span>' if it.get("code") else ""
        rows.append(f"""
        <tr>
          <td class="type">{esc(it["type"])}</td>
          <td><div class="garment">{esc(it["garment"])}{code}</div>
              <div class="sub">{esc(it.get("colours"))}{note}</div></td>
          <td class="print">{esc(it.get("print"))}</td>
          <td class="price">{money(float(it["price"]))}</td>
        </tr>""")
    other = total * (1 + VAT) if ex_vat else total / (1 + VAT)
    other_label = "inc VAT" if ex_vat else "ex VAT"
    badge = '<span class="badge">Recommended</span>' if opt.get("recommended") else ""
    return f"""
    <section class="option{' rec' if opt.get('recommended') else ''}">
      <header>
        <div><h2>{esc(opt["name"])} {badge}</h2><p>{esc(opt.get("tagline"))}</p></div>
        <div class="setprice"><span class="lbl">Per set</span>
          <span class="big">{money(total)}</span>
          <span class="alt">{money(other)} {other_label}</span></div>
      </header>
      <table>
        <thead><tr><th>Item</th><th>Garment</th><th>Printing</th><th class="price">Per item</th></tr></thead>
        <tbody>{''.join(rows)}</tbody>
      </table>
    </section>"""


def build_html(q: dict, co: dict) -> str:
    ex_vat = q.get("price_basis", "ex_vat") == "ex_vat"
    date = dt.date.fromisoformat(q["date"])
    valid = date + dt.timedelta(days=int(q.get("valid_days") or co["valid_days"]))
    number = f'{co["quote_prefix"]}-{date.year}-{q["number"]}'
    logo_b64 = base64.b64encode((HERE / co["logo"]).read_bytes()).decode()
    c = q.get("client") or {}
    client_lines = "".join(f"<div>{esc(c[k])}</div>" for k in ("company", "email") if c.get(k))
    basis = "All prices exclude VAT" if ex_vat else "All prices include VAT"
    extras = "".join(f'<tr><td>{esc(e["label"])}</td><td class="price">{esc(e["price"])}</td></tr>'
                     for e in q.get("extras") or [])
    extras_html = f"""<div class="box"><h3>Optional extras</h3>
        <table class="extras">{extras}</table></div>""" if extras else ""
    included = "".join(f"<li>{esc(i)}</li>" for i in q.get("included") or co["included"])
    terms = "".join(f"<li>{esc(t)}</li>" for t in q.get("terms") or co["terms"])
    notes = f'<p class="notes">{esc(q["notes"])}</p>' if q.get("notes") else ""
    accent = co["accent"]

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{number}</title>
<style>
  @page {{ size: A4; margin: 14mm 14mm 18mm; }}
  :root {{ --accent: {accent}; --ink: #1d1d1f; --muted: #6b6b70; --line: #e6e6e9; --tint: #f3f9f3; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; font: 9.5pt/1.45 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: var(--ink); }}
  .top {{ display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 6mm; border-bottom: 3px solid var(--accent); }}
  .top img {{ height: 13mm; }}
  .top .co {{ margin-top: 3mm; color: var(--muted); font-size: 8.5pt; }}
  .doc {{ text-align: right; }}
  .doc h1 {{ margin: 0 0 2mm; font-size: 22pt; letter-spacing: .12em; font-weight: 800; }}
  .doc dl {{ margin: 0; display: grid; grid-template-columns: auto auto; gap: .6mm 5mm; font-size: 8.5pt; }}
  .doc dt {{ color: var(--muted); }} .doc dd {{ margin: 0; font-weight: 600; }}
  .meta {{ display: flex; gap: 10mm; margin: 5mm 0 4mm; }}
  .meta .for {{ min-width: 55mm; }}
  .lbl {{ display: block; text-transform: uppercase; letter-spacing: .1em; font-size: 7pt; color: var(--muted); font-weight: 700; }}
  .meta .name {{ font-weight: 700; font-size: 11pt; }}
  .meta .proj h2 {{ margin: 0; font-size: 13pt; }}
  .meta .proj p {{ margin: 1.5mm 0 0; color: #3a3a3e; }}
  .qnote {{ background: var(--tint); border-left: 3px solid var(--accent); padding: 2.2mm 4mm; margin-bottom: 4mm; font-size: 8.5pt; }}
  .qnote b {{ font-weight: 700; }}
  .option {{ border: 1px solid var(--line); border-radius: 3mm; margin-bottom: 3.5mm; break-inside: avoid; overflow: hidden; }}
  .option.rec {{ border: 1.5px solid var(--accent); }}
  .option header {{ display: flex; justify-content: space-between; align-items: center; gap: 6mm; padding: 2.6mm 4.5mm; background: #fafafb; border-bottom: 1px solid var(--line); }}
  .option.rec header {{ background: var(--tint); }}
  .option h2 {{ margin: 0; font-size: 12.5pt; }}
  .option header p {{ margin: .8mm 0 0; color: var(--muted); font-size: 8.5pt; }}
  .badge {{ display: inline-block; vertical-align: middle; margin-left: 2mm; padding: .5mm 2.2mm; border-radius: 10mm; background: var(--accent); color: #fff; font-size: 6.8pt; letter-spacing: .06em; text-transform: uppercase; font-weight: 700; }}
  .setprice {{ text-align: right; white-space: nowrap; }}
  .setprice .big {{ display: block; font-size: 17pt; font-weight: 800; line-height: 1.1; }}
  .setprice .alt {{ font-size: 7.5pt; color: var(--muted); }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{ text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-weight: 700; padding: 2mm 4.5mm 1.2mm; }}
  td {{ padding: 1.5mm 4.5mm; border-top: 1px solid var(--line); vertical-align: top; }}
  td.type {{ font-weight: 700; width: 19mm; }}
  td.print {{ width: 38mm; white-space: nowrap; color: #3a3a3e; }}
  .price {{ text-align: right; width: 24mm; font-weight: 700; }}
  .garment {{ font-weight: 600; }}
  .code {{ white-space: nowrap; font-weight: 500; color: var(--muted); font-size: 7.5pt; margin-left: 1mm; }}
  .note {{ color: var(--ink); font-weight: 600; }}
  .sub, .note {{ font-size: 7.8pt; color: var(--muted); font-weight: 400; }}
  .cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 4.5mm; margin-top: 2mm; break-inside: avoid; }}
  .box {{ border: 1px solid var(--line); border-radius: 3mm; padding: 3.5mm 4.5mm; }}
  .box h3 {{ margin: 0 0 2mm; font-size: 10pt; }}
  .box ul {{ margin: 0; padding-left: 4.5mm; }} .box li {{ margin: .6mm 0; }}
  .included li::marker {{ color: var(--accent); content: "✓  "; }}
  .included ul {{ padding-left: 0; list-style-position: inside; }}
  .extras td {{ border-top: 0; border-bottom: 1px solid var(--line); padding: 1.6mm 0; }}
  .extras td.price {{ width: 38mm; white-space: nowrap; }}
  .terms ul {{ columns: 2; column-gap: 8mm; }}
  .terms {{ margin-top: 3.5mm; font-size: 7.8pt; color: #4a4a4f; break-inside: avoid; }}
  .notes {{ margin-top: 4mm; }}
  .accept {{ margin-top: 3.5mm; padding: 4mm 4.5mm; background: var(--ink); color: #fff; border-radius: 3mm; display: flex; justify-content: space-between; align-items: center; break-inside: avoid; }}
  .accept b {{ font-size: 11pt; }} .accept span {{ color: #c9c9cf; font-size: 8.5pt; }}
  .foot {{ margin-top: 2.5mm; text-align: center; color: var(--muted); font-size: 7.5pt; }}
</style></head>
<body>
  <div class="top">
    <div><img src="data:image/png;base64,{logo_b64}" alt="{esc(co['trading_name'])}">
      <div class="co">Custom printed clothing · {esc(co['town'])}</div></div>
    <div class="doc"><h1>QUOTE</h1>
      <dl><dt>Quote no.</dt><dd>{number}</dd><dt>Date</dt><dd>{nice_date(date)}</dd><dt>Valid until</dt><dd>{nice_date(valid)}</dd></dl></div>
  </div>

  <div class="meta">
    <div class="for"><span class="lbl">Prepared for</span><div class="name">{esc(c.get('name'))}</div>{client_lines}</div>
    <div class="proj"><span class="lbl">Project</span><h2>{esc(q['title'])}</h2><p>{esc(q.get('intro'))}</p></div>
  </div>

  <div class="qnote"><b>{basis}.</b> {esc(q.get('quantity_note'))}</div>

  {''.join(option_html(o, ex_vat) for o in q['options'])}

  <div class="cols">
    <div class="box included"><h3>Included in every price</h3><ul>{included}</ul></div>
    {extras_html}
  </div>
  {notes}
  <div class="box terms"><h3>Terms</h3><ul>{terms}</ul></div>

  <div class="accept"><div><b>Ready to go ahead?</b><br><span>Reply to this quote with your chosen option, colours, sizes and artwork, and we'll send your proof.</span></div>
    <div style="text-align:right"><b>{esc(co['email'])}</b><br><span>{esc(co['website'])}</span></div></div>

  <div class="foot">{esc(co['trading_name'])} is a trading name of {esc(co['legal_name'])} · {esc(co['town'])} · {esc(co['email'])} · {esc(co['website'])}</div>
</body></html>"""


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]).resolve()
    q = json.loads(src.read_text())
    co = json.loads((HERE / "company.json").read_text())
    out_dir = HERE / "pdf"
    out_dir.mkdir(exist_ok=True)
    html_path = out_dir / f"{src.stem}.html"
    pdf_path = out_dir / f"{src.stem}.pdf"
    html_path.write_text(build_html(q, co))
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf_path}", html_path.as_uri()],
                   check=True, capture_output=True)
    print(pdf_path)


if __name__ == "__main__":
    main()
