import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import usePageCopy from "../hooks/usePageCopy";
import usePageTitle from "../hooks/usePageTitle";
import {
  ArrowRight, BadgeCheck, RotateCcw, Palette, Truck, Package,
  ShieldCheck, Upload, MessageCircle,
} from "lucide-react";

/**
 * For Business — the page that speaks to a company already using another
 * supplier. The workwear switching guides are consistent about what actually
 * holds a business back from moving: fear the logo comes out different, dread
 * of a clunky first order, and the assumption that reordering for one new
 * starter will be treated as an inconvenience below a minimum. This page names
 * each of those and answers it, rather than listing product features.
 *
 * Copy is admin-editable via the "for-business" page-copy slug, falling back to
 * these defaults so the page is never blank before anything is entered.
 */
export default function ForBusiness() {
  usePageTitle("For business — branded workwear made easy");
  const copy = usePageCopy("for-business", {});

  const hero = {
    eyebrow: copy.eyebrow || "For businesses & teams",
    title: copy.title || "Switching your workwear to us is genuinely easy",
    subtitle:
      copy.subtitle ||
      "Send us your logo once. We proof it on your chosen garment before anything prints, keep your artwork on file, and make every reorder a two-click job — even if it's one shirt for one new starter.",
  };

  // The switcher's worries, each paired with how we remove it. This is the spine
  // of the page — drawn straight from what the guides say keeps businesses stuck.
  const worries = [
    {
      icon: Palette,
      worry: "\u201cWill our logo come out the same?\u201d",
      answer:
        "We send you a digital proof on your actual garment before printing — so you sign off on the colour, size and placement first. Nothing goes to print until it looks right to you.",
    },
    {
      icon: RotateCcw,
      worry: "\u201cReordering is always a hassle.\u201d",
      answer:
        "Your logo and past orders live in your account. Reordering for a new starter is two clicks — no re-sending artwork, no re-explaining what you had last time.",
    },
    {
      icon: Package,
      worry: "\u201cWe only need a few, not a hundred.\u201d",
      answer:
        "No minimum order. One polo or fifty — same easy process, sensible price per item either way. Order for the whole team, or top up for one new face.",
    },
    {
      icon: ShieldCheck,
      worry: "\u201cWhat if the finish doesn't last?\u201d",
      answer:
        "We print and finish to survive the wash cycle a uniform actually goes through, so the branding holds up instead of cracking or fading after a season.",
    },
  ];

  const steps = [
    { icon: Upload, title: "Send your logo", body: "Upload it in the designer or send it over WhatsApp — whichever's easier." },
    { icon: BadgeCheck, title: "Approve a free proof", body: "We mock it up on your chosen garment and send it back for you to check." },
    { icon: Truck, title: "We print & deliver", body: "Approved, printed in the UK, and sent out — with your artwork saved for next time." },
  ];

  return (
    <div className="min-h-screen bg-white">
      <BoldNavbar />

      {/* Hero */}
      <section className="bg-[#1a1a1a] text-white relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-extrabold" data-testid="business-eyebrow">
            {hero.eyebrow}
          </div>
          <h1 className="font-black text-4xl sm:text-5xl lg:text-6xl mt-3 leading-tight max-w-3xl" data-testid="business-hero-title">
            {hero.title}
          </h1>
          <p className="text-zinc-300 mt-5 text-base sm:text-lg max-w-2xl" data-testid="business-hero-subtitle">
            {hero.subtitle}
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/design" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full" data-testid="business-cta-design">
              Start a design <ArrowRight size={16} />
            </Link>
            <Link to="/workforce" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-extrabold px-6 py-3 rounded-full" data-testid="business-cta-workforce">
              Kit out a team
            </Link>
          </div>
        </div>
      </section>

      {/* Worries → answers */}
      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-20">
        <h2 className="font-black text-3xl sm:text-4xl text-center">Already have a supplier? Here's why teams move to us</h2>
        <p className="text-[#4b5563] text-center mt-3 max-w-2xl mx-auto">
          Moving supplier feels risky. It shouldn't. Here are the things businesses tell us hold them back — and how we take each one off the table.
        </p>
        <div className="grid sm:grid-cols-2 gap-5 mt-10">
          {worries.map((w) => (
            <div key={w.worry} className="border-2 border-[#dcfce7] rounded-3xl p-6" data-testid="business-worry">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#f0fdf4] grid place-items-center flex-shrink-0">
                  <w.icon size={20} className="text-[#166534]" />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-lg">{w.worry}</p>
                  <p className="text-sm text-[#4b5563] mt-1.5">{w.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#f0fdf4] py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-black text-3xl sm:text-4xl text-center">Three steps, no faff</h2>
          <div className="grid sm:grid-cols-3 gap-5 mt-10">
            {steps.map((st, i) => (
              <div key={st.title} className="bg-white rounded-3xl p-6 border-2 border-[#dcfce7]" data-testid="business-step">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#7bc67e] text-[#1a1a1a] grid place-items-center font-black">{i + 1}</div>
                  <st.icon size={20} className="text-[#166534]" />
                </div>
                <p className="font-black text-lg mt-4">{st.title}</p>
                <p className="text-sm text-[#4b5563] mt-1.5">{st.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reassurance strip */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            ["No minimum order", "One item or a thousand"],
            ["Printed in the UK", "Not shipped from overseas"],
            ["Free digital proof", "Approve before we print"],
            ["Logo saved on file", "Effortless reorders"],
          ].map(([t, sub]) => (
            <div key={t} className="p-4" data-testid="business-reassure">
              <p className="font-black text-sm">{t}</p>
              <p className="text-[11px] text-[#4b5563] mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WhatsApp / proof CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-[#1a1a1a] text-white rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <h3 className="font-black text-2xl sm:text-3xl">Not sure where to start? Send us your logo.</h3>
            <p className="text-zinc-300 mt-2 max-w-xl">
              We'll clean up the artwork, mock it on your chosen garment, and send back a proof to approve. Same price, and we do the fiddly bit.
            </p>
          </div>
          <Link to="/design" className="inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full flex-shrink-0" data-testid="business-cta-proof">
            <MessageCircle size={16} /> Get a free mock-up
          </Link>
        </div>
      </section>

      <NeedHelpCTA />
      <BoldFooter />
    </div>
  );
}
