import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, ShoppingCart, Minus, Plus, Sparkles, Check } from "lucide-react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchDesignShopProduct } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useAccountDiscount, discounted } from "../context/CustomerAuthContext";
import { ExVat } from "../components/bold/PriceTag";
import usePageTitle from "../hooks/usePageTitle";

/**
 * Design Shop product page - a ready-made design printed on the customer's
 * choice of garment. No print options (the print is included): pick garment,
 * colour, sizes. The picture is a live mockup - the design laid onto the real
 * garment photo for the chosen colour, inside that garment's print area (the
 * same photos + print area set up in Admin > Designer products).
 * Prices/sizes/colours come from the server (/design-shop/product/:id) and
 * checkout re-prices server-side from design_meta.garment.
 */

export function DesignMockup({ garment, colour, designImage, className = "" }) {
  // The chosen colour's own photo; never another colour's (that would show the
  // wrong shade) - without one, a plain block of the colour, like the designer.
  const photo = colour ? colour.photo : garment?.photo || "";
  const pa = garment?.print_area || { x: 30, y: 22, w: 40, h: 42 };
  // Fade while a newly chosen colour's photo loads, so the previous colour is
  // never shown against the new colour name.
  const [loadedSrc, setLoadedSrc] = useState("");
  const loading = photo && loadedSrc !== photo;
  return (
    <div className={`relative w-full bg-[#faf5ff] rounded-3xl overflow-hidden ${className}`} data-testid="design-mockup">
      {loading && <div className="absolute inset-0 z-10 grid place-items-center"><Loader2 className="animate-spin text-[#a855f7]" size={28} /></div>}
      {photo ? (
        <img src={photo} alt="" onLoad={() => setLoadedSrc(photo)} onError={() => setLoadedSrc(photo)}
             className={`w-full h-auto block select-none transition-opacity duration-200 ${loading ? "opacity-30" : "opacity-100"}`} draggable="false" />
      ) : (
        <div className="w-full aspect-square" style={{ background: colour?.hex || "#e5e7eb" }} />
      )}
      {designImage && (
        <div className="absolute flex items-start justify-center pointer-events-none"
             style={{ left: `${pa.x}%`, top: `${pa.y}%`, width: `${pa.w}%`, height: `${pa.h}%` }}>
          <img src={designImage} alt="" className="max-w-full max-h-full object-contain" draggable="false" />
        </div>
      )}
    </div>
  );
}

