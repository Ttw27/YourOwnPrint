import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import usePageCopy from "../hooks/usePageCopy";
import usePageTitle from "../hooks/usePageTitle";
import JsonLd from "../components/bold/JsonLd";
import { api } from "../lib/api";
import { buildWhatsAppLink } from "../lib/data";
import {
  Trophy, Palette, Users, Shirt, PoundSterling, Truck, ArrowRight, MessageCircle, Upload, Eye, CheckCircle2, ShieldCheck,
} from "lucide-react";

/**
 * /sports-day - landing page for sports day, inter-house competitions and school
 * sport (SEO + the pitch), like the School Trips page. The order builder itself
 * is /sports-day/order (GroupKitBuilder, house colours). Copy editable in
 * Admin > Page copy > "Sports Day" (usePageCopy("sports-day")).
 */
const HOUSES = [["Fire Red", "Red house"], ["Royal Blue", "Blue house"], ["Kelly Green", "Green house"], ["Sun Yellow", "Yellow house"]];

export default function SportsDay() {
  usePageTitle("Sports day t-shirts & house colour kit for schools", {
    description: "House colour sports day t-shirts, vests, polos and hoodies for primary and secondary schools - school badge on the front, house name on the back, kids and adult sizes, bulk prices, free proof, UK printed.",
  });
  const copy = usePageCopy("sports-day", {});
  const [photos, setPhotos] = React.useState({ houses: [], extra: {} });

  React.useEffect(() => {
    api.get("/group-kits/sports-day").then(({ data }) => {
      const g = (k) => (data.garments || []).find((x) => x.key === k);
      const tee = g("sports-tee");
      const pick = (gm, names) => gm && ((names.map((n) => gm.colours.find((c) => c.name === n)).find((c) => c && c.image)) || gm.colours.find((c) => c.image));
      setPhotos({
        houses: tee ? HOUSES.map(([n, label]) => ({ label, colour: n, image: (pick(tee, [n]) || {}).image || tee.adult.image })) : [],
        extra: Object.fromEntries([["vest", ["Fire Red", "Royal Blue"]], ["cool-polo", ["Kelly Green", "Royal Blue"]], ["hoodie", ["Royal Blue", "Navy"]], ["cap", ["Yellow", "Kelly Green"]]]
          .map(([k, names]) => [k, (pick(g(k), names) || {}).image || g(k)?.adult.image])),
      });
    }).catch(() => {});
  }, []);

  const hero = {
    eyebrow: copy.eyebrow || "Sports day · house competitions · school sport",
    title: copy.title || "Sports day t-shirts in every house colour",
    subtitle: copy.subtitle || "Wicking sports tees, vests, polos and hoodies for the whole school - your badge on the front, the house name on the back. Kids and adult sizes in one order, bulk prices, free proof and UK printed.",
  };
  const benefits = [
    { icon: Palette, title: "Every house, one order", body: "Red, blue, green, yellow - add a colour for each house with its own sizes. No juggling four separate orders." },
    { icon: Trophy, title: "Built for running about", body: "AWDis Cool sports tees and vests are lightweight and wicking, so pupils stay comfortable all afternoon." },
    { icon: Users, title: "Pupils and staff", body: "Kids sizes from age 3 to 14 plus adult sizes - add matching staff hoodies or polos in the same order." },
    { icon: Shirt, title: "Badge front, house back", body: "Your school badge on the chest and the house name across the back - or upload a full design of your own." },
    { icon: PoundSterling, title: "Bulk prices for the whole school", body: "The discount counts every house together - order 4 houses x 30 and you get the 100+ price. Kids clothing is VAT-free." },
    { icon: Truck, title: "Ready before the big day", body: "Tell us your sports day date and we'll make sure everything's printed and delivered in good time." },
  ];
  const steps = [
    { icon: Palette, title: "Pick colours & garments", body: "Choose sports tees, vests, polos, hoodies or caps and add a colour for each house." },
    { icon: Upload, title: "Add your badge & house names", body: "Upload your school badge or a design, and type each house name for the back." },
    { icon: Eye, title: "Free proof", body: "We mock it up and send you a proof - nothing prints until you say yes." },
    { icon: CheckCircle2, title: "Printed & delivered", body: "UK printed and delivered to school, ready for sports day." },
  ];
  const faq = [
    { q: "Can each house have its own colour and name?", a: "Yes - add a colour for each house in the order builder and type the house name for the back of each one. It all goes through as one order." },
    { q: "Do you do children's sizes?", a: "Yes. The sports tees, vests and polos come in kids sizes from age 3-4 to 12-13 and adult sizes for older pupils and staff. Kids clothing is zero-rated for VAT, so it's cheaper." },
    { q: "Which t-shirt is best for sports day?", a: "Most schools choose the AWDis Cool sports t-shirt - it's lightweight, wicks sweat and comes in 50+ colours, so every house colour is covered. A cotton tee is a cheaper alternative." },
    { q: "Can we pay by invoice?", a: "Yes - pay by card in the builder, or send it as a quote and we'll invoice the school." },
    { q: "How much does it cost?", a: "Prices are per garment with your badge included, and drop as the whole order grows: 5% off at 20+, 10% at 30+, 12% at 60+ and 15% at 100+ garments across all houses." },
    { q: "How long does it take?", a: "Tell us your sports day date when you order and we'll plan the printing and delivery around it, so the kit arrives in good time." },
  ];

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="sports-day-page">
      <BoldNavbar />
      <JsonLd id="sports-day-faq" data={{ "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />

      <section className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-40 bg-gradient-to-r from-[#dc2626] via-[#2563eb] to-[#16a34a]" />
        <div className="relative max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#fde68a]">{hero.eyebrow}</div>
          <h1 className="font-black text-4xl sm:text-5xl lg:text-6xl mt-3 leading-tight max-w-3xl" data-testid="sports-day-title">{hero.title}</h1>
          <p className="text-zinc-200 mt-5 text-base sm:text-lg max-w-2xl">{hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/sports-day/order" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full" data-testid="sports-day-cta-build">
              Build your house colours order <ArrowRight size={16} />
            </Link>
            <Link to="/contact" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-extrabold px-6 py-3 rounded-full">
              <MessageCircle size={16} /> Get a quote
            </Link>
          </div>
        </div>
      </section>

      {photos.houses.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pt-14">
          <h2 className="font-black text-3xl sm:text-4xl text-center">A colour for every house</h2>
          <p className="text-center text-[#4b5563] mt-2">AWDis Cool sports tee - 50+ colours, adults and kids. House name across the back.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {photos.houses.map((h) => (
              <div key={h.colour} className="bg-white border-2 border-[#dcfce7] rounded-3xl overflow-hidden">
                <div className="aspect-square bg-white"><img src={h.image} alt={`${h.colour} sports t-shirt`} loading="lazy" className="w-full h-full object-contain p-4" /></div>
                <div className="p-4 text-center"><div className="font-black">{h.label}</div><div className="text-xs text-[#4b5563]">{h.colour}</div></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-20">
        <h2 className="font-black text-3xl sm:text-4xl text-center">Why schools order house colour kit</h2>
        <p className="text-[#4b5563] text-center mt-3 max-w-2xl mx-auto">Team spirit, easy-to-spot houses on the field, and one simple order for the whole school.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {benefits.map((b) => (
            <div key={b.title} className="bg-[#f0fdf4] rounded-3xl p-6 border border-[#dcfce7]">
              <b.icon className="text-[#16a34a]" size={24} />
              <h3 className="font-black text-lg mt-3">{b.title}</h3>
              <p className="text-sm text-[#4b5563] mt-2 leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-6">
        <h2 className="font-black text-3xl sm:text-4xl text-center">Also popular for sports day</h2>
        <p className="text-center text-[#4b5563] mt-2">Mix and match in the same order - all in adult and kids sizes.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {[["vest", "Sports vests"], ["cool-polo", "Sports polos"], ["hoodie", "Staff & pupil hoodies"], ["cap", "Caps"]].map(([k, label]) => (
            <div key={k} className="bg-white border-2 border-[#dcfce7] rounded-3xl overflow-hidden">
              <div className="aspect-square bg-white">{photos.extra[k] && <img src={photos.extra[k]} alt={label} loading="lazy" className="w-full h-full object-contain p-4" />}</div>
              <div className="p-4 text-center font-black">{label}</div>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/sports-day/order" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full">
            Build your house colours order <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="bg-[#f0fdf4] py-14 sm:py-20 mt-14">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-black text-3xl sm:text-4xl text-center">From order to sports day in four steps</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
            {steps.map((st, i) => (
              <div key={st.title} className="bg-white rounded-3xl p-6 border-2 border-[#dcfce7]">
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

      <section className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="font-black text-3xl text-center">Sports day kit - your questions</h2>
        <div className="mt-6 space-y-3">
          {faq.map((f) => (
            <details key={f.q} className="bg-white rounded-2xl border-2 border-[#dcfce7] p-4">
              <summary className="font-extrabold cursor-pointer">{f.q}</summary>
              <p className="text-sm text-[#4b5563] mt-2 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-[#1a1a1a] text-white rounded-3xl p-8 sm:p-10 flex flex-col md:flex-row md:items-center gap-6" data-testid="sports-day-easy-route">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Ready when you are</div>
            <h3 className="font-black text-2xl sm:text-3xl mt-1">Build it now - or just send us the details.</h3>
            <p className="text-zinc-300 mt-2 max-w-xl">Message us your school badge, house names and colours, rough numbers and sizes, and your sports day date. We&rsquo;ll send a free mock-up and a price, and invoice the school if that&rsquo;s easier.</p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 flex-shrink-0">
            <Link to="/sports-day/order" className="inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full">Build it now <ArrowRight size={16} /></Link>
            <a href={buildWhatsAppLink("Hi! I'd like house colour t-shirts for our sports day - can I send you the details?")} target="_blank" rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5a] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full"><MessageCircle size={16} /> WhatsApp us</a>
            <Link to="/contact" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-extrabold px-6 py-3 rounded-full">Get a quote</Link>
          </div>
        </div>
        <div className="mt-6 grid sm:grid-cols-3 gap-4 text-center text-sm">
          {[["No minimum order", "A class or the whole school"], ["Kids' sizes VAT-free", "Lower price on children's kit"], ["Free proof", "Approve before we print"]].map(([t, s]) => (
            <div key={t} className="p-3"><ShieldCheck className="mx-auto text-[#7bc67e]" size={20} /><div className="font-black mt-1">{t}</div><div className="text-[#4b5563]">{s}</div></div>
          ))}
        </div>
      </section>
      <BoldFooter />
    </div>
  );
}
