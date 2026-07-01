import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, ArrowRight, Sparkles } from "lucide-react";
import { fetchSiteWhatsApp } from "../../lib/api";

/**
 * Universal "Need us to sort it?" CTA. Drop into any design/order flow where
 * customers might feel out of their depth (Designer, Leavers, Specials, Fight Night).
 * Offers: (1) WhatsApp direct (uses admin-configured number if present),
 *         (2) Contact / Get a Quote page fallback.
 */
export default function NeedHelpCTA({
  title = "Not confident uploading? Let us do it for you.",
  body = "Send over your logo, sketch, or just a rough idea. Our UK design team will mock it up for free, tidy up shonky files, and send you a proof to approve — no cost, no pressure.",
  presetMessage = "Hi! I'd love a hand designing my order — can you sort the artwork for me?",
  primaryLabel = "WhatsApp us your logo",
  fallbackLabel = "Get a free mock-up",
  variant = "panel",         // "panel" | "banner" | "inline"
  testid = "need-help-cta",
  className = "",
}) {
  const [whatsapp, setWhatsapp] = useState("");
  useEffect(() => {
    fetchSiteWhatsApp().then((d) => setWhatsapp(d?.number || "")).catch(() => {});
  }, []);

  const cleaned = whatsapp.replace(/[^0-9]/g, "");
  const waHref = cleaned ? `https://wa.me/${cleaned}?text=${encodeURIComponent(presetMessage)}` : null;

  const primary = waHref
    ? (
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe57] text-white font-nunito font-extrabold rounded-full px-4 py-2.5 text-sm transition-colors"
        data-testid={`${testid}-whatsapp`}
      >
        {primaryLabel} <ArrowRight size={14} />
      </a>
    )
    : (
      <Link
        to="/contact"
        className="inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold rounded-full px-4 py-2.5 text-sm transition-colors"
        data-testid={`${testid}-contact`}
      >
        {primaryLabel} <ArrowRight size={14} />
      </Link>
    );

  const secondary = (
    <Link
      to="/contact"
      className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f0fdf4] border-2 border-[#dcfce7] hover:border-[#7bc67e] text-[#1a1a1a] font-nunito font-extrabold rounded-full px-4 py-2.5 text-sm transition-colors"
      data-testid={`${testid}-quote`}
    >
      {fallbackLabel}
    </Link>
  );

  if (variant === "inline") {
    return (
      <div className={`inline-flex items-center gap-2 text-sm text-[#4b5563] ${className}`} data-testid={testid}>
        <HelpCircle size={14} className="text-[#7bc67e]" />
        <span>Not confident?</span>
        {primary}
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div className={`bg-[#1a1a1a] text-white rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${className}`} data-testid={testid}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 grid place-items-center rounded-full bg-[#fde68a] text-[#1a1a1a] flex-shrink-0"><Sparkles size={18} /></div>
          <div>
            <div className="font-nunito font-extrabold">{title}</div>
            <div className="text-xs text-zinc-300 mt-0.5 max-w-xl">{body}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{primary}{waHref && secondary}</div>
      </div>
    );
  }

  // panel (default)
  return (
    <div className={`bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-3xl p-5 ${className}`} data-testid={testid}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 grid place-items-center rounded-full bg-[#7bc67e] text-[#1a1a1a] flex-shrink-0"><HelpCircle size={20} /></div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-[0.2em] text-[#5eb062] font-extrabold">Need a hand?</div>
          <div className="font-nunito font-extrabold text-base mt-1 text-[#1a1a1a]">{title}</div>
          <p className="text-sm text-[#4b5563] mt-1 leading-relaxed">{body}</p>
          <div className="mt-3 flex flex-wrap gap-2">{primary}{waHref && secondary}</div>
        </div>
      </div>
    </div>
  );
}