export default function DesignShopProduct() {
  const { id } = useParams();
  const { addLine } = useCart();
  const accountPct = useAccountDiscount();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [garmentSlug, setGarmentSlug] = useState("");
  const [colourName, setColourName] = useState("");
  const [sizeQtys, setSizeQtys] = useState({});
  const [view, setView] = useState("mockup");   // "mockup" | "design"

  usePageTitle(d ? `${d.name} - Design Shop` : "Design Shop", { description: d?.description });

  useEffect(() => {
    let alive = true;
    setD(null); setError("");
    fetchDesignShopProduct(id)
      .then((x) => {
        if (!alive) return;
        setD(x);
        const g = x.garments?.[0];
        setGarmentSlug(g?.slug || "");
        setColourName(g?.colours?.[0]?.name || "");
      })
      .catch(() => alive && setError("Sorry, we couldn't find that design."));
    return () => { alive = false; };
  }, [id]);

  const garment = useMemo(() => (d?.garments || []).find((g) => g.slug === garmentSlug) || null, [d, garmentSlug]);
  // Warm the browser cache with this garment's colour photos so switching is instant.
  useEffect(() => {
    (garment?.colours || []).forEach((c) => { if (c.photo) { const im = new Image(); im.src = c.photo; } });
  }, [garment]);
  const colour = useMemo(() => (garment?.colours || []).find((c) => c.name === colourName) || garment?.colours?.[0] || null, [garment, colourName]);
  const totalQty = Object.values(sizeQtys).reduce((a, b) => a + (Number(b) || 0), 0);
  const unit = garment ? discounted(garment.price, accountPct) : 0;
  const total = useMemo(() => {
    if (!garment) return 0;
    return Object.entries(sizeQtys).reduce((s, [sz, q]) =>
      s + Math.round(discounted(garment.price + Number(garment.size_upcharges?.[sz] || 0), accountPct) * (Number(q) || 0) * 100) / 100, 0);
  }, [garment, sizeQtys, accountPct]);

  const pickGarment = (g) => {
    setGarmentSlug(g.slug);
    // keep the colour if the new garment has it, otherwise its first colour
    setColourName((cur) => (g.colours.some((c) => c.name === cur) ? cur : g.colours[0]?.name || ""));
    setSizeQtys((cur) => Object.fromEntries(Object.entries(cur).filter(([sz]) => g.sizes.includes(sz))));
  };
  const setQty = (sz, q) => setSizeQtys((prev) => {
    const n = Math.max(0, Math.min(500, Number(q) || 0));
    const next = { ...prev }; if (n === 0) delete next[sz]; else next[sz] = n; return next;
  });

  const add = () => {
    addLine({
      product_id: d.id,
      name: `${d.name} - ${garment.title}`,
      size_qtys: sizeQtys,
      color: colour?.name || null,
      placements: [],
      blank: false,
      design_meta: { garment: garment.slug, garment_name: garment.title },
    });
    setSizeQtys({});
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/design-shop" className="text-sm font-bold text-[#7c3aed] hover:underline">← Design Shop</Link>
        {error ? (
          <div className="py-20 text-center text-[#4b5563]">{error}</div>
        ) : !d ? (
          <div className="py-20 text-center text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={16} />Loading…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-4">
            <div className="min-w-0">
              {view === "mockup" && garment ? (
                <DesignMockup garment={garment} colour={colour} designImage={d.design_image} />
              ) : (
                <div className="bg-[#faf5ff] rounded-3xl p-8"><img src={d.design_image} alt={d.name} className="w-full h-auto" /></div>
              )}
              {garment && (
                <div className="mt-3 flex gap-2">
                  {[["mockup", `On the ${garment.title.toLowerCase()}`], ["design", "Design close-up"]].map(([k, l]) => (
                    <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 rounded-full text-xs font-extrabold border-2 ${view === k ? "bg-[#7c3aed] border-[#7c3aed] text-white" : "bg-white border-[#e9d5ff] hover:border-[#a855f7]"}`}>{l}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider bg-[#f3e8ff] text-[#7c3aed] rounded-full px-3 py-1"><Sparkles size={12} /> Design Shop</span>
              <h1 className="font-black text-4xl sm:text-5xl mt-3 leading-[1.05]">{d.name}</h1>
              {garment && (
                <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                  <span className="font-black text-3xl text-[#7c3aed]">£{unit.toFixed(2)}</span>
                  {unit < garment.price && <span className="text-sm text-[#9ca3af] line-through">£{garment.price.toFixed(2)}</span>}
                  <span className="text-sm text-[#4b5563]">{garment.title}, printed and ready to wear</span>
                </div>
              )}
              {d.description && <p className="text-[#4b5563] mt-3">{d.description.replace(/\s*\u2014\s*/g, " - ")}</p>}

              {d.garments.length === 0 ? (
                <div className="mt-6 bg-[#faf5ff] rounded-2xl p-5 text-sm text-[#4b5563]">This design isn&rsquo;t available to order just yet - please check back soon.</div>
              ) : (
                <>
                  <div className="mt-6">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#4b5563] mb-2">1. Choose your garment</div>
                    <div className="flex flex-wrap gap-2">
                      {d.garments.map((g) => (
                        <button key={g.slug} onClick={() => pickGarment(g)} data-testid={`ds-garment-${g.slug}`}
                          className={`px-4 py-2 rounded-2xl border-2 text-left ${g.slug === garmentSlug ? "border-[#7c3aed] bg-[#faf5ff]" : "border-[#e5e7eb] hover:border-[#a855f7]"}`}>
                          <div className="font-extrabold text-sm">{g.title}</div>
                          <div className="text-xs text-[#4b5563]">£{discounted(g.price, accountPct).toFixed(2)}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {garment && (
                    <div className="mt-6">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#4b5563] mb-2">2. Colour: <span className="text-[#1a1a1a] normal-case tracking-normal">{colour?.name}</span></div>
                      <div className="flex flex-wrap gap-2">
                        {garment.colours.map((c) => (
                          <button key={c.name} title={c.name} onClick={() => setColourName(c.name)} data-testid={`ds-colour-${c.name}`}
                            className={`w-9 h-9 rounded-full border-2 grid place-items-center ${c.name === colour?.name ? "border-[#7c3aed] ring-2 ring-[#e9d5ff]" : "border-[#e5e7eb]"}`}
                            style={{ background: c.hex || "#ccc" }}>
                            {c.name === colour?.name && <Check size={14} className="mix-blend-difference text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {garment && (
                    <div className="mt-6">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#4b5563] mb-2">3. Sizes &amp; quantity</div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {garment.sizes.map((sz) => (
                          <div key={sz} className="border-2 border-[#eef2f7] rounded-2xl p-2 text-center" data-testid={`ds-size-${sz}`}>
                            <div className="font-extrabold text-sm">{sz}</div>
                            {Number(garment.size_upcharges?.[sz] || 0) > 0 && <div className="text-[10px] text-[#4b5563]">+£{Number(garment.size_upcharges[sz]).toFixed(2)}</div>}
                            <div className="mt-1 flex items-center justify-center gap-1">
                              <button onClick={() => setQty(sz, (sizeQtys[sz] || 0) - 1)} className="w-6 h-6 rounded-full bg-[#f3f4f6] grid place-items-center" aria-label={`Fewer ${sz}`}><Minus size={11} /></button>
                              <input value={sizeQtys[sz] || 0} onChange={(e) => setQty(sz, e.target.value)} className="w-9 text-center text-sm font-bold bg-transparent" inputMode="numeric" />
                              <button onClick={() => setQty(sz, (sizeQtys[sz] || 0) + 1)} className="w-6 h-6 rounded-full bg-[#f3e8ff] grid place-items-center" aria-label={`More ${sz}`}><Plus size={11} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {garment.size_guide_table?.length > 0 && (
                        <details className="mt-3 text-sm">
                          <summary className="cursor-pointer font-extrabold text-[#7c3aed]">Size guide</summary>
                          <SizeTable rows={garment.size_guide_table} />
                        </details>
                      )}
                    </div>
                  )}

                  {garment && (
                    <div className="mt-6 bg-[#1a1a1a] text-white rounded-3xl p-6">
                      <div className="flex items-baseline justify-between">
                        <span className="font-extrabold">Total ({totalQty} item{totalQty === 1 ? "" : "s"})</span>
                        <div className="text-right">
                          <span className="font-black text-3xl text-[#c4b5fd]" data-testid="ds-total">£{total.toFixed(2)}</span>
                          <ExVat amount={total} zeroRated={garment.vat_zero_rated} className="text-[11px] text-white/60" />
                          {accountPct > 0 && <div className="text-[11px] text-[#86efac]">Includes your {accountPct}% regular-customer discount</div>}
                        </div>
                      </div>
                      <button onClick={add} disabled={totalQty < 1} data-testid="ds-add-to-basket"
                        className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#a855f7] hover:bg-[#9333ea] disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold py-3 rounded-full">
                        <ShoppingCart size={16} /> {totalQty < 1 ? "Choose your sizes" : "Add to basket"}
                      </button>
                      <p className="text-[11px] text-white/60 mt-3 text-center">Printed to order in the UK.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <BoldFooter />
    </div>
  );
}

function SizeTable({ rows }) {
  const cols = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (k !== "size" && !cols.includes(k)) cols.push(k); }));
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-[#e9d5ff]"><th className="text-left py-1.5 px-2">Size</th>{cols.map((c) => <th key={c} className="text-left py-1.5 px-2">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-[#f3e8ff]"><td className="py-1.5 px-2 font-extrabold">{r.size}</td>{cols.map((c) => <td key={c} className="py-1.5 px-2 text-[#4b5563]">{r[c] ?? "-"}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
