import React from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ArrowRight, UserRound, Mail } from "lucide-react";
import { buildWhatsAppLink, WHATSAPP_NUMBER_DISPLAY } from "../../lib/data";

/**
 * AccountManagerPromise — "buy from us and you get a named human, not a bot".
 *
 * This is a direct answer to the thing businesses quietly hate about big
 * faceless suppliers: chase an order and you get an auto-generated "it's been
 * dispatched" template back. We promise the opposite — a real person on
 * WhatsApp and email who can actually check and progress your order.
 *
 * The number comes from the central config in lib/data.js, so when the real
 * WhatsApp line is set it updates everywhere this component appears at once.
 *
 * Variants mirror PricePromise / ProofPromise so the three sit together:
 *  - "band" → slim full-width strip between sections
 *  - "card" → boxed card for a sidebar / product page
 *  - "hero" → larger standalone block for landing pages
 *
 * `preset` seeds the WhatsApp message so we know which page the enquiry came
 * from — handy when the same number serves the whole site.
 */
const DEFAULT_PRESET = "Hi! I'd like to speak to my account manager about an order.";

export default function AccountManagerPromise({ variant = "band", preset = DEFAULT_PRESET }) {
  const waLink = buildWhatsAppLink(preset);

  if (variant === "card") {
    return (
      <div className="bg-[#f0fdf4] rounded-2xl p-5 border-2 border-[#7bc67e]" data-testid="account-manager-card">
        <div className="inline-flex items-center gap-2 text-[#1a1a1a] font-nunito font-extrabold">
          <UserRound className="text-[#7bc67e]" size={18} /> A real account manager
        </div>
        <p className="text-sm text-[#1a1a1a] mt-2 leading-relaxed">
          No bots, no auto-replies. You get a <strong>named person on WhatsApp and email</strong> who can check
          where your order is, chase it, and answer anything &mdash; the same day.
        </p>
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer noopener"
          data-testid="account-manager-card-cta"
          className="mt-3 inline-flex items-center gap-1 text-xs font-nunito font-extrabold text-[#7bc67e] hover:underline"
        >
          <MessageCircle size={13} /> Message your account manager
        </a>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <section className="bg-[#1a1a1a] text-white rounded-3xl overflow-hidden" data-testid="account-manager-hero">
        <div className="max-w-4xl mx-auto px-6 py-10 text-center">
          <span className="inline-flex items-center gap-2 text-[#7bc67e] font-nunito font-extrabold text-xs uppercase tracking-[0.25em]">
            <UserRound size={16} /> Your dedicated account manager
          </span>
          <h2 className="font-black text-2xl sm:text-3xl mt-3">A real human on WhatsApp &mdash; not a bot</h2>
          <p className="text-neutral-300 mt-3 max-w-2xl mx-auto leading-relaxed">
            Ever chased an order and got a copy-paste &ldquo;it&rsquo;s been dispatched&rdquo; back? Not here. Every
            business account gets a named account manager you can reach on WhatsApp or email &mdash; someone who
            actually checks your order, progresses it, and gives you a straight answer.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="account-manager-hero-wa"
              className="inline-flex items-center gap-2 font-nunito font-extrabold bg-[#25D366] hover:bg-[#1ebe57] text-white px-5 py-2.5 rounded-full transition-colors"
            >
              <MessageCircle size={16} /> WhatsApp us{WHATSAPP_NUMBER_DISPLAY ? ` · ${WHATSAPP_NUMBER_DISPLAY}` : ""}
            </a>
            <Link
              to="/contact"
              data-testid="account-manager-hero-cta"
              className="inline-flex items-center gap-2 font-nunito font-extrabold border border-white/25 hover:bg-white/10 px-5 py-2.5 rounded-full transition-colors"
            >
              <Mail size={15} /> Email us instead
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Default: slim band
  return (
    <div className="bg-[#f0fdf4] border-y-2 border-[#dcfce7]" data-testid="account-manager-band">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-3 flex-wrap text-center">
        <span className="inline-flex items-center gap-2 text-[#166534] font-nunito font-extrabold text-xs uppercase tracking-[0.25em]">
          <UserRound size={16} /> A real human, not a bot
        </span>
        <span className="font-nunito text-sm sm:text-base text-[#1a1a1a]">
          Every business account gets a <span className="font-extrabold">named account manager on WhatsApp &amp; email.</span>
        </span>
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer noopener"
          data-testid="account-manager-band-cta"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-nunito font-extrabold bg-[#25D366] hover:bg-[#1ebe57] text-white px-4 py-1.5 rounded-full transition-colors"
        >
          <MessageCircle size={14} /> Message us
        </a>
      </div>
    </div>
  );
}
