import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IndustrialNavbar, IndustrialFooter } from "../components/IndustrialLayout";
import { fetchProducts } from "../lib/api";
import { ArrowRight } from "lucide-react";

export default function TeamsSchools() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts("teams-schools").then(p => setProducts(p)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-[#0d0d0d] min-h-screen text-white font-ibm">
      <IndustrialNavbar />

      <div className="relative border-b border-[#222]">
        <div className="absolute inset-0">
          <img src="https://images.pexels.com/photos/8926904/pexels-photo-8926904.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="" className="w-full h-full object-cover opacity-30" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="text-[#ff6b35] font-oswald uppercase text-sm tracking-[0.3em]">Category</div>
          <h1 className="font-oswald uppercase text-5xl lg:text-7xl font-bold mt-3">Teams, Schools & Clubs</h1>
          <p className="text-neutral-300 mt-4 max-w-xl">Leavers hoodies, kit, dance & theatre apparel. Names on the back included.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { title: "Leavers Hoodies", desc: "Class-of-XXXX with full back-print names." },
            { title: "Sports Kits", desc: "Match-day polos & tees with crests." },
            { title: "Dance & Theatre", desc: "Soft drape tees for performers." },
          ].map(b => (
            <div key={b.title} className="bg-[#111] border border-[#222] p-6">
              <div className="font-oswald uppercase text-xl">{b.title}</div>
              <p className="text-sm text-neutral-400 mt-2">{b.desc}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-neutral-400 font-oswald uppercase tracking-widest">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p, i) => (
              <div key={p.id} data-testid={`teams-product-${i}`} className="group bg-[#111] border border-[#222] hover:border-[#ff6b35] transition-colors">
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
