import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import usePageCopy from "../hooks/usePageCopy";
import usePageTitle from "../hooks/usePageTitle";
import { submitContact } from "../lib/api";
import { buildWhatsAppLink, RATING } from "../lib/data";
import { ORDERS_EMAIL } from "./EasyOrdering";
import {
  Star, Mail, MessageCircle, Loader2, CheckCircle2, Shirt, Printer, Package, Megaphone, ArrowRight,
} from "lucide-react";

/**
 * Business enquiry - a simple "tell us what you need" landing page for
 * businesses (like Printfection's): short pitch, one form, trust points,
 * what we do, how it works. Submissions go to the normal /contact endpoint,
 * so they land in Admin > Enquiries and the shop inbox. Deliberately no reply-
 * time promise. Headline/intro editable in Admin > Pages ("business-enquiry").
 */
const NEEDS = ["Workwear & uniforms", "Team, club or school kit", "Merch & event t-shirts", "Bulk pack / bundle",
  "Business website (£200)", "E-commerce shop (£1,000+)", "Ads (Facebook / Google / TikTok)", "White label printing", "Free logo design", "Something else"];
// ?service=... from the Website & Ad Services / Free Logo pages pre-selects the right one.
const SERVICE_PARAM = { website: "Business website (£200)", ecommerce: "E-commerce shop (£1,000+)", ads: "Ads (Facebook / Google / TikTok)", "white-label": "White label printing", logo: "Free logo design" };
const NOT_CLOTHING = ["Business website (£200)", "E-commerce shop (£1,000+)", "Ads (Facebook / Google / TikTok)", "Free logo design"];
const QTYS = ["1-10", "10-50", "50-100", "100-250", "250+"];

