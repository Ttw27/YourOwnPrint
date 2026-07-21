import React, { useEffect, useMemo, useState } from "react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import PricePromise from "../components/bold/PricePromise";
import { fetchWorkforceProducts, fetchWorkforceTiers, workforceCheckout, workforceQuote } from "../lib/api";
import usePageCopy from "../hooks/usePageCopy";
import { toast } from "sonner";
import { Plus, Minus, Trash2, ShieldCheck, Truck, Sparkles, ArrowRight, Loader2, ChevronDown } from "lucide-react";
export default function KitYourWorkforce() {
  const [products, setProducts] = useState([]);
  const [tiers, setTiers] = useState({ tiers: [], quote_threshold: 100, back_print_price: 3.5 });
  const [rows, setRows] = useState([]);   // [{ uid, product_id, size, qty, back_print }]
  const [expandedId, setExpandedId] = useState(null);   // product tile expanded in the picker
  const [contact, setContact] = useState({ company: "", name: "", email: "", phone: "" });
  const [breastLogo, setBreastLogo] = useState(null); // data URL
  const [backPrint, setBackPrint] = useState(null);   // data URL
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const copy = usePageCopy("kit-your-workforce", {
    title: "",
    subtitle: "One breast-logo print across every garment, optional back print on whichever items you choose, and bulk pricing that drops the more you buy — mix and match T-shirts, sweats, jackets and hi-vis.",
  });

  useEffect(() => {
    Promise.all([fetchWorkforceProducts().catch(() => []), fetchWorkforceTiers().catch(() => null)])
      .then(([ps, t]) => {
        setProducts(ps);
        if (t) setTiers(t);
      })
      .finally(() => setLoading(false));
  }, []);

  const productById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);

  const addRow = (product_id) => {
    const p = productById[product_id];
    if (!p) return;
    const defaultSize = (p.sizes && p.sizes[0]) || "M";
    setRows((r) => [...r, { uid: `${product_id}-${defaultSize}-${Date.now()}`, product_id, size: defaultSize, qty: 5, back_print: false }]);
  };
  const updateRow = (uid, patch) => setRows((r) => r.map(x => x.uid === uid ? { ...x, ...patch } : x));
  const removeRow = (uid) => setRows((r) => r.filter(x => x.uid !== uid));

  // Per-product-per-size quantity helpers used by the expandable picker.
  const qtyFor = (product_id, size) =>
    rows.filter(r => r.product_id === product_id && r.size === size).reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const bumpSize = (product_id, size, delta) => {
    setRows((prev) => {
      const idx = prev.findIndex(r => r.product_id === product_id && r.size === size);
      if (idx === -1) {
        if (delta <= 0) return prev;
        return [...prev, { uid: `${product_id}-${size}-${Date.now()}`, product_id, size, qty: delta, back_print: false }];
      }
      const next = [...prev];
      const nq = Math.max(0, Math.min(5000, (Number(next[idx].qty) || 0) + delta));
      if (nq === 0) { next.splice(idx, 1); return next; }
      next[idx] = { ...next[idx], qty: nq };
      return next;
    });
  };
  const setSizeQty = (product_id, size, qty) => {
    const n = Math.max(0, Math.min(5000, Number(qty) || 0));
    setRows((prev) => {
      const idx = prev.findIndex(r => r.product_id === product_id && r.size === size);
      if (idx === -1) {
        if (n === 0) return prev;
        return [...prev, { uid: `${product_id}-${size}-${Date.now()}`, product_id, size, qty: n, back_print: false }];
      }
      const next = [...prev];
      if (n === 0) { next.splice(idx, 1); return next; }
      next[idx] = { ...next[idx], qty: n };
      return next;
    });
  };
  const productSubtotalQty = (product_id) =>
    rows.filter(r => r.product_id === product_id).reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const totalQty = useMemo(() => rows.reduce((s, r) => s + (Number(r.qty) || 0), 0), [rows]);
  const tierList = (tiers.tiers || []).slice().sort((a, b) => a.min_qty - b.min_qty);
  const currentTierPct = useMemo(() => {
    let pct = 0;
    for (const t of tierList) if (totalQty >= t.min_qty) pct = t.pct;
    return pct;
  }, [tierList, totalQty]);
  const nextTier = useMemo(() => tierList.find(t => totalQty < t.min_qty) || null, [tierList, totalQty]);

  const lineTotal = (r) => {
    const p = productById[r.product_id];
    if (!p) return 0;
    const factor = 1 - (currentTierPct / 100);
    const base = currentTierPct > 0 ? snap99(p.price * factor) : p.price;
    const upcharge = Number(p.size_upcharges?.[r.size] || 0);
    const back = r.back_print ? (tiers.back_print_price || 3.5) : 0;
    return (base + upcharge + back) * Number(r.qty || 0);
  };
  const totalAmount = useMemo(() => rows.reduce((s, r) => s + lineTotal(r), 0), [rows, currentTierPct, tiers]);

  const overThreshold = totalQty > (tiers.quote_threshold || 100);
  const anyBackPrint = rows.some(r => r.back_print);
  const artworkOk = !!breastLogo && (!anyBackPrint || !!backPrint);
  const canCheckout = totalQty >= 1 && !overThreshold && artworkOk;
  const canQuote = totalQty > (tiers.quote_threshold || 100) && contact.name.trim() && contact.email.trim();

  const onCheckout = async () => {
    if (!canCheckout) return;
    setBusy(true);
    try {
      const res = await workforceCheckout({
        origin_url: window.location.origin,
        company: contact.company,
        contact_name: contact.name,
        contact_email: contact.email || undefined,
        contact_phone: contact.phone,
        breast_logo_data_url: breastLogo,
        back_print_data_url: anyBackPrint ? backPrint : null,
        lines: rows.map(r => ({ product_id: r.product_id, size: r.size, qty: Number(r.qty), back_print: !!r.back_print })),
      });
      window.location.href = res.url;
    } catch (e) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Checkout failed");
    } finally { setBusy(false); }
  };

  const onRequestQuote = async () => {
    if (!canQuote) {
      toast.error("Name + email needed for a quote");
      return;
    }
    setBusy(true);
    try {
      await workforceQuote({
        origin_url: window.location.origin,
        company: contact.company,
        contact_name: contact.name,
        contact_email: contact.email,
        contact_phone: contact.phone,
        lines: rows.map(r => ({ product_id: r.product_id, size: r.size, qty: Number(r.qty), back_print: !!r.back_print })),
      });
      toast.success("Quote request sent — we'll be in touch within 24 hours.");
      setRows([]);
    } catch (e) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Quote request failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="workforce-page">
      <BoldNavbar />

      {/* Hero */}
      <section className="bg-[#1a1a1a] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 30%, #fbbf24 0%, transparent 50%)" }} />
        <div className="max-w-6xl mx-auto px-6 py-16 relative">
          <div className="text-xs uppercase tracking-[0.3em] text-[#fbbf24] font-extrabold">Workwear · Bulk · DTF</div>
          <h1 className="font-black text-4xl sm:text-5xl lg:text-6xl mt-3 leading-tight" data-testid="workforce-hero-title">
            {copy.title ? copy.title : (<>Kit your<br /><span className="text-[#fbbf24]">workforce.</span> Sorted.</>)}
          </h1>
          <p className="text-zinc-300 mt-4 text-base sm:text-lg max-w-2xl" data-testid="workforce-hero-subtitle">{copy.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            {tierList.map(t => (
              <span key={t.min_qty} className={`px-3 py-1.5 rounded-full font-extrabold ${totalQty >= t.min_qty ? "bg-[#fbbf24] text-[#1a1a1a]" : "bg-zinc-800 text-zinc-300"}`} data-testid={`workforce-tier-chip-${t.min_qty}`}>
                {t.min_qty}+ items · -{t.pct}%
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12 grid lg:grid-cols-12 gap-8">
        {/* Garment picker + rows */}
        <div className="lg:col-span-8 space-y-6">
          <section data-testid="workforce-products-section">
            <h2 className="font-black text-2xl mb-3">1. Pick your garments</h2>
            {loading ? (
              <div className="text-sm text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={14}/>Loading…</div>
            ) : products.length === 0 ? (
              <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-5 text-sm" data-testid="workforce-empty">
                No workforce-eligible products yet. Ask the admin to flag them in <strong>Product settings → Workforce eligible</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3" data-testid="workforce-products-grid">
                {products.map(p => {
                  const isOpen = expandedId === p.id;
                  const itemQty = productSubtotalQty(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`bg-white border-2 rounded-2xl transition ${isOpen ? "border-[#fbbf24] shadow-md" : itemQty > 0 ? "border-[#7bc67e]" : "border-[#e5e7eb] hover:border-[#fbbf24]"}`}
                      data-testid={`workforce-product-${p.id}`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : p.id)}
                        className="w-full text-left p-3 flex items-center gap-3"
                        data-testid={`workforce-add-${p.id}`}
                        aria-expanded={isOpen}
                      >
                        <img src={p.image} alt="" className="w-16 h-16 rounded-xl object-contain bg-white flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-sm truncate">{p.name}</div>
                          <div className="text-xs text-[#4b5563]">From £{p.price.toFixed(2)} · {p.sizes?.length || 0} sizes {itemQty > 0 && <span className="text-[#7bc67e] font-extrabold">· {itemQty} added</span>}</div>
                        </div>
                        <div className={`w-8 h-8 grid place-items-center rounded-full transition-transform ${isOpen ? "bg-[#fbbf24] text-[#1a1a1a] rotate-180" : "bg-[#fef3c7] text-[#1a1a1a]"}`}>
                          {isOpen ? <ChevronDown size={16} /> : <Plus size={16} />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t-2 border-[#fef3c7] p-3 space-y-3" data-testid={`workforce-expanded-${p.id}`}>
                          {p.description && (
                            <p className="text-xs text-[#4b5563] leading-relaxed" data-testid={`workforce-description-${p.id}`}>{p.description}</p>
                          )}
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-[#fbbf24] font-extrabold mb-2">Pick sizes &amp; quantities</div>
                            <div className="grid grid-cols-3 gap-2" data-testid={`workforce-sizes-${p.id}`}>
                              {(p.sizes || []).map((sz) => {
                                const q = qtyFor(p.id, sz);
                                const up = p.size_upcharges?.[sz] || 0;
                                return (
                                  <div
                                    key={sz}
                                    className={`rounded-xl border-2 p-2 ${q > 0 ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white"}`}
                                    data-testid={`workforce-size-cell-${p.id}-${sz}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-nunito font-extrabold text-xs">{sz}</span>
                                      {up > 0 && <span className="text-[9px] text-[#4b5563]">+£{up.toFixed(2)}</span>}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                      <button
                                        type="button"
                                        onClick={() => bumpSize(p.id, sz, -1)}
                                        disabled={q === 0}
                                        className="w-6 h-6 grid place-items-center rounded-full bg-white border border-[#e5e7eb] disabled:opacity-40"
                                        data-testid={`workforce-size-minus-${p.id}-${sz}`}
                                      ><Minus size={10} /></button>
                                      <input
                                        type="number"
                                        min={0}
                                        value={q}
                                        onChange={(e) => setSizeQty(p.id, sz, e.target.value)}
                                        className="w-full text-center bg-transparent text-xs font-bold focus:outline-none"
                                        data-testid={`workforce-size-qty-${p.id}-${sz}`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => bumpSize(p.id, sz, 1)}
                                        className="w-6 h-6 grid place-items-center rounded-full bg-[#fbbf24] text-[#1a1a1a] font-extrabold"
                                        data-testid={`workforce-size-plus-${p.id}-${sz}`}
                                      ><Plus size={10} /></button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {itemQty > 0 && (
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-[#4b5563]">{itemQty} of this item in your kit</span>
                              <button
                                onClick={() => setExpandedId(null)}
                                className="text-[#7bc67e] font-extrabold hover:underline"
                                data-testid={`workforce-collapse-${p.id}`}
                              >Done ✓</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section data-testid="workforce-artwork-section">
            <h2 className="font-black text-2xl mb-3">2. Upload your prints</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <ArtworkUploader
                label="Breast logo"
                helper="Printed on every garment (no charge)."
                required
                dataUrl={breastLogo}
                onChange={setBreastLogo}
                testid="workforce-breast-logo"
              />
              <ArtworkUploader
                label="Back print"
                helper={anyBackPrint
                  ? `Required — ${rows.filter(r => r.back_print).length} item(s) have back print selected.`
                  : "Optional — only used on items where 'Back print' is ticked."}
                required={anyBackPrint}
                dataUrl={backPrint}
                onChange={setBackPrint}
                testid="workforce-back-print"
                accent="#1a1a1a"
              />
            </div>
          </section>

          <section data-testid="workforce-rows-section">
            <h2 className="font-black text-2xl mb-3">3. Your kit</h2>
            {rows.length === 0 ? (
              <div className="text-sm text-[#4b5563] py-6 text-center border-2 border-dashed border-[#e5e7eb] rounded-2xl">
                Tap a garment above to add it to your kit.
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map(r => {
                  const p = productById[r.product_id];
                  if (!p) return null;
                  const canBack = (p.allowed_placements || []).includes("back-print");
                  return (
                    <div key={r.uid} className="bg-white border-2 border-[#e5e7eb] rounded-2xl p-3 flex flex-wrap items-center gap-3" data-testid={`workforce-row-${r.uid}`}>                      <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-contain bg-white" />
                      <div className="flex-1 min-w-[140px]">
                        <div className="font-extrabold text-sm">{p.name}</div>
                        <div className="text-[11px] text-[#4b5563]">Breast logo included free</div>
                      </div>
                      <select
                        value={r.size}
                        onChange={(e) => updateRow(r.uid, { size: e.target.value })}
                        className="bg-white border border-[#e5e7eb] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#fbbf24]"
                        data-testid={`workforce-size-${r.uid}`}
                      >
                        {(p.sizes || ["M"]).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateRow(r.uid, { qty: Math.max(1, Number(r.qty) - 1) })} className="w-7 h-7 grid place-items-center bg-[#f3f4f6] rounded-lg" data-testid={`workforce-qty-minus-${r.uid}`}><Minus size={12}/></button>
                        <input
                          type="number" min={1} max={5000}
                          value={r.qty}
                          onChange={(e) => updateRow(r.uid, { qty: Math.max(1, Math.min(5000, Number(e.target.value) || 1)) })}
                          className="w-14 text-center bg-white border border-[#e5e7eb] rounded-lg text-xs py-1 focus:outline-none focus:border-[#fbbf24]"
                          data-testid={`workforce-qty-${r.uid}`}
                        />
                        <button onClick={() => updateRow(r.uid, { qty: Math.min(5000, Number(r.qty) + 1) })} className="w-7 h-7 grid place-items-center bg-[#f3f4f6] rounded-lg" data-testid={`workforce-qty-plus-${r.uid}`}><Plus size={12}/></button>
                      </div>
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer text-xs ${canBack ? "" : "opacity-40 cursor-not-allowed"}`}>
                        <input
                          type="checkbox"
                          disabled={!canBack}
                          checked={!!r.back_print}
                          onChange={(e) => updateRow(r.uid, { back_print: e.target.checked })}
                          className="w-4 h-4 accent-[#fbbf24]"
                          data-testid={`workforce-back-${r.uid}`}
                        />
                        <span className="font-extrabold">Back print +£{(tiers.back_print_price || 3.5).toFixed(2)}</span>
                      </label>
                      <button onClick={() => removeRow(r.uid)} className="ml-auto text-rose-500" data-testid={`workforce-remove-${r.uid}`}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Contact form — required for quote */}
          <section data-testid="workforce-contact-section">
            <h2 className="font-black text-2xl mb-3">4. Your details</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <input placeholder="Company / organisation" value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} className={ic} data-testid="workforce-company" />
              <input placeholder="Contact name *" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className={ic} data-testid="workforce-name" />
              <input type="email" placeholder="Email *" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className={ic} data-testid="workforce-email" />
              <input placeholder="Phone (optional)" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className={ic} data-testid="workforce-phone" />
            </div>
          </section>
        </div>

        {/* Sticky summary */}
        <aside className="lg:col-span-4">
          <div className="bg-[#1a1a1a] text-white rounded-3xl p-6 sticky top-24" data-testid="workforce-summary">
            <div className="text-xs uppercase tracking-[0.3em] text-[#fbbf24] font-extrabold">Live total</div>
            <div className="text-4xl font-black mt-2" data-testid="workforce-total">£{totalAmount.toFixed(2)}</div>
            <div className="text-sm text-zinc-300 mt-1" data-testid="workforce-total-qty">
              {totalQty} garment{totalQty === 1 ? "" : "s"}{currentTierPct > 0 && ` · ${currentTierPct}% bulk off applied`}
            </div>
            {nextTier && (
              <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs" data-testid="workforce-next-tier">
                Add <strong>{nextTier.min_qty - totalQty}</strong> more to unlock <strong className="text-[#fbbf24]">-{nextTier.pct}%</strong>
              </div>
            )}
            {overThreshold && (
              <div className="mt-3 bg-amber-900/40 border border-amber-700 rounded-xl p-3 text-xs" data-testid="workforce-quote-banner">
                <strong>Over {tiers.quote_threshold} garments</strong> — please request a quote and we&apos;ll come back within 24 hours with our best price.
              </div>
            )}

            <div className="mt-6 space-y-2">
              <button
                onClick={onCheckout}
                disabled={!canCheckout || busy}
                className="w-full bg-[#fbbf24] hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-[#1a1a1a] font-extrabold py-3 rounded-xl inline-flex items-center justify-center gap-2"
                data-testid="workforce-checkout-btn"
              >
                {busy ? <Loader2 className="animate-spin" size={16}/> : <ArrowRight size={16}/>} Checkout securely
              </button>
              {totalQty >= 1 && !overThreshold && !artworkOk && (
                <div className="text-[11px] text-amber-300 bg-amber-900/40 border border-amber-700 rounded-lg p-2" data-testid="workforce-artwork-warning">
                  {!breastLogo
                    ? "Upload your breast-logo artwork above to enable checkout."
                    : "Upload your back-print artwork — some garments are set to receive a back print."}
                </div>
              )}
              <button
                onClick={onRequestQuote}
                disabled={!canQuote || busy}
                className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-extrabold py-3 rounded-xl"
                data-testid="workforce-quote-btn"
              >
                Request a quote
              </button>
            </div>
            <div className="text-[11px] text-zinc-500 mt-3 flex items-center gap-1.5">
              <ShieldCheck size={12}/> Secure Stripe checkout · UK printed
            </div>
          </div>

          <div className="mt-4 bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-start gap-2"><Sparkles size={14} className="text-[#fbbf24] mt-0.5"/> <span><strong>Breast logo print</strong> included on every garment (no charge).</span></div>
            <div className="flex items-start gap-2"><Truck size={14} className="text-[#fbbf24] mt-0.5"/> <span>Free UK delivery on orders over £50. 7–10 working days for most kits.</span></div>
          </div>
        </aside>
      </div>

      <PricePromise variant="band" />
      <BoldFooter />
    </div>
  );
}

const ic = "w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#fbbf24]";

function snap99(price) {
  return Math.max(0.99, Math.round(price) - 0.01);
}

// ---- Reusable artwork uploader (file → data URL) ----
function ArtworkUploader({ label, helper, required, dataUrl, onChange, testid, accent = "#fbbf24" }) {
  const inputRef = React.useRef(null);
  const onFile = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast.error("Please choose an image file (PNG, JPG, SVG)."); return; }
    if (file.size > 6 * 1024 * 1024) { toast.error("Image too large (max 6 MB)."); return; }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div
      className={`rounded-2xl border-2 p-3 transition ${dataUrl ? "bg-[#fff7ed] border-[#fed7aa]" : (required ? "bg-white border-dashed border-[#fbbf24]" : "bg-white border-dashed border-[#e5e7eb]")}`}
      data-testid={`${testid}-card`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-extrabold text-sm flex items-center gap-2">
            {label}
            {required && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold" style={{ background: accent, color: "#1a1a1a" }}>Required</span>}
          </div>
          <div className="text-[11px] text-[#4b5563] mt-0.5">{helper}</div>
        </div>
        {dataUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] text-rose-500 hover:underline"
            data-testid={`${testid}-remove`}
          >
            Remove
          </button>
        )}
      </div>
      {dataUrl ? (
        <div className="mt-2 flex items-center gap-3">
          <img src={dataUrl} alt="" className="w-16 h-16 object-contain bg-white rounded-lg border border-[#fed7aa] p-1" data-testid={`${testid}-preview`} />
          <button type="button" onClick={() => inputRef.current?.click()} className="text-xs font-extrabold underline" data-testid={`${testid}-replace`}>Replace</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full mt-2 bg-white hover:bg-[#fff7ed] border-2 border-dashed py-4 rounded-lg text-xs font-extrabold inline-flex items-center justify-center gap-2"
          style={{ borderColor: accent, color: accent === "#1a1a1a" ? "#1a1a1a" : "#b45309" }}
          data-testid={`${testid}-upload`}
        >
          + Upload image
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
