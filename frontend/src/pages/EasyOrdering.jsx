import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import usePageCopy from "../hooks/usePageCopy";
import usePageTitle from "../hooks/usePageTitle";
import { buildWhatsAppLink } from "../lib/data";
import {
  MessageCircle, Mail, PhoneCall, ArrowRight, UserCheck, RotateCcw,
  FileCheck2, Receipt, Truck, Building2, GraduationCap, Trophy, ChevronDown,
} from "lucide-react";

/**
 * Easy ordering - "just message us". A lot of customers (especially repeat
 * business/school/club orders) don't want to use the website at all: they
 * WhatsApp or email "same as last time, 10 more tops" and we invoice and print.
 * This page advertises that, plus the dedicated account manager.
 *
 * Headline/intro/FAQ are editable in Admin > Pages ("easy-ordering"); the rest
 * is code defaults. Deliberately doesn't name a real person.
 */
export const ORDERS_EMAIL = "info@yourownprint.co.uk";
const WA_PRESET = "Hi! I'd like to place an order. Here's what I need (garment, colour, sizes and quantities):";
const REORDER_PRESET = "Hi! I'd like to reorder - same as last time, please. Here are the sizes and quantities:";

const DEFAULT_FAQ = [
  { q: "Do I need to create an account or use the website?",
    a: "No. Just WhatsApp or email us what you need and we'll take it from there. You can still use the website any time if you prefer." },
  { q: "How do I pay?",
    a: "By invoice or a secure payment link - whichever suits you. Businesses, schools and clubs can pay by invoice." },
  { q: "Can I just say “same as last time”?",
    a: "Yes. We keep your logo and past orders on file, so tell us the sizes and quantities and we'll match everything else." },
  { q: "Will I see what it looks like before it's printed?",
    a: "Yes - for new designs we send a free digital proof to approve first. Nothing prints until you're happy." },
  { q: "Who will I be speaking to?",
    a: "A real person from our team, not a bot - and the same account manager each time, so you never have to explain things twice." },
];

