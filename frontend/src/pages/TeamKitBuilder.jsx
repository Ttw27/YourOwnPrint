import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import WhatsAppFAB, { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import { submitQuoteRequest, createCheckout } from "../lib/api";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Loader2, Trophy, Users, Sparkles, ArrowRight, Camera, ShoppingCart, Send } from "lucide-react";

const SPORTS = [
  { id: "football", label: "Football" },
  { id: "rugby", label: "Rugby" },
  { id: "netball", label: "Netball" },
  { id: "hockey", label: "Hockey" },
  { id: "cricket", label: "Cricket" },
  { id: "basketball", label: "Basketball" },
  { id: "other", label: "Other / Mixed" },
];
const KIT_TYPES = [
  { id: "home", label: "Home kit" },
  { id: "away", label: "Away kit" },
  { id: "training", label: "Training kit" },
  { id: "tracksuit", label: "Tracksuit" },
  { id: "full-package", label: "Full package (home+away+training)" },
];
const SIZES = ["3-4", "5-6", "7-8", "9-11", "12-13", "S", "M", "L", "XL", "XXL", "3XL"];

const KIT_PRICE_PER_PLAYER = 28.00;        // base — jersey + shorts
const NAME_NUMBER_ADDON = 3.00;            // per player
const SPONSOR_ADDON_PER_PLAYER = 2.50;     // per player when ≥1 sponsor
const QUOTE_THRESHOLD = 10;                // ≥10 → quote request, <10 → direct checkout

