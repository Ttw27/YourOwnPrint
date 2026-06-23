import React from "react";
import { Link } from "react-router-dom";
import { WhatsAppInline } from "./WhatsAppFAB";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * BespokeQuoteCard — sits on product pages to nudge customers towards a quote
 * for unusual placements / sizes / fabrics / quantities.
 */
export default function BespokeQuoteCard({ productName }) {
  const preset = `Hi! I'd like a bespoke print quote for the ${productName || "garment"} — different placement / unusual size / something specific.`;
  return (
    <div className="bg-white rounded-3xl p-5 border-2 border-dashed border-[#7bc67e]" data-testid="bespoke-quote-card">
      <div className="inline-flex items-center gap-2 text-[#1a1a1a] font-nunito font-extrabold">
        <Sparkles size={16} className="text-[#7bc67e]" /> Need something bespoke?
      </div>
      <p className="text-sm text-[#4b5563] mt-2 leading-relaxed">
        Want a print in a different spot, on an unusual fabric, or a placement we don't list?
        Just message us and we'll quote it directly — no obligation, free artwork proof.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <WhatsAppInline preset={preset} label="WhatsApp us" />
        <Link
          to="/contact"
          data-testid="bespoke-contact-link"
          className="inline-flex items-center gap-1 text-xs font-nunito font-extrabold bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] px-4 py-2 rounded-full transition-colors"
        >
          Or send a quote request <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