export default function EasyOrdering() {
  usePageTitle("Order by WhatsApp or Email", {
    description: "Skip the website - WhatsApp or email your order to your own account manager. Pay by invoice or payment link. Printed in the UK.",
  });
  const copy = usePageCopy("easy-ordering", {});
  const title = copy.title || "Just message us - we'll sort the rest";
  const subtitle = copy.subtitle ||
    "No website, no forms. WhatsApp or email what you need - even “same as last time, 10 more tops” - and your own account manager handles it from there. Pay by invoice or payment link.";
  const faq = (copy.faq && copy.faq.length ? copy.faq : DEFAULT_FAQ).filter((f) => f && f.q);

  const waLink = buildWhatsAppLink(WA_PRESET);
  const mailto = `mailto:${ORDERS_EMAIL}?subject=${encodeURIComponent("Order request")}&body=${encodeURIComponent("Hi,\n\nI'd like to order:\n- Garment:\n- Colour:\n- Sizes & quantities:\n- Logo: attached / same as last time\n\nThanks")}`;

  const steps = [
    { icon: MessageCircle, title: "Message us", body: "WhatsApp or email what you need - garment, colour, sizes and quantities. Attach your logo, or just say “same as last time”." },
    { icon: FileCheck2, title: "We confirm & proof", body: "Your account manager checks everything, sends a free proof for new designs, and your invoice or payment link." },
    { icon: Truck, title: "We print & deliver", body: "Printed in-house in the UK and sent straight to you. That's it." },
  ];
  const perks = [
    { icon: UserCheck, title: "Your own account manager", body: "The same real person every time - they know your logo, your garments and your sizes." },
    { icon: RotateCcw, title: "Repeat orders in one message", body: "New starter? Extra tops for the team? Tell us the sizes - we'll match the rest." },
    { icon: Receipt, title: "Invoice or payment link", body: "Pay the way that suits you. Businesses, schools and clubs can pay on invoice." },
  ];

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      {/* Hero */}
      <section className="bg-[#1a1a1a] text-white">
        <div className="max-w-6xl mx-auto px-6 py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 bg-white/10 text-[#7bc67e] font-extrabold rounded-full px-3 py-1 text-xs">
            <MessageCircle size={14} /> Talk to a real person
          </div>
          <h1 className="font-black text-4xl sm:text-5xl lg:text-6xl mt-4 max-w-3xl leading-[1.05]" data-testid="easy-title">{title}</h1>
          <p className="text-neutral-300 mt-5 max-w-2xl text-lg leading-relaxed">{subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white font-extrabold px-6 py-3.5 rounded-full" data-testid="easy-whatsapp">
              <MessageCircle size={18} /> Order on WhatsApp
            </a>
            <a href={mailto} className="inline-flex items-center gap-2 bg-white text-[#1a1a1a] hover:bg-neutral-100 font-extrabold px-6 py-3.5 rounded-full" data-testid="easy-email">
              <Mail size={18} /> Email {ORDERS_EMAIL}
            </a>
            <Link to="/contact" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-extrabold px-6 py-3.5 rounded-full" data-testid="easy-callback">
              <PhoneCall size={18} /> Request a callback
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-20">
        <h2 className="font-black text-3xl sm:text-4xl text-center">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-5 mt-10">
          {steps.map((st, i) => (
            <div key={st.title} className="bg-[#f0fdf4] rounded-3xl p-6 border-2 border-[#dcfce7]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#7bc67e] text-[#1a1a1a] grid place-items-center font-black">{i + 1}</div>
                <st.icon size={20} className="text-[#166534]" />
              </div>
              <p className="font-black text-lg mt-4">{st.title}</p>
              <p className="text-sm text-[#4b5563] mt-1.5">{st.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example message */}
      <section className="bg-[#f0fdf4] py-14 sm:py-16">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-black text-3xl sm:text-4xl">As easy as sending a text</h2>
            <p className="text-[#4b5563] mt-3 max-w-lg">Most of our regulars order in one message. No logins, no baskets - just tell us what you need and we'll confirm the details and total before anything's printed.</p>
            <a href={buildWhatsAppLink(REORDER_PRESET)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold px-6 py-3 rounded-full" data-testid="easy-reorder">
              <RotateCcw size={16} /> Reorder on WhatsApp <ArrowRight size={16} />
            </a>
          </div>
          <div className="bg-white rounded-3xl p-5 border-2 border-[#dcfce7] shadow-sm space-y-3 max-w-md w-full lg:justify-self-end" aria-label="Example conversation">
            <div className="ml-auto max-w-[85%] bg-[#dcf8c6] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
              Hi! Same as last time please - 10 more polos in navy. 4× M, 4× L, 2× XL 👍
            </div>
            <div className="max-w-[85%] bg-[#f3f4f6] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm">
              No problem! Same logo on the left chest. That's £XX + VAT - I'll send the invoice over now.
            </div>
            <div className="ml-auto max-w-[85%] bg-[#dcf8c6] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">Perfect, thanks!</div>
          </div>
        </div>
      </section>

      {/* Account manager perks */}
      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-20">
        <h2 className="font-black text-3xl sm:text-4xl text-center">Your own account manager</h2>
        <p className="text-[#4b5563] text-center mt-3 max-w-2xl mx-auto">A real person on our team who looks after your orders from start to finish - not a chatbot, not a ticket queue.</p>
        <div className="grid sm:grid-cols-3 gap-5 mt-10">
          {perks.map((pk) => (
            <div key={pk.title} className="border-2 border-[#dcfce7] rounded-3xl p-6">
              <div className="w-11 h-11 rounded-2xl bg-[#f0fdf4] grid place-items-center"><pk.icon size={20} className="text-[#166534]" /></div>
              <p className="font-black text-lg mt-4">{pk.title}</p>
              <p className="text-sm text-[#4b5563] mt-1.5">{pk.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          {[[Building2, "Businesses & trades"], [GraduationCap, "Schools & colleges"], [Trophy, "Clubs & teams"]].map(([Icon, label]) => (
            <div key={label} className="inline-flex items-center justify-center gap-2 bg-[#f0fdf4] rounded-full px-4 py-2.5 text-sm font-extrabold">
              <Icon size={16} className="text-[#166534]" /> {label}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#f9fafb] py-14 sm:py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-black text-3xl sm:text-4xl text-center">Questions</h2>
          <div className="mt-8 space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="group bg-white border-2 border-[#e5e7eb] rounded-2xl p-5" data-testid="easy-faq">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none font-black">
                  {f.q} <ChevronDown size={18} className="flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="text-sm text-[#4b5563] mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-20 text-center">
        <h2 className="font-black text-3xl sm:text-4xl">Ready when you are</h2>
        <p className="text-[#4b5563] mt-3">Send us a message and a real person will get back to you during working hours.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white font-extrabold px-6 py-3.5 rounded-full">
            <MessageCircle size={18} /> Order on WhatsApp
          </a>
          <a href={mailto} className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold px-6 py-3.5 rounded-full">
            <Mail size={18} /> Email us
          </a>
        </div>
      </section>

      <BoldFooter />
    </div>
  );
}
