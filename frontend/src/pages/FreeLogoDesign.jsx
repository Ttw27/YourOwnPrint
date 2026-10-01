import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import usePageTitle from "../hooks/usePageTitle";
import usePageCopy from "../hooks/usePageCopy";
import { Check, Pencil, MessageCircle, Download, ArrowRight } from "lucide-react";

/**
 * Free logo design (from the old site's page). Free when you print your
 * branded clothing with us. Heading/intro editable in Admin > Page Copy
 * ("free-logo-design").
 */
export default function FreeLogoDesign() {
  usePageTitle("Free Logo Design", { description: "Get a professional logo designed for free when you print your branded clothing with Your Own Print. Unlimited revisions, high-res files, 100% yours." });
  const copy = usePageCopy("free-logo-design", {
    title: "Free logo design",
    subtitle: "A professional logo for your business - free when you print your branded clothing with us.",
    body: "A great logo is the foundation of your brand. Whether you're just starting out or giving your business a refresh, our in-house team will turn your ideas into a professional logo that's unique and 100% yours.",
  });
  const steps = [
    [MessageCircle, "Tell us about your business", "Share your ideas, colours you like, or logos you love - a quick message is plenty."],
    [Pencil, "We design your options", "Our team designs options for you to pick from, with unlimited changes until it's exactly right."],
    [Download, "It's yours", "You get high-resolution files and full rights to your logo - ready for clothing, signs, your website and socials."],
  ];
  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <section className="bg-[#f0fdf4] border-b border-[#dcfce7]">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <div className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#166534]">Free with your order</div>
          <h1 className="font-black text-4xl sm:text-5xl mt-3 leading-[1.05]">{copy.title}</h1>
          <p className="text-xl font-bold mt-4 max-w-3xl">{copy.subtitle}</p>
          <p className="text-[#4b5563] mt-3 max-w-3xl">{copy.body}</p>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="font-black text-3xl">How it works</h2>
        <ol className="mt-6 grid md:grid-cols-3 gap-4">
          {steps.map(([Icon, t, d], i) => (
            <li key={t} className="border-2 border-[#eef2f7] rounded-2xl p-5">
              <span className="w-10 h-10 rounded-xl bg-[#7bc67e] grid place-items-center font-black">{i + 1}</span>
              <div className="font-black mt-3 flex items-center gap-2"><Icon size={16} className="text-[#166534]" />{t}</div>
              <p className="text-sm text-[#4b5563] mt-1">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm">
          {["Designed by real people, not a logo generator", "Unlimited revisions until you're happy", "Premium fonts and custom layouts", "High-resolution files for print and web", "Full rights - the logo is 100% yours", "Free when you print your branded clothing with us"].map((p) => (
            <div key={p} className="flex gap-2"><Check size={16} className="text-[#16a34a] flex-shrink-0 mt-0.5" />{p}</div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/contact?topic=logo" className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold rounded-full px-6 py-3">Start my free logo <ArrowRight size={16} /></Link>
          <Link to="/easy-ordering" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] font-extrabold rounded-full px-6 py-3">Message us on WhatsApp</Link>
        </div>
      </section>
      <BoldFooter />
    </div>
  );
}
