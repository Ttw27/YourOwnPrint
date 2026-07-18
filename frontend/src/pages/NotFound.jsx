import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import usePageTitle from "../hooks/usePageTitle";
import { ArrowRight, Search, Home as HomeIcon } from "lucide-react";

/**
 * Catch-all 404. Without this route, any unknown or mistyped URL rendered a
 * completely blank page — no nav, no footer, no way back — which looks broken
 * to customers and gives search engines nothing useful.
 */
export default function NotFound() {
  usePageTitle("Page not found");

  const suggestions = [
    { to: "/workwear", label: "Workwear" },
    { to: "/shop/t-shirts", label: "T-Shirts" },
    { to: "/shop/hoodies", label: "Hoodies" },
    { to: "/shop/polos", label: "Polo Shirts" },
    { to: "/industries", label: "Shop by industry" },
    { to: "/design", label: "Design Your Own" },
  ];

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen flex flex-col">
      <BoldNavbar />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-20 text-center" data-testid="not-found">
        <div className="text-[#7bc67e] font-extrabold text-sm uppercase tracking-[0.3em]">Error 404</div>
        <h1 className="font-black text-4xl sm:text-5xl mt-3">We can&rsquo;t find that page</h1>
        <p className="text-[#4b5563] mt-4 text-base sm:text-lg">
          The link may be out of date, or the address might have a typo in it. Everything else is still here &mdash;
          try one of these:
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="px-4 py-2 rounded-full bg-[#f0fdf4] border border-[#dcfce7] font-bold text-sm hover:bg-[#7bc67e] hover:border-[#7bc67e] transition-colors"
              data-testid={`not-found-link-${s.label}`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold rounded-full px-6 py-3 transition-colors"
          >
            <HomeIcon size={16} /> Back to the homepage
          </Link>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] font-extrabold rounded-full px-6 py-3 hover:bg-[#f0fdf4] transition-colors"
          >
            <Search size={16} /> Search products
          </Link>
        </div>

        <p className="text-xs text-[#4b5563] mt-10">
          Looking for something specific?{" "}
          <Link to="/contact" className="text-[#166534] font-extrabold hover:underline inline-flex items-center gap-1">
            Get in touch <ArrowRight size={11} />
          </Link>
        </p>
      </main>

      <BoldFooter />
    </div>
  );
}
