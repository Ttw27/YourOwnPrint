import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import WhatsAppFAB, { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import { fetchLeaversProducts, fetchLeaversTiers } from "../lib/api";
import { Sparkles, GraduationCap, Users, CalendarDays, Mail, Truck, ShieldCheck, Star, Package, ArrowRight } from "lucide-react";

const TEMPLATES = [
  { id: "year-nicknames",  title: "Year + nicknames",         desc: "Big year on the front, nicknames list on the back. The classic.",       img: "https://images.pexels.com/photos/8839894/pexels-photo-8839894.jpeg" },
  { id: "class-list",      title: "Class list",                desc: "Every leaver's name printed on the back. One hoodie, the whole year.", img: "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg" },
  { id: "varsity",         title: "Varsity letter",            desc: "Letter on chest, year on the back, your name on the left sleeve.",     img: "https://images.pexels.com/photos/16429777/pexels-photo-16429777.jpeg" },
];

export default function LeaversHoodies() {
  const [products, setProducts] = useState([]);
  const [tiers, setTiers] = useState({ tiers: [], bag_price: 3.99 });
  const navigate = useNavigate();
  useEffect(() => {
    fetchLeaversProducts().then(setProducts);
    fetchLeaversTiers().then(setTiers);
  }, []);
  const tiersAsc = [...(tiers.tiers || [])].sort((a, b) => a.min_qty - b.min_qty);

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <WhatsAppFAB preset="Hi! Quick question about leavers' hoodies for our year group." />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-20 -left-24 w-[500px] h-[500px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 w-[420px] h-[420px] rounded-full bg-[#fde68a]/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f0fdf4] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs">
              <GraduationCap size={14} className="text-[#7bc67e]" /> Class of 2026 · Year 11 · Year 13 · College
            </div>
            <h1 className="font-nunito font-black text-5xl lg:text-7xl mt-3 leading-[1.02]">
              Leavers&apos; hoodies <span className="relative inline-block"><span className="relative z-10">done right.</span><span className="absolute left-0 right-0 bottom-1 h-3 bg-[#7bc67e] -z-0 rounded-full" /></span>
            </h1>
            <p className="text-[#4b5563] mt-4 text-lg max-w-lg">Pullover hoodies, zip hoodies, varsity jackets — printed in the UK in 7–10 days. <strong>Share one link with your year group</strong> — everyone adds their own name &amp; size. You get a free proof before we print a thing.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button data-testid="leavers-start-cta" onClick={() => navigate("/leavers-hoodies/start")} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
                Start a group order <ArrowRight size={16} />
              </button>
              <WhatsAppInline preset="Hi! Quick question about leavers' hoodies." label="Chat on WhatsApp" />
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs text-[#4b5563]">
              <span className="inline-flex items-center gap-1"><ShieldCheck size={14} className="text-[#7bc67e]" /> Free proof before print</span>
              <span className="inline-flex items-center gap-1"><Truck size={14} className="text-[#7bc67e]" /> UK printed · 7–10 days</span>
              <span className="inline-flex items-center gap-1"><Star size={14} className="text-[#fde68a] fill-[#fde68a]" /> 4.9 from 800+ reviews</span>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl">
              <img src="https://images.pexels.com/photos/8839894/pexels-photo-8839894.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk tier ladder */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        <h2 className="font-nunito font-black text-3xl lg:text-4xl text-center">Bigger groups, better prices</h2>
        <p className="text-center text-[#4b5563] mt-2">The whole year group&apos;s price drops as more classmates join.</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8 max-w-4xl mx-auto" data-testid="leavers-tier-ladder">
          <Tier label="1–19" price="from £24.99" sub="Pullover hoodie list price" />
          {tiersAsc.map((t) => (
            <Tier key={t.min_qty} testId={`tier-${t.min_qty}`} label={`${t.min_qty}+`} price={`£${t.unit_price.toFixed(2)}`} sub={`/ hoodie`} highlight={t.min_qty === 60} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <span className="inline-flex items-center gap-2 bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-4 py-2 text-sm" data-testid="leavers-bag-callout">
            <Package size={14} className="text-[#7bc67e]" />
            Add a matching <strong className="text-[#1a1a1a]">printed drawstring bag</strong> for just <strong className="text-[#7bc67e]">£{tiers.bag_price.toFixed(2)}</strong> per hoodie
          </span>
        </div>
      </div>

      {/* Garments */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <h2 className="font-nunito font-black text-3xl lg:text-4xl">Pick your garment</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6" data-testid="leavers-garments">
          {products.filter(p => p.id !== "leavers-drawstring-bag").map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} data-testid={`leavers-product-${p.id}`} className="group bg-white rounded-2xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md transition-all overflow-hidden">
              <div className="aspect-square overflow-hidden bg-[#f0fdf4]"><img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /></div>
              <div className="p-4">
                <div className="font-nunito font-extrabold">{p.name}</div>
                <div className="text-xs text-[#4b5563] mt-1 line-clamp-2">{p.description}</div>
                <div className="mt-3 flex items-center justify-between"><span className="text-[#7bc67e] font-nunito font-extrabold text-xl">from £{p.price.toFixed(2)}</span><ArrowRight size={14} className="text-[#7bc67e]" /></div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Design templates */}
      <div className="bg-[#f0fdf4] py-14 border-y border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-nunito font-black text-3xl lg:text-4xl">Ready-to-go designs</h2>
          <p className="text-[#4b5563] mt-2">Start with one of these or send us your own — we&apos;ll send you a free proof either way.</p>
          <div className="grid md:grid-cols-3 gap-4 mt-8" data-testid="leavers-templates">
            {TEMPLATES.map((t) => (
              <button key={t.id} data-testid={`leavers-template-${t.id}`} onClick={() => navigate("/leavers-hoodies/start?template=" + t.id)} className="text-left bg-white rounded-2xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md transition-all overflow-hidden">
                <div className="aspect-[4/3] overflow-hidden bg-[#f0fdf4]"><img src={t.img} alt="" className="w-full h-full object-cover" /></div>
                <div className="p-4">
                  <div className="font-nunito font-extrabold">{t.title}</div>
                  <div className="text-xs text-[#4b5563] mt-1">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        <h2 className="font-nunito font-black text-3xl lg:text-4xl text-center">How the group order works</h2>
        <div className="grid md:grid-cols-4 gap-4 mt-8">
          <Step n={1} icon={<GraduationCap size={18} />} title="You start it" body="Set school, year group, garment + deadline." />
          <Step n={2} icon={<Users size={18} />} title="Share the link" body="Drop the link in the year-group chat — everyone adds their own name &amp; size." />
          <Step n={3} icon={<CalendarDays size={18} />} title="We send a proof" body="When you close it, we send a free artwork proof for sign-off." />
          <Step n={4} icon={<Mail size={18} />} title="You pay once" body="Pay the whole group total via Stripe or Klarna. We ship to one address." />
        </div>
      </div>

      <div className="bg-[#1a1a1a] text-white py-14">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-nunito font-black text-3xl lg:text-4xl">Ready to start your year&apos;s hoodies?</h2>
          <p className="text-neutral-300 mt-3">Takes about 2 minutes. We do the rest.</p>
          <button data-testid="leavers-start-cta-bottom" onClick={() => navigate("/leavers-hoodies/start")} className="mt-6 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
            Start a group order <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <BoldFooter />
    </div>
  );
}

function Tier({ label, price, sub, highlight, testId }) {
  return (
    <div data-testid={testId} className={`rounded-2xl border-2 p-4 text-center ${highlight ? "border-[#7bc67e] bg-[#f0fdf4] -translate-y-1 shadow-md" : "border-[#dcfce7] bg-white"}`}>
      <div className="text-xs uppercase tracking-wider text-[#4b5563] font-nunito font-extrabold">{label}</div>
      <div className="font-nunito font-black text-2xl text-[#1a1a1a] mt-1">{price}</div>
      <div className="text-[10px] text-[#4b5563] mt-1">{sub}</div>
    </div>
  );
}
function Step({ n, icon, title, body }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#dcfce7] p-5">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-[#7bc67e] text-[#1a1a1a] grid place-items-center font-nunito font-black text-sm">{n}</span>
        <span className="text-[#7bc67e]">{icon}</span>
      </div>
      <div className="font-nunito font-extrabold mt-3">{title}</div>
      <div className="text-xs text-[#4b5563] mt-1" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}
