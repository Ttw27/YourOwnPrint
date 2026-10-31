import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchBrands } from "../lib/api";
import { ArrowRight, Loader2, Search } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

/**
 * /brands - Shop by brand. Every maker we stock (supplier sub-lines grouped,
 * e.g. Result Core + Result Work-Guard = Result), each linking to /brands/:slug.
 */
export default function Brands() {
  usePageTitle("Shop by brand", { description: "Gildan, AWDis, Pro RTX, Portwest, Regatta, Stanley/Stella and more - every brand we print on, in one place." });
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { fetchBrands().then(setData).catch(() => setErr(true)); }, []);

  const brands = useMemo(() => {
    const all = data?.brands || [];
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((b) => b.name.toLowerCase().includes(s) || b.lines.some((l) => l.toLowerCase().includes(s)));
  }, [data, q]);

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid="brands-page">
      <BoldNavbar />
      <header className="bg-[#1a1a1a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <Link to="/" className="text-xs text-[#7bc67e] hover:underline">&larr; Home</Link>
          <h1 className="font-black text-5xl lg:text-6xl mt-3">Shop by brand</h1>
          <p className="text-zinc-300 mt-3 max-w-2xl">
            Know the brand you want? Every maker we print on is here{data ? ` - ${data.total} brands` : ""}.
            Pick one to see all its styles, then filter by product type, colour and size.
          </p>
          <label className="mt-6 flex items-center gap-2 bg-white text-[#1a1a1a] rounded-full px-4 py-2.5 max-w-md">
            <Search size={16} className="text-[#7bc67e]" />
            <input id="brand-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a brand, e.g. Gildan or Just Hoods"
              className="flex-1 text-sm focus:outline-none bg-transparent" data-testid="brand-search" />
          </label>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-10">
        {err && <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm">Couldn't load the brands just now - please try again in a moment.</div>}
        {!data && !err && <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>}
        {data && brands.length === 0 && (
          <div className="bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-6 text-sm">
            No brand matches "{q}". <Link to="/contact" className="underline font-extrabold text-[#166534]">Ask us</Link> - we can often get other brands in.
          </div>
        )}
        {brands.length > 1 && (
          <nav className="flex flex-wrap gap-1.5 mb-8" aria-label="All brands" data-testid="brand-chips">
            {brands.map((b) => (
              <Link key={b.slug} to={`/brands/${b.slug}`} className="text-xs font-extrabold border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-full px-3 py-1">
                {b.name} <span className="text-[#9ca3af] font-bold">{b.count}</span>
              </Link>
            ))}
          </nav>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {brands.map((b) => (
            <Link key={b.slug} to={`/brands/${b.slug}`} className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-shadow hover:shadow-md min-w-0" data-testid={`brand-${b.slug}`}>
              <div className="aspect-[4/3] bg-[#f0fdf4] overflow-hidden">
                {b.image && <img src={b.image} alt={b.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />}
              </div>
              <div className="p-4">
                <div className="font-black text-lg leading-tight">{b.name}</div>
                <div className="text-xs text-[#4b5563] mt-1">{b.count} style{b.count === 1 ? "" : "s"} · {b.top_types.map((t) => t.replace(/-/g, " ")).join(", ")}</div>
                {b.lines.length > 0 && <div className="text-[11px] text-[#9ca3af] mt-1 line-clamp-2">Includes {b.lines.join(", ")}</div>}
                <span className="mt-2 text-xs inline-flex items-center gap-1 text-[#7bc67e] font-extrabold group-hover:translate-x-0.5 transition-transform">See all <ArrowRight size={12} /></span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <BoldFooter />
    </div>
  );
}
