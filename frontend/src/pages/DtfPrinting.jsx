import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import usePageTitle from "../hooks/usePageTitle";
import usePageCopy from "../hooks/usePageCopy";
import { Check, X, Sparkles, Palette, Type, ShieldCheck, Feather, Layers, ArrowRight } from "lucide-react";

/**
 * Why we print with DTF - what DTF is, how it compares with embroidery, and why
 * we moved to it. Heading/intro editable in Admin > Page Copy ("dtf-printing").
 */
export const DTF_VS_EMBROIDERY = [
  ["Small text and fine detail", "Crisp and readable, even tiny lettering and thin lines", "Small text blurs or fills in - stitches can't go finer than the thread"],
  ["Colours", "Unlimited - full colour, gradients, even photos", "Limited to a handful of thread colours, no gradients or photos"],
  ["Logo accuracy", "Your logo exactly as designed", "Redrawn as stitches - detail is simplified or lost"],
  ["Durability", "Bonded into the fabric - built to last as long as the garment", "Threads can snag, pull and come loose over time"],
  ["Feel on the garment", "Soft and flexible, moves with the fabric", "Stiff stitching and backing, can pucker thin fabrics"],
  ["Lightweight garments", "Perfect on tees, sportswear and performance fabrics", "Heavy stitching can drag and pucker thin tees"],
  ["Minimum order", "None - one item or hundreds, same price per print", "Often minimums + a digitising (setup) fee"],
];

