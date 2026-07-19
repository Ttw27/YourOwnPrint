import React, { useState } from "react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import PortfolioCarousel from "../components/bold/PortfolioCarousel";
import MediaBlock from "../components/bold/MediaBlock";
import { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import { submitContact } from "../lib/api";
import usePageCopy from "../hooks/usePageCopy";
import { toast } from "sonner";
import {
  Music, Shirt, Rocket, Sparkles, Send, CheckCircle2, Mail,
  PackageCheck, Wallet, Truck, Megaphone,
} from "lucide-react";

const DEFAULT_BENEFITS = [
  "No minimum order — print a single tour tee or a full festival run",
  "Your name, logo and artwork — nothing generic, nothing off-the-shelf",
  "Free artwork proof before anything goes to print",
  "Fast UK turnaround, ready in time for your next date",
];

const DEFAULT_BRAND_BENEFITS = [
  "No upfront cost — we only print when an order comes in",
  "No stock to buy, store or ship — we handle production and fulfilment",
  "Your own branded clothing line, live and ready to sell",
  "You set your price and keep the margin — we just handle the printing",
  "Perfect alongside gigs, socials, or your own website",
];

const DEFAULT_FAQ = [
  {
    q: "I've never done merch before — can you help me design it?",
    a: "Yes — send over a logo, a rough idea, or even just your name and a vibe, and our design team will mock something up for free before you commit to anything.",
  },
  {
    q: "What's the catch with \"no upfront cost\"?",
    a: "There isn't one. We print to order, so you're never paying for stock upfront or sitting on boxes of unsold tees. We agree your price, you promote it, and we print and ship as orders come in.",
  },
  {
    q: "How many do I need to order?",
    a: "As few as one. Whether it's a single festival date or an ongoing clothing line, there's no minimum order quantity.",
  },
];

export default function FestivalTeesAndBrands() {
  const copy = usePageCopy("festival-tees-brands", {
    title: "Festival Tees, Gig Merch & Your Own Clothing Line",
    subtitle:
      "Printed tops for tour dates, local gigs and festival sets — or launch your own branded clothing line with zero upfront cost. We print, you promote.",
    body: "",
    bullets: DEFAULT_BENEFITS,
    faq: DEFAULT_FAQ,
    cta_label: "Get in touch to discuss",
    cta_link: "#enquiry",
    // Admin-managed media for the promo block — image or short looping clip.
    // Set it in /admin/page-copy under "Festival Tees & Start Your Brand".
    media: {},
  });
  const brandBenefits = (copy.extras && copy.extras.brand_bullets) || DEFAULT_BRAND_BENEFITS;

  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in your name, email and a quick message.");
      return;
    }
    setSubmitting(true);
    try {
      await submitContact({ ...form, sector: "DJ / Festival / Own Clothing Brand" });
      toast.success("Thanks! We'll be in touch within 1 working day. 🎧");
      setForm({ name: "", email: "", phone: "", company: "", message: "" });
    } catch {
      toast.error("Something went wrong — please try again or WhatsApp us.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute -top-32 -right-20 w-[500px] h-[500px] rounded-full bg-[#7bc67e]/20 blur-3xl" />
        <div className="absolute top-10 -left-32 w-[400px] h-[400px] rounded-full bg-[#fde68a]/30 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f0fdf4] font-extrabold rounded-full text-xs">
            <Music size={14} className="text-[#7bc67e]" /> DJs · Promoters · Local Gigs · Festivals
          </div>
          <h1 className="font-black text-4xl lg:text-6xl mt-4 leading-tight" data-testid="festival-hero-title">
            {copy.title}
          </h1>
          <p className="text-lg text-[#4b5563] mt-5 max-w-2xl mx-auto">{copy.subtitle}</p>
          <a
            href={copy.cta_link || "#enquiry"}
            className="inline-flex items-center gap-2 mt-8 bg-[#1a1a1a] text-white font-extrabold px-7 py-4 rounded-full hover:bg-[#333] transition-colors"
            data-testid="festival-hero-cta"
          >
            {copy.cta_label} <Send size={16} />
          </a>
        </div>
      </div>

      {/* Section 1 — Festival / gig / DJ promo tees */}
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#7bc67e] uppercase tracking-widest">
              <Shirt size={14} /> Tour & festival merch
            </div>
            <h2 className="font-black text-3xl lg:text-4xl mt-3">Promo tops for your next date</h2>
            <p className="text-[#4b5563] mt-4">
              Whether it's a one-off gig or a full festival season, we print promotional tees and
              tops with your name, logo or set artwork — ready for you to sell or give away on the night.
            </p>
            <ul className="mt-6 space-y-3">
              {copy.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 size={18} className="text-[#7bc67e] flex-shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <MediaBlock
            media={copy.media?.promo}
            testid="festival-promo-media"
          >
            <Music size={64} className="text-[#7bc67e]" />
          </MediaBlock>
        </div>
      </div>

      {/* Gallery — admin-managed via /admin/portfolio, category "festival-tees-brands" */}
      <PortfolioCarousel
        category="festival-tees-and-brands"
        eyebrow="Out on the road"
        title="DJs & artists wearing our prints"
        emptyCTA="Got tour photos in our gear? Send them over and we'll feature them here."
        emptyPreset="Hi! I've got some tour photos wearing your prints to share."
      />

      {/* Section 2 — Start your own clothing brand, dropship */}
      <div className="bg-[#1a1a1a] text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="order-2 lg:order-1 rounded-3xl bg-white/5 aspect-square flex items-center justify-center">
              <Rocket size={64} className="text-[#7bc67e]" />
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#7bc67e] uppercase tracking-widest">
                <Sparkles size={14} /> Your name, your brand
              </div>
              <h2 className="font-black text-3xl lg:text-4xl mt-3">Start your own clothing line — no upfront cost</h2>
              <p className="text-neutral-300 mt-4">
                Thinking about launching your own merch line under your own name or logo? We'll print
                and ship it for you as a dropship service — no stock, no minimums, no money down. You
                focus on the brand and the promotion, we handle the rest.
              </p>
              <ul className="mt-6 space-y-3">
                {brandBenefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={18} className="text-[#7bc67e] flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* How it works */}
          <div className="grid sm:grid-cols-3 gap-6 mt-14">
            {[
              { icon: Megaphone, title: "1. Tell us your idea", body: "Your name, logo, or just a rough concept — we'll help shape it into a product." },
              { icon: PackageCheck, title: "2. We set it up", body: "Free artwork proof, pricing agreed together, ready to print on demand." },
              { icon: Wallet, title: "3. You promote, we fulfil", body: "Share it with your following — we print and ship each order, you keep your margin." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white/5 rounded-2xl p-6">
                <Icon size={22} className="text-[#7bc67e]" />
                <div className="font-extrabold mt-3">{title}</div>
                <div className="text-sm text-neutral-400 mt-1">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      {copy.faq?.length > 0 && (
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="font-black text-2xl text-center">Questions</h2>
          <div className="mt-8 space-y-6">
            {copy.faq.map((f, i) => (
              <div key={i}>
                <div className="font-extrabold">{f.q}</div>
                <p className="text-sm text-[#4b5563] mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enquiry form */}
      <div id="enquiry" className="bg-[#f0fdf4]">
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="text-center">
            <h2 className="font-black text-3xl">Let's talk it through</h2>
            <p className="text-[#4b5563] mt-3">
              Whether it's merch for your next date or launching your own brand — tell us a bit about
              it and we'll come back with ideas, no pressure.
            </p>
            {/* Two clearly-labelled routes. The WhatsApp button existed before
                but sat unlabelled under the heading, so it read as decoration
                rather than an alternative to the form. */}
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <a
                href="#festival-enquiry-form"
                className="inline-flex items-center justify-center gap-2 bg-white border-2 border-[#1a1a1a] text-[#1a1a1a] font-extrabold rounded-full px-5 py-3 text-sm hover:bg-[#1a1a1a] hover:text-white transition-colors"
                data-testid="festival-contact-email"
              >
                <Mail size={16} /> Email us
              </a>
              <WhatsAppInline
                preset="Hi! I'd like to chat about festival tees / starting my own clothing line."
                label="Message on WhatsApp"
              />
            </div>
            <p className="text-[11px] text-[#4b5563] mt-3">
              WhatsApp is usually quickest during the day &mdash; the form is better if you want to send artwork or dates.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 bg-white rounded-3xl border-2 border-[#dcfce7] p-6 sm:p-8 space-y-4 shadow-lg">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name *" value={form.name} onChange={update("name")} testId="festival-form-name" />
              <Field label="Email *" type="email" value={form.email} onChange={update("email")} testId="festival-form-email" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Phone" value={form.phone} onChange={update("phone")} testId="festival-form-phone" />
              <Field label="DJ name / brand name" value={form.company} onChange={update("company")} testId="festival-form-company" />
            </div>
            <div>
              <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-2">Tell us what you're after *</label>
              <textarea value={form.message} onChange={update("message")} rows={5}
                className="w-full bg-white border border-[#e5e7eb] focus:border-[#7bc67e] outline-none rounded-xl px-3 py-2.5"
                placeholder="A one-off gig tee, a festival run, or starting your own clothing line…"
                data-testid="festival-form-message" />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform"
              data-testid="festival-form-submit">
              {submitting ? "Sending…" : <>Send Enquiry <Send size={16} /></>}
            </button>
            <p className="text-xs text-[#4b5563]">We typically reply within 1 working day.</p>
          </form>
        </div>
      </div>

      <BoldFooter />
    </div>
  );
}

function Field({ label, value, onChange, type = "text", testId }) {
  return (
    <div>
      <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-2">{label}</label>
      <input data-testid={testId} type={type} value={value} onChange={onChange}
        className="w-full bg-white border border-[#e5e7eb] focus:border-[#7bc67e] outline-none rounded-xl px-3 py-2.5" />
    </div>
  );
}
