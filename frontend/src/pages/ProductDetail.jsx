import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import ProductReviews from "../components/bold/ProductReviews";
import PricePromise from "../components/bold/PricePromise";
import BespokeQuoteCard from "../components/bold/BespokeQuoteCard";
import WhatsAppFAB, { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import { api, fetchReviewsAggregate, fetchPlacements, createCheckout } from "../lib/api";
import { toast } from "sonner";
import { ArrowRight, ShieldCheck, Truck, Sparkles, Loader2, ShoppingCart, Wand2, Minus, Plus, Info, Shirt, Upload, Trash2, Lock, Check, ImageIcon } from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [aggregates, setAggregates] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Selections
  const [color, setColor] = useState(null);
  const [sizeQtys, setSizeQtys] = useState({});
  const [printMode, setPrintMode] = useState("custom"); // "custom" | "blank"
  const [selectedPlacements, setSelectedPlacements] = useState([]);
  // Per-placement artwork uploads (data URLs)
  const [artwork, setArtwork] = useState({}); // { 'left-breast': dataUrl, ... }
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/products/${id}`).then(r => r.data),
      fetchPlacements().catch(() => []),
      fetchReviewsAggregate().catch(() => ({})),
    ])
      .then(([p, pl, ag]) => {
        setProduct(p); setPlacements(pl); setAggregates(ag);
        setColor((p.colors && p.colors[0]?.name) || null);
        setSizeQtys({});
        setPrintMode("custom");
        setSelectedPlacements([]);
        setArtwork({});
      })
      .catch((e) => setErr(e?.response?.status === 404 ? "Product not found" : "Could not load product"))
      .finally(() => setLoading(false));
  }, [id]);

  const blank = printMode === "blank";
  const agg = aggregates[id];
  const placementById = useMemo(() => Object.fromEntries(placements.map(p => [p.id, p])), [placements]);

  const togglePlacement = (pid) => {
    if (blank) return;
    setSelectedPlacements((prev) => {
      const has = prev.includes(pid);
      if (has) {
        // also drop any uploaded art for that placement
        setArtwork((a) => { const next = { ...a }; delete next[pid]; return next; });
        return prev.filter(x => x !== pid);
      }
      const excludes = placementById[pid]?.excludes || [];
      const next = prev.filter(x => !excludes.includes(x));
      const reverseExcl = placements.filter(p => p.excludes.includes(pid)).map(p => p.id);
      // also drop artwork for excluded placements
      excludes.concat(reverseExcl).forEach((excl) => {
        setArtwork((a) => { const nx = { ...a }; delete nx[excl]; return nx; });
      });
      return [...next.filter(x => !reverseExcl.includes(x)), pid];
    });
  };
  const isPlacementDisabled = (pid) => {
    if (blank) return true;
    const excl = placementById[pid]?.excludes || [];
    return excl.some(e => selectedPlacements.includes(e));
  };

  // Artwork upload — auto-resize to <800px
  const onPickArtwork = (pid, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1000;
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        setArtwork(prev => ({ ...prev, [pid]: c.toDataURL("image/png") }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const removeArtwork = (pid) =>
    setArtwork(prev => { const next = { ...prev }; delete next[pid]; return next; });

  const totalQty = useMemo(() => Object.values(sizeQtys).reduce((a, b) => a + (Number(b) || 0), 0), [sizeQtys]);
  const printCostPerGarment = useMemo(
    () => (blank ? 0 : selectedPlacements.reduce((s, pid) => s + (placementById[pid]?.price || 0), 0)),
    [blank, selectedPlacements, placementById]
  );
  const lineTotal = useMemo(() => {
    if (!product) return 0;
    const upcharges = product.size_upcharges || {};
    let total = 0;
    Object.entries(sizeQtys).forEach(([sz, q]) => {
      const qn = Number(q) || 0;
      if (qn <= 0) return;
      const unit = (product.price || 0) + (upcharges[sz] || 0) + printCostPerGarment;
      total += unit * qn;
    });
    return total;
  }, [product, sizeQtys, printCostPerGarment]);

  const allArtworkUploaded = useMemo(
    () => blank || (selectedPlacements.length > 0 && selectedPlacements.every(p => artwork[p])),
    [blank, selectedPlacements, artwork]
  );
  const checkoutBlocked = totalQty < 1
    || (!blank && selectedPlacements.length === 0)
    || (!blank && !allArtworkUploaded);

  const setSizeQty = (sz, q) => {
    const n = Math.max(0, Math.min(5000, Number(q) || 0));
    setSizeQtys((prev) => { const next = { ...prev }; if (n === 0) delete next[sz]; else next[sz] = n; return next; });
  };
  const bump = (sz, d) => setSizeQty(sz, (sizeQtys[sz] || 0) + d);

  const onCheckout = async () => {
    if (checkoutBlocked) {
      if (totalQty < 1) toast.error("Add at least 1 item to a size");
      else if (!blank && selectedPlacements.length === 0) toast.error("Pick at least one print placement (or switch to Buy Blank)");
      else toast.error("Please upload artwork for every selected placement");
      return;
    }
    setCheckingOut(true);
    try {
      const { url } = await createCheckout({
        product_id: product.id,
        size_qtys: sizeQtys,
        color,
        placements: blank ? [] : selectedPlacements,
        blank,
        origin_url: window.location.origin,
        design_meta: blank ? { mode: "blank" } : {
          mode: "uploaded",
          placements_uploaded: Object.keys(artwork).join(","),
        },
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Checkout failed");
      setCheckingOut(false);
    }
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <WhatsAppFAB preset={`Hi! Question about the ${product?.name || "product"}…`} />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-xs font-nunito font-bold text-[#4b5563] mb-4">
          <Link to="/" className="hover:text-[#7bc67e]">Home</Link>
          <span className="mx-2">/</span>
          <Link to={product?.category === "workwear" ? "/workwear" : product?.category === "teams-schools" ? "/teams-schools" : product?.category === "sports" ? "/sports" : "/"} className="hover:text-[#7bc67e]">{product?.category || "Shop"}</Link>
          <span className="mx-2">/</span>
          <span data-testid="product-breadcrumb-name">{product?.name || ""}</span>
        </div>

        {loading ? (
          <div className="text-[#4b5563] py-20 text-center">Loading…</div>
        ) : err ? (
          <div className="text-rose-600 py-20 text-center font-nunito font-bold">{err}</div>
        ) : product && (
          <>
            <div className="grid lg:grid-cols-12 gap-8 mb-12">
              {/* Image */}
              <div className="lg:col-span-6">
                <div className="bg-[#f0fdf4] rounded-3xl p-6 border border-[#dcfce7] sticky top-20" data-testid="product-image-block">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-white relative">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    {color && (
                      <div className="absolute bottom-3 left-3 bg-white px-3 py-1.5 rounded-full shadow-md font-nunito font-bold text-xs flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-[#dcfce7]" style={{ background: (product.colors?.find(c => c.name === color)?.hex) || "#ccc" }} />
                        {color}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Configurator */}
              <div className="lg:col-span-6 space-y-5">
                <div>
                  <span className="inline-block bg-[#fde68a] text-[#1a1a1a] text-xs font-nunito font-extrabold uppercase tracking-wider px-3 py-1 rounded-full">{product.category}</span>
                  <h1 data-testid="product-name" className="mt-3 font-nunito font-black text-4xl lg:text-5xl text-[#1a1a1a]">{product.name}</h1>
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    {agg ? <><StarRating value={agg.average} size={16} /><span className="text-sm text-[#4b5563]">{agg.average.toFixed(1)} ({agg.count} reviews)</span></> : <span className="text-sm text-[#4b5563]">No reviews yet</span>}
                    <span className="text-xs font-nunito font-bold text-[#1a1a1a] bg-[#f0fdf4] px-2 py-1 rounded-full border border-[#dcfce7]">From £{product.price.toFixed(2)}</span>
                  </div>
                  <p className="text-[#4b5563] mt-4">{product.description}</p>
                </div>

                {/* Colours */}
                {product.colors?.length > 0 && (
                  <Section title="1. Colour" right={<span className="text-xs text-[#4b5563]">{color || "Pick one"}</span>}>
                    <div className="flex gap-2 flex-wrap" data-testid="color-swatches">
                      {product.colors.map((c) => (
                        <button
                          key={c.name}
                          data-testid={`color-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                          onClick={() => setColor(c.name)}
                          title={c.name}
                          aria-label={c.name}
                          className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${color === c.name ? "border-[#7bc67e] ring-2 ring-[#7bc67e]/40" : "border-[#e5e7eb]"}`}
                          style={{ background: c.hex }}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                {/* Sizes */}
                <Section title="2. Sizes & quantity" right={
                  <span className="text-xs text-[#4b5563]">Total: <span data-testid="size-total-qty" className="font-nunito font-extrabold text-[#1a1a1a]">{totalQty}</span></span>
                }>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="size-grid">
                    {(product.sizes || []).map((sz) => {
                      const qty = sizeQtys[sz] || 0;
                      const upcharge = (product.size_upcharges || {})[sz] || 0;
                      const active = qty > 0;
                      return (
                        <div key={sz} data-testid={`size-row-${sz}`} className={`rounded-xl border-2 p-2.5 transition-colors ${active ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white"}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-nunito font-extrabold text-sm">{sz}</span>
                            {upcharge > 0 && <span className="text-[10px] font-nunito font-bold text-[#4b5563]">+£{upcharge.toFixed(2)}</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            <button data-testid={`size-${sz}-minus`} onClick={() => bump(sz, -1)} className="w-7 h-7 grid place-items-center rounded-full bg-white border border-[#e5e7eb] hover:border-[#7bc67e] disabled:opacity-40" disabled={qty === 0}><Minus size={12} /></button>
                            <input data-testid={`size-${sz}-qty`} type="number" min={0} value={qty} onChange={(e) => setSizeQty(sz, e.target.value)} className="w-full text-center bg-transparent font-nunito font-extrabold text-sm focus:outline-none" />
                            <button data-testid={`size-${sz}-plus`} onClick={() => bump(sz, 1)} className="w-7 h-7 grid place-items-center rounded-full bg-white border border-[#e5e7eb] hover:border-[#7bc67e]"><Plus size={12} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>

                {/* PRINT MODE — prominent segmented choice */}
                <Section title="3. Print options">
                  <div className="grid grid-cols-2 gap-2 mb-4" data-testid="print-mode-toggle">
                    <button
                      data-testid="print-mode-custom"
                      onClick={() => setPrintMode("custom")}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${printMode === "custom" ? "border-[#7bc67e] bg-[#f0fdf4] shadow-md" : "border-[#e5e7eb] bg-white hover:border-[#dcfce7]"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 ${printMode === "custom" ? "border-[#7bc67e] bg-[#7bc67e]" : "border-[#e5e7eb]"}`} />
                        <span className="font-nunito font-extrabold">Add Custom Print</span>
                      </div>
                      <div className="text-xs text-[#4b5563] mt-1.5">Pick placements, upload your logo, free proof.</div>
                    </button>
                    <button
                      data-testid="print-mode-blank"
                      onClick={() => setPrintMode("blank")}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${printMode === "blank" ? "border-[#1a1a1a] bg-[#1a1a1a] text-white shadow-md" : "border-[#e5e7eb] bg-white hover:border-[#dcfce7]"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 ${printMode === "blank" ? "border-white bg-white" : "border-[#e5e7eb]"}`} />
                        <span className="font-nunito font-extrabold">Buy Blank — No Print</span>
                      </div>
                      <div className={`text-xs mt-1.5 ${printMode === "blank" ? "text-neutral-300" : "text-[#4b5563]"}`}>Plain garment, no decoration. Just the base price.</div>
                    </button>
                  </div>

                  {!blank && (
                    <>
                      <div className={`grid grid-cols-2 gap-2`} data-testid="placements-grid">
                        {placements.map((p) => {
                          const checked = selectedPlacements.includes(p.id);
                          const disabled = isPlacementDisabled(p.id);
                          return (
                            <label
                              key={p.id}
                              data-testid={`placement-${p.id}`}
                              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${checked ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white hover:border-[#dcfce7]"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                            >
                              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => togglePlacement(p.id)} className="w-4 h-4 accent-[#7bc67e]" data-testid={`placement-${p.id}-checkbox`} />
                              <div className="flex-1">
                                <div className="font-nunito font-extrabold text-sm">{p.label}</div>
                                <div className="text-xs text-[#4b5563]">+£{p.price.toFixed(2)} / garment</div>
                              </div>
                              <Shirt size={16} className="text-[#7bc67e]" />
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-3 text-xs text-[#4b5563] flex items-start gap-1.5">
                        <Info size={12} className="mt-0.5 flex-shrink-0" />
                        <span><strong>Full front replaces left/right breast.</strong> Pick any combination of front, back & sleeves.</span>
                      </div>
                    </>
                  )}
                  {blank && (
                    <div className="bg-[#1a1a1a]/5 rounded-xl p-4 text-sm text-[#4b5563] flex items-start gap-2">
                      <Info size={14} className="mt-0.5 text-[#1a1a1a]" />
                      <span>You're buying <strong>blank garments only</strong> — no print, just the base price.</span>
                    </div>
                  )}
                </Section>

                {/* UPLOAD ARTWORK — visible only when custom + at least 1 placement */}
                {!blank && selectedPlacements.length > 0 && (
                  <Section
                    title="4. Upload your prints"
                    right={
                      allArtworkUploaded
                        ? <span className="inline-flex items-center gap-1 text-xs font-nunito font-extrabold text-[#7bc67e]"><Check size={14} /> All artwork uploaded</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-nunito font-extrabold text-rose-500"><Lock size={12} /> Required to checkout</span>
                    }
                  >
                    <div className="grid sm:grid-cols-2 gap-3" data-testid="artwork-grid">
                      {selectedPlacements.map((pid) => (
                        <ArtworkSlot
                          key={pid}
                          placement={placementById[pid]}
                          dataUrl={artwork[pid]}
                          onPick={(file) => onPickArtwork(pid, file)}
                          onRemove={() => removeArtwork(pid)}
                          testId={`artwork-${pid}`}
                        />
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-[#4b5563] flex items-start gap-1.5">
                      <Info size={12} className="mt-0.5 flex-shrink-0" />
                      <span>PNG with transparent background works best · we'll send a free proof before printing · same logo for every placement? Just upload the same file for each.</span>
                    </div>
                  </Section>
                )}

                {/* Price summary */}
                <div className="bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="price-summary">
                  <div className="flex items-center justify-between text-sm">
                    <span>Base price ({totalQty || 0} × £{product.price.toFixed(2)})</span>
                    <span data-testid="price-base">£{((product.price || 0) * totalQty).toFixed(2)}</span>
                  </div>
                  {Object.entries(product.size_upcharges || {}).some(([sz]) => (sizeQtys[sz] || 0) > 0) && (
                    <div className="flex items-center justify-between text-sm mt-1 text-neutral-300">
                      <span>Size upcharges</span>
                      <span data-testid="price-upcharge">£{Object.entries(sizeQtys).reduce((s, [sz, q]) => s + ((product.size_upcharges?.[sz] || 0) * (Number(q) || 0)), 0).toFixed(2)}</span>
                    </div>
                  )}
                  {printCostPerGarment > 0 && (
                    <div className="flex items-center justify-between text-sm mt-1 text-neutral-300">
                      <span>Print ({selectedPlacements.length} placement{selectedPlacements.length > 1 ? "s" : ""} × £{printCostPerGarment.toFixed(2)} × {totalQty})</span>
                      <span data-testid="price-print">£{(printCostPerGarment * totalQty).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 mt-3 pt-3 flex items-baseline justify-between">
                    <span className="font-nunito font-extrabold">Total</span>
                    <span data-testid="price-total" className="text-[#7bc67e] font-nunito font-black text-4xl">£{lineTotal.toFixed(2)}</span>
                  </div>

                  <div className="mt-5 grid sm:grid-cols-2 gap-2">
                    <button
                      data-testid="add-to-cart"
                      onClick={onCheckout}
                      disabled={checkingOut || checkoutBlocked}
                      className="inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 disabled:cursor-not-allowed text-[#1a1a1a] font-nunito font-extrabold rounded-full px-5 py-3.5 shadow-md transition-transform hover:-translate-y-0.5"
                    >
                      {checkingOut
                        ? <><Loader2 className="animate-spin" size={16} /> Redirecting…</>
                        : blank
                          ? <><ShoppingCart size={16} /> Checkout (Blank)</>
                          : !allArtworkUploaded
                            ? <><Lock size={14} /> Upload prints to checkout</>
                            : <><ShoppingCart size={16} /> Checkout £{lineTotal.toFixed(2)}</>}
                    </button>
                    <button
                      data-testid="customise-design"
                      onClick={() => {
                        if (blank) { toast.error("Switch to 'Add Custom Print' first"); return; }
                        if (selectedPlacements.length === 0) { toast.error("Pick at least one print placement first"); return; }
                        const qs = new URLSearchParams({ product: product.id, placements: selectedPlacements.join(","), color: color || "" });
                        navigate(`/design?${qs.toString()}`);
                      }}
                      disabled={blank || selectedPlacements.length === 0}
                      className="inline-flex items-center justify-center gap-2 border-2 border-[#7bc67e] text-[#7bc67e] hover:bg-[#7bc67e] hover:text-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed font-nunito font-extrabold rounded-full px-5 py-3.5 transition-colors"
                    >
                      <Wand2 size={16} /> Upload your prints
                    </button>
                  </div>
                  <div className="text-xs text-neutral-400 mt-2">"Upload your prints" opens our designer for live previewing — or upload directly above and checkout.</div>
                </div>

                {/* Trust strip */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { icon: ShieldCheck, label: "UK based" },
                    { icon: Truck, label: "Fast dispatch" },
                    { icon: Sparkles, label: "Free logo design" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="bg-[#f0fdf4] rounded-xl p-3 border border-[#dcfce7] text-center">
                      <Icon size={20} className="mx-auto text-[#7bc67e]" />
                      <div className="mt-1 font-nunito font-bold text-[#1a1a1a]">{label}</div>
                    </div>
                  ))}
                </div>

                <BespokeQuoteCard productName={product.name} />
                <PricePromise variant="card" />

                <div className="bg-[#f0fdf4] rounded-2xl p-4 border border-[#dcfce7] flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-nunito font-bold text-[#1a1a1a]">Need instant help? Our UK team is on WhatsApp.</div>
                  <WhatsAppInline preset={`Hi! Question about the ${product.name}…`} label="WhatsApp" />
                </div>
              </div>
            </div>

            <ProductReviews productId={product.id} productName={product.name} />
          </>
        )}
      </div>

      <BoldFooter />
    </div>
  );
}

function Section({ title, right, children }) {
  return (
    <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-nunito font-extrabold text-[#1a1a1a]">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function ArtworkSlot({ placement, dataUrl, onPick, onRemove, testId }) {
  const ref = useRef(null);
  return (
    <div className={`rounded-xl border-2 p-3 transition-colors ${dataUrl ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-dashed border-[#e5e7eb] bg-white"}`} data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-nunito font-extrabold text-sm">{placement?.label}</span>
        {dataUrl
          ? <span className="inline-flex items-center gap-1 text-xs font-nunito font-bold text-[#7bc67e]"><Check size={12} /> Uploaded</span>
          : <span className="text-xs text-rose-500 font-nunito font-bold">Required</span>}
      </div>
      {dataUrl ? (
        <div className="flex items-center gap-2">
          <img src={dataUrl} alt="" className="w-16 h-16 object-contain bg-white rounded-lg border border-[#dcfce7] p-1" />
          <div className="flex flex-col gap-1.5">
            <button data-testid={`${testId}-replace`} onClick={() => ref.current?.click()} className="text-xs font-nunito font-extrabold bg-white border border-[#dcfce7] hover:border-[#7bc67e] rounded-full px-3 py-1.5 transition-colors">Replace</button>
            <button data-testid={`${testId}-remove`} onClick={onRemove} className="text-xs font-nunito font-extrabold text-rose-500 hover:bg-rose-50 rounded-full px-3 py-1.5 transition-colors inline-flex items-center gap-1"><Trash2 size={10} /> Remove</button>
          </div>
        </div>
      ) : (
        <button data-testid={`${testId}-upload`} onClick={() => ref.current?.click()} className="w-full bg-white hover:bg-[#f0fdf4] border border-dashed border-[#7bc67e] text-[#7bc67e] py-4 rounded-lg flex flex-col items-center gap-1 transition-colors">
          <Upload size={18} />
          <span className="text-xs font-nunito font-extrabold">Upload artwork</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
    </div>
  );
}
