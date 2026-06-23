import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import ProductReviews from "../components/bold/ProductReviews";
import PricePromise from "../components/bold/PricePromise";
import { api, fetchReviewsAggregate, fetchPlacements, createCheckout } from "../lib/api";
import { toast } from "sonner";
import { ArrowRight, ShieldCheck, Truck, Sparkles, Loader2, ShoppingCart, Wand2, Minus, Plus, Info, BadgeCheck, Shirt } from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [aggregates, setAggregates] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // selection state
  const [color, setColor] = useState(null);
  const [sizeQtys, setSizeQtys] = useState({});
  const [blank, setBlank] = useState(false);
  const [selectedPlacements, setSelectedPlacements] = useState([]);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/products/${id}`).then(r => r.data),
      fetchPlacements().catch(() => []),
      fetchReviewsAggregate().catch(() => ({})),
    ])
      .then(([p, pl, ag]) => {
        setProduct(p);
        setPlacements(pl);
        setAggregates(ag);
        setColor((p.colors && p.colors[0]?.name) || null);
        setSizeQtys({});
        setBlank(false);
        setSelectedPlacements([]);
      })
      .catch((e) => setErr(e?.response?.status === 404 ? "Product not found" : "Could not load product"))
      .finally(() => setLoading(false));
  }, [id]);

  const agg = aggregates[id];

  const placementById = useMemo(() => Object.fromEntries(placements.map(p => [p.id, p])), [placements]);

  const togglePlacement = (pid) => {
    if (blank) setBlank(false);
    setSelectedPlacements((prev) => {
      const has = prev.includes(pid);
      if (has) return prev.filter(x => x !== pid);
      // enforce exclusivity
      const excludes = placementById[pid]?.excludes || [];
      const next = prev.filter(x => !excludes.includes(x));
      // also remove this id from any other placement that excludes it
      const reverseExcl = placements
        .filter(p => p.excludes.includes(pid))
        .map(p => p.id);
      return [...next.filter(x => !reverseExcl.includes(x)), pid];
    });
  };

  const isPlacementDisabled = (pid) => {
    if (blank) return true;
    const excl = placementById[pid]?.excludes || [];
    return excl.some(e => selectedPlacements.includes(e));
  };

  const totalQty = useMemo(
    () => Object.values(sizeQtys).reduce((a, b) => a + (Number(b) || 0), 0),
    [sizeQtys]
  );
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

  const setSizeQty = (sz, q) => {
    const n = Math.max(0, Math.min(5000, Number(q) || 0));
    setSizeQtys((prev) => {
      const next = { ...prev };
      if (n === 0) delete next[sz];
      else next[sz] = n;
      return next;
    });
  };
  const bump = (sz, delta) => setSizeQty(sz, (sizeQtys[sz] || 0) + delta);

  const onCheckout = async () => {
    if (totalQty < 1) { toast.error("Add at least 1 item to a size"); return; }
    setCheckingOut(true);
    try {
      const { url } = await createCheckout({
        product_id: product.id,
        size_qtys: sizeQtys,
        color,
        placements: blank ? [] : selectedPlacements,
        blank,
        origin_url: window.location.origin,
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Checkout failed");
      setCheckingOut(false);
    }
  };

  const goCustomise = () => {
    if (totalQty < 1) { toast.error("Pick at least one size & quantity first"); return; }
    if (blank) { toast.error("Switch off 'Buy blank' to design a print"); return; }
    if (selectedPlacements.length === 0) { toast.error("Pick at least one print placement first"); return; }
    const qs = new URLSearchParams({
      product: product.id,
      placements: selectedPlacements.join(","),
      color: color || "",
    });
    navigate(`/design?${qs.toString()}`);
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-xs font-nunito font-bold text-[#4b5563] mb-4">
          <Link to="/" className="hover:text-[#7bc67e]">Home</Link>
          <span className="mx-2">/</span>
          <Link to={`/${product?.category === "workwear" ? "workwear" : product?.category === "teams-schools" ? "teams-schools" : ""}`} className="hover:text-[#7bc67e]">{product?.category || "Shop"}</Link>
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
                  <span className="text-xs text-[#4b5563]">
                    Total: <span data-testid="size-total-qty" className="font-nunito font-extrabold text-[#1a1a1a]">{totalQty}</span>
                  </span>
                }>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="size-grid">
                    {(product.sizes || []).map((sz) => {
                      const qty = sizeQtys[sz] || 0;
                      const upcharge = (product.size_upcharges || {})[sz] || 0;
                      const active = qty > 0;
                      return (
                        <div
                          key={sz}
                          data-testid={`size-row-${sz}`}
                          className={`rounded-xl border-2 p-2.5 transition-colors ${active ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-nunito font-extrabold text-sm">{sz}</span>
                            {upcharge > 0 && <span className="text-[10px] font-nunito font-bold text-[#4b5563]">+£{upcharge.toFixed(2)}</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            <button data-testid={`size-${sz}-minus`} onClick={() => bump(sz, -1)} className="w-7 h-7 grid place-items-center rounded-full bg-white border border-[#e5e7eb] hover:border-[#7bc67e] disabled:opacity-40" disabled={qty === 0}><Minus size={12} /></button>
                            <input
                              data-testid={`size-${sz}-qty`}
                              type="number"
                              min={0}
                              value={qty}
                              onChange={(e) => setSizeQty(sz, e.target.value)}
                              className="w-full text-center bg-transparent font-nunito font-extrabold text-sm focus:outline-none"
                            />
                            <button data-testid={`size-${sz}-plus`} onClick={() => bump(sz, 1)} className="w-7 h-7 grid place-items-center rounded-full bg-white border border-[#e5e7eb] hover:border-[#7bc67e]"><Plus size={12} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalQty > 0 && (
                    <div className="mt-3 text-xs text-[#4b5563]" data-testid="size-summary">
                      <Info size={12} className="inline mr-1" />
                      Ordering: {Object.entries(sizeQtys).filter(([, q]) => q > 0).map(([sz, q]) => `${sz}×${q}`).join(" · ")}
                    </div>
                  )}
                </Section>

                {/* Print placement */}
                <Section title="3. Print options" right={
                  <button
                    onClick={() => { setBlank(b => !b); if (!blank) setSelectedPlacements([]); }}
                    data-testid="buy-blank-toggle"
                    className={`text-xs font-nunito font-extrabold px-3 py-1.5 rounded-full transition-colors ${blank ? "bg-[#1a1a1a] text-white" : "bg-[#f0fdf4] text-[#1a1a1a] hover:bg-[#dcfce7]"}`}
                  >
                    {blank ? "✓ Buy Blank (no print)" : "Buy blank"}
                  </button>
                }>
                  <div className={`grid grid-cols-2 gap-2 ${blank ? "opacity-50 pointer-events-none" : ""}`} data-testid="placements-grid">
                    {placements.map((p) => {
                      const checked = selectedPlacements.includes(p.id);
                      const disabled = isPlacementDisabled(p.id);
                      return (
                        <label
                          key={p.id}
                          data-testid={`placement-${p.id}`}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                            checked ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white hover:border-[#dcfce7]"
                          } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => togglePlacement(p.id)}
                            className="w-4 h-4 accent-[#7bc67e]"
                            data-testid={`placement-${p.id}-checkbox`}
                          />
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
                    <span>Pick any combination — front & back, sleeves, breast logo. <strong>Full front replaces left/right breast.</strong> Or buy blank with no print.</span>
                  </div>
                </Section>

                {/* Price summary */}
                <div className="bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="price-summary">
                  <div className="flex items-center justify-between text-sm">
                    <span>Base price ({totalQty || 0} × £{product.price.toFixed(2)})</span>
                    <span data-testid="price-base">£{((product.price || 0) * totalQty).toFixed(2)}</span>
                  </div>
                  {Object.entries(product.size_upcharges || {}).some(([sz]) => (sizeQtys[sz] || 0) > 0) && (
                    <div className="flex items-center justify-between text-sm mt-1 text-neutral-300">
                      <span>Size upcharges</span>
                      <span data-testid="price-upcharge">
                        £{Object.entries(sizeQtys).reduce((s, [sz, q]) => s + ((product.size_upcharges?.[sz] || 0) * (Number(q) || 0)), 0).toFixed(2)}
                      </span>
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
                  <div className="text-xs text-neutral-400 mt-1">incl. free UK delivery on orders over £50 · Stripe secure checkout</div>

                  <div className="mt-5 grid sm:grid-cols-2 gap-2">
                    <button
                      data-testid="add-to-cart"
                      onClick={onCheckout}
                      disabled={checkingOut || totalQty < 1}
                      className="inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 text-[#1a1a1a] font-nunito font-extrabold rounded-full px-5 py-3.5 shadow-md transition-transform hover:-translate-y-0.5"
                    >
                      {checkingOut ? <><Loader2 className="animate-spin" size={16} /> Redirecting…</> : <><ShoppingCart size={16} /> {blank ? "Checkout (Blank)" : "Checkout"}</>}
                    </button>
                    <button
                      data-testid="customise-design"
                      onClick={goCustomise}
                      disabled={blank || selectedPlacements.length === 0 || totalQty < 1}
                      className="inline-flex items-center justify-center gap-2 border-2 border-[#7bc67e] text-[#7bc67e] hover:bg-[#7bc67e] hover:text-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed font-nunito font-extrabold rounded-full px-5 py-3.5 transition-colors"
                    >
                      <Wand2 size={16} /> Design these prints
                    </button>
                  </div>
                  <div className="text-xs text-neutral-400 mt-2">"Design these prints" lets you upload your logo & preview before paying.</div>
                </div>

                {/* Trust strip + price promise card */}
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
                <PricePromise variant="card" />
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-nunito font-extrabold text-[#1a1a1a]">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
