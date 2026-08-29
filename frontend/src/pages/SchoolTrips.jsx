import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import ProofPromise from "../components/bold/ProofPromise";
import usePageCopy from "../hooks/usePageCopy";
import { useSiteImages } from "../hooks/usePageCopy";
import SiteImage from "../components/bold/SiteImage";
import usePageTitle from "../hooks/usePageTitle";
import {
  Eye, ShieldCheck, Users, Palette, Truck, PoundSterling,
  ArrowRight, MessageCircle, Shirt, MapPin,
} from "lucide-react";

/**
 * SchoolTrips — a landing page pitched at the teacher or trip organiser.
 *
 * The insight, from a parent: on a school trip every child wears the same
 * bright tee (one year blue, the next orange) with the school name on the back,
 * purely so staff can spot and count them at a glance in a busy museum, station
 * or theme park. It's a real, recurring, bulk order that most printers never
 * speak to directly — so this page names the use-case plainly and funnels into
 * the designer or a quote.
 *
 * Content-only pitch page (no product grid), same shape as ForBusiness, with
 * admin-editable copy via usePageCopy("school-trips", …).
 */
export default function SchoolTrips() {
  usePageTitle("School trip t-shirts — bright, easy to spot, printed in the UK", {
    description:
      "Bright, matching school trip t-shirts with your school name on the back. Easy to spot and count on any trip. No minimum order, free proof, UK printed.",
  });
  const copy = usePageCopy("school-trips", {});
  const site = useSiteImages();

  const hero = {
    eyebrow: copy.eyebrow || "For schools & trip organisers",
    title: copy.title || "School trip t-shirts you can spot from across the room",
    subtitle:
      copy.subtitle ||
      "One bright colour, your school name on the back — so staff can count heads at a glance and no child gets lost in the crowd. No minimum order, free proof before we print, and UK made.",
  };

  // Why a matching trip tee earns its place — safety first, because that's the
  // real reason schools order them.
  const benefits = [
    {
      icon: Eye,
      title: "Easy to spot, easy to count",
      body: "One vivid colour makes your group instantly recognisable in a busy museum, station or theme park. A quick glance and staff know everyone's there.",
    },
    {
      icon: ShieldCheck,
      title: "Peace of mind for staff & parents",
      body: "If a child does wander, they're wearing your school's name — anyone who finds them knows exactly who to contact.",
    },
    {
      icon: Palette,
      title: "A colour per trip or per year",
      body: "Blue for Year 5, orange for Year 6 — pick a different colour each time so groups never get mixed up. Loads of bright shades to choose from.",
    },
    {
      icon: Users,
      title: "Names, classes or numbers too",
      body: "Add the school name on the back, and optionally each child's first name or class on the front. Great for larger trips and residentials.",
    },
    {
      icon: PoundSterling,
      title: "No minimum, sensible pricing",
      body: "A class of 30 or a whole year group — same easy process, sensible price per shirt either way. Kids' sizes are VAT-free, so they come in even lower.",
    },
    {
      icon: Truck,
      title: "In good time for the trip",
      body: "Tell us your trip date and we'll make sure they're printed and delivered with time to spare. UK printed, no overseas waiting.",
    },
  ];

  const steps = [
    { icon: Palette, title: "Pick your colour", body: "Choose a bright shade for the trip — a different one each year keeps groups clear." },
    { icon: Shirt, title: "Add your school name", body: "We put your school name (and crest if you have one) on the back. Send your logo or we'll set it up." },
    { icon: Eye, title: "Approve a free proof", body: "We mock it up and send it over to check before printing. Nothing prints until you're happy." },
    { icon: Truck, title: "Delivered before the trip", body: "Printed in the UK and sent out in good time for the big day." },
  ];

  return (
    <div className="min-h-screen bg-white font-nunito" data-testid="school-trips-page">
      <BoldNavbar />

      {/* Hero */}
      <section className="bg-[#1a1a1a] text-white relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold" data-testid="school-trips-eyebrow">
            {hero.eyebrow}
          </div>
          <h1 className="font-black text-4xl sm:text-5xl lg:text-6xl mt-3 leading-tight max-w-3xl" data-testid="school-trips-title">
            {hero.title}
          </h1>
          <p className="text-zinc-300 mt-5 text-base sm:text-lg max-w-2xl" data-testid="school-trips-subtitle">
            {hero.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/design" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full" data-testid="school-trips-cta-design">
              Design your trip tee <ArrowRight size={16} />
            </Link>
            <Link to="/contact" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-extrabold px-6 py-3 rounded-full" data-testid="school-trips-cta-quote">
              <MessageCircle size={16} /> Get a quote for your trip
            </Link>
          </div>
        </div>
      </section>

      {/* Why matching trip tees */}
      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-20">
        <h2 className="font-black text-3xl sm:text-4xl text-center">Why schools order matching trip tees</h2>
        <p className="text-[#4b5563] text-center mt-3 max-w-2xl mx-auto">
          It comes down to one thing: keeping every child safe and accounted for — and looking smart while you do it.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {benefits.map((b) => (
            <div key={b.title} className="border-2 border-[#dcfce7] rounded-3xl p-6" data-testid="school-trips-benefit">
              <div className="w-11 h-11 rounded-2xl bg-[#f0fdf4] grid place-items-center text-[#7bc67e]">
                <b.icon size={20} />
              </div>
              <h3 className="font-black text-lg mt-4">{b.title}</h3>
              <p className="text-sm text-[#4b5563] mt-2 leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Garment examples — admin-editable photos so schools can picture it */}
      <section className="max-w-6xl mx-auto px-6 pb-4">
        <h2 className="font-black text-3xl sm:text-4xl text-center">Popular for school trips</h2>
        <p className="text-center text-[#4b5563] mt-2">Tap a style to start — or ask us and we'll help you pick.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {[
            { key: "t-shirt", label: "Trip T-Shirts", to: "/shop/t-shirts" },
            { key: "hoodie", label: "Hoodies", to: "/shop/hoodies" },
            { key: "polo", label: "Polo Shirts", to: "/shop/polos" },
            { key: "cap", label: "Caps & Hats", to: "/shop/hats" },
          ].map((g) => (
            <Link key={g.key} to={g.to} data-testid={`school-garment-${g.key}`} className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md rounded-3xl overflow-hidden transition-all">
              <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                <SiteImage src={site.image(`school-trip:${g.key}`, "")} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" testid={`school-garment-image-${g.key}`} />
              </div>
              <div className="p-4 text-center font-black">{g.label}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#f0fdf4] py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-black text-3xl sm:text-4xl text-center">From idea to trip day in four steps</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
            {steps.map((st, i) => (
              <div key={st.title} className="bg-white rounded-3xl p-6 border-2 border-[#dcfce7]" data-testid="school-trips-step">
                <div className="flex items-center gap-2 text-[#7bc67e] font-black">
                  <span className="w-7 h-7 rounded-full bg-[#f0fdf4] grid place-items-center text-sm">{i + 1}</span>
                  <st.icon size={18} />
                </div>
                <h3 className="font-black text-lg mt-4">{st.title}</h3>
                <p className="text-sm text-[#4b5563] mt-2 leading-relaxed">{st.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reassurance strip */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid sm:grid-cols-3 gap-6 text-center">
          {[
            ["No minimum order", "A class or a whole year group"],
            ["Kids' sizes VAT-free", "Lower price on children's tees"],
            ["Free digital proof", "Approve before we print"],
          ].map(([t, s]) => (
            <div key={t} className="p-4" data-testid="school-trips-reassure">
              <MapPin className="mx-auto text-[#7bc67e]" size={22} />
              <div className="font-black mt-2">{t}</div>
              <div className="text-sm text-[#4b5563] mt-1">{s}</div>
            </div>
          ))}
        </div>
      </section>

      <ProofPromise variant="band" />

      {/* Quote CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-[#1a1a1a] text-white rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <h3 className="font-black text-2xl sm:text-3xl">Got a trip coming up? Tell us the details.</h3>
            <p className="text-zinc-300 mt-2 max-w-xl">
              Send us your school name, rough numbers and the trip date. We&rsquo;ll suggest a colour, mock it up on the
              tee, and get you a price — all before you commit to anything.
            </p>
          </div>
          <Link to="/contact" className="inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full flex-shrink-0" data-testid="school-trips-cta-final">
            <MessageCircle size={16} /> Get a trip quote
          </Link>
        </div>
      </section>

      <NeedHelpCTA />
      <BoldFooter />
    </div>
  );
}
