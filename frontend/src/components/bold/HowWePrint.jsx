import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Layers, Palette, ShieldCheck, Type } from "lucide-react";
import { DtfComparison } from "../../pages/DtfPrinting";
import usePageCopy from "../../hooks/usePageCopy";

/**
 * How We Print - a reusable, admin-editable block that presents DTF as our go-to
 * method (confident, not apologetic) and quietly invites method-preference
 * enquiries (embroidery / screen print for larger runs) without listing them as
 * menu options.
 *
 * IMPORTANT: never place this on the Design Your Own page - that flow is always
 * DTF, with no alternative method implied.
 *
 * All wording is editable in Admin → Page Copy under the "how-we-print" page, so
 * copy can be tuned without a code change.
 */
export default function HowWePrint({ className = "", variant = "section" }) {
  // Reads the standard admin Page Copy fields so it's editable in Admin → Page
  // Copy under "How We Print (DTF) block" with no extra wiring:
  //   title    → the heading
  //   body     → the main DTF message
  //   subtitle → the soft method-preference line
  //   cta_label→ the button label
  const copy = usePageCopy("how-we-print", {
    title: "How we print",
    body: "Every order is printed with DTF as standard - sharper detail than embroidery, every colour you need, and a print that's bonded into the fabric to last as long as the garment. No minimums, no setup fees.",
    subtitle: "Ordering a big run, or need embroidery? Embroidery is available on request - get in touch and we'll put a quote together for you.",
    cta_label: "Get a quote",
  });
  const heading = copy.title || "How we print";
  const body = copy.body;
  const enquiry = copy.subtitle;
  const enquiry_cta = copy.cta_label || "Get a quote";

  const points = [
    { icon: Type, label: "Small text stays sharp", sub: "Fine detail embroidery can't stitch" },
    { icon: Palette, label: "Every colour", sub: "Gradients, shading, even photos" },
    { icon: ShieldCheck, label: "Lasts as long as the garment", sub: "No loose threads, no fraying" },
    { icon: Layers, label: "No minimums", sub: "One item or hundreds" },
  ];

  if (variant === "compact") {
    return (
      <div className={`bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-5 ${className}`} data-testid="how-we-print-compact">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#7bc67e] grid place-items-center flex-shrink-0"><Sparkles size={18} className="text-[#1a1a1a]" /></span>
          <div>
            <div className="font-black text-sm">{heading}</div>
            <p className="text-xs text-[#4b5563] mt-1">{body}</p>
            <Link to="/dtf-printing" className="inline-block text-xs font-extrabold text-[#166534] hover:underline mt-1">Why DTF beats embroidery →</Link>
            <p className="text-xs text-[#4b5563] mt-2">{enquiry}{" "}
              <Link to="/contact" className="font-extrabold text-[#166534] hover:underline">{enquiry_cta} →</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={`px-6 ${className}`} data-testid="how-we-print">
      <div className="max-w-6xl mx-auto bg-white border-2 border-[#dcfce7] rounded-[2rem] p-8 sm:p-12">
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.25em] text-[#166534]">
              <Sparkles size={14} /> {heading}
            </div>
            <p className="mt-4 text-xl font-bold leading-relaxed text-[#1a1a1a]">{body}</p>
            <p className="mt-4 text-[#4b5563]">{enquiry}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/dtf-printing" className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold rounded-full px-6 py-3" data-testid="how-we-print-more">
                Why DTF beats embroidery →
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] font-extrabold rounded-full px-6 py-3" data-testid="how-we-print-cta">
                {enquiry_cta}
              </Link>
            </div>
          </div>
          <div className="grid sm:grid-cols-1 gap-3">
            {points.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} className="flex items-center gap-3 bg-[#f0fdf4] rounded-2xl px-4 py-3">
                  <span className="w-10 h-10 rounded-xl bg-white grid place-items-center flex-shrink-0"><Icon size={18} className="text-[#166534]" /></span>
                  <div>
                    <div className="font-extrabold text-sm">{p.label}</div>
                    <div className="text-xs text-[#4b5563]">{p.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-8 border-t-2 border-[#f0fdf4] pt-6">
          <div className="font-black text-lg mb-2">DTF vs embroidery at a glance</div>
          <DtfComparison compact />
        </div>
      </div>
    </section>
  );
}