export function DtfComparison({ compact = false }) {
  return (
    <div className="overflow-x-auto" data-testid="dtf-comparison">
      <table className={`w-full ${compact ? "text-xs" : "text-sm"} min-w-[520px]`}>
        <thead>
          <tr className="text-left">
            <th className="py-2 pr-3 font-extrabold text-[#4b5563]"></th>
            <th className="py-2 px-3 font-black text-[#166534] bg-[#f0fdf4] rounded-t-xl">DTF (what we use)</th>
            <th className="py-2 px-3 font-black text-[#4b5563]">Embroidery</th>
          </tr>
        </thead>
        <tbody>
          {DTF_VS_EMBROIDERY.map(([what, dtf, emb]) => (
            <tr key={what} className="border-t border-[#eef2f7] align-top">
              <td className="py-2.5 pr-3 font-extrabold">{what}</td>
              <td className="py-2.5 px-3 bg-[#f0fdf4]"><span className="inline-flex gap-1.5"><Check size={15} className="text-[#16a34a] flex-shrink-0 mt-0.5" />{dtf}</span></td>
              <td className="py-2.5 px-3 text-[#4b5563]"><span className="inline-flex gap-1.5"><X size={15} className="text-[#dc2626] flex-shrink-0 mt-0.5" />{emb}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DtfPrinting() {
  usePageTitle("Why We Print With DTF", {
    description: "DTF printing explained: sharper detail, unlimited colours and prints that last as long as the garment. How DTF compares with embroidery - plus embroidery and screen printing on request.",
  });
  const copy = usePageCopy("dtf-printing", {
    title: "Why we print with DTF",
    subtitle: "Sharper detail, every colour, and prints that last as long as the garment.",
    body: "DTF is how we print as standard, because it simply does a better job of showing off your logo - especially the small, detailed logos most businesses, clubs and teams actually have. Prefer embroidery or screen printing? We can arrange both on request - just ask for a quote.",
  });

  const steps = [
    ["Your design is printed onto film", "Using full-colour pigment inks - every shade, gradient and fine line exactly as you designed it."],
    ["A bonding powder is applied", "This is what welds the print to the fabric fibres - the secret to how long it lasts."],
    ["Heat-pressed onto your garment", "Under heat and pressure the print bonds into the fabric, staying soft and flexible."],
    ["Checked and packed in Leicester", "Every item is checked by hand before it leaves us."],
  ];
  const benefits = [
    [Type, "Small text stays sharp", "Tiny lettering, website addresses and fine lines stay crisp and readable - even on a breast-pocket logo."],
    [Palette, "Every colour, no limits", "Full colour, gradients, shading and even photos. No reducing your logo to a few thread colours."],
    [ShieldCheck, "Lasts as long as the garment", "Bonded into the fabric - it won't fray, snag or come unstitched. Wash after wash it stays put."],
    [Feather, "Soft and flexible", "No stiff patch or scratchy backing inside. Stretches and moves with the garment."],
    [Layers, "Works on almost anything", "Cotton, polyester, blends, sportswear and performance fabrics - light or dark colours."],
    [Sparkles, "No minimums, no setup fees", "One shirt or five hundred, the same quality and no digitising charge."],
  ];

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <section className="bg-[#f0fdf4] border-b border-[#dcfce7]">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.25em] text-[#166534]"><Sparkles size={14} /> How we print</div>
          <h1 className="font-black text-4xl sm:text-5xl mt-3 leading-[1.05]">{copy.title}</h1>
          <p className="text-xl font-bold mt-4 max-w-3xl">{copy.subtitle}</p>
          <p className="text-[#4b5563] mt-3 max-w-3xl">{copy.body}</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="font-black text-3xl">DTF vs embroidery</h2>
        <p className="text-[#4b5563] mt-2 max-w-3xl">Embroidery has its place, but most logos aren&rsquo;t big, bold and simple. Here&rsquo;s how the two compare on the things that matter when it&rsquo;s your brand on the shirt.</p>
        <div className="mt-6 border-2 border-[#eef2f7] rounded-3xl p-4 sm:p-6"><DtfComparison /></div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-4">
        <h2 className="font-black text-3xl">Why DTF is our standard</h2>
        <div className="mt-4 grid md:grid-cols-2 gap-6 text-[#374151] leading-relaxed">
          <p>Embroidery builds your logo out of thread, and thread has a minimum thickness. On a breast-pocket logo - usually around 9cm wide - small text and fine details simply can&rsquo;t be stitched clearly. Letters fill in, thin lines disappear and the logo ends up looking blurry or &ldquo;blobby&rdquo;. We kept seeing it: a sharp logo on screen, and a disappointing badge on the shirt.</p>
          <p>Stitching also wears. Loose threads snag on bags and seatbelts, edges start to fray, and the stiff backing can make lighter garments pucker. DTF bonds the print into the fabric itself, so there are no threads to pull and nothing to come unstitched - the print is built to last as long as the garment does, keeping your brand looking sharp on every wear.</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pt-8">
        <div className="bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between" data-testid="dtf-embroidery-note">
          <div><div className="font-black">Want embroidery or screen printing?</div>
            <p className="text-sm text-[#4b5563] mt-1">Both are available on request through our trusted partners - quote only. Tell us the garment, quantity and your logo.</p></div>
          <Link to="/business-enquiry" className="inline-flex items-center justify-center bg-[#1a1a1a] text-white font-extrabold rounded-full px-5 py-2.5 text-sm flex-shrink-0">Ask for a quote</Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="font-black text-3xl">What you get with DTF</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map(([Icon, t, d]) => (
            <div key={t} className="bg-[#f0fdf4] rounded-2xl p-5">
              <span className="w-10 h-10 rounded-xl bg-white grid place-items-center"><Icon size={18} className="text-[#166534]" /></span>
              <div className="font-black mt-3">{t}</div>
              <p className="text-sm text-[#4b5563] mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <h2 className="font-black text-3xl">How DTF works</h2>
        <ol className="mt-6 grid sm:grid-cols-2 gap-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="border-2 border-[#eef2f7] rounded-2xl p-5 flex gap-4">
              <span className="w-9 h-9 rounded-full bg-[#7bc67e] text-[#1a1a1a] font-black grid place-items-center flex-shrink-0">{i + 1}</span>
              <div><div className="font-black">{t}</div><p className="text-sm text-[#4b5563] mt-1">{d}</p></div>
            </li>
          ))}
        </ol>
        <div className="mt-8 bg-[#f9fafb] rounded-2xl p-5 text-sm text-[#4b5563]">
          <div className="font-black text-[#1a1a1a]">Looking after your print</div>
          Wash inside out at 30&deg;C, avoid tumble drying where you can, and don&rsquo;t iron directly over the print. Look after it like that and it&rsquo;ll look after your brand.
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="bg-[#1a1a1a] text-white rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <h2 className="font-black text-2xl">See your logo on a shirt</h2>
            <p className="text-neutral-300 mt-1">Upload it in the designer, or send it to us and we&rsquo;ll send a free proof.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/design" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full">Try the designer <ArrowRight size={16} /></Link>
            <Link to="/contact" className="inline-flex items-center gap-2 border-2 border-white/30 hover:border-white text-white font-extrabold px-6 py-3 rounded-full">Get a free proof</Link>
          </div>
        </div>
      </section>
      <BoldFooter />
    </div>
  );
}
