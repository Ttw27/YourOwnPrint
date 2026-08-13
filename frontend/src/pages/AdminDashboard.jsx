import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingBag, MessageSquare, HelpCircle, Star, Package, Upload,
  Wand2, Tags, Layers, FileText, Menu as MenuIcon, Image, Shirt,
  GraduationCap, Plug, SlidersHorizontal, ArrowRight,
} from "lucide-react";
import { adminFetchReviewStats } from "../lib/api";

/**
 * AdminDashboard — the admin home. Login lands here (instead of mid-task on
 * Product Settings), giving a clear launchpad into every area. Counts are
 * best-effort: if an endpoint isn't there, the tile still works as a link.
 */
const SECTIONS = [
  {
    heading: "Orders & customers",
    tiles: [
      { label: "Orders", to: "/admin/orders", icon: ShoppingBag, blurb: "View and manage customer orders." },
      { label: "Enquiries", to: "/admin/enquiries", icon: MessageSquare, blurb: "Quote requests and bespoke enquiries." },
      { label: "Questions (Q&A)", to: "/admin/qa", icon: HelpCircle, blurb: "Answer customer product questions." },
      { label: "Reviews", to: "/admin/reviews", icon: Star, blurb: "Moderate and import reviews." },
    ],
  },
  {
    heading: "Products",
    tiles: [
      { label: "Product settings", to: "/admin/product-settings", icon: Package, blurb: "Brand, SKU, descriptions, bulk pricing." },
      { label: "Import products", to: "/admin/products-import", icon: Upload, blurb: "Pull the catalogue and re-tag." },
      { label: "Designer products", to: "/admin/designer-products", icon: Wand2, blurb: "Which products use the online designer." },
      { label: "Collections & SEO", to: "/admin/collection-seo", icon: Tags, blurb: "Collection copy and search settings." },
      { label: "Bundle variants", to: "/admin/bundle-variants", icon: Layers, blurb: "Set up product bundles." },
    ],
  },
  {
    heading: "Content",
    tiles: [
      { label: "Page copy", to: "/admin/page-copy", icon: FileText, blurb: "Edit headings and intros across the site." },
      { label: "Navigation menu", to: "/admin/navigation", icon: MenuIcon, blurb: "Add or reorder menu links." },
      { label: "Portfolio", to: "/admin/portfolio", icon: Image, blurb: "Manage the work gallery." },
      { label: "Team kits", to: "/admin/team-kits", icon: Shirt, blurb: "Team kit builder settings." },
      { label: "Leavers templates", to: "/admin/leavers-templates", icon: GraduationCap, blurb: "Leavers hoodie templates." },
    ],
  },
  {
    heading: "Settings",
    tiles: [
      { label: "Integrations", to: "/admin/integrations", icon: Plug, blurb: "WhatsApp, Stripe, email, API keys." },
      { label: "Configurator settings", to: "/admin/configurator-settings", icon: SlidersHorizontal, blurb: "Kit and outfit configurator options." },
    ],
  },
];

export default function AdminDashboard() {
  const [reviewStats, setReviewStats] = useState(null);

  useEffect(() => {
    adminFetchReviewStats().then(setReviewStats).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 font-nunito text-[#1a1a1a]">
      <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Admin</div>
      <h1 className="font-black text-4xl lg:text-5xl mt-2">Dashboard</h1>
      <p className="text-[#4b5563] mt-3">Everything for running the shop, in one place.</p>

      {reviewStats && typeof reviewStats.pending === "number" && reviewStats.pending > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/admin/reviews" className="inline-flex items-center gap-2 bg-amber-50 border-2 border-amber-200 rounded-full px-4 py-2 text-sm font-extrabold">
            <Star size={14} className="text-amber-500" /> {reviewStats.pending} review{reviewStats.pending === 1 ? "" : "s"} awaiting moderation
          </Link>
        </div>
      )}

      {SECTIONS.map((sec) => (
        <div key={sec.heading} className="mt-9">
          <h2 className="font-black text-lg mb-3">{sec.heading}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sec.tiles.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className="group bg-white border-2 border-[#e5e7eb] hover:border-[#7bc67e] rounded-2xl p-4 transition-colors"
                  data-testid={`dash-${t.to.split("/").pop()}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#f0fdf4] grid place-items-center text-[#7bc67e] flex-shrink-0">
                      <Icon size={18} />
                    </div>
                    <div className="font-extrabold flex-1">{t.label}</div>
                    <ArrowRight size={15} className="text-[#cbd5e1] group-hover:text-[#7bc67e] transition-colors" />
                  </div>
                  <p className="text-xs text-[#4b5563] mt-2 leading-relaxed">{t.blurb}</p>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
