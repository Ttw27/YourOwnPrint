import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchLeaversProducts, fetchLeaversTiers, fetchLeaversTemplates, leaversCheckout } from "../lib/api";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, GraduationCap, Sparkles, Loader2, ShieldCheck, Package } from "lucide-react";

export default function LeaversStart() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tiers, setTiers] = useState({ tiers: [], bag_price: 3.99 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [details, setDetails] = useState({ school: "", year_group: "Year 11", contact_name: "", contact_email: "", contact_phone: "" });
  const [productId, setProductId] = useState(null);
  const [templateId, setTemplateId] = useState(null);
  const [sizeQtys, setSizeQtys] = useState({}); // {size: qty}
  const [addBag, setAddBag] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchLeaversProducts().catch(() => []),
      fetchLeaversTemplates().catch(() => []),
      fetchLeaversTiers().catch(() => null),
    ]).then(([ps, ts, lt]) => {
      const garments = (ps || []).filter((p) => p.id !== "leavers-drawstring-bag");
      setProducts(garments);
      setTemplates(ts || []);
      if (lt) setTiers(lt);
    }).finally(() => setLoading(false));
  }, []);

  const product = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId]);
  const template = useMemo(() => templates.find((t) => t.id === templateId) || null, [templates, templateId]);
  const totalQty = useMemo(() => Object.values(sizeQtys).reduce((a, b) => a + (Number(b) || 0), 0), [sizeQtys]);

  const tiersAsc = useMemo(() => [...(tiers.tiers || [])].sort((a, b) => a.min_qty - b.min_qty), [tiers]);
  const activeMinQty = useMemo(() => {
    let m = 0;
    for (const t of tiersAsc) if (totalQty >= t.min_qty) m = t.min_qty;
    return m;
  }, [tiersAsc, totalQty]);
  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const activeTier = tiersAsc.find((t) => t.min_qty === activeMinQty);
    return activeTier ? Number(activeTier.unit_price) : Number(product.price || 0);
  }, [product, tiersAsc, activeMinQty]);
  const bagPerUnit = addBag ? (tiers.bag_price || 3.99) : 0;
  const totalAmount = useMemo(() => (unitPrice + bagPerUnit) * totalQty, [unitPrice, bagPerUnit, totalQty]);

  const detailsOk = details.school.trim() && details.year_group.trim() && details.contact_name.trim() && details.contact_email.trim();
  const canCheckout = detailsOk && product && totalQty >= 1;

  const setSizeQty = (sz, v) => setSizeQtys((s) => ({ ...s, [sz]: Math.max(0, Math.min(2000, Number(v) || 0)) }));
  const bump = (sz, d) => setSizeQty(sz, (sizeQtys[sz] || 0) + d);

  const onCheckout = async () => {
    if (!canCheckout) {
      if (!detailsOk) toast.error("Fill in school, year group, name and email first.");
      else if (!product) toast.error("Pick a garment.");
      else toast.error("Add at least one item to a size.");
      return;
    }
    setBusy(true);
    try {
      const res = await leaversCheckout({
        school: details.school,
        year_group: details.year_group,
        contact_name: details.contact_name,
        contact_email: details.contact_email,
        contact_phone: details.contact_phone,
        product_id: product.id,
        template_id: template?.id || null,
        template_title: template?.title || null,
        sizes: Object.entries(sizeQtys).filter(([, q]) => Number(q) > 0).map(([size, qty]) => ({ size, qty: Number(qty) })),
        add_drawstring_bag: addBag,
        origin_url: window.location.origin,
      });
      window.location.href = res.url;
    } catch (e) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Couldn't start checkout");
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" data-testid="leavers-start-loading">
        <Loader2 className="animate-spin text-[#7bc67e]" /> <span className="ml-2 text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen" data-testid="leavers-start-page">
      <BoldNavbar />
      <div className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <header>
            <button onClick={() => navigate("/leavers-hoodies")} className="text-xs text-[#4b5563] hover:underline mb-2" data-testid="leavers-start-back">← Back to overview</button>
            <h1 className="font-nunito font-black text-4xl lg:text-5xl">Start your leavers&apos; order</h1>
            <p className="text-[#4b5563] mt-2">No group sign-up needed — just tell us what you want and we&apos;ll send a free proof before printing.</p>
          </header>

          {/* Step 1: details */}
          <section data-testid="leavers-step-details">
            <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">1.</span> Your details</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <Field testid="ls-school" label="School / college *" value={details.school} onChange={(v) => setDetails({ ...details, school: v })} />
              <Field testid="ls-year" label="Year group *" value={details.year_group} onChange={(v) => setDetails({ ...details, year_group: v })} />
              <Field testid="ls-name" label="Your name *" value={details.contact_name} onChange={(v) => setDetails({ ...details, contact_name: v })} />
              <Field testid="ls-email" label="Email *" type="email" value={details.contact_email} onChange={(v) => setDetails({ ...details, contact_email: v })} />
              <Field testid="ls-phone" label="Phone (optional)" value={details.contact_phone} onChange={(v) => setDetails({ ...details, contact_phone: v })} />
            </div>
          </section>

          {/* Step 2: garment */}
          <section data-testid="leavers-step-garment">
            <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">2.</span> Pick your garment</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProductId(p.id);
                    setSizeQtys({}); // reset sizes when switching garment
                  }}
                  className={`text-left rounded-2xl border-2 overflow-hidden transition ${productId === p.id ? "border-[#7bc67e] bg-[#f0fdf4] shadow-md" : "border-[#dcfce7] bg-white hover:border-[#7bc67e]"}`}
                  data-testid={`ls-garment-${p.id}`}
                >
                  <div className="aspect-square overflow-hidden bg-[#f0fdf4] relative">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    {productId === p.id && (
                      <div className="absolute top-2 right-2 bg-[#7bc67e] text-[#1a1a1a] rounded-full p-1"><CheckCircle2 size={16} /></div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-extrabold text-sm">{p.name}</div>
                    <div className="text-xs text-[#4b5563] mt-0.5">From £{p.price.toFixed(2)}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Step 3: design */}
          <section data-testid="leavers-step-design">
            <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">3.</span> Pick your design <span className="text-xs font-normal text-[#4b5563]">(or skip — we&apos;ll work with your own artwork)</span></h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(templateId === t.id ? null : t.id)}
                  className={`text-left rounded-2xl border-2 overflow-hidden transition ${templateId === t.id ? "border-[#7bc67e] bg-[#f0fdf4] shadow-md" : "border-[#dcfce7] bg-white hover:border-[#7bc67e]"}`}
                  data-testid={`ls-template-${t.id}`}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[#f0fdf4] relative">
                    <img src={t.image} alt={t.title} className="w-full h-full object-cover" />
                    {templateId === t.id && (
                      <div className="absolute top-2 right-2 bg-[#7bc67e] text-[#1a1a1a] rounded-full p-1"><CheckCircle2 size={16} /></div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-extrabold text-sm">{t.title}</div>
                    {t.description && <div className="text-xs text-[#4b5563] mt-0.5 line-clamp-2">{t.description}</div>}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Step 4: sizes + tier ladder */}
          {product && (
            <section data-testid="leavers-step-sizes">
              <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">4.</span> Sizes &amp; quantities</h2>
              <div className="bg-white rounded-2xl border-2 border-[#dcfce7] p-4 mb-3" data-testid="ls-tier-ladder">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#7bc67e]">Live bulk pricing</div>
                  {totalQty > 0 && <div className="text-[10px] text-[#4b5563]">Your qty: <strong className="text-[#1a1a1a]" data-testid="ls-total-qty">{totalQty}</strong></div>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
                  <Tile
                    label={tiersAsc[0] ? `1–${tiersAsc[0].min_qty - 1}` : "Any"}
                    price={`£${Number(product.price).toFixed(2)}`}
                    sub="List price"
                    active={activeMinQty === 0 && totalQty >= 1}
                    testid="ls-tier-base"
                  />
                  {tiersAsc.map((t) => (
                    <Tile
                      key={t.min_qty}
                      testid={`ls-tier-${t.min_qty}`}
                      label={`${t.min_qty}+`}
                      price={`£${t.unit_price.toFixed(2)}`}
                      sub="per hoodie"
                      active={activeMinQty === t.min_qty}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(product.sizes || ["S", "M", "L", "XL"]).map((sz) => {
                  const q = sizeQtys[sz] || 0;
                  return (
                    <div key={sz} className={`bg-white border-2 rounded-2xl p-3 ${q > 0 ? "border-[#7bc67e]" : "border-[#e5e7eb]"}`} data-testid={`ls-size-card-${sz}`}>
                      <div className="text-xs font-extrabold uppercase">{sz}</div>
                      <div className="flex items-center gap-1 mt-2">
                        <button onClick={() => bump(sz, -1)} disabled={q === 0} className="w-7 h-7 grid place-items-center rounded-full border border-[#e5e7eb] disabled:opacity-40" data-testid={`ls-size-${sz}-minus`}>−</button>
                        <input
                          type="number" min={0}
                          value={q}
                          onChange={(e) => setSizeQty(sz, e.target.value)}
                          className="w-full text-center bg-transparent font-extrabold text-sm focus:outline-none"
                          data-testid={`ls-size-${sz}-qty`}
                        />
                        <button onClick={() => bump(sz, 1)} className="w-7 h-7 grid place-items-center rounded-full border border-[#e5e7eb]" data-testid={`ls-size-${sz}-plus`}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="mt-4 flex items-center gap-2 cursor-pointer bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-3" data-testid="ls-bag-toggle-row">
                <input type="checkbox" checked={addBag} onChange={(e) => setAddBag(e.target.checked)} className="w-4 h-4 accent-[#7bc67e]" data-testid="ls-bag-toggle" />
                <Package size={14} className="text-[#7bc67e]" />
                <span className="text-sm font-extrabold">Matching printed drawstring bag — +£{(tiers.bag_price || 3.99).toFixed(2)} per hoodie</span>
              </label>
            </section>
          )}
        </div>

        {/* Sticky summary */}
        <aside className="lg:col-span-4">
          <div className="bg-[#1a1a1a] text-white rounded-3xl p-6 sticky top-24" data-testid="ls-summary">
            <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Live total</div>
            <div className="text-4xl font-black mt-2" data-testid="ls-total">£{totalAmount.toFixed(2)}</div>
            <div className="text-sm text-zinc-300 mt-1">{totalQty} hoodie{totalQty === 1 ? "" : "s"}{unitPrice > 0 ? ` · £${unitPrice.toFixed(2)} ea` : ""}{addBag ? ` + £${bagPerUnit.toFixed(2)} bag` : ""}</div>
            {product && tiersAsc.length > 0 && (() => {
              const next = tiersAsc.find((t) => totalQty < t.min_qty);
              return next ? (
                <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs" data-testid="ls-next-tier">
                  Add <strong>{next.min_qty - totalQty}</strong> more to drop to <strong className="text-[#7bc67e]">£{next.unit_price.toFixed(2)}</strong> each
                </div>
              ) : null;
            })()}
            <button
              onClick={onCheckout}
              disabled={!canCheckout || busy}
              className="mt-5 w-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-40 disabled:cursor-not-allowed text-[#1a1a1a] font-extrabold py-3 rounded-xl inline-flex items-center justify-center gap-2"
              data-testid="ls-checkout-btn"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />} Checkout securely
            </button>
            <div className="text-[11px] text-zinc-500 mt-3 flex items-center gap-1.5">
              <ShieldCheck size={12} /> Stripe · UK printed · free proof
            </div>
          </div>
        </aside>
      </div>
      <BoldFooter />
    </div>
  );
}

function Tile({ label, price, sub, active, testid }) {
  return (
    <div
      data-testid={testid}
      data-active={active ? "true" : "false"}
      className={`rounded-xl p-2 text-center transition ${active ? "bg-[#7bc67e] text-[#1a1a1a] ring-2 ring-[#7bc67e] ring-offset-1 scale-105" : "bg-[#f0fdf4] text-[#1a1a1a]"}`}
    >
      <div className="font-extrabold text-sm">{price}</div>
      <div className="text-[10px] mt-0.5">{label} · {sub}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", testid }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-[#4b5563] font-extrabold mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-[#dcfce7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#7bc67e]"
        data-testid={testid}
      />
    </label>
  );
}
