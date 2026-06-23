import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import { fetchProducts, fetchReviewsAggregate } from "../lib/api";
import { SECTORS } from "../lib/data";
import { ArrowRight } from "lucide-react";

export default function Workwear() {
  const [products, setProducts] = useState([]);
  const [aggs, setAggs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchProducts("workwear"), fetchReviewsAggregate()])
      .then(([p, a]) => { setProducts(p); setAggs(a); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-[#fde68a]/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="text-[#7bc67e] font-nunito font-extrabold text-sm uppercase tracking-[0.3em]">Category</div>
          <h1 className="font-nunito font-black text-5xl lg:text-7xl mt-3">Workwear</h1>
          <p className="text-[#4b5563] mt-4 max-w-xl text-lg">Trade-tough garments branded with your logo. Free print included.</p>
        </div>
      </div>

      <div className="border-b border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex gap-2 overflow-x-auto no-scrollbar">
          {SECTORS.map((s, i) => (
            <span key={s.name} data-testid={`workwear-chip-${i}`} className="whitespace-nowrap px-4 py-2 rounded-full bg-[#f0fdf4] border border-[#dcfce7] text-[#1a1a1a] font-nunito font-bold text-xs hover:bg-[#7bc67e] hover:border-[#7bc67e] cursor-pointer transition-colors">{s.name}</span>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {loading ? (
          <div className="text-[#4b5563]">Loading products…</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((p, i) => {
              const agg = aggs[p.id];
              return (
                <Link key={p.id} to={`/product/${p.id}`} data-testid={`workwear-product-${i}`} className="group bg-white rounded-2xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md transition-all overflow-hidden">
                  <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-4">
                    <div className="font-nunito font-bold text-[#1a1a1a]">{p.name}</div>
                    <div className="text-xs text-[#4b5563] mt-1 line-clamp-2">{p.description}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[#7bc67e] font-nunito font-extrabold text-xl">£{p.price.toFixed(2)}</span>
                      {agg && <StarRating value={agg.average} size={12} />}
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-nunito font-bold text-[#1a1a1a]">View product <ArrowRight size={12} /></div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <BoldFooter />
    </div>
  );
}
