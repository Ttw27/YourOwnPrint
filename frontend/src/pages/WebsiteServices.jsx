import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import usePageTitle from "../hooks/usePageTitle";
import usePageCopy from "../hooks/usePageCopy";
import { Check, Globe, ShoppingCart, Megaphone, Package, ArrowRight } from "lucide-react";

/**
 * Website, ad and white label services (from the old site's Website Services,
 * Ad Services and White Label pages). Heading/intro editable in Admin > Page
 * Copy ("website-services").
 */
const WEBSITES = [
  {
    icon: Globe, name: "Business website", price: "£200", note: "one-off",
    blurb: "A clean, professional website so customers can find you, see what you do and get in touch.",
    points: ["Up to 5 pages - home, about, services, gallery, contact", "Mobile-friendly design in your brand colours", "Contact form + click-to-call / WhatsApp", "Help registering your domain name", "Basic Google (SEO) setup", "You own it all - website, domain and content"],
  },
  {
    icon: ShoppingCart, name: "Full e-commerce shop", price: "£1,000+", note: "quoted to your needs",
    blurb: "A proper online shop to sell your products, take card payments and manage orders.",
    points: ["Product catalogue with photos, sizes and variants", "Secure card payments (Stripe / PayPal)", "Basket, checkout, delivery options and order emails", "Admin area to add products and manage orders", "SEO setup so your products can be found", "You own it all - no monthly platform fees to us"],
  },
];

export default function WebsiteServices() {
  usePageTitle("Website & Ad Services", { description: "Business websites from £200 and full e-commerce shops from £1,000 - you own it all. Plus ad campaign setup and white label printing." });
  const copy = usePageCopy("website-services", {
    title: "Websites & ads for your business",
    subtitle: "We build the clothing that shows your brand off - and we can build the website and ads that bring the customers in too.",
    body: "Simple, fair pricing and no tie-ins. Once it's built, it's yours - the website, the domain and everything on it.",
  });
  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <section className="bg-[#f0fdf4] border-b border-[#dcfce7]">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#166534]">Services</div>
          <h1 className="font-black text-4xl sm:text-5xl mt-3 leading-[1.05]">{copy.title}</h1>
          <p className="text-xl font-bold mt-4 max-w-3xl">{copy.subtitle}</p>
          <p className="text-[#4b5563] mt-3 max-w-3xl">{copy.body}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="font-black text-3xl">Websites</h2>
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          {WEBSITES.map((w) => (
            <div key={w.name} className="border-2 border-[#dcfce7] rounded-3xl p-6 flex flex-col" data-testid={`service-${w.name}`}>
              <span className="w-11 h-11 rounded-xl bg-[#f0fdf4] grid place-items-center"><w.icon size={20} className="text-[#166534]" /></span>
              <h3 className="font-black text-2xl mt-3">{w.name}</h3>
              <div className="mt-1"><span className="font-black text-3xl text-[#166534]">{w.price}</span> <span className="text-sm text-[#4b5563]">{w.note}</span></div>
              <p className="text-[#4b5563] mt-2">{w.blurb}</p>
              <ul className="mt-4 space-y-1.5 text-sm flex-1">
                {w.points.map((p) => <li key={p} className="flex gap-2"><Check size={16} className="text-[#16a34a] flex-shrink-0 mt-0.5" />{p}</li>)}
              </ul>
              <Link to="/business-enquiry" className="mt-5 inline-flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold rounded-full px-6 py-3">Get started <ArrowRight size={16} /></Link>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#6b7280] mt-3">Domain names and any hosting are paid at cost and registered in your name.</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="bg-[#1a1a1a] text-white rounded-3xl p-8 grid md:grid-cols-[auto_1fr] gap-6 items-start">
          <span className="w-12 h-12 rounded-xl bg-white/10 grid place-items-center"><Megaphone size={22} className="text-[#7bc67e]" /></span>
          <div>
            <h2 className="font-black text-3xl">Ad services</h2>
            <p className="text-neutral-300 mt-2 max-w-3xl">Get your business in front of the right people on Facebook, Instagram, Google and TikTok. We set up your campaigns properly - tracking pixels, events and audiences - so you can see exactly what your ads bring in. One-off setup or ongoing management, and no tie-in contracts.</p>
            <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
              {["Platform advice - where your customers actually are", "Pixel + conversion tracking on your website", "Campaign and audience setup", "Optional ongoing management, testing and reports"].map((p) => (
                <li key={p} className="flex gap-2"><Check size={16} className="text-[#7bc67e] flex-shrink-0 mt-0.5" />{p}</li>
              ))}
            </ul>
            <Link to="/business-enquiry" className="mt-5 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold rounded-full px-6 py-3">Ask about ads <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="border-2 border-[#eef2f7] rounded-3xl p-8 grid md:grid-cols-[auto_1fr] gap-6 items-start" data-testid="service-white-label">
          <span className="w-12 h-12 rounded-xl bg-[#f0fdf4] grid place-items-center"><Package size={22} className="text-[#166534]" /></span>
          <div>
            <h2 className="font-black text-3xl">White label printing</h2>
            <p className="text-[#4b5563] mt-2 max-w-3xl">Run your own clothing or print business? We&rsquo;ll print and send orders on your behalf - to you or straight to your customers - with no Your Own Print branding. Include your own invoice or packing slip and add your own markup.</p>
            <Link to="/business-enquiry" className="mt-5 inline-flex items-center gap-2 border-2 border-[#1a1a1a] font-extrabold rounded-full px-6 py-3">Talk to us about white label <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>
      <BoldFooter />
    </div>
  );
}
