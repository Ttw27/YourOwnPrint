import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import WhatsAppFAB, { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import { api, createCheckout, fetchFightNightAddons, fetchFightNightTiers } from "../lib/api";
import usePageCopy from "../hooks/usePageCopy";
import { toast } from "sonner";
import { Plus, Minus, Loader2, Send, Zap, Sparkles, ShieldCheck, Info, Camera, Upload } from "lucide-react";
import PortfolioCarousel from "../components/bold/PortfolioCarousel";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";

const SIZES = ["S", "M", "L", "XL", "XXL", "3XL"];

export default function FightNightTee() {
  const [tee, setTee] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const fnCopy = usePageCopy("fight-night", {
    title: "",
    subtitle: "Upload your sponsors, pay securely, and we'll send a free artwork proof before we print a thing. Nothing goes to print until you're happy.",
  });
  const [addons, setAddons] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [color, setColor] = useState("Black");
  const [sizeQtys, setSizeQtys] = useState({});
  const [sponsors, setSponsors] = useState([]);
  const [backPrint, setBackPrint] = useState(false);
  const [backArt, setBackArt] = useState(null);        // artwork data URL for back print
  const [leftSleeve, setLeftSleeve] = useState(false);
  const [leftArt, setLeftArt] = useState(null);
  const [rightSleeve, setRightSleeve] = useState(false);
  const [rightArt, setRightArt] = useState(null);
  const [eventDate, setEventDate] = useState("");
  const [contact, setContact] = useState({ name: "", email: "", phone: "", company: "" });
  const [submitting, setSubmitting] = useState(false);
  const sponsorRef = useRef(null);
  const backRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    Promise.all([api.get("/products/boxing-fight-tee").then(r => r.data), fetchFightNightAddons(), fetchFightNightTiers()])
      .then(([p, a, t]) => { setTee(p); setAddons(a); setTiers(t.tiers || []); setColor(p.colors[0]?.name || "Black"); })
      .catch(() => { toast.error("Couldn't load this page — please refresh"); setLoadError(true); });
  }, []);

  const totalQty = useMemo(() => Object.values(sizeQtys).reduce((a, b) => a + (Number(b) || 0), 0), [sizeQtys]);

  const tierUnitPrice = useMemo(() => {
    const baseDefault = tee?.price ?? 11.99;
    for (const t of tiers) if (totalQty >= t.min_qty) return t.unit_price;
    return baseDefault;
  }, [tiers, totalQty, tee]);
  const nextTier = useMemo(() => {
    const sortedAsc = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
    return sortedAsc.find((t) => totalQty < t.min_qty) || null;
  }, [tiers, totalQty]);
  const addonMap = useMemo(() => Object.fromEntries(addons.map(a => [a.id, a])), [addons]);
  const selectedAddons = useMemo(() => {
    const list = [];
    if (backPrint) list.push("back-print");
    if (leftSleeve) list.push("left-sleeve");
    if (rightSleeve) list.push("right-sleeve");
    return list;
  }, [backPrint, leftSleeve, rightSleeve]);
  const addonCostPerTee = selectedAddons.reduce((s, id) => s + (addonMap[id]?.price || 0), 0);
  const basePrice = tierUnitPrice;
  const baseListPrice = tee?.price ?? 11.99;
  const bulkSavingsPerTee = Math.max(0, baseListPrice - basePrice);
  const total = useMemo(() => {
    if (!tee) return 0;
    const upcharges = tee.size_upcharges || {};
    let t = 0;
    Object.entries(sizeQtys).forEach(([sz, q]) => {
      const qn = Number(q) || 0;
      if (qn <= 0) return;
      t += (basePrice + (upcharges[sz] || 0) + addonCostPerTee) * qn;
    });
    return t;
  }, [tee, sizeQtys, basePrice, addonCostPerTee]);

  const setSizeQty = (sz, q) => {
    const n = Math.max(0, Math.min(2000, Number(q) || 0));
    setSizeQtys(prev => { const next = { ...prev }; if (n === 0) delete next[sz]; else next[sz] = n; return next; });
  };
  const bump = (sz, d) => setSizeQty(sz, (sizeQtys[sz] || 0) + d);

  const onPickSponsors = (e) => {
    Array.from(e.target.files || []).slice(0, 30 - sponsors.length).forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 800; const sc = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          setSponsors(prev => [...prev, c.toDataURL("image/png")]);
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
    });
    e.target.value = "";
  };
  const removeSponsor = (i) => setSponsors(prev => prev.filter((_, idx) => idx !== i));

  const pickSingleArt = (e, setter) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 800; const sc = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        setter(c.toDataURL("image/png"));
      };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  };

  const validate = () => {
    if (!contact.name.trim() || !contact.email.trim()) return "Add your name and email";
    if (sponsors.length === 0) return "Upload at least one sponsor logo for the front";
    if (totalQty < 1) return "Pick at least 1 tee size & quantity";
    if (backPrint && !backArt) return "Upload artwork for the back print (or untick back print)";
    if (leftSleeve && !leftArt) return "Upload artwork for the left sleeve (or untick left sleeve)";
    if (rightSleeve && !rightArt) return "Upload artwork for the right sleeve (or untick right sleeve)";
    return null;
  };

  const checkout = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const designMeta = {
        flow: "fight_night_tee",
        contact_name: contact.name,
        contact_email: contact.email,
        contact_phone: contact.phone,
        company: contact.company,
        event_date: eventDate,
        color,
        sponsors_count: String(sponsors.length),
        back_print: backPrint ? "full" : "no",
        left_sleeve: leftSleeve ? "yes" : "no",
        right_sleeve: rightSleeve ? "yes" : "no",
        proof_before_print: "true",
      };
      // Pass sponsor data URLs via design_meta (split if necessary). For Stripe metadata size limits we store only count + send full artwork to a quote_requests doc shadow record so the team has the actual files.
      // Actually we'll persist sponsors in a quote_requests doc keyed by session_id reference (best-effort) for the team to access — backend will tie it via metadata.session_id after checkout.
      const { url, session_id } = await createCheckout({
        product_id: "boxing-fight-tee",
        size_qtys: sizeQtys,
        color,
        placements: selectedAddons,
        blank: false,
        origin_url: window.location.origin,
        design_meta: designMeta,
      });
      // Best-effort: also send artwork to /api/quote-request so we keep the actual logo files on file.
      try {
        await api.post("/quote-request", {
          kind: "fight_night",
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          sport: "boxing",
          kit_type: `fight-night-tee-${session_id}`,
          quantity: totalQty,
          deadline: eventDate,
          message: `PAID fight-night order. Sponsors: ${sponsors.length}. Back print: ${backPrint ? "full" : "no"}${backPrint && backArt ? " (art uploaded)" : ""}. Sleeves: ${leftSleeve ? "L" : ""}${rightSleeve ? "R" : ""}${(leftSleeve && leftArt) || (rightSleeve && rightArt) ? " (art uploaded)" : ""}. Stripe session: ${session_id}. Proof before print.`,
          artwork: [...sponsors, backArt, leftArt, rightArt].filter(Boolean),
          product_id: "boxing-fight-tee",
        });
      } catch { /* non-blocking quote sync */ }
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Checkout failed");
      setSubmitting(false);
    }
  };

  if (!tee) return (
    <div className="bg-white min-h-screen">
      <BoldNavbar />
      <div className="p-12 text-center">
        {loadError ? (
          <>
            <p className="text-sm text-[#4b5563]">Something went wrong loading this page.</p>
            <button onClick={() => window.location.reload()} className="mt-4 inline-flex bg-[#7bc67e] text-[#1a1a1a] font-extrabold px-5 py-2.5 rounded-full">Try again</button>
          </>
        ) : "Loading…"}
      </div>
    </div>
  );

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <WhatsAppFAB preset="Hi! Question about the fight-night tee…" />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-16 -left-16 w-[400px] h-[400px] rounded-full bg-[#fde68a]/35 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 w-[400px] h-[400px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1a1a1a] text-[#7bc67e] font-nunito font-extrabold rounded-full text-xs">
            <Zap size={14} /> Fight Night Sponsor Tee · Pay → Free Proof → Print
          </div>
          <h1 className="mt-3 font-nunito font-black text-4xl lg:text-6xl leading-[1.05]" data-testid="fn-hero-title">
            {fnCopy.title ? fnCopy.title : (<>Walk-out tees, <span className="text-[#7bc67e]">sorted.</span></>)}
          </h1>
          <p className="text-[#4b5563] mt-3 text-lg max-w-2xl" data-testid="fn-hero-subtitle">{fnCopy.subtitle}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        <ProofBanner />

        {/* Mockup gallery — admin-managed via /admin/portfolio (category: fight-night-action) */}
        <PortfolioCarousel
          category="fight-night-action"
          title="See the tee in action"
          eyebrow="Fight night gallery"
          emptyCTA="Send fight-night photos over WhatsApp — we'll add them here (and credit you)."
          emptyPreset="Hi! I have fight-night tee photos to share."
          testid="fn-portfolio-carousel"
        />

        <NeedHelpCTA
          title="Not confident laying out sponsors? Send it to us."
          body="Ping over your fight card, sponsor logos and any rough placement notes. We'll lay them out, tidy up any dodgy files, and send you a mock-up before printing — no charge."
          presetMessage="Hi! I need help laying out sponsors on my Fight Night Tees."
          testid="fn-need-help"
        />

        <Block n={1} title="Your details">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Your name *" v={contact.name} onV={(v) => setContact({ ...contact, name: v })} testId="fn-name" />
            <Field label="Email *" type="email" v={contact.email} onV={(v) => setContact({ ...contact, email: v })} testId="fn-email" />
            <Field label="Phone" v={contact.phone} onV={(v) => setContact({ ...contact, phone: v })} testId="fn-phone" />
            <Field label="Gym / promotion / fighter" v={contact.company} onV={(v) => setContact({ ...contact, company: v })} testId="fn-company" />
            <Field label="Event date" type="date" v={eventDate} onV={setEventDate} testId="fn-event-date" />
          </div>
        </Block>

        <Block n={2} title="Upload sponsor logos">
          <div className="text-xs text-[#4b5563] mb-3">
            The <strong>main sponsor goes on the front big</strong>. Upload all sponsors — we&apos;ll lay them out cleanly and send a free proof.
          </div>
          <div className="flex flex-wrap items-center gap-2" data-testid="fn-logos">
            {sponsors.map((src, i) => (
              <div key={i} className="relative w-16 h-16 rounded-xl bg-white border border-[#dcfce7] overflow-hidden">
                <img src={src} alt="" className="w-full h-full object-contain p-1" />
                <button onClick={() => removeSponsor(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center">×</button>
              </div>
            ))}
            {sponsors.length < 30 && (
              <button data-testid="fn-upload-logos" onClick={() => sponsorRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-[#7bc67e] grid place-items-center text-[#7bc67e] hover:bg-[#f0fdf4]"><Plus size={18} /></button>
            )}
            <input ref={sponsorRef} type="file" accept="image/*" multiple hidden onChange={onPickSponsors} />
          </div>
          <div className="text-xs text-[#4b5563] mt-2">{sponsors.length}/30 logos uploaded</div>
        </Block>

        <Block n={3} title="Back print (optional)">
          <label className="flex items-start gap-3 p-3 rounded-xl border-2 border-[#e5e7eb] cursor-pointer hover:border-[#dcfce7] transition-colors" data-testid="fn-back-toggle">
            <input type="checkbox" checked={backPrint} onChange={(e) => setBackPrint(e.target.checked)} className="mt-1 w-4 h-4 accent-[#7bc67e]" />
            <div className="flex-1">
              <div className="font-nunito font-extrabold text-sm">Add a print on the back</div>
              <div className="text-xs text-[#4b5563]">+£{addonMap["back-print"]?.price.toFixed(2) || "3.50"} per tee</div>
            </div>
          </label>
          {backPrint && (
            <>
              <div className="mt-3 text-xs text-[#4b5563] bg-[#f0fdf4] border border-[#dcfce7] rounded-xl px-3 py-2">
                Full back print — large logo or sponsor strip, your choice at proof stage. Upload the artwork below.
              </div>
              <div className="mt-3 flex items-center gap-3" data-testid="fn-back-upload-row">
                <div className="w-16 h-16 rounded-xl bg-white border border-[#dcfce7] grid place-items-center overflow-hidden flex-shrink-0">
                  {backArt ? <img src={backArt} alt="" className="w-full h-full object-contain p-1" data-testid="fn-back-art-preview" /> : <Camera size={18} className="text-[#7bc67e]" />}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-nunito font-bold text-[#1a1a1a]">Back print artwork *</div>
                  <button data-testid="fn-back-upload" onClick={() => backRef.current?.click()} className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold text-xs px-3 py-1.5 rounded-full inline-flex items-center justify-center gap-1 w-fit"><Upload size={12} /> {backArt ? "Replace" : "Upload back art"}</button>
                  {backArt && <button data-testid="fn-back-clear" onClick={() => setBackArt(null)} className="text-[10px] font-nunito font-bold text-rose-500 hover:underline w-fit">Remove</button>}
                  <input ref={backRef} type="file" accept="image/*" hidden onChange={(e) => pickSingleArt(e, setBackArt)} />
                </div>
              </div>
            </>
          )}
        </Block>

        <Block n={4} title="Sleeve prints (optional)">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className={`rounded-xl border-2 p-3 transition-colors ${leftSleeve ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb]"}`}>
              <label data-testid="fn-left-sleeve-toggle" className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={leftSleeve} onChange={(e) => setLeftSleeve(e.target.checked)} className="mt-1 w-4 h-4 accent-[#7bc67e]" />
                <div className="flex-1"><div className="font-nunito font-extrabold text-sm">Left sleeve</div><div className="text-xs text-[#4b5563]">+£{addonMap["left-sleeve"]?.price.toFixed(2) || "3.00"} per tee</div></div>
              </label>
              {leftSleeve && (
                <div className="mt-3 flex items-center gap-3" data-testid="fn-left-upload-row">
                  <div className="w-14 h-14 rounded-xl bg-white border border-[#dcfce7] grid place-items-center overflow-hidden flex-shrink-0">
                    {leftArt ? <img src={leftArt} alt="" className="w-full h-full object-contain p-1" data-testid="fn-left-art-preview" /> : <Camera size={16} className="text-[#7bc67e]" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button data-testid="fn-left-upload" onClick={() => leftRef.current?.click()} className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1 w-fit"><Upload size={12} /> {leftArt ? "Replace" : "Upload"}</button>
                    {leftArt && <button data-testid="fn-left-clear" onClick={() => setLeftArt(null)} className="text-[10px] font-nunito font-bold text-rose-500 hover:underline w-fit">Remove</button>}
                    <input ref={leftRef} type="file" accept="image/*" hidden onChange={(e) => pickSingleArt(e, setLeftArt)} />
                  </div>
                </div>
              )}
            </div>
            <div className={`rounded-xl border-2 p-3 transition-colors ${rightSleeve ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb]"}`}>
              <label data-testid="fn-right-sleeve-toggle" className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={rightSleeve} onChange={(e) => setRightSleeve(e.target.checked)} className="mt-1 w-4 h-4 accent-[#7bc67e]" />
                <div className="flex-1"><div className="font-nunito font-extrabold text-sm">Right sleeve</div><div className="text-xs text-[#4b5563]">+£{addonMap["right-sleeve"]?.price.toFixed(2) || "3.00"} per tee</div></div>
              </label>
              {rightSleeve && (
                <div className="mt-3 flex items-center gap-3" data-testid="fn-right-upload-row">
                  <div className="w-14 h-14 rounded-xl bg-white border border-[#dcfce7] grid place-items-center overflow-hidden flex-shrink-0">
                    {rightArt ? <img src={rightArt} alt="" className="w-full h-full object-contain p-1" data-testid="fn-right-art-preview" /> : <Camera size={16} className="text-[#7bc67e]" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button data-testid="fn-right-upload" onClick={() => rightRef.current?.click()} className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1 w-fit"><Upload size={12} /> {rightArt ? "Replace" : "Upload"}</button>
                    {rightArt && <button data-testid="fn-right-clear" onClick={() => setRightArt(null)} className="text-[10px] font-nunito font-bold text-rose-500 hover:underline w-fit">Remove</button>}
                    <input ref={rightRef} type="file" accept="image/*" hidden onChange={(e) => pickSingleArt(e, setRightArt)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Block>

        <Block n={5} title="Tee colour & sizes">
          <div className="text-xs font-nunito font-bold text-[#1a1a1a] mb-2">Colour</div>
          <div className="flex gap-2 mb-4">
            {tee.colors.map((c) => (
              <button key={c.name} data-testid={`fn-color-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => setColor(c.name)} title={c.name} className={`w-9 h-9 rounded-full border-2 ${color === c.name ? "border-[#7bc67e] ring-2 ring-[#7bc67e]/40" : "border-[#e5e7eb]"}`} style={{ background: c.hex }} />
            ))}
          </div>
          <div className="text-xs font-nunito font-bold text-[#1a1a1a] mb-2">Sizes (total <span data-testid="fn-total-qty" className="font-extrabold text-[#1a1a1a]">{totalQty}</span>)</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SIZES.map((sz) => {
              const qty = sizeQtys[sz] || 0; const active = qty > 0;
              return (
                <div key={sz} data-testid={`fn-size-${sz}`} className={`rounded-xl border-2 p-2 ${active ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white"}`}>
                  <div className="text-center font-nunito font-extrabold text-sm">{sz}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <button data-testid={`fn-size-${sz}-minus`} onClick={() => bump(sz, -1)} className="w-6 h-6 grid place-items-center rounded-full bg-white border disabled:opacity-40" disabled={qty === 0}><Minus size={10} /></button>
                    <input data-testid={`fn-size-${sz}-qty`} type="number" min={0} value={qty} onChange={(e) => setSizeQty(sz, e.target.value)} className="w-full text-center bg-transparent text-xs font-bold focus:outline-none" />
                    <button data-testid={`fn-size-${sz}-plus`} onClick={() => bump(sz, 1)} className="w-6 h-6 grid place-items-center rounded-full bg-white border"><Plus size={10} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </Block>

        {/* Bulk tier ladder */}
        {tiers.length > 0 && (
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-4" data-testid="fn-bulk-tiers">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="font-nunito font-extrabold text-sm">Bulk pricing for the corner</div>
              {bulkSavingsPerTee > 0 && <span className="text-[10px] uppercase tracking-wider font-nunito font-extrabold bg-[#7bc67e] text-[#1a1a1a] px-2 py-0.5 rounded-full" data-testid="fn-bulk-savings">Saving £{bulkSavingsPerTee.toFixed(2)}/tee</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className={`text-xs p-2 rounded-xl text-center ${totalQty < 10 ? "bg-[#7bc67e] text-[#1a1a1a]" : "bg-[#f0fdf4] text-[#4b5563]"}`}>
                <div className="font-nunito font-extrabold text-sm">£{baseListPrice.toFixed(2)}</div>
                <div className="text-[10px] mt-0.5">1–9 tees</div>
              </div>
              {[...tiers].sort((a, b) => a.min_qty - b.min_qty).map((t) => {
                const active = totalQty >= t.min_qty && (!nextTier || nextTier.min_qty > t.min_qty);
                return (
                  <div key={t.min_qty} data-testid={`fn-tier-${t.min_qty}`} className={`text-xs p-2 rounded-xl text-center ${active ? "bg-[#7bc67e] text-[#1a1a1a]" : "bg-[#f0fdf4] text-[#4b5563]"}`}>
                    <div className="font-nunito font-extrabold text-sm">£{t.unit_price.toFixed(2)}</div>
                    <div className="text-[10px] mt-0.5">{t.min_qty}+ tees</div>
                  </div>
                );
              })}
            </div>
            {nextTier && (
              <div className="text-[11px] text-[#4b5563] mt-2" data-testid="fn-next-tier-hint">
                Add <strong className="text-[#1a1a1a]">{nextTier.min_qty - totalQty}</strong> more to drop to <strong className="text-[#7bc67e]">£{nextTier.unit_price.toFixed(2)}/tee</strong>.
              </div>
            )}
          </div>
        )}

        {/* Total + Checkout */}
        <div className="bg-[#1a1a1a] text-white rounded-3xl p-6">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Tee base ({totalQty} × £{basePrice.toFixed(2)})</span><span>£{(basePrice * totalQty).toFixed(2)}</span></div>
            {Object.entries(tee.size_upcharges || {}).some(([sz]) => (sizeQtys[sz] || 0) > 0) && (
              <div className="flex justify-between text-neutral-300"><span>Size upcharges</span><span>£{Object.entries(sizeQtys).reduce((s, [sz, q]) => s + ((tee.size_upcharges?.[sz] || 0) * (Number(q) || 0)), 0).toFixed(2)}</span></div>
            )}
            {addonCostPerTee > 0 && (
              <div className="flex justify-between text-neutral-300"><span>Prints ({selectedAddons.length} extra × £{addonCostPerTee.toFixed(2)} × {totalQty})</span><span>£{(addonCostPerTee * totalQty).toFixed(2)}</span></div>
            )}
          </div>
          <div className="border-t border-white/10 mt-3 pt-3 flex items-baseline justify-between">
            <span className="font-nunito font-extrabold">Total</span>
            <span data-testid="fn-total" className="text-[#7bc67e] font-nunito font-black text-4xl">£{total.toFixed(2)}</span>
          </div>
          <div className="text-xs text-neutral-400 mt-1">Pay now → we send a <strong className="text-[#7bc67e]">free artwork proof</strong> → only then do we print.</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button data-testid="fn-checkout" onClick={checkout} disabled={submitting} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5">
              {submitting ? <><Loader2 className="animate-spin" size={16} /> Redirecting…</> : <><ShieldCheck size={16} /> Pay £{total.toFixed(2)} — proof before print</>}
            </button>
            <WhatsAppInline preset="Hi! Quick question about fight night tees…" label="WhatsApp" />
          </div>
        </div>
      </div>

      <BoldFooter />
    </div>
  );
}

function ProofBanner() {
  return (
    <div className="bg-[#f0fdf4] border-2 border-[#7bc67e] rounded-3xl p-4 flex items-start gap-3">
      <Sparkles className="text-[#7bc67e] flex-shrink-0 mt-1" size={20} />
      <div className="text-sm">
        <span className="font-nunito font-extrabold">How it works:</span>{" "}
        Pay today → we&apos;ll arrange your sponsors → email you a <strong>free proof for approval</strong> →{" "}
        <strong>nothing prints until you say it&apos;s perfect</strong>.
      </div>
    </div>
  );
}
function Block({ n, title, children }) {
  return (
    <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
      <h3 className="font-nunito font-extrabold text-[#1a1a1a] mb-3 flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-[#7bc67e] text-[#1a1a1a] grid place-items-center font-black text-sm">{n}</span>{title}
      </h3>
      {children}
    </div>
  );
}
function Field({ label, v, onV, type = "text", testId }) {
  return (
    <div>
      <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-1">{label}</label>
      <input data-testid={testId} type={type} value={v} onChange={(e) => onV(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm" />
    </div>
  );
}
