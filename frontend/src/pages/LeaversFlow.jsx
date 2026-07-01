import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchLeaversProducts, fetchLeaversTiers, fetchLeaversTemplates, leaversCheckout, fetchPortfolio, api } from "../lib/api";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, GraduationCap, Sparkles, Loader2, ShieldCheck, Package, Upload, ImageIcon, Users, FileText, Info } from "lucide-react";

export default function LeaversStart() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tiers, setTiers] = useState({ tiers: [], bag_price: 3.99 });
  const [config, setConfig] = useState({ full_front_upcharge: 2.5, no_full_front_product_ids: ["varsity-jacket", "leavers-varsity"], design_libraries: { front_breast: "leavers-front-designs", back: "leavers-back-designs", full_front: "leavers-full-front-designs" } });
  const [designLibs, setDesignLibs] = useState({ front_breast: [], back: [], full_front: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [details, setDetails] = useState({ school: "", year_group: "Year 11", contact_name: "", contact_email: "", contact_phone: "" });
  const [productId, setProductId] = useState(null);
  // Print position — "breast" (default, included) OR "full_front" (+upcharge)
  const [printPosition, setPrintPosition] = useState("breast");
  // Design selections — either a picked library item id OR a custom upload data URL
  const [frontDesignId, setFrontDesignId] = useState(null);
  const [customFront, setCustomFront] = useState(null);
  const [backDesignId, setBackDesignId] = useState(null);
  const [customBack, setCustomBack] = useState(null);
  // Legacy template pick (quick starter)
  const [templateId, setTemplateId] = useState(null);
  // Names collection
  const [namesMode, setNamesMode] = useState("we-will-contact");   // "we-will-contact" | "upload"
  const [namesFile, setNamesFile] = useState(null);
  const [bagProduct, setBagProduct] = useState(null);
  const [sizeQtys, setSizeQtys] = useState({});
  const [addBag, setAddBag] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchLeaversProducts().catch(() => []),
      fetchLeaversTemplates().catch(() => []),
      fetchLeaversTiers().catch(() => null),
      api.get("/leavers/config").then(r => r.data).catch(() => null),
    ]).then(([ps, ts, lt, cfg]) => {
      const garments = (ps || []).filter((p) => p.id !== "leavers-drawstring-bag");
      const bag = (ps || []).find((p) => p.id === "leavers-drawstring-bag") || null;
      setProducts(garments);
      setBagProduct(bag);
      setTemplates(ts || []);
      if (lt) setTiers(lt);
      if (cfg) setConfig(cfg);
      const libs = cfg?.design_libraries || {};
      Promise.all([
        libs.front_breast ? fetchPortfolio({ category: libs.front_breast, limit: 40 }).then(d => d.items || []) : Promise.resolve([]),
        libs.back ? fetchPortfolio({ category: libs.back, limit: 40 }).then(d => d.items || []) : Promise.resolve([]),
        libs.full_front ? fetchPortfolio({ category: libs.full_front, limit: 40 }).then(d => d.items || []) : Promise.resolve([]),
      ]).then(([fb, bk, ff]) => setDesignLibs({ front_breast: fb, back: bk, full_front: ff }));
    }).finally(() => setLoading(false));
  }, []);

  const product = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId]);
  const template = useMemo(() => templates.find((t) => t.id === templateId) || null, [templates, templateId]);
  const totalQty = useMemo(() => Object.values(sizeQtys).reduce((a, b) => a + (Number(b) || 0), 0), [sizeQtys]);
  const allowsFullFront = product ? product.allows_full_front !== false : true;

  // Reset print position to breast if user switches to a garment that can't do full-front
  useEffect(() => {
    if (product && !allowsFullFront && printPosition === "full_front") {
      setPrintPosition("breast");
      toast.info(`${product.name} doesn't support a full-front print — switched to breast.`);
    }
  }, [product, allowsFullFront, printPosition]);

  const tiersAsc = useMemo(() => [...(tiers.tiers || [])].sort((a, b) => a.min_qty - b.min_qty), [tiers]);
  const activeMinQty = useMemo(() => {
    let m = 0;
    for (const t of tiersAsc) if (totalQty >= t.min_qty) m = t.min_qty;
    return m;
  }, [tiersAsc, totalQty]);
  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const activeTier = tiersAsc.find((t) => t.min_qty === activeMinQty);
    const base = activeTier ? Number(activeTier.unit_price) : Number(product.price || 0);
    const ff = printPosition === "full_front" ? Number(config.full_front_upcharge || 0) : 0;
    return base + ff;
  }, [product, tiersAsc, activeMinQty, printPosition, config]);
  const bagPerUnit = addBag ? (tiers.bag_price || 3.99) : 0;
  const totalAmount = useMemo(() => (unitPrice + bagPerUnit) * totalQty, [unitPrice, bagPerUnit, totalQty]);

  const detailsOk = details.school.trim() && details.year_group.trim() && details.contact_name.trim() && details.contact_email.trim();
  const hasFrontDesign = !!(frontDesignId || customFront || templateId);
  const hasBackDesign = !!(backDesignId || customBack);
  const designOk = hasFrontDesign || hasBackDesign;
  const canCheckout = detailsOk && product && designOk && totalQty >= 1;

  const setSizeQty = (sz, v) => setSizeQtys((s) => ({ ...s, [sz]: Math.max(0, Math.min(2000, Number(v) || 0)) }));
  const bump = (sz, d) => setSizeQty(sz, (sizeQtys[sz] || 0) + d);

  const onCheckout = async () => {
    if (!canCheckout) {
      if (!detailsOk) toast.error("Fill in school, year group, name and email first.");
      else if (!product) toast.error("Pick a garment.");
      else if (!designOk) toast.error("Pick a front or back design, or upload your own.");
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
        template_id: templateId || null,
        template_title: template?.title || null,
        custom_design_data_url: customFront || null,
        custom_back_design_data_url: customBack || null,
        front_design_id: frontDesignId || null,
        back_design_id: backDesignId || null,
        print_position: printPosition,
        names_collection_mode: namesMode,
        names_file_data_url: namesFile || null,
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

          {/* Step 3: Print position — breast (included) vs full front (+upcharge, disabled for varsity) */}
          {product && (
            <section data-testid="leavers-step-position">
              <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">3.</span> Where does the print go?</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrintPosition("breast")}
                  className={`text-left rounded-2xl border-2 p-4 transition ${printPosition === "breast" ? "border-[#7bc67e] bg-[#f0fdf4] shadow-md" : "border-[#dcfce7] bg-white hover:border-[#7bc67e]"}`}
                  data-testid="ls-position-breast"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 ${printPosition === "breast" ? "border-[#7bc67e] bg-[#7bc67e]" : "border-[#e5e7eb]"}`} />
                    <span className="font-nunito font-extrabold">Front breast pocket</span>
                    <span className="ml-auto text-xs font-extrabold text-[#7bc67e]">Included</span>
                  </div>
                  <div className="text-xs text-[#4b5563] mt-1.5">Neat, subtle logo/design on the left chest — the standard leavers' look.</div>
                </button>
                <button
                  type="button"
                  disabled={!allowsFullFront}
                  onClick={() => setPrintPosition("full_front")}
                  className={`text-left rounded-2xl border-2 p-4 transition ${!allowsFullFront ? "opacity-50 cursor-not-allowed border-[#e5e7eb]" : printPosition === "full_front" ? "border-[#7bc67e] bg-[#f0fdf4] shadow-md" : "border-[#dcfce7] bg-white hover:border-[#7bc67e]"}`}
                  data-testid="ls-position-full-front"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 ${printPosition === "full_front" ? "border-[#7bc67e] bg-[#7bc67e]" : "border-[#e5e7eb]"}`} />
                    <span className="font-nunito font-extrabold">Full front print</span>
                    <span className="ml-auto text-xs font-extrabold text-[#fbbf24]">+£{Number(config.full_front_upcharge || 0).toFixed(2)} each</span>
                  </div>
                  <div className="text-xs text-[#4b5563] mt-1.5">
                    {allowsFullFront
                      ? "Full-size design across the chest — the bold statement version."
                      : `${product.name} doesn't support a full-front print (chest-panel construction). Please choose breast.`}
                  </div>
                </button>
              </div>
              <div className="mt-2 text-xs text-[#4b5563] flex items-start gap-1.5" data-testid="ls-position-note">
                <Info size={12} className="mt-0.5 flex-shrink-0" />
                <span>You can only pick one front print — breast <em>or</em> full-front (not both).</span>
              </div>
            </section>
          )}

          {/* Step 4: Front design — pick from library OR upload */}
          {product && (
            <section data-testid="leavers-step-front-design">
              <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">4.</span> Front design {printPosition === "full_front" ? "(full front)" : "(breast pocket)"}</h2>
              <DesignLibraryGrid
                testidPrefix="ls-front-design"
                items={printPosition === "full_front" ? designLibs.full_front : designLibs.front_breast}
                selectedId={frontDesignId}
                onSelect={(id) => { setFrontDesignId(id === frontDesignId ? null : id); setTemplateId(null); if (id) setCustomFront(null); }}
              />
              <div className="mt-4 bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-4" data-testid="ls-front-upload-block">
                <div className="font-extrabold text-sm flex items-center gap-2">
                  Or upload your own front design
                  {customFront && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold bg-[#7bc67e] text-[#1a1a1a]">Uploaded</span>}
                </div>
                <div className="text-[11px] text-[#4b5563] mt-0.5">PNG, JPG or SVG (max 6&nbsp;MB). Uploading overrides any preset picked above.</div>
                <CustomDesignDrop
                  dataUrl={customFront}
                  onChange={(d) => { setCustomFront(d); if (d) { setFrontDesignId(null); setTemplateId(null); } }}
                  slot="front"
                />
              </div>
            </section>
          )}

          {/* Step 5: Back design — pick from library OR upload (both included in price) */}
          {product && (
            <section data-testid="leavers-step-back-design">
              <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">5.</span> Back design <span className="text-xs font-normal text-[#4b5563]">— optional, included in price</span></h2>
              <DesignLibraryGrid
                testidPrefix="ls-back-design"
                items={designLibs.back}
                selectedId={backDesignId}
                onSelect={(id) => { setBackDesignId(id === backDesignId ? null : id); if (id) setCustomBack(null); }}
              />
              <div className="mt-4 bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-4" data-testid="ls-back-upload-block">
                <div className="font-extrabold text-sm flex items-center gap-2">
                  Or upload your own back design
                  {customBack && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold bg-[#7bc67e] text-[#1a1a1a]">Uploaded</span>}
                </div>
                <div className="text-[11px] text-[#4b5563] mt-0.5">PNG, JPG or SVG (max 6&nbsp;MB). Uploading overrides the preset picked above.</div>
                <CustomDesignDrop
                  dataUrl={customBack}
                  onChange={(d) => { setCustomBack(d); if (d) setBackDesignId(null); }}
                  slot="back"
                />
              </div>
            </section>
          )}

          {/* Step 6: Names — upload a file OR let us contact them after purchase */}
          {product && (
            <section data-testid="leavers-step-names">
              <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">6.</span> Student names</h2>
              <p className="text-sm text-[#4b5563] mb-3">Only needed if your design lists names on the back. If you've uploaded your own artwork with names baked in, tick "we'll be in touch" — we may not need anything else.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNamesMode("we-will-contact")}
                  className={`text-left rounded-2xl border-2 p-4 transition ${namesMode === "we-will-contact" ? "border-[#7bc67e] bg-[#f0fdf4] shadow-md" : "border-[#dcfce7] bg-white hover:border-[#7bc67e]"}`}
                  data-testid="ls-names-we-will-contact"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 ${namesMode === "we-will-contact" ? "border-[#7bc67e] bg-[#7bc67e]" : "border-[#e5e7eb]"}`} />
                    <Users size={16} className="text-[#7bc67e]" />
                    <span className="font-nunito font-extrabold">We'll be in touch</span>
                  </div>
                  <div className="text-xs text-[#4b5563] mt-1.5">After you check out, we'll email you a simple form to collect names — you have up to {config.names_deadline_days || 7} days.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNamesMode("upload")}
                  className={`text-left rounded-2xl border-2 p-4 transition ${namesMode === "upload" ? "border-[#7bc67e] bg-[#f0fdf4] shadow-md" : "border-[#dcfce7] bg-white hover:border-[#7bc67e]"}`}
                  data-testid="ls-names-upload"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 ${namesMode === "upload" ? "border-[#7bc67e] bg-[#7bc67e]" : "border-[#e5e7eb]"}`} />
                    <FileText size={16} className="text-[#7bc67e]" />
                    <span className="font-nunito font-extrabold">Upload a names list now</span>
                  </div>
                  <div className="text-xs text-[#4b5563] mt-1.5">CSV, spreadsheet, screenshot or PDF of the class list. Max 6 MB.</div>
                </button>
              </div>
              {namesMode === "upload" && (
                <div className="mt-4 bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-4" data-testid="ls-names-file-block">
                  <NamesFileDrop dataUrl={namesFile} onChange={setNamesFile} />
                </div>
              )}
            </section>
          )}

          {/* Step 7: sizes + tier ladder */}
          {product && (
            <section data-testid="leavers-step-sizes">
              <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">7.</span> Sizes &amp; quantities</h2>
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

              <DrawstringBagCard
                bag={bagProduct}
                price={tiers.bag_price || 3.99}
                checked={addBag}
                onToggle={setAddBag}
              />
            </section>
          )}

          {/* Do-it-for-me CTA */}
          <NeedHelpCTA
            title="Rather we handled the design for the whole year group?"
            body="Send over your school logo, the year, colour preferences and a rough idea. We'll mock up a design (front + back), send it for approval, then handle names collection with you directly."
            presetMessage="Hi! I'd like your team to sort our leavers' hoodie design — can I send you the info?"
            testid="leavers-need-help"
            variant="banner"
          />
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
            <div className="mt-4 space-y-2 text-[11px] text-zinc-300" data-testid="ls-proof-block">
              <div className="flex items-start gap-2">
                <ShieldCheck size={12} className="mt-0.5 flex-shrink-0 text-[#7bc67e]" />
                <span><strong className="text-white">We'll send a proof</strong> — mock-up of the design (and names) within {config.proof_days || 2} working days. Nothing prints until you say yes.</span>
              </div>
              {printPosition === "full_front" && (
                <div className="flex items-start gap-2" data-testid="ls-summary-full-front-note">
                  <Sparkles size={12} className="mt-0.5 flex-shrink-0 text-[#fbbf24]" />
                  <span>Full-front print upgrade — <strong className="text-white">+£{Number(config.full_front_upcharge || 0).toFixed(2)}</strong> per garment.</span>
                </div>
              )}
              {namesMode === "we-will-contact" && (
                <div className="flex items-start gap-2" data-testid="ls-summary-names-note">
                  <Users size={12} className="mt-0.5 flex-shrink-0 text-[#7bc67e]" />
                  <span>Names — we'll email you a form after checkout to collect them.</span>
                </div>
              )}
              {namesMode === "upload" && namesFile && (
                <div className="flex items-start gap-2">
                  <FileText size={12} className="mt-0.5 flex-shrink-0 text-[#7bc67e]" />
                  <span>Names list uploaded — we'll double-check it on the proof.</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      <BoldFooter />
    </div>
  );
}

// ---- Design library grid (portfolio-backed presets) ----
function DesignLibraryGrid({ items, selectedId, onSelect, testidPrefix }) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-[#f0fdf4] border-2 border-dashed border-[#dcfce7] rounded-2xl p-6 text-center text-sm text-[#4b5563]" data-testid={`${testidPrefix}-empty`}>
        No preset designs live yet — <strong>upload your own below</strong> or ask us to design one for you.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid={`${testidPrefix}-grid`}>
      {items.map((it) => {
        const active = selectedId === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onSelect(it.id)}
            className={`text-left rounded-2xl border-2 overflow-hidden transition ${active ? "border-[#7bc67e] bg-[#f0fdf4] shadow-md" : "border-[#dcfce7] bg-white hover:border-[#7bc67e]"}`}
            data-testid={`${testidPrefix}-${it.id}`}
          >
            <div className="aspect-square overflow-hidden bg-[#f0fdf4] relative">
              <img src={it.image_url} alt={it.alt_text || it.title} className="w-full h-full object-cover" loading="lazy" />
              {active && <div className="absolute top-2 right-2 bg-[#7bc67e] text-[#1a1a1a] rounded-full p-1"><CheckCircle2 size={16} /></div>}
            </div>
            <div className="p-2">
              <div className="font-extrabold text-xs line-clamp-1">{it.title}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function NamesFileDrop({ dataUrl, onChange }) {
  const inputRef = React.useRef(null);
  const onFile = (file) => {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) { toast.error("File too large (max 6 MB)."); return; }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div className="mt-3" data-testid="ls-names-file-drop">
      {dataUrl ? (
        <div className="flex items-center gap-3 bg-white border border-[#fed7aa] rounded-xl p-3">
          <div className="w-14 h-14 grid place-items-center bg-[#fff7ed] rounded-lg border border-[#fed7aa]"><FileText size={22} className="text-[#fbbf24]" /></div>
          <div className="text-xs flex-1">
            <div className="font-extrabold">Names list uploaded</div>
            <div className="text-[#4b5563]">We'll confirm every name on the proof before printing.</div>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} className="text-xs font-extrabold underline" data-testid="ls-names-file-replace">Replace</button>
          <button type="button" onClick={() => onChange(null)} className="text-xs text-rose-500 hover:underline" data-testid="ls-names-file-remove">Remove</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full bg-white border-2 border-dashed border-[#fed7aa] rounded-2xl p-6 text-sm text-[#4b5563] hover:border-[#fbbf24] hover:bg-[#fff7ed] transition-colors"
          data-testid="ls-names-file-choose"
        >
          <FileText className="mx-auto text-[#fbbf24]" size={22} />
          <div className="mt-2 font-extrabold text-[#1a1a1a]">Upload names list</div>
          <div className="text-[11px] text-[#4b5563] mt-1">CSV, spreadsheet, PDF or image (max 6&nbsp;MB)</div>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*,application/pdf,.csv,.xls,.xlsx,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="ls-names-file-input" />
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

// ---- Custom design drop / upload ----
function CustomDesignDrop({ dataUrl, onChange, slot = "" }) {
  const inputRef = React.useRef(null);
  const suffix = slot ? `-${slot}` : "";
  const onFile = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast.error("Image only (PNG, JPG, SVG)."); return; }
    if (file.size > 6 * 1024 * 1024) { toast.error("Image too large (max 6 MB)."); return; }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div className="mt-3" data-testid={`ls-custom-design-drop${suffix}`}>
      {dataUrl ? (
        <div className="flex items-center gap-3 bg-white border border-[#fed7aa] rounded-xl p-3">
          <img src={dataUrl} alt="Your design" className="w-20 h-20 object-contain bg-[#fff7ed] rounded-lg border border-[#fed7aa] p-1" data-testid={`ls-custom-design-preview${suffix}`} />
          <div className="text-xs flex-1">
            <div className="font-extrabold">Design uploaded</div>
            <div className="text-[#4b5563]">We&apos;ll proof and reply within 1 working day.</div>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} className="text-xs font-extrabold underline" data-testid={`ls-custom-design-replace${suffix}`}>Replace</button>
          <button type="button" onClick={() => onChange(null)} className="text-xs text-rose-500 hover:underline" data-testid={`ls-custom-design-remove${suffix}`}>Remove</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full bg-white hover:bg-[#fff7ed] border-2 border-dashed border-[#fbbf24] text-[#b45309] py-6 rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-2"
          data-testid={`ls-custom-design-upload${suffix}`}
        >
          <Upload size={16} /> Upload your {slot || ""} design here
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

// ---- Drawstring bag preview + toggle ----
function DrawstringBagCard({ bag, price, checked, onToggle }) {
  return (
    <div className="mt-4 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl overflow-hidden" data-testid="ls-bag-card">
      <label className="flex flex-col sm:flex-row cursor-pointer">
        {bag && (
          <div className="sm:w-44 sm:flex-shrink-0 aspect-[4/3] sm:aspect-square overflow-hidden bg-white">
            <img src={bag.image} alt="Matching printed drawstring bag" className="w-full h-full object-cover" data-testid="ls-bag-image" />
          </div>
        )}
        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onToggle(e.target.checked)}
              className="w-5 h-5 accent-[#7bc67e] mt-0.5"
              data-testid="ls-bag-toggle"
            />
            <div className="flex-1">
              <div className="font-extrabold text-sm flex items-center gap-2">
                <Package size={14} className="text-[#7bc67e]" />
                Matching printed drawstring bag
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#7bc67e] text-[#1a1a1a] font-extrabold">+£{price.toFixed(2)} / hoodie</span>
              </div>
              <div className="text-xs text-[#4b5563] mt-1 leading-relaxed">
                Same design as your hoodie printed on the front, with the <strong className="text-[#1a1a1a]">size of the garment inside</strong> printed on the back — makes handing them out at school painless.
              </div>
              <div className="text-[11px] text-[#4b5563] mt-2 flex items-center gap-1">
                <ImageIcon size={11} className="text-[#7bc67e]" /> Westford Mill-style carry-all · UK printed
              </div>
            </div>
          </div>
        </div>
      </label>
    </div>
  );
}