export default function BusinessEnquiry() {
  usePageTitle("Business Enquiries - Branded Clothing & Workwear", {
    description: "Branded workwear, uniforms and merch for your business. Tell us what you need and a real person will come back with ideas, a free mock-up and a price.",
  });
  const copy = usePageCopy("business-enquiry", {});
  const title = copy.title || "Branded clothing for your business, sorted.";
  const subtitle = copy.subtitle || "Uniforms, workwear, merch or event tees - tell us what you need and a real person from our team will come back with ideas, a free mock-up and a price.";

  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", sector: SERVICE_PARAM[params.get("service")] || NEEDS[0], quantity: QTYS[1], message: "" });
  const clothing = !NOT_CLOTHING.includes(form.sector);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) { toast.error("Please add your name, email and a short message"); return; }
    setSending(true);
    try {
      await submitContact({ ...form, message: `[Business enquiry - ${form.sector}${clothing ? `, approx ${form.quantity}` : ""}]\n\n${form.message}` });
      setSent(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail?.[0]?.msg || err?.response?.data?.detail || "Couldn't send - please email us instead");
    } finally { setSending(false); }
  };

  const ic = "w-full bg-white border-2 border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7bc67e]";
  const services = [
    [Shirt, "Workwear & uniforms", "Polos, tees, hoodies, hi-vis and trousers for your whole team.", "/workwear"],
    [Package, "Bulk packs", "Ready-made team packs with your logo on every item.", "/bundles"],
    [Megaphone, "Merch & events", "Event tees, totes and caps for launches, festivals and fundraisers.", "/festival-tees-and-brands"],
    [Printer, "Printing (embroidery & screen printing on request)", "Full-colour DTF prints as standard. Embroidery and screen printing available on request - quote only.", "/dtf-printing"],
  ];

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      {/* Hero + form */}
      <section className="bg-[#1a1a1a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-12 sm:py-16 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#7bc67e] font-extrabold rounded-full px-3 py-1 text-xs">For businesses</div>
            <h1 className="font-black text-4xl sm:text-5xl mt-4 leading-[1.05]" data-testid="biz-title">{title}</h1>
            <p className="text-neutral-300 mt-5 text-lg leading-relaxed">{subtitle}</p>
            <div className="mt-6 flex items-center gap-2 text-sm">
              <span className="inline-flex">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} className="text-amber-400 fill-amber-400" />)}</span>
              <span className="font-bold">{RATING.value} from {RATING.count} reviews</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-neutral-200">
              {["Printed in-house in the UK", "No minimum order", "Free digital proof before we print", "Your own account manager", "Pay by invoice or payment link"].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#7bc67e]" /> {t}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`mailto:${ORDERS_EMAIL}`} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 font-extrabold px-5 py-3 rounded-full text-sm"><Mail size={16} /> {ORDERS_EMAIL}</a>
              <a href={buildWhatsAppLink("Hi! I'm enquiring for my business - here's what we need:")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5b] font-extrabold px-5 py-3 rounded-full text-sm"><MessageCircle size={16} /> WhatsApp us</a>
            </div>
          </div>

          <div className="bg-white text-[#1a1a1a] rounded-3xl p-6 sm:p-8 shadow-xl" id="enquiry-form">
            {sent ? (
              <div className="text-center py-10" data-testid="biz-sent">
                <CheckCircle2 size={48} className="mx-auto text-[#7bc67e]" />
                <h2 className="font-black text-2xl mt-4">Thanks - we&rsquo;ve got it</h2>
                <p className="text-[#4b5563] mt-2">A real person from our team will be in touch. Need to add anything? Email {ORDERS_EMAIL}.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3" data-testid="biz-form">
                <h2 className="font-black text-2xl">Get a quote</h2>
                <p className="text-sm text-[#4b5563] -mt-1">Takes a minute. No obligation.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={form.name} onChange={set("name")} placeholder="Your name *" className={ic} data-testid="biz-name" />
                  <input value={form.company} onChange={set("company")} placeholder="Company" className={ic} data-testid="biz-company" />
                  <input type="email" value={form.email} onChange={set("email")} placeholder="Email *" className={ic} data-testid="biz-email" />
                  <input value={form.phone} onChange={set("phone")} placeholder="Phone" className={ic} data-testid="biz-phone" />
                  <select value={form.sector} onChange={set("sector")} className={ic} aria-label="What do you need?">{NEEDS.map((n) => <option key={n}>{n}</option>)}</select>
                  {clothing && <select value={form.quantity} onChange={set("quantity")} className={ic} aria-label="Roughly how many?">{QTYS.map((q) => <option key={q} value={q}>{`Roughly ${q} items`}</option>)}</select>}
                </div>
                <textarea value={form.message} onChange={set("message")} rows={4} placeholder="Tell us a bit about what you need - garments, colours, where the logo goes… *" className={ic + " resize-none"} data-testid="biz-message" />
                <button type="submit" disabled={sending} className="w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-extrabold rounded-full py-3.5" data-testid="biz-submit">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : null} Send my enquiry
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* What we do */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <h2 className="font-black text-3xl sm:text-4xl text-center">What we do for businesses</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
          {services.map(([Icon, t, d, to]) => (
            <Link key={t} to={to} className="border-2 border-[#eef2f7] hover:border-[#7bc67e] rounded-3xl p-6 transition-colors">
              <div className="w-11 h-11 rounded-2xl bg-[#f0fdf4] grid place-items-center"><Icon size={20} className="text-[#166534]" /></div>
              <p className="font-black text-lg mt-4">{t}</p>
              <p className="text-sm text-[#4b5563] mt-1.5">{d}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#f0fdf4] py-14">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-black text-3xl sm:text-4xl text-center">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-5 mt-10">
            {[["Tell us what you need", "Fill in the form, email or WhatsApp - as much or as little detail as you have."],
              ["Free mock-up & price", "We suggest garments, show your logo on them and give you a clear price."],
              ["We print & deliver", "Approve it, pay by invoice or payment link, and we print in the UK and send it over."]].map(([t, d], i) => (
              <div key={t} className="bg-white rounded-3xl p-6 border-2 border-[#dcfce7]">
                <div className="w-9 h-9 rounded-full bg-[#7bc67e] text-[#1a1a1a] grid place-items-center font-black">{i + 1}</div>
                <p className="font-black text-lg mt-4">{t}</p>
                <p className="text-sm text-[#4b5563] mt-1.5">{d}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="#enquiry-form" className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold px-6 py-3.5 rounded-full">Get a quote <ArrowRight size={16} /></a>
          </div>
        </div>
      </section>

      <BoldFooter />
    </div>
  );
}
