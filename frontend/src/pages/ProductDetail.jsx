import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import ProductReviews from "../components/bold/ProductReviews";
import { api, fetchReviewsAggregate } from "../lib/api";
import { ArrowRight, ShieldCheck, Truck, Sparkles } from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [aggregates, setAggregates] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/products/${id}`)
      .then(({ data }) => setProduct(data))
      .catch((e) => setErr(e?.response?.status === 404 ? "Product not found" : "Could not load product"))
      .finally(() => setLoading(false));
    fetchReviewsAggregate().then(setAggregates).catch(() => {});
  }, [id]);

  const agg = aggregates[id];

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-xs font-nunito font-bold text-[#4b5563] mb-4">
          <Link to="/" className="hover:text-[#7bc67e]">Home</Link>
          <span className="mx-2">/</span>
          <Link to={`/${product?.category === "workwear" ? "workwear" : product?.category === "teams-schools" ? "teams-schools" : ""}`} className="hover:text-[#7bc67e]">{product?.category || "Shop"}</Link>
          <span className="mx-2">/</span>
          <span data-testid="product-breadcrumb-name">{product?.name || ""}</span>
        </div>

        {loading ? (
          <div className="text-[#4b5563] py-20 text-center">Loading…</div>
        ) : err ? (
          <div className="text-rose-600 py-20 text-center font-nunito font-bold">{err}</div>
        ) : product && (
          <>
            <div className="grid lg:grid-cols-2 gap-10 mb-12">
              <div className="bg-[#f0fdf4] rounded-3xl p-8 border border-[#dcfce7]" data-testid="product-image-block">
                <div className="aspect-square overflow-hidden rounded-2xl bg-white">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
              </div>
              <div>
                <span className="inline-block bg-[#fde68a] text-[#1a1a1a] text-xs font-nunito font-extrabold uppercase tracking-wider px-3 py-1 rounded-full">{product.category}</span>
                <h1 data-testid="product-name" className="mt-3 font-nunito font-black text-4xl lg:text-5xl text-[#1a1a1a]">{product.name}</h1>
                <div className="mt-3 flex items-center gap-3">
                  {agg ? <><StarRating value={agg.average} size={18} /><span className="text-sm text-[#4b5563]">{agg.average.toFixed(1)} ({agg.count} reviews)</span></> : <span className="text-sm text-[#4b5563]">No reviews yet</span>}
                </div>
                <p className="text-[#4b5563] mt-5 text-lg">{product.description}</p>
                <div className="mt-6 flex items-baseline gap-3">
                  <span data-testid="product-price" className="text-[#7bc67e] font-nunito font-black text-5xl">£{product.price.toFixed(2)}</span>
                  <span className="text-sm text-[#4b5563]">incl. free print</span>
                </div>
                <Link to="/design" data-testid="product-customise" className="mt-7 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
                  Customise this product <ArrowRight size={16} />
                </Link>
                <div className="mt-8 grid grid-cols-3 gap-3 text-xs">
                  {[
                    { icon: ShieldCheck, label: "UK based" },
                    { icon: Truck, label: "Fast dispatch" },
                    { icon: Sparkles, label: "Free logo design" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="bg-[#f0fdf4] rounded-xl p-3 border border-[#dcfce7] text-center">
                      <Icon size={20} className="mx-auto text-[#7bc67e]" />
                      <div className="mt-1 font-nunito font-bold text-[#1a1a1a]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ProductReviews productId={product.id} productName={product.name} />
          </>
        )}
      </div>

      <BoldFooter />
    </div>
  );
}