export default function TeamKitBuilder() {
  const [step, setStep] = useState(1);
  const [club, setClub] = useState({ name: "", contact_name: "", email: "", phone: "" });
  const [sport, setSport] = useState("football");
  const [kitType, setKitType] = useState("home");
  const [colors, setColors] = useState({ primary: "#1d4ed8", secondary: "#ffffff", accent: "#facc15" });
  const [badge, setBadge] = useState(null);            // data URL
  const [sponsors, setSponsors] = useState([]);        // array of data URLs
  const [namesNumbers, setNamesNumbers] = useState(true);
  const [roster, setRoster] = useState([{ name: "", number: "", size: "M", qty: 1 }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const badgeRef = useRef(null);
  const sponsorRef = useRef(null);

  const totalKits = useMemo(() => roster.reduce((s, r) => s + (Number(r.qty) || 0), 0), [roster]);
  const requiresQuote = totalKits >= QUOTE_THRESHOLD;
  const perKitPrice = KIT_PRICE_PER_PLAYER + (namesNumbers ? NAME_NUMBER_ADDON : 0) + (sponsors.length > 0 ? SPONSOR_ADDON_PER_PLAYER : 0);
  const totalPrice = (perKitPrice * totalKits).toFixed(2);

  const onPickImage = async (file, set) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 800;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        set(c.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const onBadgeFile = (e) => onPickImage(e.target.files?.[0], (d) => setBadge(d));
  const onSponsorFile = (e) => {
    Array.from(e.target.files || []).forEach((f) => onPickImage(f, (d) => setSponsors(prev => [...prev, d])));
    e.target.value = "";
  };
  const removeSponsor = (idx) => setSponsors(prev => prev.filter((_, i) => i !== idx));

  const updateRoster = (i, key, val) =>
    setRoster(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  const addRow = () => setRoster(prev => [...prev, { name: "", number: "", size: "M", qty: 1 }]);
  const removeRow = (i) => setRoster(prev => prev.filter((_, idx) => idx !== i));
  const fillSizes = (count) => setRoster(Array.from({ length: count }).map(() => ({ name: "", number: "", size: "M", qty: 1 })));

  const validateBasics = () => {
    if (!club.name.trim()) return "Please enter your club / team name.";
    if (!club.contact_name.trim() || !club.email.trim()) return "Please fill the contact name and email.";
    if (!badge) return "Please upload your club badge.";
    if (totalKits < 1) return "Add at least 1 kit to the roster.";
    return null;
  };

  const submitQuote = async () => {
    const err = validateBasics();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const artwork = [badge, ...sponsors].filter(Boolean);
      const cleanRoster = roster.map(r => ({ name: r.name, number: r.number, size: r.size, qty: Number(r.qty) || 1 }));
      const message = `Sport: ${sport}\nKit type: ${kitType}\nColours: primary ${colors.primary}, secondary ${colors.secondary}, accent ${colors.accent}\nNames+Numbers: ${namesNumbers ? "yes" : "no"}\nSponsors: ${sponsors.length}\nTotal kits: ${totalKits}\nNotes:\n${notes}`;
      await submitQuoteRequest({
        kind: "team_kit",
        name: club.contact_name,
        email: club.email,
        phone: club.phone,
        company: club.name,
        sport,
        kit_type: kitType,
        quantity: totalKits,
        message,
        artwork,
        roster: cleanRoster,
        product_id: sport === "rugby" ? "rugby-shirt" : "football-jersey",
      });
      toast.success("Quote request sent! We'll come back within 1 working day with a free artwork proof.");
      setStep(99);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const directCheckout = async () => {
    const err = validateBasics();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      // Aggregate sizes for pricing — direct checkout uses the football-jersey base product as a placeholder line.
      const size_qtys = {};
      roster.forEach(r => { if (Number(r.qty) > 0) size_qtys[r.size] = (size_qtys[r.size] || 0) + Number(r.qty); });
      const placements = ["full-front"]; // badge front
      if (sponsors.length > 0) placements.push("back-print");
      const { url } = await createCheckout({
        product_id: sport === "rugby" ? "rugby-shirt" : "football-jersey",
        size_qtys,
        color: "Custom",
        placements,
        origin_url: window.location.origin,
        design_meta: {
          flow: "team-kit-builder",
          club: club.name,
          sport,
          kit_type: kitType,
          names_numbers: namesNumbers ? "1" : "0",
          sponsors: String(sponsors.length),
        },
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Checkout failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <WhatsAppFAB preset="Hi! Quick question about the Team Kit Builder…" />

      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-6 py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f0fdf4] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs">
            <Trophy size={14} className="text-[#7bc67e]" /> Football · Rugby · Netball · Hockey · Cricket
          </div>
          <h1 className="mt-3 font-nunito font-black text-4xl lg:text-6xl leading-[1.05]">
            Team Kit <span className="text-[#7bc67e]">Builder</span>
          </h1>
          <p className="text-[#4b5563] mt-3 text-lg max-w-2xl">
            Upload your badge, sponsors and roster. Under 10 kits → straight to checkout.
            10+ kits → we'll review, send a free artwork proof and email a tailored quote within 1 working day.
          </p>
        </div>
      </div>

      {step === 99 ? (
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div className="mx-auto w-20 h-20 bg-[#7bc67e] rounded-full grid place-items-center"><Sparkles className="text-[#1a1a1a]" size={36} /></div>
          <h2 className="mt-5 font-nunito font-black text-3xl">Quote request sent! 🎉</h2>
          <p className="mt-3 text-[#4b5563]">We'll be in touch within 1 working day with a free proof and your tailored quote. Need anything urgent?</p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            <WhatsAppInline preset={`Hi! I just submitted a Team Kit quote for ${club.name}. Anything I can prep?`} label="WhatsApp us" />
            <Link to="/" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white font-nunito font-extrabold px-6 py-3 rounded-full transition-colors">Back to home</Link>
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
          {/* Step 1: Club + sport */}
          <Section step={1} title="Your club" data-testid="step-1">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Club / team name *" v={club.name} onV={(v) => setClub({ ...club, name: v })} testId="club-name" />
              <Field label="Contact name *" v={club.contact_name} onV={(v) => setClub({ ...club, contact_name: v })} testId="club-contact-name" />
              <Field label="Email *" type="email" v={club.email} onV={(v) => setClub({ ...club, email: v })} testId="club-email" />
              <Field label="Phone" v={club.phone} onV={(v) => setClub({ ...club, phone: v })} testId="club-phone" />
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <div>
                <Label>Sport</Label>
                <select data-testid="club-sport" value={sport} onChange={(e) => setSport(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm">
                  {SPORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Kit type</Label>
                <select data-testid="club-kit-type" value={kitType} onChange={(e) => setKitType(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm">
                  {KIT_TYPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <ColorField label="Primary kit colour" v={colors.primary} onV={(v) => setColors({ ...colors, primary: v })} testId="kit-color-primary" />
              <ColorField label="Secondary colour" v={colors.secondary} onV={(v) => setColors({ ...colors, secondary: v })} testId="kit-color-secondary" />
              <ColorField label="Accent / number colour" v={colors.accent} onV={(v) => setColors({ ...colors, accent: v })} testId="kit-color-accent" />
            </div>
          </Section>

          {/* Step 2: Badge */}
          <Section step={2} title="Club badge" data-testid="step-2">
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 rounded-2xl bg-[#f0fdf4] border-2 border-dashed border-[#7bc67e] grid place-items-center overflow-hidden">
                {badge ? <img src={badge} alt="badge" className="w-full h-full object-contain p-2" /> : <Upload className="text-[#7bc67e]" size={28} />}
              </div>
              <div>
                <button data-testid="upload-badge" onClick={() => badgeRef.current?.click()} className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-5 py-2.5 rounded-full text-sm transition-colors">
                  {badge ? "Replace badge" : "Upload club badge"}
                </button>
                <input type="file" accept="image/*" hidden ref={badgeRef} onChange={onBadgeFile} />
                <div className="text-xs text-[#4b5563] mt-2">PNG with transparent background works best.</div>
              </div>
            </div>
          </Section>

          {/* Step 3: Sponsors */}
          <Section step={3} title="Sponsor logos (optional)" data-testid="step-3">
            <div className="flex flex-wrap items-center gap-3">
              {sponsors.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl bg-white border border-[#dcfce7] overflow-hidden">
                  <img src={src} alt="" className="w-full h-full object-contain p-1" />
                  <button onClick={() => removeSponsor(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center">×</button>
                </div>
              ))}
              <button data-testid="upload-sponsors" onClick={() => sponsorRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-[#7bc67e] grid place-items-center text-[#7bc67e] hover:bg-[#f0fdf4]">
                <Plus size={20} />
              </button>
              <input type="file" accept="image/*" multiple hidden ref={sponsorRef} onChange={onSponsorFile} />
              <div className="text-xs text-[#4b5563] flex-1 min-w-[200px]">Add as many sponsors as you'd like. Front, back or sleeves — we'll arrange them on a free proof.</div>
            </div>
          </Section>

          {/* Step 4: Roster */}
          <Section
            step={4}
            title="Squad roster"
            right={
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-nunito font-bold">
                  <input type="checkbox" data-testid="names-numbers-toggle" checked={namesNumbers} onChange={(e) => setNamesNumbers(e.target.checked)} className="w-4 h-4 accent-[#7bc67e]" />
                  Names & numbers (+£{NAME_NUMBER_ADDON.toFixed(2)}/kit)
                </label>
                <select data-testid="roster-quick-fill" onChange={(e) => fillSizes(Number(e.target.value))} className="bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-3 py-1.5 text-xs font-bold" defaultValue="">
                  <option value="" disabled>Quick add…</option>
                  {[5, 11, 15, 18, 22, 25].map(n => <option key={n} value={n}>{n} blank rows</option>)}
                </select>
              </div>
            }
            data-testid="step-4"
          >
            <div className="space-y-2" data-testid="roster-list">
              {roster.map((r, i) => (
                <div key={i} data-testid={`roster-row-${i}`} className="grid grid-cols-12 gap-2 items-center bg-white border border-[#dcfce7] rounded-xl p-2">
                  <input data-testid={`roster-name-${i}`} value={r.name} onChange={(e) => updateRoster(i, "name", e.target.value)} placeholder="Name on back" className="col-span-5 bg-transparent px-2 py-1 text-sm focus:outline-none" />
                  <input data-testid={`roster-number-${i}`} value={r.number} onChange={(e) => updateRoster(i, "number", e.target.value)} placeholder="No." className="col-span-2 bg-transparent px-2 py-1 text-sm text-center focus:outline-none border-l border-[#dcfce7]" />
                  <select data-testid={`roster-size-${i}`} value={r.size} onChange={(e) => updateRoster(i, "size", e.target.value)} className="col-span-2 bg-transparent text-sm focus:outline-none">
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input data-testid={`roster-qty-${i}`} type="number" min={1} value={r.qty} onChange={(e) => updateRoster(i, "qty", e.target.value)} className="col-span-2 bg-transparent text-sm text-center focus:outline-none border-l border-[#dcfce7]" />
                  <button data-testid={`roster-remove-${i}`} onClick={() => removeRow(i)} className="col-span-1 text-rose-500 hover:bg-rose-50 rounded-full p-1 grid place-items-center"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button data-testid="add-roster-row" onClick={addRow} className="mt-3 inline-flex items-center gap-1.5 text-sm font-nunito font-extrabold text-[#7bc67e] hover:underline"><Plus size={14} /> Add player</button>
          </Section>

          {/* Step 5: Notes */}
          <Section step={5} title="Anything else?" data-testid="step-5">
            <textarea data-testid="roster-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Special requests, deadlines, season dates, sleeve sponsors, captain's armband, anything goes…" className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm" />
          </Section>

          {/* Summary */}
          <div className="bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="kit-summary">
            <div className="flex items-baseline justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Indicative total</div>
                <div className="font-nunito font-black text-4xl mt-1">£{totalPrice}</div>
                <div className="text-xs text-neutral-400 mt-1">{totalKits} kits · £{perKitPrice.toFixed(2)} per kit (jersey + shorts)</div>
              </div>
              <div className="max-w-sm text-sm text-neutral-300">
                {requiresQuote
                  ? <>10+ kits — we'll review your roster, send a <strong className="text-[#7bc67e]">free proof</strong> and email a tailored quote within 1 working day.</>
                  : <>Under 10 kits — pay securely with Stripe and we'll start production after sending you a proof for sign-off.</>}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {requiresQuote ? (
                <button data-testid="submit-quote" onClick={submitQuote} disabled={submitting} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5">
                  {submitting ? <><Loader2 className="animate-spin" size={16} /> Sending…</> : <><Send size={16} /> Send quote request</>}
                </button>
              ) : (
                <button data-testid="kit-direct-checkout" onClick={directCheckout} disabled={submitting} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5">
                  {submitting ? <><Loader2 className="animate-spin" size={16} /> Redirecting…</> : <><ShoppingCart size={16} /> Checkout £{totalPrice}</>}
                </button>
              )}
              <button data-testid="submit-quote-anyway" onClick={submitQuote} disabled={submitting} className="inline-flex items-center gap-2 border-2 border-[#7bc67e] hover:bg-[#7bc67e] hover:text-[#1a1a1a] text-[#7bc67e] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-colors">
                Get a quote first
              </button>
              <WhatsAppInline preset={`Hi! I'm building a team kit for ${club.name || "our club"} (${sport}, ~${totalKits} kits).`} label="WhatsApp" />
            </div>
          </div>
        </div>
      )}

      <BoldFooter />
    </div>
  );
}

function Section({ step, title, right, children, ...rest }) {
  return (
    <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5" {...rest}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-nunito font-extrabold text-[#1a1a1a] text-lg flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#7bc67e] text-[#1a1a1a] grid place-items-center font-black text-sm">{step}</span>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  );
}
function Label({ children }) { return <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-1">{children}</label>; }
function Field({ label, v, onV, type = "text", testId }) {
  return (
    <div>
      <Label>{label}</Label>
      <input data-testid={testId} type={type} value={v} onChange={(e) => onV(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm" />
    </div>
  );
}
function ColorField({ label, v, onV, testId }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input data-testid={testId} type="color" value={v} onChange={(e) => onV(e.target.value)} className="w-12 h-10 rounded-lg border border-[#e5e7eb]" />
        <input value={v} onChange={(e) => onV(e.target.value)} className="flex-1 bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm" />
      </div>
    </div>
  );
}
