import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import WhatsAppFAB, { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import { fetchLeaversProducts, fetchLeaversTiers, fetchLeaversTemplates, leaversBespoke, fetchPortfolio, mediaUrl } from "../lib/api";
import { buildWhatsAppLink } from "../lib/data";
import usePageCopy from "../hooks/usePageCopy";
import SiteImage from "../components/bold/SiteImage";
import { Sparkles, GraduationCap, Users, CalendarDays, Mail, Truck, ShieldCheck, Star, Package, ArrowRight, ChevronLeft, ChevronRight, Brush } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_HERO_IMAGES } from "../lib/defaultImages";

export default function LeaversHoodies() {
  const [products, setProducts] = useState([]);
  const [tiers, setTiers] = useState({ tiers: [], bag_price: 3.99 });
  const [templates, setTemplates] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [showBespoke, setShowBespoke] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeaversProducts().then(setProducts).catch(() => toast.error("Couldn't load products - please refresh"));
    fetchLeaversTiers().then(setTiers).catch(() => toast.error("Couldn't load pricing tiers - please refresh"));
    // The same designs customers pick from on the order page (Admin > Portfolio >
    // "Leavers designer - ... design choices") - add a design once, it shows in both.
    Promise.all(["leavers-back-designs", "leavers-front-designs", "leavers-full-front-designs"].map((c) =>
      fetchPortfolio({ category: c, limit: 40 }).then((d) => d.items || []).catch(() => [])))
      .then(([back, front, full]) => setDesigns([...back, ...full, ...front]));
    // older "Leavers templates" (Admin > Leavers templates) - shown only if they have a real photo
    fetchLeaversTemplates().then((ts) => setTemplates((ts || []).filter((t) => t.image && !/pexels\.com/.test(t.image)))).catch(() => setTemplates([]));
  }, []);
  const tiersAsc = [...(tiers.tiers || [])].sort((a, b) => a.min_qty - b.min_qty);

  const copy = usePageCopy("leavers-hoodies", {
    title: "",
    subtitle: "Hoodies, varsity jackets, sweatshirts and tees, adults and kids - printed in the UK in 7–10 days. Fill in your details, pick your garment and design, choose sizes, and we'll get cracking. Free proof before we print a thing.",
    // Swap in /admin/page-copy → Leavers Hoodies → Pictures & video.
    hero_image: DEFAULT_HERO_IMAGES["leavers-hoodies"],
  });

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen" data-testid="leavers-page">
      <BoldNavbar />
      <WhatsAppFAB preset="Hi! Quick question about leavers' hoodies for our year group." />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-20 -left-24 w-[500px] h-[500px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 w-[420px] h-[420px] rounded-full bg-[#fde68a]/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f0fdf4] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs">
              <GraduationCap size={14} className="text-[#7bc67e]" /> Class of 2026 · Year 11 · Year 13 · College
            </div>
            <h1 className="font-nunito font-black text-5xl lg:text-7xl mt-3 leading-[1.02]" data-testid="leavers-hero-title">
              {copy.title ? copy.title : (<>Leavers&apos; hoodies <span className="relative inline-block"><span className="relative z-10">done right.</span><span className="absolute left-0 right-0 bottom-1 h-3 bg-[#7bc67e] -z-0 rounded-full" /></span></>)}
            </h1>
            <p className="text-[#4b5563] mt-4 text-lg max-w-lg" data-testid="leavers-hero-subtitle">{copy.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                data-testid="leavers-start-cta"
                onClick={() => navigate("/leavers-hoodies/start")}
                className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform"
              >
                Start Leavers order <ArrowRight size={16} />
              </button>
              <button
                data-testid="leavers-bespoke-cta"
                onClick={() => setShowBespoke(true)}
                className="inline-flex items-center gap-2 bg-white hover:bg-[#fff7ed] border-2 border-[#fbbf24] text-[#1a1a1a] font-nunito font-extrabold px-6 py-3 rounded-full transition"
              >
                <Brush size={14} className="text-[#fbbf24]" /> Bespoke design
              </button>
              <WhatsAppInline preset="Hi! Quick question about leavers' hoodies." label="Chat on WhatsApp" />
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs text-[#4b5563]">
              <span className="inline-flex items-center gap-1"><ShieldCheck size={14} className="text-[#7bc67e]" /> Free proof before print</span>
              <span className="inline-flex items-center gap-1"><Truck size={14} className="text-[#7bc67e]" /> UK printed · 7–10 days</span>
              <span className="inline-flex items-center gap-1"><Star size={14} className="text-[#fde68a] fill-[#fde68a]" /> 4.9 from 800+ reviews</span>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl">
              <SiteImage src={copy.hero_image} className="w-full h-full object-cover" testid="leavers-hero-image" />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk tier ladder */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        <h2 className="font-nunito font-black text-3xl lg:text-4xl text-center">Bigger groups, better prices</h2>
        <p className="text-center text-[#4b5563] mt-2">The price drops as more classmates join.</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8 max-w-4xl mx-auto" data-testid="leavers-tier-ladder">
          <Tier label={tiersAsc[0] ? `1–${tiersAsc[0].min_qty - 1}` : "Any"} price="List price" sub="each garment's own price" />
          {tiersAsc.map((t) => (
            <Tier key={t.min_qty} testId={`tier-${t.min_qty}`} label={`${t.min_qty}+`} price={t.pct != null ? `${t.pct}% off` : `£${Number(t.unit_price).toFixed(2)}`} sub="every garment, adults and kids" highlight={t.min_qty === 60} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <span className="inline-flex items-center gap-2 bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-4 py-2 text-sm" data-testid="leavers-bag-callout">
            <Package size={14} className="text-[#7bc67e]" />
            Add a matching <strong className="text-[#1a1a1a]">printed drawstring bag</strong> for just <strong className="text-[#7bc67e]">£{Number(tiers.bag_price).toFixed(2)}</strong> each
          </span>
        </div>
      </div>

      {/* Garments - display-only carousel */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <h2 className="font-nunito font-black text-3xl lg:text-4xl">Pick your garment</h2>
        <p className="text-[#4b5563] mt-2">Hoodies, varsity jackets, sweatshirts and tees - adult sizes and kids from age 7-8. You&apos;ll choose the colour during the order.</p>
        <ImageCarousel
          testid="leavers-garments-carousel"
          items={products.filter((p) => p.id !== "leavers-drawstring-bag").map((p) => ({
            id: p.id,
            image: p.image,
            title: p.name,
            sub: `From £${Math.min(p.price, ...Object.values(p.size_prices || {}).map((v) => v[0])).toFixed(2)}${(p.kids_sizes || []).length ? " (kids)" : ""}`,
          }))}
        />
      </div>

      {/* Design templates - display-only carousel */}
      <div className="bg-[#f0fdf4] py-14 border-y border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-nunito font-black text-3xl lg:text-4xl">Ready-to-go designs</h2>
          <p className="text-[#4b5563] mt-2">Start with one of these, or show us your own idea - we&apos;ll send a free proof either way.</p>
          <ImageCarousel
            testid="leavers-templates-carousel"
            items={[
              { id: "bespoke", onClick: () => setShowBespoke(true), node: (
                <div className="w-full h-full bg-gradient-to-br from-[#fff7ed] via-[#fef3c7] to-[#dcfce7] grid place-items-center p-6 text-center">
                  <div>
                    <Sparkles className="mx-auto text-[#f59e0b]" size={44} />
                    <div className="font-black text-2xl leading-tight mt-3">Your own design</div>
                    <div className="text-sm text-[#4b5563] mt-2 leading-snug">Got a design, or seen one you like? Show us and we&apos;ll make it for your year group.</div>
                    <div className="mt-4 inline-flex items-center gap-1.5 bg-[#1a1a1a] text-white text-xs font-extrabold px-4 py-2 rounded-full">Tell us your idea <ArrowRight size={13} /></div>
                  </div>
                </div>
              ), title: "Bespoke design", sub: "Free - we design it and send a proof before anything is printed." },
              ...designs.map((d) => ({ id: d.id, image: mediaUrl(d.thumb_url || d.image_url), title: d.title, sub: d.caption })),
              ...templates.map((t) => ({ id: t.id, image: t.image, title: t.title, sub: t.description })),
            ]}
          />
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        <h2 className="font-nunito font-black text-3xl lg:text-4xl text-center">How the order works</h2>
        <div className="grid md:grid-cols-4 gap-4 mt-8">
          <Step n={1} icon={<GraduationCap size={18} />} title="Your details" body="School, year group, contact info." />
          <Step n={2} icon={<Sparkles size={18} />} title="Pick garment + design" body="Choose from our pullover, zip, varsity or sweatshirt - then a ready-to-go design or send your own." />
          <Step n={3} icon={<Users size={18} />} title="Sizes &amp; quantities" body="Tap in how many of each size - the price drops live as the total grows." />
          <Step n={4} icon={<Mail size={18} />} title="Free proof, then ship" body="We email a free artwork proof. Sign off, pay, we print &amp; ship to one address in 7–10 days." />
        </div>
      </div>

      <div className="bg-[#1a1a1a] text-white py-14">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-nunito font-black text-3xl lg:text-4xl">Ready to start your year&apos;s hoodies?</h2>
          <p className="text-neutral-300 mt-3">Takes about 2 minutes. We do the rest.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button data-testid="leavers-start-cta-bottom" onClick={() => navigate("/leavers-hoodies/start")} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
              Start Leavers order <ArrowRight size={16} />
            </button>
            <button data-testid="leavers-bespoke-cta-bottom" onClick={() => setShowBespoke(true)} className="inline-flex items-center gap-2 bg-white text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full border-2 border-[#fbbf24]">
              <Brush size={14} className="text-[#fbbf24]" /> Bespoke design
            </button>
          </div>
        </div>
      </div>

      <BoldFooter />

      {showBespoke && (
        <BespokeModal onClose={() => setShowBespoke(false)} />
      )}
    </div>
  );
}

function Tier({ label, price, sub, highlight, testId }) {
  return (
    <div data-testid={testId} className={`rounded-2xl border-2 p-4 text-center ${highlight ? "border-[#7bc67e] bg-[#f0fdf4] -translate-y-1 shadow-md" : "border-[#dcfce7] bg-white"}`}>
      <div className="text-xs uppercase tracking-wider text-[#4b5563] font-nunito font-extrabold">{label}</div>
      <div className="font-nunito font-black text-2xl text-[#1a1a1a] mt-1">{price}</div>
      <div className="text-[10px] text-[#4b5563] mt-1">{sub}</div>
    </div>
  );
}
function Step({ n, icon, title, body }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#dcfce7] p-5">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-[#7bc67e] text-[#1a1a1a] grid place-items-center font-nunito font-black text-sm">{n}</span>
        <span className="text-[#7bc67e]">{icon}</span>
      </div>
      <div className="font-nunito font-extrabold mt-3">{title}</div>
      <div className="text-xs text-[#4b5563] mt-1" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}

// ---- Display-only horizontal carousel (no clicks, just scroll/arrow nav) ----
function ImageCarousel({ items, testid }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * 320, behavior: "smooth" });
  };
  if (!items || items.length === 0) return <div className="text-sm text-[#4b5563] mt-6">No items yet.</div>;
  return (
    <div className="relative mt-6" data-testid={testid}>
      <div ref={ref} className="flex gap-4 overflow-x-auto scroll-smooth pb-3 snap-x snap-mandatory" style={{ scrollbarWidth: "thin" }}>
        {items.map((it) => (
          <div
            key={it.id}
            onClick={it.onClick}
            role={it.onClick ? "button" : undefined}
            className={`bg-white rounded-2xl border-2 overflow-hidden flex-shrink-0 w-72 snap-start ${it.onClick ? "cursor-pointer border-[#fbbf24] hover:border-[#7bc67e] transition" : "border-[#dcfce7] cursor-default"}`}
            data-testid={`${testid}-item-${it.id}`}
          >
            <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
              {it.node || <img src={it.image} alt={it.title} className="w-full h-full object-cover" loading="lazy" />}
            </div>
            <div className="p-4">
              <div className="font-nunito font-extrabold">{it.title}</div>
              {it.sub && <div className="text-xs text-[#4b5563] mt-1 line-clamp-2">{it.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      {items.length > 2 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scroll(-1)}
            className="hidden sm:grid place-items-center absolute -left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] shadow"
            data-testid={`${testid}-prev`}
          ><ChevronLeft size={18} /></button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scroll(1)}
            className="hidden sm:grid place-items-center absolute -right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] shadow"
            data-testid={`${testid}-next`}
          ><ChevronRight size={18} /></button>
        </>
      )}
    </div>
  );
}

// ---- Bespoke quote modal ----
function BespokeModal({ onClose }) {
  const [form, setForm] = useState({ school: "", year_group: "", contact_name: "", contact_email: "", contact_phone: "", estimated_qty: 30, notes: "" });
  const [busy, setBusy] = useState(false);
  const canSubmit = form.school.trim() && form.year_group.trim() && form.contact_name.trim() && form.contact_email.trim() && Number(form.estimated_qty) >= 1;
  const submit = async () => {
    if (!canSubmit) { toast.error("Please fill in school, year, name, email and quantity."); return; }
    setBusy(true);
    try {
      await leaversBespoke({ ...form, estimated_qty: Number(form.estimated_qty) });
      toast.success("Thanks! We'll be in touch with design ideas.");
      onClose();
    } catch (e) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Couldn't send your request - please try WhatsApp instead.");
    } finally { setBusy(false); }
  };
  const waLink = buildWhatsAppLink(`Hi! Bespoke leavers' hoodie enquiry - ${form.school || "(school)"} ${form.year_group || "(year)"}, around ${form.estimated_qty || "?"} hoodies. ${form.notes || ""}`.trim());
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose} data-testid="leavers-bespoke-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl max-w-lg w-full p-6 relative">
        <button aria-label="Close" onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#f0fdf4] grid place-items-center" data-testid="leavers-bespoke-close">×</button>
        <div className="text-xs uppercase tracking-[0.3em] text-[#fbbf24] font-extrabold">Bespoke design</div>
        <h2 className="font-nunito font-black text-3xl mt-1">Tell us what you have in mind</h2>
        <p className="text-sm text-[#4b5563] mt-1">We&apos;ll mock up a custom design just for your year group - no charge for the proof.</p>
        <div className="grid sm:grid-cols-2 gap-2 mt-4">
          <Input testid="bespoke-school" label="School / college *" value={form.school} onChange={(v) => setForm({ ...form, school: v })} />
          <Input testid="bespoke-year" label="Year group *" value={form.year_group} onChange={(v) => setForm({ ...form, year_group: v })} placeholder="Year 11" />
          <Input testid="bespoke-name" label="Your name *" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
          <Input testid="bespoke-email" label="Email *" type="email" value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} />
          <Input testid="bespoke-phone" label="Phone (optional)" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} />
          <Input testid="bespoke-qty" label="Estimated qty *" type="number" min={1} value={form.estimated_qty} onChange={(v) => setForm({ ...form, estimated_qty: v })} />
        </div>
        <label className="block mt-3">
          <div className="text-[10px] uppercase tracking-wider text-[#4b5563] font-extrabold mb-1">Design notes (mascot, colours, leavers&apos; names, anything)</div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full bg-white border border-[#dcfce7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#7bc67e] resize-none"
            data-testid="bespoke-notes"
          />
        </label>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button onClick={submit} disabled={busy || !canSubmit} className="flex-1 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 text-[#1a1a1a] font-extrabold py-3 rounded-full inline-flex items-center justify-center gap-2" data-testid="bespoke-submit">
            {busy ? "Sending…" : "Send to our designers"}
          </button>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#25D366] hover:opacity-90 text-white font-extrabold py-3 rounded-full inline-flex items-center justify-center gap-2" data-testid="bespoke-whatsapp">
            WhatsApp us instead
          </a>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", min, placeholder, testid }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-[#4b5563] font-extrabold mb-1">{label}</div>
      <input
        type={type}
        value={value}
        min={min}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-[#dcfce7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#7bc67e]"
        data-testid={testid}
      />
    </label>
  );
}
