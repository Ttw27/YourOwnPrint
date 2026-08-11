import React from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ArrowRight, Sparkles, PackageCheck } from "lucide-react";
import { buildWhatsAppLink, WHATSAPP_NUMBER_DISPLAY } from "../../lib/data";

/**
 * ConciergeService — "you don't even have to use the website".
 *
 * The pitch: a busy trade buyer hasn't got time to design online, upload a logo
 * or pick garments. So they don't have to. Message us on WhatsApp, we reuse the
 * logo from your last order (or take a new one), help you choose the clothing,
 * mock it up, and send a payment link. You get on with running your business;
 * we get you looking professional and post it out.
 *
 * This is a stronger, more specific promise than "a human checks your order" —
 * it's "hand us the whole job" — so it's its own component rather than a
 * variant of AccountManagerPromise. The two are complementary.
 *
 * Variants mirror the other promise blocks (band / card / hero). The number and
 * message route through the central WhatsApp config so it stays in one place.
 */
const DEFAULT_PRESET =
  "Hi! I'd rather not order through the website — can you sort my order over WhatsApp? Here's what I need:";

export default function ConciergeService({ variant = "band", preset = DEFAULT_PRESET }) {
  const waLink = buildWhatsAppLink(preset);

  if (variant === "card") {
    return (
      <div className="bg-[#1a1a1a] text-white rounded-2xl p-5" data-testid="concierge-card">
        <div className="inline-flex items-center gap-2 font-nunito font-extrabold">
          <Sparkles className="text-[#7bc67e]" size={18} /> No time? We&rsquo;ll do it all
        </div>
        <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
          Too busy to design online? Message us on WhatsApp. We&rsquo;ll reuse your logo from last time (or take a new
          one), help you pick the clothing, and send a payment link. You carry on &mdash; we post it out.
        </p>
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer noopener"
          data-testid="concierge-card-cta"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-nunito font-extrabold bg-[#25D366] hover:bg-[#1ebe57] text-white px-3 py-2 rounded-full transition-colors"
        >
          <MessageCircle size={13} /> Sort my order on WhatsApp
        </a>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <section className="bg-[#1a1a1a] text-white rounded-3xl overflow-hidden" data-testid="concierge-hero">
        <div className="max-w-4xl mx-auto px-6 py-10 text-center">
          <span className="inline-flex items-center gap-2 text-[#7bc67e] font-nunito font-extrabold text-xs uppercase tracking-[0.25em]">
            <Sparkles size={16} /> Done for you
          </span>
          <h2 className="font-black text-2xl sm:text-3xl mt-3">Haven&rsquo;t got time? Let us do the whole thing</h2>
          <p className="text-neutral-300 mt-3 max-w-2xl mx-auto leading-relaxed">
            Not everyone has time to sit and design online &mdash; and you shouldn&rsquo;t have to. Send us a message on
            WhatsApp with what you need. We&rsquo;ll use the logo from your last order (or take a fresh one), help you
            choose the right garments, mock it up for you to approve, then send a payment link. You get on with the
            important stuff; we get you looking professional and post it straight out.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="concierge-hero-wa"
              className="inline-flex items-center gap-2 font-nunito font-extrabold bg-[#25D366] hover:bg-[#1ebe57] text-white px-5 py-2.5 rounded-full transition-colors"
            >
              <MessageCircle size={16} /> Order over WhatsApp{WHATSAPP_NUMBER_DISPLAY ? ` · ${WHATSAPP_NUMBER_DISPLAY}` : ""}
            </a>
            <Link
              to="/contact"
              data-testid="concierge-hero-cta"
              className="inline-flex items-center gap-2 font-nunito font-extrabold border border-white/25 hover:bg-white/10 px-5 py-2.5 rounded-full transition-colors"
            >
              Prefer email? Get in touch <ArrowRight size={15} />
            </Link>
          </div>
          <p className="text-[11px] text-neutral-500 mt-4 inline-flex items-center gap-1.5">
            <PackageCheck size={13} /> Reorder in seconds &middot; we already have your logo on file
          </p>
        </div>
      </section>
    );
  }

  // Default: slim band
  return (
    <div className="bg-[#1a1a1a] text-white" data-testid="concierge-band">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-3 flex-wrap text-center">
        <span className="inline-flex items-center gap-2 text-[#7bc67e] font-nunito font-extrabold text-xs uppercase tracking-[0.25em]">
          <Sparkles size={16} /> No time to design?
        </span>
        <span className="font-nunito text-sm sm:text-base">
          Order over WhatsApp &mdash; <span className="font-extrabold">we&rsquo;ll reuse your logo, pick the kit, and send a payment link.</span>
        </span>
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer noopener"
          data-testid="concierge-band-cta"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-nunito font-extrabold bg-[#25D366] hover:bg-[#1ebe57] text-white px-4 py-1.5 rounded-full transition-colors"
        >
          <MessageCircle size={14} /> Message us
        </a>
      </div>
    </div>
  );
}
