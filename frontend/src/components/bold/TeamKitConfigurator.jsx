import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createCheckout, submitQuoteRequest, fetchTeamKitBrands, fetchTeamKitAddons } from "../../lib/api";
import { WhatsAppInline } from "./WhatsAppFAB";
import { Upload, Plus, Trash2, Loader2, ShoppingCart, Send, Info, Camera, Sparkles, Check, X } from "lucide-react";

const QUOTE_THRESHOLD = 15;
const DEFAULT_SIZE = "M";

/**
 * Single-team team-kit configurator with optional brand picker.
 * Print structure (per kit):
 *  - Club badge: required, free.
 *  - Front sponsor: optional, free, ONE upload max (front big).
 *  - Left sleeve: optional, +£3.00/kit, requires upload when toggled.
 *  - Right sleeve: optional, +£3.00/kit, requires upload when toggled.
 *  - Back print: optional, +£3.50/kit, requires upload when toggled.
 * Quote-only trigger: totalKits > 15.
 */
export default function TeamKitConfigurator({ product }) {
  const navigate = useNavigate();
  const isFrontOnly = product.id.endsWith("-front-only");
  const [brands, setBrands] = useState([]);
  const [brand, setBrand] = useState(null);
  const [addons, setAddons] = useState({});  // {left-sleeve: {price}, right-sleeve: {price}, back-print: {price}}
  const [team, setTeam] = useState({ name: "First Team", contact_name: "", contact_email: "", contact_phone: "", badge: null });
  const [roster, setRoster] = useState([blankRow()]);
  const [frontSponsor, setFrontSponsor] = useState(null);     // single image (data URL)
  const [leftSleeve, setLeftSleeve] = useState({ on: false, art: null });
  const [rightSleeve, setRightSleeve] = useState({ on: false, art: null });
  const [backPrint, setBackPrint] = useState({ on: false, art: null });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTeamKitBrands(product.id).then((b) => { setBrands(b); setBrand(b[0] || null); }).catch(() => {});
    fetchTeamKitAddons().then((list) => {
      setAddons(Object.fromEntries(list.map(a => [a.id, a])));
    }).catch(() => {});
  }, [product.id]);

  const effectivePrice = brand?.price ?? product.price;
  const totalKits = useMemo(() => roster.reduce((s, r) => s + (Number(r.qty) || 0), 0), [roster]);
  const quoteOnly = totalKits > QUOTE_THRESHOLD;

  const upcharges = useMemo(() => product.size_upcharges || {}, [product.size_upcharges]);
  const addonCostPerKit = useMemo(() => {
    let c = 0;
    if (leftSleeve.on)  c += addons["left-sleeve"]?.price  ?? 3.00;
    if (rightSleeve.on) c += addons["right-sleeve"]?.price ?? 3.00;
    if (backPrint.on)   c += addons["back-print"]?.price   ?? 3.50;
    return c;
  }, [leftSleeve.on, rightSleeve.on, backPrint.on, addons]);

  const selectedAddons = useMemo(() => {
    const list = [];
    if (leftSleeve.on)  list.push("left-sleeve");
    if (rightSleeve.on) list.push("right-sleeve");
    if (backPrint.on)   list.push("back-print");
    return list;
  }, [leftSleeve.on, rightSleeve.on, backPrint.on]);

  const lineTotal = useMemo(() => {
    let total = 0;
    roster.forEach((r) => {
      const qty = Number(r.qty) || 0;
      if (qty <= 0) return;
      total += (effectivePrice + (upcharges[r.size] || 0) + addonCostPerKit) * qty;
    });
    return total;
  }, [roster, effectivePrice, upcharges, addonCostPerKit]);

  const updateRoster = (i, patch) => setRoster((prev) => prev.map((r, j) => j === i ? { ...r, ...patch } : r));
  const addRow = () => setRoster((prev) => [...prev, blankRow()]);
  const removeRow = (i) => setRoster((prev) => prev.filter((_, j) => j !== i));
  const quickFill = (n) => setRoster(Array.from({ length: n }).map(() => blankRow()));

  const onPickBadge = (file) => readImage(file, (url) => setTeam((t) => ({ ...t, badge: url })));
  const onPickFrontSponsor = (file) => readImage(file, (url) => setFrontSponsor(url));
  const onPickSleeveArt = (file, side) => readImage(file, (url) => {
    if (side === "left")  setLeftSleeve((s) => ({ ...s, art: url }));
    if (side === "right") setRightSleeve((s) => ({ ...s, art: url }));
  });
  const onPickBackArt = (file) => readImage(file, (url) => setBackPrint((s) => ({ ...s, art: url })));

  const validate = () => {
    if (!team.name.trim()) return "Add a team / club name";
    if (!team.contact_email.trim()) return "Add a contact email";
    if (!team.badge) return "Upload your club badge";
    if (totalKits < 1) return "Add at least 1 player to the roster";
    if (roster.some((r) => !r.size)) return "Each player needs a size";
    if (leftSleeve.on  && !leftSleeve.art)  return "Upload artwork for the left sleeve (or untick it)";
    if (rightSleeve.on && !rightSleeve.art) return "Upload artwork for the right sleeve (or untick it)";
    if (backPrint.on   && !backPrint.art)   return "Upload artwork for the back print (or untick it)";
    return null;
  };

  const buildArtwork = () => [team.badge, frontSponsor, leftSleeve.art, rightSleeve.art, backPrint.art].filter(Boolean);

  const submitQuote = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const placementsHuman = [
        frontSponsor ? "front sponsor (free)" : null,
        leftSleeve.on ? `left sleeve (+£${(addons["left-sleeve"]?.price ?? 3).toFixed(2)})` : null,
        rightSleeve.on ? `right sleeve (+£${(addons["right-sleeve"]?.price ?? 3).toFixed(2)})` : null,
        backPrint.on ? `back print (+£${(addons["back-print"]?.price ?? 3.5).toFixed(2)})` : null,
      ].filter(Boolean).join(", ") || "badge only";
      const message = [
        `Product: ${product.name}${brand ? ` — Brand: ${brand.brand} ${brand.name} (£${brand.price.toFixed(2)})` : ` (£${product.price.toFixed(2)})`}`,
        `Total kits: ${totalKits}`,
        `Prints: ${placementsHuman}`,
        `Per-kit addon cost: £${addonCostPerKit.toFixed(2)}`,
        `Indicative total: £${lineTotal.toFixed(2)}`,
        isFrontOnly ? "FRONT-PRINT-ONLY variant — no names/numbers on backs." : "Includes badge, names & numbers.",
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
        artwork: buildArtwork(),
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
      const { url } = await createCheckout({
        product_id: product.id,
        size_qtys,
        color: brand ? `${brand.brand} ${brand.name}` : "Default",
        placements: selectedAddons,
        blank: false,
        origin_url: window.location.origin,
        design_meta: {
          flow: isFrontOnly ? "team_kit_front_only" : "team_kit_bundle",
          team_name: team.name,
          contact: team.contact_name || "",
          brand: brand ? `${brand.brand} ${brand.name} (£${brand.price.toFixed(2)})` : "Default",
          front_sponsor: frontSponsor ? "yes" : "no",
          left_sleeve: leftSleeve.on ? "yes" : "no",
          right_sleeve: rightSleeve.on ? "yes" : "no",
          back_print: backPrint.on ? "yes" : "no",
          roster: rosterLines,
        },
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Checkout failed");
      setSubmitting(false);
    }
  };

  const brandRequiresQuote = !!brand && Math.abs(brand.price - product.price) > 0.001;
  const finalQuoteOnly = quoteOnly || brandRequiresQuote;
  const stepBase = brands.length > 0 ? 1 : 0;

  return (
    <div className="space-y-5" data-testid="team-kit-configurator">
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

      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
        <h3 className="font-nunito font-extrabold text-[#1a1a1a] mb-3">{stepBase + 1}. Team details</h3>
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

      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-nunito font-extrabold text-[#1a1a1a]">{stepBase + 2}. Roster <span className="text-xs text-[#4b5563] font-bold">({roster.length} players · {totalKits} kits)</span></h3>
          <select data-testid="roster-quick-fill" onChange={(e) => quickFill(Number(e.target.value))} className="bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-3 py-1.5 text-xs font-bold" defaultValue="">
            <option value="" disabled>Quick add…</option>
            {[5, 11, 15, 18, 22, 25].map((n) => <option key={n} value={n}>{n} blank rows</option>)}
          </select>
        </div>
        {isFrontOnly && (
          <div className="text-xs text-[#4b5563] mb-2 italic">Front-print-only variant — names & numbers are not included. Names/numbers below are for your reference only.</div>
        )}
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

      {/* 4. Front sponsor — FREE, one only */}
      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5" data-testid="front-sponsor-block">
        <h3 className="font-nunito font-extrabold text-[#1a1a1a]">{stepBase + 3}. Front sponsor <span className="text-xs font-bold text-[#7bc67e]">— FREE · 1 logo</span></h3>
        <div className="text-xs text-[#4b5563] mt-1 mb-3">One main sponsor goes on the front big — included free. Skip if you don&apos;t have one.</div>
        <SingleSlot image={frontSponsor} onPick={onPickFrontSponsor} onClear={() => setFrontSponsor(null)} testId="front-sponsor" placeholder="Upload front sponsor" />
      </div>

      {/* 5. Extra prints (paid) */}
      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5" data-testid="extra-prints-block">
        <h3 className="font-nunito font-extrabold text-[#1a1a1a]">{stepBase + 4}. Extra prints <span className="text-xs font-bold text-[#4b5563]">(optional)</span></h3>
        <div className="text-xs text-[#4b5563] mt-1 mb-3">
          Add sleeve logos or a back print. Each priced per kit. Upload the artwork before checkout.<br />
          <span className="text-[#1a1a1a]"><Info size={10} className="inline mr-1" /><strong>Back print sits below the player&apos;s name &amp; number</strong> — names &amp; numbers are already included in your kit price.</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <AddonSlot
            testId="left-sleeve"
            label="Left sleeve"
            price={addons["left-sleeve"]?.price ?? 3.00}
            state={leftSleeve}
            onToggle={(on) => setLeftSleeve((s) => ({ ...s, on }))}
            onPick={(f) => onPickSleeveArt(f, "left")}
            onClear={() => setLeftSleeve((s) => ({ ...s, art: null }))}
          />
          <AddonSlot
            testId="right-sleeve"
            label="Right sleeve"
            price={addons["right-sleeve"]?.price ?? 3.00}
            state={rightSleeve}
            onToggle={(on) => setRightSleeve((s) => ({ ...s, on }))}
            onPick={(f) => onPickSleeveArt(f, "right")}
            onClear={() => setRightSleeve((s) => ({ ...s, art: null }))}
          />
          <AddonSlot
            testId="back-print"
            label="Back print"
            price={addons["back-print"]?.price ?? 3.50}
            state={backPrint}
            onToggle={(on) => setBackPrint((s) => ({ ...s, on }))}
            onPick={(f) => onPickBackArt(f)}
            onClear={() => setBackPrint((s) => ({ ...s, art: null }))}
          />
        </div>
      </div>

      {/* Price summary + CTAs */}
      <div className="bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="kit-price-summary">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Indicative total</div>
            <div className="font-nunito font-black text-4xl mt-1" data-testid="kit-total-price">£{lineTotal.toFixed(2)}</div>
            <div className="text-xs text-neutral-400 mt-1">
              {totalKits} kits · £{effectivePrice.toFixed(2)}/player
              {addonCostPerKit > 0 && <> + £{addonCostPerKit.toFixed(2)} extras</>}
              {isFrontOnly ? " · front print only" : " · badge + names + numbers included"}
            </div>
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
        <div className="mt-3 text-xs text-neutral-400"><Info size={10} className="inline mr-1" />Front sponsor is included free. Sleeves & back add extra cost per kit.</div>
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

function SingleSlot({ image, onPick, onClear, testId, placeholder }) {
  const ref = useRef(null);
  return (
    <div className="flex items-center gap-4">
      <div className="w-24 h-24 rounded-2xl bg-[#f0fdf4] border-2 border-dashed border-[#7bc67e] grid place-items-center overflow-hidden">
        {image ? <img src={image} alt="" className="w-full h-full object-contain p-1.5" data-testid={`${testId}-preview`} /> : <Camera className="text-[#7bc67e]" size={22} />}
      </div>
      <div className="flex flex-col gap-1.5">
        <button data-testid={`${testId}-upload`} onClick={() => ref.current?.click()} className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-4 py-2 rounded-full text-sm transition-colors inline-flex items-center gap-1.5">
          <Upload size={14} /> {image ? "Replace" : placeholder}
        </button>
        {image && <button data-testid={`${testId}-clear`} onClick={onClear} className="text-xs font-nunito font-bold text-rose-500 hover:underline">Remove</button>}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
      </div>
    </div>
  );
}

function AddonSlot({ testId, label, price, state, onToggle, onPick, onClear }) {
  const ref = useRef(null);
  return (
    <div className={`rounded-2xl border-2 p-3 transition-colors ${state.on ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white hover:border-[#dcfce7]"}`} data-testid={`addon-${testId}`}>
      <label className="flex items-center gap-2 cursor-pointer" data-testid={`addon-${testId}-toggle`}>
        <input type="checkbox" checked={state.on} onChange={(e) => onToggle(e.target.checked)} className="w-4 h-4 accent-[#7bc67e]" />
        <div className="flex-1">
          <div className="font-nunito font-extrabold text-sm">{label}</div>
          <div className="text-xs text-[#4b5563]">+£{price.toFixed(2)} per kit</div>
        </div>
      </label>
      {state.on && (
        <div className="mt-3 flex items-center gap-2">
          <div className="w-14 h-14 rounded-xl bg-white border border-[#dcfce7] grid place-items-center overflow-hidden flex-shrink-0">
            {state.art
              ? <img src={state.art} alt="" className="w-full h-full object-contain p-1" data-testid={`addon-${testId}-preview`} />
              : <Camera size={18} className="text-[#7bc67e]" />}
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <button data-testid={`addon-${testId}-upload`} onClick={() => ref.current?.click()} className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold text-xs px-3 py-1.5 rounded-full inline-flex items-center justify-center gap-1">
              <Upload size={12} /> {state.art ? "Replace" : "Upload"}
            </button>
            {state.art && <button data-testid={`addon-${testId}-clear`} onClick={onClear} className="text-[10px] font-nunito font-bold text-rose-500 hover:underline inline-flex items-center gap-0.5"><X size={10} /> Remove</button>}
            <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
          </div>
        </div>
      )}
    </div>
  );
}
