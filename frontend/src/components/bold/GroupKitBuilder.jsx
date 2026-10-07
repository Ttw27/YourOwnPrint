import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, createCartCheckout, submitQuoteRequest, uploadOrderArtwork } from "../../lib/api";
import { ImageSlot } from "../../pages/FullSquadConfigurator";
import { ExVat } from "./PriceTag";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ShoppingCart, Send, ShieldCheck, Check } from "lucide-react";

/**
 * School group order builder (routers/group_kits.py) - School Trips and Sports Day.
 * The school ticks garments, picks colour(s) (Sports Day: several house colours),
 * chooses front / back prints (upload a design, or type the wording; first print
 * included, second +£3) and enters quantities by size, adults + kids. Basket
 * checkout - the server re-prices everything and applies the whole-order bulk %.
 */
const snap99 = (x) => Math.max(0.99, Math.round(x) - 0.01);
const newRow = (colour = "") => ({ colour, house: "", qty: {} });   // qty: {"a:M": 3, "k:7-8": 2}

export default function GroupKitBuilder({ page, accent = "#7bc67e", eventLabel = "Trip / event date" }) {
  const [cfg, setCfg] = useState(null);
  const [school, setSchool] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "", date: "", notes: "" });
  const [front, setFront] = useState({ on: true, art: null, text: "" });
  const [back, setBack] = useState({ on: false, art: null, text: "" });
  const [sel, setSel] = useState({});   // garmentKey -> {on, rows: [row]}
  const [busy, setBusy] = useState(false);
  const [groupId] = useState(() => Math.random().toString(36).slice(2, 10));

  useEffect(() => {
    api.get(`/group-kits/${page}`).then(({ data }) => {
      setCfg(data);
      const init = {};
      data.garments.forEach((g, i) => {
        const def = g.colours.find((c) => /^(black|navy|royal|red|jet black)$/i.test(c.name)) || g.colours[0];
        const want = new URLSearchParams(window.location.search).get("garment");   // tile on the School Trips page
        init[g.key] = { on: want ? g.key === want : i === 0, rows: [newRow(def?.name || "")] };
      });
      setSel(init);
    }).catch(() => toast.error("Couldn't load the order builder - please refresh"));
  }, [page]);

  const garments = cfg?.garments || [];
  const houses = !!cfg?.houses;
  const printsFor = (g) => [front.on && g.prints.front ? "front" : null, back.on && g.prints.back ? "back" : null].filter(Boolean);
  const qtyOf = (row) => Object.values(row.qty).reduce((a, b) => a + (Number(b) || 0), 0);
  const totalQty = useMemo(() => garments.reduce((t, g) => t + (sel[g.key]?.on ? sel[g.key].rows.reduce((a, r) => a + qtyOf(r), 0) : 0), 0), [garments, sel]);
  const tiers = cfg?.bulk_tiers || [];
  const pct = tiers.reduce((p, t) => (totalQty >= t.min_qty ? t.pct : p), 0);
  const nextTier = tiers.find((t) => totalQty < t.min_qty);

  const unit = (g, sideKey, size, colour) => {
    const side = sideKey === "k" ? g.kids : g.adult;
    if (!side) return 0;
    const sz = side.sizes.find((s) => s.value === size);
    const base = side.price;
    const disc = pct ? snap99(base * (1 - pct / 100)) : base;
    return disc + ((sz?.price || base) - base) + Number(side.colour_upcharges?.[colour] || 0) + (cfg?.print_price || 3) * printsFor(g).length;
  };
  const lines = [];
  garments.forEach((g) => {
    const s = sel[g.key];
    if (!s?.on) return;
    s.rows.forEach((row, ri) => {
      ["a", "k"].forEach((sideKey) => {
        const side = sideKey === "k" ? g.kids : g.adult;
        if (!side) return;
        const size_qtys = {};
        Object.entries(row.qty).forEach(([k, q]) => { if (k.startsWith(sideKey + ":") && Number(q) > 0) size_qtys[k.slice(2)] = Number(q); });
        const qty = Object.values(size_qtys).reduce((a, b) => a + b, 0);
        if (!qty) return;
        const total = Object.entries(size_qtys).reduce((a, [sz, q]) => a + q * unit(g, sideKey, sz, row.colour), 0);
        lines.push({ g, row, ri, sideKey, side, size_qtys, qty, total });
      });
    });
  });
  const grandTotal = lines.reduce((a, l) => a + l.total, 0);

  const patchG = (key, p) => setSel((s) => ({ ...s, [key]: { ...s[key], ...p } }));
  const patchRow = (key, ri, p) => setSel((s) => ({ ...s, [key]: { ...s[key], rows: s[key].rows.map((r, j) => (j === ri ? { ...r, ...p } : r)) } }));

  const validate = () => {
    if (!school.name.trim() || !school.contact_email.trim()) return "Add your school name and email";
    if (!front.on && !back.on) return "Choose what's printed - front, back or both";
    if (front.on && !front.art && !front.text.trim()) return "Upload your front logo / design, or type what goes on the front";
    if (back.on && !back.art && !back.text.trim() && !(houses && lines.some((l) => l.row.house.trim()))) return "Upload your back design, or type the wording for the back";
    if (!lines.length) return "Pick at least one garment and enter quantities";
    for (const l of lines) {
      const c = l.g.colours.find((x) => x.name === l.row.colour);
      if (!c) return `Pick a colour for the ${l.g.label.toLowerCase()}`;
      if (l.sideKey === "k" && c.kids === false) return `${l.g.label}: ${c.name} isn't made in kids sizes - pick another colour`;
    }
    return null;
  };

  const checkout = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      const art = await uploadOrderArtwork({ "front-design": front.on ? front.art : null, "back-design": back.on ? back.art : null }, page);
      const items = lines.map((l) => ({
        product_id: l.side.product_id, size_qtys: l.size_qtys, color: l.row.colour, placements: printsFor(l.g), blank: false,
        design_meta: {
          flow: "group_kit", page, group_id: groupId, school: school.name.slice(0, 120), event_date: school.date.slice(0, 40),
          front_text: front.on ? front.text.slice(0, 200) : "", back_text: back.on ? back.text.slice(0, 300) : "",
          house: houses && back.on ? l.row.house.slice(0, 60) : "", notes: school.notes.slice(0, 400), ...art,
        },
      }));
      const { url } = await createCartCheckout(items, school.contact_email);
      window.location.href = url;
    } catch (e) { toast.error(e?.response?.data?.detail || "Checkout failed"); setBusy(false); }
  };
  const quote = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      await submitQuoteRequest({
        kind: "school_group", name: school.contact_name || school.name, email: school.contact_email, phone: school.contact_phone,
        company: school.name, kit_type: page, quantity: totalQty, deadline: school.date,
        message: [`${page === "sports-day" ? "Sports day" : "School trip"} order for ${school.name}`,
          `Front: ${front.on ? (front.text || "uploaded design") : "none"} | Back: ${back.on ? (back.text || "uploaded design / house names") : "none"}`,
          ...lines.map((l) => `${l.g.label}${l.sideKey === "k" ? " (kids)" : ""} - ${l.row.colour}${l.row.house ? ` [${l.row.house}]` : ""}: ${Object.entries(l.size_qtys).map(([s, q]) => `${q}x${s}`).join(", ")}`),
          `Indicative total £${grandTotal.toFixed(2)}`, school.notes].filter(Boolean).join("\n"),
        artwork: [front.on ? front.art : null, back.on ? back.art : null].filter(Boolean),
      });
      toast.success("Quote request sent - we'll be in touch with a proof and price.");
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't send - try WhatsApp instead."); }
    finally { setBusy(false); }
  };

  if (!cfg) return <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  const swatch = (c) => (c.name.includes("/") ? `linear-gradient(135deg, ${c.hex} 50%, #ffffff 50%)` : c.hex);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-12 gap-6 font-nunito text-[#1a1a1a]" data-testid={`group-builder-${page}`}>
      <section className="lg:col-span-8 space-y-6 min-w-0">
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5">
          <h2 className="font-black text-2xl mb-3"><span style={{ color: accent }}>1.</span> Your school</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[["name", "School name *"], ["contact_name", "Your name"], ["contact_email", "Email *"], ["contact_phone", "Phone (optional)"], ["date", eventLabel]].map(([k, ph]) => (
              <input key={k} value={school[k]} onChange={(e) => setSchool({ ...school, [k]: e.target.value })} placeholder={ph}
                className="w-full border-2 border-[#dcfce7] focus:border-[#7bc67e] rounded-xl px-3 py-2.5 text-sm outline-none" data-testid={`gk-${k}`} />
            ))}
          </div>
        </div>

        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="gk-prints">
          <h2 className="font-black text-2xl mb-1"><span style={{ color: accent }}>2.</span> What&apos;s printed</h2>
          <p className="text-sm text-[#4b5563] mb-3">One print is included in the prices; a second print is +£{(cfg.print_price || 3).toFixed(2)} each. Upload your design, or just type the wording - we&apos;ll send a free proof.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {[["front", front, setFront, "Front", "Your school logo / badge or a design"], ["back", back, setBack, "Back", houses ? "School name, house or team names, or a design" : "e.g. ST MARY'S · YEAR 6 · LONDON 2027"]].map(([k, st, set, title, hint]) => (
              <div key={k} className={`rounded-2xl border-2 p-4 ${st.on ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb]"}`} data-testid={`gk-print-${k}`}>
                <label className="flex items-center gap-2 font-extrabold cursor-pointer">
                  <input type="checkbox" checked={st.on} onChange={(e) => set({ ...st, on: e.target.checked })} className="w-5 h-5 accent-[#7bc67e]" data-testid={`gk-print-${k}-toggle`} />
                  {title} print
                </label>
                {st.on && (
                  <div className="mt-3 space-y-3">
                    <ImageSlot label={`Upload ${title.toLowerCase()} design`} hint="PNG / JPG - logo, badge or full design (optional)" value={st.art} onChange={(v) => set({ ...st, art: v })} testid={`gk-${k}-art`} />
                    <textarea value={st.text} onChange={(e) => set({ ...st, text: e.target.value })} rows={2} placeholder={`Or type it: ${hint}`}
                      className="w-full border-2 border-[#dcfce7] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#7bc67e] bg-white" data-testid={`gk-${k}-text`} />
                    {k === "back" && houses && <div className="text-[11px] text-[#4b5563]">You can also give each colour its own house or team name below (e.g. NELSON) - we print it on the back. One colour for an inter-school team? Just add one.</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-black text-2xl mb-1"><span style={{ color: accent }}>3.</span> Pick your garments</h2>
          <p className="text-sm text-[#4b5563] mb-3">Tick as many as you like. Adults and kids sizes in one order{houses ? " - add a colour for each house or team" : ""}.</p>
          <div className="space-y-3">
            {garments.map((g) => {
              const s = sel[g.key] || { on: false, rows: [] };
              const from = Math.min(g.adult.price, g.kids ? g.kids.price : Infinity) + (cfg.print_price || 3);
              return (
                <div key={g.key} className={`bg-white border-2 rounded-3xl overflow-hidden ${s.on ? "border-[#7bc67e]" : "border-[#dcfce7]"}`} data-testid={`gk-g-${g.key}`}>
                  <label className="flex items-center gap-3 p-4 cursor-pointer">
                    <input type="checkbox" checked={!!s.on} onChange={(e) => patchG(g.key, { on: e.target.checked })} className="w-5 h-5 accent-[#7bc67e]" data-testid={`gk-g-${g.key}-toggle`} />
                    <img src={(g.colours.find((c) => c.name === s.rows[0]?.colour) || {}).image || g.adult.image} alt="" className="w-14 h-14 object-contain rounded-xl bg-[#f9fafb]" />
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-lg">{g.label} <span className="text-sm font-bold text-[#4b5563]">from £{from.toFixed(2)}</span></div>
                      <div className="text-xs text-[#4b5563]">{g.note}{g.kids ? " · adults + kids" : ""}{!g.prints.back ? " · front print only" : ""}</div>
                    </div>
                  </label>
                  {s.on && (
                    <div className="px-4 pb-4 space-y-3">
                      {s.rows.map((row, ri) => {
                        const col = g.colours.find((c) => c.name === row.colour);
                        const kidsUsed = Object.entries(row.qty).some(([k, q]) => k.startsWith("k:") && Number(q) > 0);
                        return (
                          <div key={ri} className="border border-[#dcfce7] rounded-2xl p-3" data-testid={`gk-g-${g.key}-row-${ri}`}>
                            <div className="flex items-start gap-3 flex-wrap">
                              {col?.image && <img src={col.image} alt="" className="w-16 h-16 object-contain rounded-xl bg-[#f9fafb]" />}
                              <div className="flex-1 min-w-[220px]">
                                <div className="text-xs font-extrabold mb-1">{houses ? `Colour ${ri + 1}: ` : "Colour: "}<span className="text-[#4b5563]">{row.colour || "pick one"}</span>
                                  {col && g.kids && <span className={`ml-1 ${col.kids === false ? "text-rose-600" : "text-[#16a34a]"}`}>{col.kids === false ? "· adults only" : "· adults + kids"}</span>}</div>
                                <div className="flex flex-wrap gap-1">
                                  {g.colours.map((c) => (
                                    <button key={c.name} type="button" title={c.name} onClick={() => patchRow(g.key, ri, { colour: c.name })}
                                      className={`w-6 h-6 rounded-full border-2 ${row.colour === c.name ? "border-[#1a1a1a] ring-2 ring-[#7bc67e]" : "border-[#e5e7eb]"} ${g.kids && c.kids === false && kidsUsed ? "opacity-30" : ""}`}
                                      style={{ background: swatch(c) }} data-testid={`gk-${g.key}-${ri}-colour-${c.name}`} />
                                  ))}
                                </div>
                                {houses && back.on && g.prints.back && (
                                  <input value={row.house} onChange={(e) => patchRow(g.key, ri, { house: e.target.value })} placeholder="House or team name on the back (optional) e.g. NELSON"
                                    className="mt-2 w-full border border-[#dcfce7] rounded-lg px-2 py-1.5 text-sm" data-testid={`gk-${g.key}-${ri}-house`} />
                                )}
                              </div>
                              {s.rows.length > 1 && <button type="button" onClick={() => patchG(g.key, { rows: s.rows.filter((_, j) => j !== ri) })} className="text-rose-500 p-1" aria-label="Remove colour"><Trash2 size={16} /></button>}
                            </div>
                            {[["a", g.adult, g.kids ? "Adult sizes" : "Sizes"], ["k", g.kids, "Kids sizes (age)"]].filter(([, side]) => side).map(([sk, side, title]) => (
                              <div key={sk} className="mt-3">
                                <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#4b5563] mb-1">{title}{sk === "k" && col && col.kids === false ? <span className="normal-case tracking-normal text-rose-600"> - not made in {col.name}</span> : null}</div>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                  {side.sizes.map((z) => {
                                    const k = `${sk}:${z.value}`;
                                    const blocked = sk === "k" && col && col.kids === false;
                                    return (
                                      <label key={k} className={`border rounded-xl px-2 py-1.5 text-center ${Number(row.qty[k]) > 0 ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb]"} ${blocked ? "opacity-40" : ""}`}>
                                        <div className="text-[11px] font-extrabold">{["ONE", "One Size"].includes(z.label) ? "One size" : z.label}</div>
                                        <input type="number" min={0} disabled={blocked} value={row.qty[k] || ""} placeholder="0"
                                          onChange={(e) => patchRow(g.key, ri, { qty: { ...row.qty, [k]: Math.max(0, Math.min(999, Number(e.target.value) || 0)) } })}
                                          className="w-full text-center text-sm font-extrabold outline-none bg-transparent" data-testid={`gk-${g.key}-${ri}-${k}`} />
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {houses && (
                        <button type="button" onClick={() => patchG(g.key, { rows: [...s.rows, newRow("")] })} className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#16a34a] hover:underline" data-testid={`gk-g-${g.key}-add-colour`}>
                          <Plus size={14} /> Add another colour (house / team)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <textarea value={school.notes} onChange={(e) => setSchool({ ...school, notes: e.target.value })} rows={2} placeholder="Anything else we should know? (optional)"
          className="w-full border-2 border-[#dcfce7] rounded-2xl px-3 py-2 text-sm outline-none focus:border-[#7bc67e]" />
        <Link to="/club-shop/new" className="block bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-4 hover:border-[#7bc67e] text-sm">
          <strong>Parents paying for their own?</strong> Set up a school shop link instead - each family orders and pays, we print it all together →
        </Link>
      </section>

      <aside className="lg:col-span-4">
        <div className="lg:sticky lg:top-24 bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="gk-summary">
          <div className="text-xs uppercase tracking-[0.3em] font-extrabold" style={{ color: accent }}>Your order</div>
          <div className="font-black text-4xl mt-2" data-testid="gk-total">£{grandTotal.toFixed(2)}</div>
          <ExVat amount={grandTotal} className="text-[11px] text-neutral-400" />
          <div className="text-sm text-zinc-300 mt-1">{totalQty} item{totalQty === 1 ? "" : "s"}{pct ? ` · ${pct}% bulk discount` : ""}</div>
          {nextTier && totalQty > 0 && <div className="mt-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl p-2.5">Add <strong>{nextTier.min_qty - totalQty}</strong> more for <strong style={{ color: accent }}>{nextTier.pct}% off</strong> the garments</div>}
          <div className="mt-4 space-y-2 text-sm">
            {lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 border-b border-white/10 pb-2">
                <span><strong>{l.g.label}{l.sideKey === "k" ? " (kids)" : ""}</strong><br /><span className="text-xs text-neutral-400">{l.qty} × {l.row.colour}{l.row.house ? ` · ${l.row.house}` : ""}</span></span>
                <span className="font-extrabold">£{l.total.toFixed(2)}</span>
              </div>
            ))}
            {!lines.length && <div className="text-xs text-neutral-400">Tick a garment and enter quantities.</div>}
          </div>
          <div className="mt-5 space-y-2">
            <button onClick={checkout} disabled={busy || !lines.length} className="w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-40 text-[#1a1a1a] font-extrabold px-5 py-3.5 rounded-full" data-testid="gk-checkout">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />} Checkout £{grandTotal.toFixed(2)}
            </button>
            <button onClick={quote} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 border-2 border-[#7bc67e] text-[#7bc67e] font-extrabold px-5 py-3 rounded-full" data-testid="gk-quote">
              <Send size={16} /> Get a quote / invoice instead
            </button>
          </div>
          <div className="mt-4 space-y-1.5 text-xs text-neutral-400">
            {["Free proof before anything is printed", "Pay by card, or ask for a quote / school invoice", "UK printed in Leicester"].map((t) => (
              <div key={t} className="flex items-start gap-1.5"><ShieldCheck size={12} className="mt-0.5 text-[#7bc67e]" /> {t}</div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

export const BuilderTicks = ({ items }) => (
  <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
    {items.map((t) => (
      <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 font-extrabold"><Check size={12} className="text-[#7bc67e]" /> {t}</span>
    ))}
  </div>
);
