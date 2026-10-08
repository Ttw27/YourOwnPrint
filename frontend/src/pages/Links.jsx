import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Mail, Star, ShieldCheck } from "lucide-react";
import { buildWhatsAppLink, RATING } from "../lib/data";
import { useBuilderImage, KIT_BUILDERS } from "../components/bold/KitBuilders";
import usePageTitle from "../hooks/usePageTitle";

/**
 * /links - the "link in bio" page for Instagram / Facebook / TikTok. Phone-first,
 * no menu: logo, WhatsApp + email, one big button per kit builder, then shop links.
 * Bio link: https://www.yourownprint.co.uk/links?utm_source=instagram&utm_medium=bio
 */
const BUILDERS = ["team", "gym", "dance", "sports-day", "school-trip", "leavers"];
const MORE = [
  ["Design your own", "Upload a photo or logo, add text - tees from £7.99", "/design"],
  ["Workwear with your logo", "From £8.49 · up to 35% off in bulk", "/kit-your-workforce"],
  ["Bundle deals", "Logo included · save up to 12%", "/bundles"],
  ["Specials", "Branded tees from £4.99, logo included", "/specials"],
  ["Fight night tees", "Walk-out & sponsor tees from £11.99", "/fight-night-tee"],
  ["Club shop link", "Parents pick sizes and pay for their own", "/club-shop/new"],
  ["Our work", "Real jobs for real clubs and businesses", "/portfolio"],
];

function BuilderButton({ k }) {
  const b = KIT_BUILDERS[k];
  const img = useBuilderImage(k);
  return (
    <Link to={b.to} className="flex items-center gap-3 bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-2xl p-2 pr-4 transition" data-testid={`links-builder-${k}`}>
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#f0fdf4] flex-shrink-0">
        {img.src && <img src={img.src} alt="" className={`w-full h-full ${img.photo ? "object-cover" : "object-contain p-1 mix-blend-multiply"}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-black leading-tight">{b.title}</div>
        <div className="text-xs text-[#4b5563] truncate">{b.who}</div>
      </div>
      <ArrowRight size={18} className="text-[#16a34a] flex-shrink-0" />
    </Link>
  );
}

export default function Links() {
  usePageTitle("Links", { description: "Your Own Print - kit builders, workwear, leavers hoodies and more. Printed in Leicester." });
  const wa = (e) => { e.preventDefault(); window.open(buildWhatsAppLink("Hi! I found you on Instagram - "), "_blank", "noopener"); };
  return (
    <div className="min-h-screen bg-[#f0fdf4] font-nunito text-[#1a1a1a]" data-testid="links-page">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="text-center">
          <Link to="/" className="inline-block bg-white rounded-2xl px-5 py-3 shadow-sm"><img src="/logo.png" alt="Your Own Print" className="h-12" /></Link>
          <p className="font-extrabold mt-3 leading-snug">Custom printed kit for teams, schools, studios &amp; businesses</p>
          <div className="text-xs text-[#4b5563] mt-1 flex items-center justify-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" /> {RATING.value} from {RATING.count} reviews</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck size={12} className="text-[#16a34a]" /> Free proof · no minimum</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-6">
          <a href={buildWhatsAppLink()} onClick={wa} className="flex items-center justify-center gap-2 bg-[#25D366] text-[#1a1a1a] font-black rounded-2xl py-3.5" data-testid="links-whatsapp">
            <MessageCircle size={18} /> WhatsApp us
          </a>
          <a href="mailto:info@yourownprint.co.uk" className="flex items-center justify-center gap-2 bg-[#1a1a1a] text-white font-black rounded-2xl py-3.5" data-testid="links-email">
            <Mail size={18} /> Email us
          </a>
        </div>
        <Link to="/" className="mt-2 flex items-center justify-center gap-2 bg-[#7bc67e] font-black rounded-2xl py-3.5" data-testid="links-shop">
          Shop the website <ArrowRight size={18} />
        </Link>

        <h2 className="text-xs uppercase tracking-[0.25em] font-extrabold text-[#16a34a] mt-8 mb-2">Build your kit online</h2>
        <div className="space-y-2">
          {BUILDERS.map((k) => <BuilderButton key={k} k={k} />)}
        </div>

        <h2 className="text-xs uppercase tracking-[0.25em] font-extrabold text-[#16a34a] mt-8 mb-2">More from us</h2>
        <div className="space-y-2">
          {MORE.map(([t, s, to]) => (
            <Link key={to} to={to} className="flex items-center gap-3 bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-2xl px-4 py-3 transition">
              <div className="flex-1 min-w-0"><div className="font-black leading-tight">{t}</div><div className="text-xs text-[#4b5563]">{s}</div></div>
              <ArrowRight size={18} className="text-[#16a34a] flex-shrink-0" />
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-[#4b5563] mt-8">Printed in Leicester · UK delivery · free collection &amp; LE1-LE5 delivery</p>
      </div>
    </div>
  );
}
