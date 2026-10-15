import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import usePageCopy from "../hooks/usePageCopy";
import usePageTitle from "../hooks/usePageTitle";
import JsonLd from "../components/bold/JsonLd";
import { submitQuoteRequest } from "../lib/api";
import { buildWhatsAppLink, RATING } from "../lib/data";
import { toast } from "sonner";
import {
  ArrowRight, Building2, UserCheck, FileText, Truck, Users, ShieldCheck, Shirt, RefreshCw, Gift, MessageCircle, Loader2, Check, Star, Upload,
} from "lucide-react";

/**
 * /corporate - uniform and merch for whole companies: bespoke pricing on 250+ garments, a named account
 * manager, BACS/card on proof approval (account terms for regulars), multi-site roll-outs, samples first,
 * staff order links (/staff-order-link), quick reorders. Quote form -> /quote-request kind "corporate".
 * Hero copy editable in Admin > Page copy > "Corporate & large orders" (usePageCopy("corporate")).
 */
const TIERS = [["10+", "10% off"], ["25+", "18% off"], ["100+", "28% off"], ["200+", "35% off"], ["250+", "Bespoke quote"]];

export default function Corporate() {
  usePageTitle("Corporate uniform & large orders", {
    description: "Branded uniform and merch for whole companies - bespoke pricing on 250+ garments, a named account manager, pay by BACS or card on proof approval, multi-site delivery, samples first and staff order links.",
  });
  const copy = usePageCopy("corporate", {});
  const hero = {
    eyebrow: copy.eyebrow || "Corporate & large orders",
    title: copy.title || "Uniform for the whole company. One contact, one invoice.",
    subtitle: copy.subtitle || "Bespoke pricing on 250+ garments, a named account manager, samples before you commit and delivery to every site - printed in Leicester.",
  };
  const [f, setF] = useState({ company: "", name: "", email: "", phone: "", quantity: "", deadline: "", garments: "", sites: "", message: "" });
  const [logo, setLogo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const pickLogo = (file) => {
    if (!file) return;
    if (file.size > 10_000_000) { toast.error("That file is over 10MB - send it by email instead"); return; }
    const r = new FileReader(); r.onload = () => setLogo({ name: file.name, data: r.result }); r.readAsDataURL(file);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!f.company.trim() || !f.name.trim() || !f.email.trim()) { toast.error("Add your company, name and email"); return; }
    setBusy(true);
    try {
      await submitQuoteRequest({
        kind: "corporate", company: f.company, name: f.name, email: f.email, phone: f.phone,
        quantity: parseInt(f.quantity, 10) || 0, deadline: f.deadline, kit_type: "corporate uniform",
        message: `Garments: ${f.garments || "-"}\nDelivery sites: ${f.sites || "-"}\n\n${f.message || ""}`.trim(),
        artwork: logo ? [logo.data] : [],
      });
      setSent(true);
    } catch (err) { toast.error(err?.response?.data?.detail?.[0]?.msg || err?.response?.data?.detail || "Couldn't send - please email us instead"); }
    finally { setBusy(false); }
  };

  const why = [
    { icon: UserCheck, title: "Your own account manager", body: "One named person handles your quotes, proofs, reorders and new starters - on WhatsApp, email or phone. No call centres, no bots." },
    { icon: FileText, title: "Pay by BACS or card", body: "Approve your proof, then pay by BACS bank transfer or card before we print. Purchase order numbers welcome. 30-day account terms for regular customers, subject to approval." },
    { icon: Truck, title: "Every site, one order", body: "Delivered to each branch, depot or office - or bagged per person. Roll it out in stages if that suits you better." },
    { icon: Shirt, title: "Sample first", body: "We'll make a sample garment with your logo before you commit to the full order - and the cost comes off your order." },
    { icon: ShieldCheck, title: "Your brand, every time", body: "Logo, colours and garments kept on file, so every reorder matches. Full-colour DTF as standard; embroidery and screen printing on request for big runs." },
    { icon: RefreshCw, title: "Quick reorders", body: "New starter? Tell us the name and size and it's sorted - your artwork and garments are already on file, so no stockholding needed." },
  ];
  const faq = [
    { q: "What counts as a large order?", a: "Our website prices already drop as you order more - up to 35% off at 200+ garments. From 250+ garments we'll put together a bespoke quote for you." },
    { q: "Can we pay on invoice?", a: "Yes. Once you've approved your proof we send an invoice - pay by BACS or card and we print. Regular customers can apply for 30-day account terms. Larger first orders may need a deposit." },
    { q: "Can we see a sample first?", a: "Yes - we'll make a sample garment with your logo before you commit, and the cost comes off your order." },
    { q: "Can you deliver to more than one site?", a: "Yes - to as many branches or offices as you need, or bagged and labelled per person." },
    { q: "How do we get everyone's sizes?", a: "Use a staff order link: share one link, every member of staff chooses their own garments and sizes, and you send us one order." },
    { q: "Do you embroider?", a: "We print with DTF as standard - sharper detail and every colour. Embroidery and screen printing are available on request for larger runs - just ask for a quote." },
  ];
  const input = "w-full border-2 border-[#dcfce7] focus:border-[#7bc67e] rounded-xl px-3 py-2.5 text-sm outline-none";

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="corporate-page">
      <BoldNavbar />
      <JsonLd id="corporate-faq" data={{ "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) }} />

      <section className="bg-[#1a1a1a] text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e] inline-flex items-center gap-2"><Building2 size={14} /> {hero.eyebrow}</div>
          <h1 className="font-black text-4xl sm:text-5xl lg:text-6xl mt-3 leading-tight max-w-4xl" data-testid="corporate-title">{hero.title}</h1>
          <p className="text-zinc-300 mt-5 text-base sm:text-lg max-w-2xl">{hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#corporate-quote" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full" data-testid="corporate-cta-quote">Get a quote <ArrowRight size={16} /></a>
            <a href={buildWhatsAppLink("Hi! I'm enquiring about uniform for our company - can I speak to an account manager?")} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5a] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full"><MessageCircle size={16} /> Talk to an account manager</a>
            <Link to="/staff-order-link" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 font-extrabold px-6 py-3 rounded-full">Staff order link</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-300">
            <span className="inline-flex items-center gap-1.5"><Star size={14} className="fill-amber-400 text-amber-400" /> {RATING.value} from {RATING.count} reviews</span>
            <span>✓ Bespoke pricing 250+</span><span>✓ BACS or card</span><span>✓ Multi-site delivery</span><span>✓ Samples first</span>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="font-black text-3xl sm:text-4xl text-center">Pricing that grows with your order</h2>
        <p className="text-center text-[#4b5563] mt-2">Website prices drop automatically as you order more - from 250 garments we quote you directly.</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8" data-testid="corporate-tiers">
          {TIERS.map(([q, d], i) => (
            <div key={q} className={`rounded-2xl p-5 text-center border-2 ${i === TIERS.length - 1 ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-[#f0fdf4] border-[#dcfce7]"}`}>
              <div className="font-black text-3xl">{q}</div>
              <div className={`font-extrabold mt-1 ${i === TIERS.length - 1 ? "text-[#7bc67e]" : "text-[#16a34a]"}`}>{d}</div>
              <div className={`text-[11px] mt-1 ${i === TIERS.length - 1 ? "text-zinc-400" : "text-[#4b5563]"}`}>garments</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f0fdf4] py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-black text-3xl sm:text-4xl text-center">Built for companies</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {why.map((w) => (
              <div key={w.title} className="bg-white rounded-3xl p-6 border-2 border-[#dcfce7]">
                <w.icon className="text-[#16a34a]" size={24} />
                <h3 className="font-black text-lg mt-3">{w.title}</h3>
                <p className="text-sm text-[#4b5563] mt-2 leading-relaxed">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="bg-[#1a1a1a] text-white rounded-3xl p-8 sm:p-10 grid md:grid-cols-[1.4fr_1fr] gap-8 items-center" data-testid="corporate-staff-links">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e] inline-flex items-center gap-2"><Users size={14} /> Staff order links</div>
            <h2 className="font-black text-3xl mt-2">No more chasing staff for sizes.</h2>
            <p className="text-zinc-300 mt-3">Pick the uniform once and share one link. Every member of staff chooses their own garments and sizes - you can set how many each person can have. You see everyone&apos;s choices, then send us one order: pay by card or ask for an invoice.</p>
          </div>
          <div className="space-y-2 text-sm">
            {["1. Pick the uniform with your logo", "2. Share the link with your team", "3. Staff choose their sizes - nothing to pay", "4. You send one order - card or invoice"].map((t) => (
              <div key={t} className="bg-white/10 rounded-2xl px-4 py-3 font-bold">{t}</div>
            ))}
            <Link to="/staff-order-link" className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full">Set up a staff link - free <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-14">
        <div className="grid md:grid-cols-2 gap-5">
          <Link to="/bundles" className="rounded-3xl border-2 border-[#dcfce7] hover:border-[#7bc67e] p-6 block">
            <Gift className="text-[#16a34a]" size={24} />
            <h3 className="font-black text-xl mt-3">Merch & events</h3>
            <p className="text-sm text-[#4b5563] mt-1">Conference tees, giveaways, totes and caps - bundle deals with your logo included.</p>
            <span className="text-sm font-extrabold text-[#16a34a] inline-flex items-center gap-1 mt-3">See bundles <ArrowRight size={14} /></span>
          </Link>
          <Link to="/website-ad-services" className="rounded-3xl border-2 border-[#dcfce7] hover:border-[#7bc67e] p-6 block">
            <Building2 className="text-[#16a34a]" size={24} />
            <h3 className="font-black text-xl mt-3">More than clothing</h3>
            <p className="text-sm text-[#4b5563] mt-1">Free logo design, websites from £200 and ads set up properly - help to look professional for less.</p>
            <span className="text-sm font-extrabold text-[#16a34a] inline-flex items-center gap-1 mt-3">Websites & ads <ArrowRight size={14} /></span>
          </Link>
        </div>
      </section>

      <section id="corporate-quote" className="bg-[#f0fdf4] py-14 sm:py-20 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-black text-3xl sm:text-4xl text-center">Get a corporate quote</h2>
          <p className="text-center text-[#4b5563] mt-2">Tell us what you need - your account manager comes back with ideas, a mock-up and a price.</p>
          {sent ? (
            <div className="mt-8 bg-white border-2 border-[#7bc67e] rounded-3xl p-8 text-center" data-testid="corporate-sent">
              <Check size={36} className="mx-auto text-[#7bc67e]" />
              <h3 className="font-black text-2xl mt-2">Thanks - we&apos;ve got it</h3>
              <p className="text-[#4b5563] mt-1">Your account manager will be in touch with a mock-up and a price.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 bg-white border-2 border-[#dcfce7] rounded-3xl p-6 space-y-3" data-testid="corporate-form">
              <div className="grid sm:grid-cols-2 gap-3">
                {[["company", "Company *"], ["name", "Your name *"], ["email", "Email *"], ["phone", "Phone"], ["quantity", "Roughly how many garments?"], ["deadline", "When do you need them?"]].map(([k, ph]) => (
                  <input key={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} type={k === "email" ? "email" : k === "quantity" ? "number" : "text"} className={input} data-testid={`corp-${k}`} />
                ))}
              </div>
              <input value={f.garments} onChange={(e) => setF({ ...f, garments: e.target.value })} placeholder="Garments - e.g. polos, softshells, hi-vis" className={input} data-testid="corp-garments" />
              <input value={f.sites} onChange={(e) => setF({ ...f, sites: e.target.value })} placeholder="How many sites to deliver to?" className={input} />
              <textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} rows={3} placeholder="Anything else - colours, print positions, a sample first, invoice / PO details..." className={input} />
              <label className="flex items-center gap-3 border-2 border-dashed border-[#dcfce7] rounded-xl px-4 py-3 cursor-pointer text-sm">
                <Upload size={16} className="text-[#16a34a]" /> {logo ? <span className="font-bold">{logo.name}</span> : <span>Upload your logo (optional)</span>}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
              </label>
              <button type="submit" disabled={busy} className="w-full bg-[#1a1a1a] text-white font-extrabold py-3.5 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-60" data-testid="corp-submit">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Send my enquiry
              </button>
              <p className="text-[11px] text-[#4b5563] text-center">No obligation. We reply with a mock-up and a price.</p>
            </form>
          )}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="font-black text-3xl text-center">Questions companies ask</h2>
        <div className="mt-6 space-y-3">
          {faq.map((x) => (
            <details key={x.q} className="bg-white rounded-2xl border-2 border-[#dcfce7] p-4">
              <summary className="font-extrabold cursor-pointer">{x.q}</summary>
              <p className="text-sm text-[#4b5563] mt-2 leading-relaxed">{x.a}</p>
            </details>
          ))}
        </div>
      </section>
      <BoldFooter />
    </div>
  );
}
