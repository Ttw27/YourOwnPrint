import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IndustrialNavbar, IndustrialFooter } from "../components/IndustrialLayout";
import { fetchProducts } from "../lib/api";
import { SECTORS } from "../lib/data";
import { ArrowRight } from "lucide-react";

export default function Workwear() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts("workwear").then(p => setProducts(p)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-[#0d0d0d] min-h-screen text-white font-ibm">
      <IndustrialNavbar />

      {/* Hero */}
      <div className="relative border-b border-[#222]">
        <div className="absolute inset-0">
          <img src="https://images.pexels.com/photos/8821005/pexels-photo-8821005.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="" className="w-full h-full object-cover opacity-30" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="text-[#ff6b35] font-oswald uppercase text-sm tracking-[0.3em]">Category</div>
          <h1 className="font-oswald uppercase text-5xl lg:text-7xl font-bold mt-3">Workwear</h1>
          <p className="text-neutral-300 mt-4 max-w-xl">Trade-tough garments. Branded with your logo. Free print included.</p>
        </div>
      </div>

      {/* Sector chips */}
      <div className="border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-6 py-6 flex gap-2 overflow-x-auto no-scrollbar">
          {SECTORS.map(s => (
            <span key={s.name} data-testid={`workwear-chip-${s.name}`} className="whitespace-nowrap px-4 py-2 border border-[#333] text-neutral-300 font-oswald uppercase tracking-wider text-xs hover:border-[#ff6b35] hover:text-[#ff6b35] cursor-pointer transition-colors">{s.name}</span>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        {loading ? (
          <div className="text-neutral-400 font-oswald uppercase tracking-widest">Loading products…</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p, i) => (
              <div key={p.id} data-testid={`workwear-product-${i}`} className="group bg-[#111] border border-[#222] hover:border-[#ff6b35] transition-colors">
                <div className="aspect-square overflow-hidden bg-[#1a1a1a]">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <div className="font-oswald uppercase font-semibold">{p.name}</div>
                  <div className="text-xs text-neutral-400 mt-1 line-clamp-2">{p.description}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[#ff6b35] font-oswald text-xl font-bold">£{p.price.toFixed(2)}</span>
                    <Link to="/design" className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-neutral-300 hover:text-[#ff6b35]">Design <ArrowRight size={12} /></Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <IndustrialFooter />
    </div>
  );
}
