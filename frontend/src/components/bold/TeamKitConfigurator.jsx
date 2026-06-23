import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createCheckout, submitQuoteRequest, fetchTeamKitBrands } from "../../lib/api";
import { WhatsAppInline } from "./WhatsAppFAB";
import { Upload, Plus, Trash2, Loader2, ShoppingCart, Send, Info, Camera, Sparkles, Check } from "lucide-react";

const QUOTE_THRESHOLD = 15;
const DEFAULT_SIZE = "M";

/**
 * Single-team team-kit configurator with optional brand picker.
 * Sponsors are upload-for-proof only (no upcharge, no quote trigger).
 * Quote-only trigger: totalKits > 15.
 */
export default function TeamKitConfigurator({ product }) {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);
  const [brand, setBrand] = useState(null);          // selected brand object, null = default product
  const [team, setTeam] = useState({ name: "First Team", contact_name: "", contact_email: "", contact_phone: "", badge: null });
  const [roster, setRoster] = useState([blankRow()]);
  const [sponsors, setSponsors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const sponsorRef = useRef(null);

  useEffect(() => {
    fetchTeamKitBrands(product.id).then((b) => { setBrands(b); setBrand(b[0] || null); }).catch(() => {});
  }, [product.id]);

  const effectivePrice = brand?.price ?? product.price;
  const totalKits = useMemo(() => roster.reduce((s, r) => s + (Number(r.qty) || 0), 0), [roster]);
  const quoteOnly = totalKits > QUOTE_THRESHOLD;

  const upcharges = useMemo(() => product.size_upcharges || {}, [product.size_upcharges]);
  const lineTotal = useMemo(() => {
    let total = 0;
    roster.forEach((r) => {
      const qty = Number(r.qty) || 0;
      if (qty <= 0) return;
      total += (effectivePrice + (upcharges[r.size] || 0)) * qty;
    });
    return total;
  }, [roster, effectivePrice, upcharges]);

  const updateRoster = (i, patch) => setRoster((prev) => prev.map((r, j) => j === i ? { ...r, ...patch } : r));
  const addRow = () => setRoster((prev) => [...prev, blankRow()]);
  const removeRow = (i) => setRoster((prev) => prev.filter((_, j) => j !== i));
  const quickFill = (n) => setRoster(Array.from({ length: n }).map(() => blankRow()));

  const onPickBadge = (file) => readImage(file, (url) => setTeam((t) => ({ ...t, badge: url })));
  const onPickSponsors = (e) => {
    Array.from(e.target.files || []).forEach((f) => readImage(f, (url) => setSponsors((p) => [...p, url])));
    e.target.value = "";
  };
  const removeSponsor = (i) => setSponsors((prev) => prev.filter((_, idx) => idx !== i));

  const validate = () => {
    if (!team.name.trim()) return "Add a team / club name";
    if (!team.contact_email.trim()) return "Add a contact email";
    if (!team.badge) return "Upload your club badge";
    if (totalKits < 1) return "Add at least 1 player to the roster";
    if (roster.some((r) => !r.size)) return "Each player needs a size";
    return null;
  };

  const submitQuote = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const artwork = [team.badge, ...sponsors].filter(Boolean);
      const message = [
        `Product: ${product.name}${brand ? ` — Brand: ${brand.brand} ${brand.name} (£${brand.price.toFixed(2)})` : ` (£${product.price.toFixed(2)})`}`,
        `Total kits: ${totalKits}`,
        `Sponsors uploaded: ${sponsors.length} (to be arranged at proof stage)`,
        `Indicative total: £${lineTotal.toFixed(2)}`,
      ].join("\n");
      const cleanRoster = roster.map(r => ({ name: r.name, number: r.number, size: r.size, qty: Number(r.qty) || 1 }));
      await submitQuoteRequest({
        kind: "team_kit",
        name: team.contact_name || team.name,
        email: team.contact_email,
        phone: team.contact_phone,
        company: team.name,
        sport: product.id.includes("rugby") ? "rugby" : "football",
        kit_type: brand ? `${brand.brand} - ${brand.name}` : product.id,
        quantity: totalKits,
        message,
        artwork,
        roster: cleanRoster,
        product_id: product.id,
      });
      toast.success("Quote request sent! Free proof inbound 🎉");
      navigate("/team-kits");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not submit. Please try again.");
    } finally { setSubmitting(false); }
  };

  const directCheckout = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const size_qtys = {};
      roster.forEach((r) => { const q = Number(r.qty) || 0; if (q > 0) size_qtys[r.size] = (size_qtys[r.size] || 0) + q; });
      const rosterLines = roster.map(r => `${r.name || "—"}#${r.number || "—"}/${r.size}×${r.qty}`).join("|").slice(0, 380);
      // Note: we send the BASE product to backend (its price = product.price). Brand upcharge applied via design_meta upcharge.
      // Backend will compute base × qty + size_upcharges. Brand price diff is handled by a separate add-on… simplest: use brand price as our quoted base by adjusting per-kit via a synthetic upcharge isn't supported.
      // For MVP simplicity: only brands matching the base product price are used for direct checkout. Higher-priced brands force the quote flow.
      const { url } = await createCheckout({
        product_id: product.id,
        size_qtys,
        color: brand ? `${brand.brand} ${brand.name}` : "Default",
        placements: [],
        blank: false,
        origin_url: window.location.origin,
        design_meta: {
          flow: "team_kit_bundle",
          team_name: team.name,
          contact: team.contact_name || "",
          brand: brand ? `${brand.brand} ${brand.name} (£${brand.price.toFixed(2)})` : "Default",
          sponsors_count: String(sponsors.length),
          roster: rosterLines,
        },
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Checkout failed");
      setSubmitting(false);
    }
  };

  // If the chosen brand has a different price to the base product, force quote (Stripe path uses base price server-side).
  const brandRequiresQuote = !!brand && Math.abs(brand.price - product.price) > 0.001;
  const finalQuoteOnly = quoteOnly || brandRequiresQuote;

  return (
    <div className="space-y-5" data-testid="team-kit-configurator">
      {/* 1. Brand picker — only shown when ≥1 brand configured */}
      {brands.length > 0 && (
        <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5" data-testid="brand-picker">
          <h3 className="font-nunito font-extrabold text-[#1a1a1a] mb-3 flex items-center gap-2"><Sparkles size={16} className="text-[#7bc67e]" /> 1. Pick your kit</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {brands.map((b) => (
              <button
                key={b.id}
                data-testid={`brand-${b.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onClick={() => setBrand(b)}
                className={`text-left p-3 rounded-2xl border-2 transition-all ${brand?.id === b.id ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] hover:border-[#dcfce7]"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-nunito font-extrabold text-sm">{b.brand} · {b.name}</span>
                  {brand?.id === b.id && <Check size={16} className="text-[#7bc67e]" />}
                </div>
                <div className="text-xs text-[#4b5563] mt-1">{b.description || "—"}</div>
                <div className="mt-1 text-[#7bc67e] font-nunito font-extrabold">£{b.price.toFixed(2)}/player</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Team details */}
      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
        <h3 className="font-nunito font-extrabold text-[#1a1a1a] mb-3">{brands.length > 0 ? "2" : "1"}. Team details</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <LabeledInput label="Team / club name *" testId="team-0-name" v={team.name} onV={(v) => setTeam({ ...team, name: v })} />
          <LabeledInput label="Contact name" testId="team-0-contact-name" v={team.contact_name} onV={(v) => setTeam({ ...team, contact_name: v })} />
          <LabeledInput label="Contact email *" type="email" testId="team-0-contact-email" v={team.contact_email} onV={(v) => setTeam({ ...team, contact_email: v })} />
          <LabeledInput label="Contact phone" testId="team-0-contact-phone" v={team.contact_phone} onV={(v) => setTeam({ ...team, contact_phone: v })} />
        </div>
        <div className="mt-4">
          <div className="text-xs font-nunito font-bold text-[#1a1a1a] mb-2">Club badge *</div>
          <BadgeUpload badge={team.badge} onPick={onPickBadge} onClear={() => setTeam({ ...team, badge: null })} testId="team-0-badge" />
        </div>
      </div>

      {/* 3. Roster */}
      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-nunito font-extrabold text-[#1a1a1a]">{brands.length > 0 ? "3" : "2"}. Roster <span className="text-xs text-[#4b5563] font-bold">({roster.length} players · {totalKits} kits)</span></h3>
          <select data-testid="roster-quick-fill" onChange={(e) => quickFill(Number(e.target.value))} className="bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-3 py-1.5 text-xs font-bold" defaultValue="">
            <option value="" disabled>Quick add…</option>
            {[5, 11, 15, 18, 22, 25].map((n) => <option key={n} value={n}>{n} blank rows</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-nunito font-bold uppercase tracking-wider text-[#4b5563] px-2">
            <span className="col-span-5">Name on back</span><span className="col-span-2 text-center">No.</span><span className="col-span-2">Size</span><span className="col-span-2 text-center">Qty</span><span className="col-span-1" />
          </div>
          {roster.map((r, j) => (
            <div key={j} data-testid={`row-${j}`} className="grid grid-cols-12 gap-2 items-center bg-white border border-[#dcfce7] rounded-xl p-2">
              <input data-testid={`row-${j}-name`} value={r.name} onChange={(e) => updateRoster(j, { name: e.target.value })} placeholder="Name" className="col-span-5 bg-transparent px-2 py-1 text-sm focus:outline-none" />
              <input data-testid={`row-${j}-number`} value={r.number} onChange={(e) => updateRoster(j, { number: e.target.value })} placeholder="No." className="col-span-2 bg-transparent px-2 py-1 text-sm text-center focus:outline-none border-l border-[#dcfce7]" />
              <select data-testid={`row-${j}-size`} value={r.size} onChange={(e) => updateRoster(j, { size: e.target.value })} className="col-span-2 bg-transparent text-sm focus:outline-none">
                {(product.sizes || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input data-testid={`row-${j}-qty`} type="number" min={1} value={r.qty} onChange={(e) => updateRoster(j, { qty: e.target.value })} className="col-span-2 bg-transparent text-sm text-center focus:outline-none border-l border-[#dcfce7]" />
              <button data-testid={`row-${j}-remove`} onClick={() => removeRow(j)} className="col-span-1 text-rose-500 hover:bg-rose-50 rounded-full p-1 grid place-items-center"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button data-testid="add-row" onClick={addRow} className="mt-2 inline-flex items-center gap-1.5 text-sm font-nunito font-extrabold text-[#7bc67e] hover:underline"><Plus size={14} /> Add player</button>
      </div>

      {/* 4. Sponsors — upload-for-proof only */}
      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
        <h3 className="font-nunito font-extrabold text-[#1a1a1a]">{brands.length > 0 ? "4" : "3"}. Sponsor logos <span className="text-xs font-bold text-[#4b5563]">(optional)</span></h3>
        <div className="text-xs text-[#4b5563] mt-1 mb-3 leading-relaxed">
          The <strong>main sponsor goes on the front big</strong> by default. Additional sponsors can go on the front, back or sleeves — <strong>you tell us where at the proof stage</strong>. Upload everything you&apos;ve got; we&apos;ll arrange and send a free proof for sign-off.
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="sponsor-uploads">
          {sponsors.map((src, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl bg-white border border-[#dcfce7] overflow-hidden">
              <img src={src} alt="" className="w-full h-full object-contain p-1" />
              <button onClick={() => removeSponsor(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center">×</button>
            </div>
          ))}
          {sponsors.length < 12 && (
            <button data-testid="add-sponsor" onClick={() => sponsorRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-[#7bc67e] grid place-items-center text-[#7bc67e] hover:bg-[#f0fdf4]"><Plus size={18} /></button>
          )}
          <input ref={sponsorRef} type="file" accept="image/*" multiple hidden onChange={onPickSponsors} />
        </div>
        <div className="mt-2 text-xs text-[#4b5563]"><Info size={10} className="inline mr-1" />No upcharge — uploading sponsors won&apos;t increase your kit price.</div>
      </div>

      {/* Price summary + CTAs */}
      <div className="bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="kit-price-summary">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Indicative total</div>
            <div className="font-nunito font-black text-4xl mt-1" data-testid="kit-total-price">£{lineTotal.toFixed(2)}</div>
            <div className="text-xs text-neutral-400 mt-1">{totalKits} kits · £{effectivePrice.toFixed(2)}/player · badge + names + numbers included</div>
            {brand && brandRequiresQuote && <div className="text-xs text-[#7bc67e] mt-1">Premium brand {brand.brand} — confirmed in your quote</div>}
          </div>
          <div className="max-w-sm text-sm text-neutral-300">
            {finalQuoteOnly
              ? <>{quoteOnly ? "15+ kits — " : "Premium kit — "}we&apos;ll send a <strong className="text-[#7bc67e]">free proof</strong> and tailored quote within 1 working day.</>
              : <>Under 15 kits — pay securely with Stripe. We&apos;ll send a proof for sign-off before printing.</>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {finalQuoteOnly ? (
            <button data-testid="submit-quote" onClick={submitQuote} disabled={submitting} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5">
              {submitting ? <><Loader2 className="animate-spin" size={16} /> Sending…</> : <><Send size={16} /> Send quote request</>}
            </button>
          ) : (
            <>
              <button data-testid="kit-direct-checkout" onClick={directCheckout} disabled={submitting} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5">
                {submitting ? <><Loader2 className="animate-spin" size={16} /> Redirecting…</> : <><ShoppingCart size={16} /> Checkout £{lineTotal.toFixed(2)}</>}
              </button>
              <button data-testid="kit-quote-anyway" onClick={submitQuote} disabled={submitting} className="inline-flex items-center gap-2 border-2 border-[#7bc67e] hover:bg-[#7bc67e] hover:text-[#1a1a1a] text-[#7bc67e] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-colors">Get a quote first</button>
            </>
          )}
          <WhatsAppInline preset={`Hi! Team kit for ${team.name} (~${totalKits} kits${brand ? `, ${brand.brand}` : ""}).`} label="WhatsApp" />
        </div>
      </div>
    </div>
  );
}

function blankRow() { return { name: "", number: "", size: DEFAULT_SIZE, qty: 1 }; }
function readImage(file, onDone) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 800; const sc = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      onDone(c.toDataURL("image/png"));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function LabeledInput({ label, v, onV, type = "text", testId }) {
  return (
    <div>
      <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-1">{label}</label>
      <input data-testid={testId} type={type} value={v} onChange={(e) => onV(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm" />
    </div>
  );
}
function BadgeUpload({ badge, onPick, onClear, testId }) {
  const ref = useRef(null);
  return (
    <div className="flex items-center gap-4">
      <div className="w-24 h-24 rounded-2xl bg-[#f0fdf4] border-2 border-dashed border-[#7bc67e] grid place-items-center overflow-hidden">
        {badge ? <img src={badge} alt="" className="w-full h-full object-contain p-1.5" /> : <Camera className="text-[#7bc67e]" size={26} />}
      </div>
      <div className="flex flex-col gap-1.5">
        <button data-testid={`${testId}-upload`} onClick={() => ref.current?.click()} className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-4 py-2 rounded-full text-sm transition-colors inline-flex items-center gap-1.5">
          <Upload size={14} /> {badge ? "Replace" : "Upload badge"}
        </button>
        {badge && <button data-testid={`${testId}-clear`} onClick={onClear} className="text-xs font-nunito font-bold text-rose-500 hover:underline">Remove</button>}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
