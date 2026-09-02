import React from "react";
import { Link } from "react-router-dom";
import { Eye, ArrowRight, ShieldCheck } from "lucide-react";

/**
 * ProofPromise — the "you'll see it before you commit" reassurance.
 *
 * The research on why businesses hesitate to switch supplier is blunt: the
 * number-one first-order fear is that the logo comes out wrong — off-colour on
 * fabric, badly placed, cracking after a wash. Suppliers that win are the ones
 * that de-risk the *first* order by proofing before production. We already do
 * this; this component states it plainly wherever a business is deciding.
 *
 * Variants mirror PricePromise so the two sit together naturally:
 *  - "band" → slim full-width strip between sections
 *  - "card" → boxed card for a sidebar or product page
 *  - "hero" → larger standalone block for landing pages
 *
 * No admin photo here by design — this is a promise, not a picture, and it
 * should read instantly. Copy is deliberately concrete ("on your chosen
 * garment", "before we print a thing").
 */
export default function ProofPromise({ variant = "band" }) {
  if (variant === "card") {
    return (
      <div className="bg-[#f0fdf4] rounded-2xl p-5 border-2 border-[#7bc67e]" data-testid="proof-promise-card">
        <div className="inline-flex items-center gap-2 text-[#1a1a1a] font-nunito font-extrabold">
          <Eye className="text-[#7bc67e]" size={18} /> Free proof first
        </div>
        <p className="text-sm text-[#1a1a1a] mt-2 leading-relaxed">
          We&rsquo;ll mock your logo up on your chosen garment and send it over to approve&nbsp;&mdash;{" "}
          <strong>before we print a thing.</strong> No surprises on colour, size or placement.
        </p>
        <Link to="/contact" data-testid="proof-promise-card-cta" className="mt-3 inline-flex items-center gap-1 text-xs font-nunito font-extrabold text-[#7bc67e] hover:underline">
          Get a free mock-up <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <section className="bg-[#1a1a1a] text-white rounded-3xl overflow-hidden" data-testid="proof-promise-hero">
        <div className="max-w-4xl mx-auto px-6 py-10 text-center">
          <span className="inline-flex items-center gap-2 text-[#7bc67e] font-nunito font-extrabold text-xs uppercase tracking-[0.25em]">
            <ShieldCheck size={16} /> Free proof, every time
          </span>
          <h2 className="font-black text-2xl sm:text-3xl mt-3">See it on your garment before you commit</h2>
          <p className="text-neutral-300 mt-3 max-w-2xl mx-auto leading-relaxed">
            The biggest worry with a first order is that the logo won&rsquo;t come out right. So we take it off the table:
            send us your logo and we&rsquo;ll mock it up on your chosen colour and garment, then send you a proof to
            approve. Nothing goes to print until you&rsquo;re happy with it.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link to="/design" data-testid="proof-promise-hero-design" className="font-nunito font-extrabold bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] px-5 py-2.5 rounded-full transition-colors">
              Start your design
            </Link>
            <Link to="/contact" data-testid="proof-promise-hero-cta" className="font-nunito font-extrabold border border-white/25 hover:bg-white/10 px-5 py-2.5 rounded-full transition-colors">
              Get a free mock-up →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Default: slim band
  return (
    <div className="bg-[#f0fdf4] border-y-2 border-[#dcfce7]" data-testid="proof-promise-band">
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-center gap-4 flex-wrap text-center">
        <span className="inline-flex items-center gap-2 text-[#166534] font-nunito font-extrabold text-xs uppercase tracking-[0.25em]">
          <Eye size={16} /> Free proof first
        </span>
        <span className="font-nunito text-sm sm:text-base text-[#1a1a1a]">
          We mock your logo on your garment and <span className="font-extrabold">send a proof before we print.</span>
        </span>
        <Link to="/contact" data-testid="proof-promise-band-cta" className="text-xs sm:text-sm font-nunito font-extrabold bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] px-4 py-1.5 rounded-full transition-colors">
          Get a free mock-up →
        </Link>
      </div>
    </div>
  );
}
