import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchDanceKitConfig, submitQuoteRequest, createCartCheckout, uploadOrderArtwork } from "../lib/api";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import { ImageSlot } from "./FullSquadConfigurator";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck, Loader2, Check, ShoppingCart, Send } from "lucide-react";
import { ExVat } from "../components/bold/PriceTag";
import usePageTitle from "../hooks/usePageTitle";

/**
 * Dance studio kit builder (/dance-studio-kit) - real garments, women's + kids.
 * Config + print prices come from routers/dance_kit.py. One set = one garment
 * choice (top, bottoms, hoodie, joggers, bag) + colour + prints; one list of
 * dancers with a size per set. Checkout = basket lines of the real products with
 * design_meta.flow "dance" - the server re-prices each (dance_print()).
 */
const QUOTE_THRESHOLD = 40;
const DEFAULT_ON = { top: true, hoodie: true };

const blankDancer = () => ({ name: "", sizes: {} });

export default function DanceStudioKit() {
  usePageTitle("Dance Studio Kit Builder", { description: "Branded crop tops, leggings, hoodies and dance bags for your studio - women's and kids sizes." });
  const [cfg, setCfg] = useState(null);
  const [studio, setStudio] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [logo, setLogo] = useState(null);
  const [backLogo, setBackLogo] = useState(null);
  const [sets, setSets] = useState({});      // key -> {on, opt, colour, logo, bigFront, name, back}
  const [dancers, setDancers] = useState(Array.from({ length: 5 }, blankDancer));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchDanceKitConfig().then((c) => {
      setCfg(c);
      const init = {};
      c.sets.forEach((s) => {
        const o = s.options[0];
        const black = o.colours.find((x) => /^(jet |deep |solid )?black( blend)?(\/black)?$/i.test(x.name)) || o.colours[0];
        init[s.key] = { on: !!DEFAULT_ON[s.key], opt: o.id, colour: black?.name || "", logo: true, bigFront: false, name: false, back: false };
      });
      setSets(init);
    }).catch(() => toast.error("Couldn't load the studio kit - please refresh"));
  }, []);

  // name -> hex across every garment, so two-tone colours ("Black/White") show both halves
  const hexOf = useMemo(() => {
    const m = {};
    (cfg?.sets || []).forEach((s) => s.options.forEach((o) => o.colours.forEach((c) => { if (!c.name.includes("/")) m[c.name.toLowerCase()] = c.hex; })));
    return m;
  }, [cfg]);
  const swatch = (c) => {
    if (!c.name.includes("/")) return c.hex;
    const [a, b] = c.name.split("/").map((h) => hexOf[h.trim().toLowerCase()] || (/black/i.test(h) ? "#111" : /white/i.test(h) ? "#fff" : c.hex));
    return `linear-gradient(135deg, ${a} 50%, ${b} 50%)`;
  };

  if (!cfg) return <div className="min-h-screen grid place-items-center bg-white"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;

  const P = cfg.prices;
  const setDef = (key) => cfg.sets.find((s) => s.key === key);
  const optOf = (key) => { const s = setDef(key); return s?.options.find((o) => o.id === sets[key]?.opt) || s?.options[0]; };
  const colourOf = (key) => optOf(key)?.colours.find((c) => c.name === sets[key]?.colour);
  const patch = (key, p) => setSets((st) => ({ ...st, [key]: { ...st[key], ...p } }));
  const active = cfg.sets.filter((s) => sets[s.key]?.on);

  const printCost = (s) => {
    const st = sets[s.key]; const pr = s.prints;
    let c = 0;
    if (pr.big_front && st.bigFront) c += P.big_front;
    else if (!pr.logo_optional || st.logo) c += P.logo;
    if (pr.name && st.name) c += P.name;
    if (pr.back && st.back) c += P.back_logo;
    return c;
  };
  const placementsOf = (s) => {
    const st = sets[s.key]; const pr = s.prints; const out = [];
    if (pr.big_front && st.bigFront) out.push("big-front"); else if (!pr.logo_optional || st.logo) out.push("logo");
    if (pr.name && st.name) out.push("name");
    if (pr.back && st.back) out.push("back-logo");
    return out;
  };
  // a dancer's size for a set is "a:M" (adult product) or "k:7-8" (kids product)
  const sideOf = (s, v) => (v ? (v.startsWith("k:") ? optOf(s.key).kids : optOf(s.key).adult) : null);
  const unitFor = (s, v) => {
    const side = sideOf(s, v); if (!side) return 0;
    const sz = side.sizes.find((x) => x.value === v.slice(2));
    return (sz?.price || side.price) + Number(side.colour_upcharges?.[sets[s.key].colour] || 0) + printCost(s);
  };

  const lines = [];
  active.forEach((s) => {
    ["a", "k"].forEach((side) => {
      const prod = side === "k" ? optOf(s.key).kids : optOf(s.key).adult;
      if (!prod) return;
      const size_qtys = {}; let total = 0;
      dancers.forEach((d) => {
        const v = d.sizes[s.key];
        if (!v || !v.startsWith(side + ":")) return;
        size_qtys[v.slice(2)] = (size_qtys[v.slice(2)] || 0) + 1;
        total += unitFor(s, v);
      });
      const qty = Object.values(size_qtys).reduce((a, b) => a + b, 0);
      if (qty) lines.push({ s, side, prod, size_qtys, qty, total });
    });
  });
  const grandTotal = lines.reduce((a, l) => a + l.total, 0);
  const totalItems = lines.reduce((a, l) => a + l.qty, 0);
  const headcount = dancers.filter((d) => active.some((s) => d.sizes[s.key])).length;
  const needBackLogo = active.some((s) => s.prints.back && sets[s.key].back);
  const quoteOnly = headcount > QUOTE_THRESHOLD;

  const sizeLabel = (s, v) => {
    const side = sideOf(s, v); const sz = side?.sizes.find((x) => x.value === v.slice(2));
    return sz ? `${v.startsWith("k:") ? "Age " : ""}${sz.label}` : "";
  };
  const rosterText = dancers.filter((d) => active.some((s) => d.sizes[s.key])).map((d) =>
    `${d.name || "-"}: ${active.filter((s) => d.sizes[s.key]).map((s) => `${s.title.toLowerCase()} ${sizeLabel(s, d.sizes[s.key])}`).join(", ")}`);

  const validate = () => {
    if (!active.length) return "Pick at least one item for your kit";
    if (!studio.name.trim()) return "Add your studio name";
    if (!studio.contact_email.trim()) return "Add a contact email";
    if (!logo) return "Upload your studio logo";
    if (needBackLogo && !backLogo) return "Upload the logo for the back (or untick the back logo)";
    if (!totalItems) return "Add your dancers and pick their sizes";
    for (const s of active) {
      const c = colourOf(s.key);
      if (!c) return `Pick a colour for the ${s.title.toLowerCase()}`;
      const kidsUsed = dancers.some((d) => (d.sizes[s.key] || "").startsWith("k:"));
      if (kidsUsed && c.kids === false) return `${s.title}: ${c.name} isn't made in kids sizes - pick another colour`;
      if (s.prints.name && sets[s.key].name && dancers.some((d) => d.sizes[s.key] && !d.name.trim())) return `Add a name for every dancer getting a ${s.title.toLowerCase()} (or untick names)`;
    }
    return null;
  };

  const checkout = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      const art = await uploadOrderArtwork({ logo, "back-logo": needBackLogo ? backLogo : null }, "dance-kit");
      const items = lines.map((l) => ({
        product_id: l.prod.product_id,
        size_qtys: l.size_qtys,
        color: sets[l.s.key].colour,
        placements: placementsOf(l.s),
        blank: false,
        design_meta: {
          flow: "dance", studio: studio.name, set: l.s.title,
          names: sets[l.s.key].name && l.s.prints.name
            ? dancers.filter((d) => (d.sizes[l.s.key] || "").startsWith(l.side + ":")).map((d) => `${d.name} (${sizeLabel(l.s, d.sizes[l.s.key])})`).join(", ").slice(0, 480)
            : "",
          roster: rosterText.join(" | ").slice(0, 1500),
          ...art,
        },
      }));
      const { url } = await createCartCheckout(items, studio.contact_email);
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Checkout failed");
      setBusy(false);
    }
  };

  const quote = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      const summary = active.map((s) => `${s.title}: ${optOf(s.key).label} (${optOf(s.key).adult.name}${optOf(s.key).kids ? " / " + optOf(s.key).kids.name : ""}) in ${sets[s.key].colour} - ${placementsOf(s).join(", ")}`);
      await submitQuoteRequest({
        kind: "team_kit", name: studio.contact_name || studio.name, email: studio.contact_email, phone: studio.contact_phone,
        company: studio.name, sport: "dance", kit_type: "dance-studio-kit", quantity: totalItems,
        message: [`Dance studio kit for ${studio.name} (${headcount} dancers)`, ...summary, `Indicative total: £${grandTotal.toFixed(2)}`, "", ...rosterText].join("\n"),
        artwork: [logo, needBackLogo ? backLogo : null].filter(Boolean),
        roster: [],
        product_id: "dance-studio-kit",
      });
      toast.success("Quote request sent - we'll be in touch with a proof and price.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't send - try WhatsApp instead.");
    } finally { setBusy(false); }
  };

  const setDancer = (i, p) => setDancers((ds) => ds.map((d, j) => (j === i ? { ...d, ...p } : d)));

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid="dance-kit-page">
      <BoldNavbar />
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-[#f472b6] via-[#a855f7] to-[#7bc67e]" />
        <div className="relative max-w-7xl mx-auto px-6 py-14">
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#f9a8d4]">Dance studio kit builder</span>
          <h1 className="font-black text-4xl lg:text-6xl mt-2">Your studio&apos;s kit, in one order.</h1>
          <p className="text-zinc-200 mt-3 max-w-2xl">Crop tops, leggings, hoodies and dance bags with your studio logo - names on the back if you like. Women&apos;s and kids sizes from age 3.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            {["Real dancewear brands", "Women's + kids in one order", "UK printed · free proof"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 font-extrabold"><Check size={12} className="text-[#f9a8d4]" /> {t}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 space-y-6 min-w-0">
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="dk-studio">
            <h2 className="font-black text-2xl mb-3"><span className="text-[#7bc67e]">1.</span> Your studio</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[["name", "Studio name *"], ["contact_name", "Your name"], ["contact_email", "Email *"], ["contact_phone", "Phone (optional)"]].map(([k, ph]) => (
                <input key={k} value={studio[k]} onChange={(e) => setStudio({ ...studio, [k]: e.target.value })} placeholder={ph}
                  className="w-full bg-white border-2 border-[#dcfce7] focus:border-[#7bc67e] rounded-xl px-3 py-2.5 text-sm outline-none" data-testid={`dk-${k}`} />
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <ImageSlot label="Studio logo *" hint="On every item" value={logo} onChange={setLogo} testid="dk-logo" />
              {needBackLogo && <ImageSlot label="Back logo *" hint="Big print on the back" value={backLogo} onChange={setBackLogo} testid="dk-back-logo" />}
            </div>
          </div>

          <div>
            <h2 className="font-black text-2xl mb-1"><span className="text-[#7bc67e]">2.</span> Build your kit</h2>
            <p className="text-sm text-[#4b5563] mb-3">Tick what you want - pick the style, colour and what&apos;s printed.</p>
            <div className="space-y-3">
              {cfg.sets.map((s) => (
                <SetCard key={s.key} s={s} st={sets[s.key] || {}} opt={optOf(s.key)} colour={colourOf(s.key)} patch={(p) => patch(s.key, p)}
                  prices={P} printCost={printCost(s)} swatch={swatch} logo={logo}
                  kidsUsed={dancers.some((d) => (d.sizes[s.key] || "").startsWith("k:"))} />
              ))}
            </div>
          </div>

          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="dk-dancers">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h2 className="font-black text-2xl"><span className="text-[#7bc67e]">3.</span> Your dancers <span className="text-sm text-[#4b5563] font-bold">({headcount})</span></h2>
              <select onChange={(e) => setDancers(Array.from({ length: Number(e.target.value) }, (_, i) => dancers[i] || blankDancer()))} defaultValue=""
                className="bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-3 py-1.5 text-xs font-bold" data-testid="dk-quick-rows">
                <option value="" disabled>Number of dancers…</option>
                {[1, 3, 5, 8, 10, 12, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <p className="text-xs text-[#4b5563] mb-3">One line per dancer (or teacher / parent). Pick a size for each item they need - leave it on &quot;none&quot; if they don&apos;t.</p>
            {!active.length ? <div className="text-sm text-[#4b5563]">Tick at least one item above first.</div> : (
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#4b5563]">
                      <th className="text-left font-extrabold pb-1">Name{active.some((s) => s.prints.name && sets[s.key].name) ? " (printed)" : ""}</th>
                      {active.map((s) => <th key={s.key} className="text-left font-extrabold pb-1 pl-2">{s.title.replace("Studio ", "")}</th>)}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dancers.map((d, i) => (
                      <tr key={i} className="border-t border-[#f0fdf4]" data-testid={`dk-dancer-${i}`}>
                        <td className="py-1.5 pr-2"><input value={d.name} onChange={(e) => setDancer(i, { name: e.target.value })} placeholder="Name" className="w-full min-w-[110px] border border-[#dcfce7] rounded-lg px-2 py-1.5 outline-none focus:border-[#7bc67e]" /></td>
                        {active.map((s) => {
                          const o = optOf(s.key);
                          return (
                            <td key={s.key} className="py-1.5 pl-2">
                              <select value={d.sizes[s.key] || ""} onChange={(e) => setDancer(i, { sizes: { ...d.sizes, [s.key]: e.target.value } })}
                                className="w-full border border-[#dcfce7] rounded-lg px-1.5 py-1.5 bg-white outline-none" data-testid={`dk-dancer-${i}-${s.key}`}>
                                <option value="">none</option>
                                <optgroup label={o.kids ? "Women's / adult" : "Sizes"}>{o.adult.sizes.map((z) => <option key={z.value} value={`a:${z.value}`}>{z.label}</option>)}</optgroup>
                                {o.kids && <optgroup label="Kids (age)">{o.kids.sizes.map((z) => <option key={z.value} value={`k:${z.value}`}>{z.label}</option>)}</optgroup>}
                              </select>
                            </td>
                          );
                        })}
                        <td className="pl-1"><button type="button" onClick={() => setDancers((ds) => ds.filter((_, j) => j !== i))} className="text-rose-500 hover:bg-rose-50 rounded-full p-1" aria-label="Remove dancer"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" onClick={() => setDancers((ds) => [...ds, blankDancer()])} className="mt-2 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#7bc67e] hover:underline" data-testid="dk-add-dancer"><Plus size={14} /> Add dancer</button>
          </div>
          <NeedHelpCTA title="Selling to parents?" body="Send us your logo and colours and we can set up the order for you - or ask about a parent pre-order list." presetMessage="Hi! I'd like branded dancewear for my studio." />
        </section>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="dk-summary">
            <div className="text-xs uppercase tracking-[0.3em] text-[#f9a8d4] font-extrabold">Your studio kit</div>
            <div className="font-black text-4xl mt-2" data-testid="dk-total">£{grandTotal.toFixed(2)}</div>
            <ExVat amount={grandTotal} className="text-[11px] text-neutral-400" />
            <div className="mt-4 space-y-2 text-sm">
              {lines.map((l) => (
                <div key={l.s.key + l.side} className="flex justify-between gap-3 border-b border-white/10 pb-2">
                  <span><strong>{optOf(l.s.key).label}{l.side === "k" ? " (kids)" : ""}</strong><br /><span className="text-xs text-neutral-400">{l.qty} × {sets[l.s.key].colour}</span></span>
                  <span className="font-extrabold">£{l.total.toFixed(2)}</span>
                </div>
              ))}
              {!lines.length && <div className="text-xs text-neutral-400">Pick your items, then add dancers and sizes.</div>}
            </div>
            <div className="mt-5 space-y-2">
              {!quoteOnly && (
                <button onClick={checkout} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-extrabold px-5 py-3.5 rounded-full" data-testid="dk-checkout">
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <ShoppingCart size={16} />} Checkout £{grandTotal.toFixed(2)}
                </button>
              )}
              <button onClick={quote} disabled={busy} className={`w-full inline-flex items-center justify-center gap-2 font-extrabold px-5 py-3.5 rounded-full ${quoteOnly ? "bg-[#7bc67e] text-[#1a1a1a]" : "border-2 border-[#7bc67e] text-[#7bc67e]"}`} data-testid="dk-quote">
                <Send size={16} /> {quoteOnly ? "Get a proof & quote" : "Get a quote first"}
              </button>
            </div>
            <div className="mt-4 text-xs text-neutral-400 flex items-start gap-1.5"><ShieldCheck size={12} className="mt-0.5 text-[#7bc67e]" /> We send a free proof before anything is printed.</div>
            <div className="mt-2 text-xs text-neutral-400">Just a few items? <Link to="/sports-teams/dance-studios" className="text-[#7bc67e] underline">Browse dancewear</Link></div>
          </div>
        </aside>
      </div>
      <BoldFooter />
    </div>
  );
}

function SetCard({ s, st, opt, colour, patch, prices, printCost, swatch, logo, kidsUsed }) {
  const pr = s.prints;
  const from = opt ? Math.min(opt.adult.price, opt.kids ? opt.kids.price : Infinity) + printCost : 0;
  const kidsClash = kidsUsed && colour && colour.kids === false;
  const logoBox = s.kind === "bottoms" ? { left: "57%", top: "18%", width: "14%" } : s.kind === "bag" ? { left: "38%", top: "40%", width: "24%" } : { left: "56%", top: "28%", width: "15%" };
  return (
    <div className={`bg-white border-2 rounded-3xl overflow-hidden ${st.on ? "border-[#7bc67e]" : "border-[#dcfce7]"}`} data-testid={`dk-set-${s.key}`}>
      <label className="flex items-start gap-3 p-4 cursor-pointer">
        <input type="checkbox" checked={!!st.on} onChange={(e) => patch({ on: e.target.checked })} className="mt-1 w-5 h-5 accent-[#7bc67e]" data-testid={`dk-set-${s.key}-toggle`} />
        <div className="flex-1 min-w-0">
          <div className="font-black text-lg">{s.title} <span className="text-sm font-bold text-[#4b5563]">from £{from.toFixed(2)}</span></div>
          <div className="text-xs text-[#4b5563]">{s.sub}</div>
        </div>
      </label>
      {st.on && opt && (
        <div className="px-4 pb-4 grid md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative aspect-square rounded-2xl bg-[#f9fafb] border border-[#eef2f7] overflow-hidden">
              {colour?.image && <img src={colour.image} alt={`${opt.label} in ${colour.name}`} className="absolute inset-0 w-full h-full object-contain" />}
              {logo && <img src={logo} alt="" aria-hidden="true" className="absolute object-contain opacity-90" style={logoBox} />}
            </div>
            <div className="text-[11px] text-[#4b5563] mt-1 text-center">Preview - your proof shows the exact placement</div>
          </div>
          <div className="md:col-span-3 space-y-3 min-w-0">
            {s.options.length > 1 && (
              <div className="grid grid-cols-2 gap-1.5">
                {s.options.map((o) => (
                  <button key={o.id} type="button" onClick={() => {
                    const keep = o.colours.find((c) => c.name === st.colour) || o.colours.find((c) => /black/i.test(c.name)) || o.colours[0];
                    patch({ opt: o.id, colour: keep?.name || "" });
                  }}
                    className={`text-left rounded-xl border-2 px-2.5 py-2 ${st.opt === o.id ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] hover:border-[#7bc67e]"}`} data-testid={`dk-opt-${o.id}`}>
                    <div className="text-xs font-extrabold">{o.label}</div>
                    <div className="text-[10px] text-[#4b5563] leading-tight">{o.note}</div>
                  </button>
                ))}
              </div>
            )}
            {s.options.length === 1 && <div className="text-xs text-[#4b5563]">{opt.note}</div>}
            <div>
              <div className="text-xs font-extrabold mb-1">Colour: <span className="text-[#4b5563]">{st.colour}</span>
                {colour && opt.kids && <span className={`ml-1 font-bold ${colour.kids === false ? "text-rose-600" : "text-[#16a34a]"}`}>{colour.kids === false ? "· women's / adult only" : "· adult + kids"}</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {opt.colours.map((c) => (
                  <button key={c.name} type="button" title={`${c.name}${opt.kids && c.kids === false ? " (adult only)" : ""}`} onClick={() => patch({ colour: c.name })}
                    className={`w-7 h-7 rounded-full border-2 ${st.colour === c.name ? "border-[#1a1a1a] ring-2 ring-[#7bc67e]" : "border-[#e5e7eb]"} ${opt.kids && c.kids === false && kidsUsed ? "opacity-35" : ""}`}
                    style={{ background: swatch(c) }} data-testid={`dk-colour-${s.key}-${c.name}`} />
                ))}
              </div>
              {kidsClash && <div className="text-[11px] text-rose-600 font-bold mt-1">{colour.name} isn&apos;t made in kids sizes - pick another colour for your kids&apos; sizes.</div>}
            </div>
            <div className="space-y-1.5 text-sm">
              {pr.logo_optional ? (
                <Tick on={st.logo} set={(v) => patch({ logo: v })} label={pr.front_label} price={prices.logo} testid={`dk-${s.key}-logo`} />
              ) : (
                <div className="flex items-center gap-2 text-xs"><Check size={14} className="text-[#7bc67e]" /> <strong>{pr.front_label}</strong> <span className="text-[#4b5563]">included in the price shown</span></div>
              )}
              {pr.big_front && <Tick on={st.bigFront} set={(v) => patch({ bigFront: v })} label="Big logo across the front instead" price={prices.big_front - prices.logo} testid={`dk-${s.key}-big`} />}
              {pr.name && <Tick on={st.name} set={(v) => patch({ name: v })} label={s.kind === "bag" ? "Dancer's name on the bag" : "Dancer's name on the back"} price={prices.name} testid={`dk-${s.key}-name`} />}
              {pr.back && <Tick on={st.back} set={(v) => patch({ back: v })} label="Big studio logo on the back" price={prices.back_logo} testid={`dk-${s.key}-back`} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tick({ on, set, label, price, testid }) {
  return (
    <label className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 cursor-pointer text-xs ${on ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb]"}`} data-testid={testid}>
      <input type="checkbox" checked={!!on} onChange={(e) => set(e.target.checked)} className="accent-[#7bc67e]" />
      <span className="flex-1"><strong>{label}</strong></span>
      <span className="text-[#4b5563] font-bold">+£{Number(price).toFixed(2)}</span>
    </label>
  );
}
