import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Layers, Palette, ShieldCheck } from "lucide-react";
import usePageCopy from "../../hooks/usePageCopy";

/**
 * How We Print — a reusable, admin-editable block that presents DTF as our go-to
 * method (confident, not apologetic) and quietly invites method-preference
 * enquiries (embroidery / screen print for larger runs) without listing them as
 * menu options.
 *
 * IMPORTANT: never place this on the Design Your Own page — that flow is always
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
    body: "Every order is printed with DTF — our go-to method for vibrant, full-colour, long-lasting prints with no minimums and no setup fees. One tee or five hundred, DTF gives you the same crisp finish.",
    subtitle: "Prefer embroidery or screen print for a larger run? Get in touch and we'll put a quote together for you.",
    cta_label: "Get a quote",
  });
  const heading = copy.title || "How we print";
  const body = copy.body;
  const enquiry = copy.subtitle;
  const enquiry_cta = copy.cta_label || "Get a quote";

  const points = [
    { icon: Palette, label: "Full colour", sub: "Photos, gradients, fine detail" },
    { icon: Layers, label: "No minimums", sub: "One item or hundreds" },
    { icon: ShieldCheck, label: "Built to last", sub: "Washes and wears well" },
  ];

  if (variant === "compact") {
    return (
      <div className={`bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-5 ${className}`} data-testid="how-we-print-compact">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#7bc67e] grid place-items-center flex-shrink-0"><Sparkles size={18} className="text-[#1a1a1a]" /></span>
          <div>
            <div className="font-black text-sm">{heading}</div>
            <p className="text-xs text-[#4b5563] mt-1">{body}</p>
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
            <Link to="/contact" className="mt-5 inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold rounded-full px-6 py-3" data-testid="how-we-print-cta">
              {enquiry_cta} →
            </Link>
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
      </div>
    </section>
  );
}
