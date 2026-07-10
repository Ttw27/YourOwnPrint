import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import { fetchProducts, fetchRecentReviews, fetchReviewsAggregate } from "../lib/api";
import { Star, ShieldCheck, Camera } from "lucide-react";

export default function ReviewsPage() {
  const [products, setProducts] = useState([]);
  const [aggregates, setAggregates] = useState({});
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchProducts(undefined, 200), fetchReviewsAggregate(), fetchRecentReviews(24)])
      .then(([prods, aggs, rec]) => {
        setProducts(prods.items || []);
        setAggregates(aggs);
        setRecent(rec);
      })
      .finally(() => setLoading(false));
  }, []);

  const overallTotal = Object.values(aggregates).reduce((a, b) => a + b.count, 0);
  const overallAvg = overallTotal
    ? (Object.values(aggregates).reduce((a, b) => a + b.average * b.count, 0) / overallTotal).toFixed(1)
    : "—";

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-16 -left-16 w-[360px] h-[360px] rounded-full bg-[#7bc67e]/20 blur-3xl" />
        <div className="max-w-7xl mx-auto px-6 py-16 relative">
          <h1 className="font-nunito font-black text-5xl lg:text-6xl">Customer Reviews</h1>
          <div className="mt-4 flex items-center gap-3 text-[#1a1a1a]">
            <StarRating value={Number(overallAvg) || 0} size={22} />
            <span className="text-xl font-nunito font-extrabold">{overallAvg}</span>
            <span className="text-sm text-[#4b5563]">· {overallTotal} verified reviews on this site</span>
          </div>
          <p className="text-[#4b5563] mt-3 max-w-xl">Read what real customers are saying — and leave your own review with photos if you've ordered with us.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="font-nunito font-extrabold text-2xl mb-5">Pick a product to review</h2>
        {loading ? (
          <div className="text-[#4b5563]">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => {
              const agg = aggregates[p.id];
              return (
                <Link key={p.id} to={`/product/${p.id}`} data-testid={`reviews-product-${p.id}`} className="bg-white rounded-2xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md transition-all overflow-hidden">
                  <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                    <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-4">
                    <div className="font-nunito font-bold text-[#1a1a1a]">{p.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {agg ? (
                        <>
                          <StarRating value={agg.average} size={12} />
                          <span className="text-xs text-[#4b5563]">{agg.count}</span>
                        </>
                      ) : (
                        <span className="text-xs text-[#4b5563]">Be the first!</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <h2 className="font-nunito font-extrabold text-2xl mt-14 mb-5">Most Recent Reviews</h2>
        {recent.length === 0 ? (
          <div className="bg-[#f0fdf4] rounded-2xl p-8 text-center border border-[#dcfce7]">
            <Camera className="mx-auto text-[#7bc67e]" size={28} />
            <div className="font-nunito font-extrabold text-xl mt-2">No reviews yet — be the first!</div>
            <div className="text-sm text-[#4b5563] mt-1">Pick a product above and leave a review with photos.</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {recent.map((r) => (
              <div key={r.id} className="bg-[#f0fdf4] rounded-2xl p-5 border border-[#dcfce7]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <StarRating value={r.rating} />
                  <span className="text-xs text-[#4b5563]">{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                </div>
                <h3 className="font-nunito font-extrabold text-lg mt-2">{r.title}</h3>
                <p className="text-[#4b5563] text-sm mt-1">"{r.body}"</p>
                {r.photos && r.photos.length > 0 && (
                  <div className="mt-3 flex gap-1.5">
                    {r.photos.slice(0, 4).map((src, i) => (
                      <img key={i} src={src} alt="" loading="lazy" className="w-14 h-14 object-cover rounded-lg" />
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs font-nunito font-bold">
                  <span className="text-[#7bc67e]">— {r.reviewer_name}</span>
                  {r.verified && <span className="inline-flex items-center gap-0.5 text-[10px] bg-[#7bc67e] text-[#1a1a1a] px-1.5 py-0.5 rounded-full"><ShieldCheck size={8} /> Verified</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BoldFooter />
    </div>
  );
}
