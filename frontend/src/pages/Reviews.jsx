import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import { ReviewForm } from "../components/bold/ProductReviews";
import SiteImage from "../components/bold/SiteImage";
import {
  fetchProducts, fetchRecentReviews, fetchReviewsAggregate, fetchStoreReviews,
} from "../lib/api";
import usePageTitle from "../hooks/usePageTitle";
import usePageCopy from "../hooks/usePageCopy";
import {
  ShieldCheck, Camera, Search, X, ChevronLeft, ChevronRight,
  AlertTriangle, RefreshCw, Store, PenLine,
} from "lucide-react";

// Options divide evenly by 2, 3 and 4, so no size leaves an orphan on its own
// row whichever breakpoint the grid is at.
const PAGE_SIZES = [12, 24, 48];
const STORE_ID = "store";

export default function ReviewsPage() {
  usePageTitle("Customer Reviews");
  // Admin → Page Copy → "Reviews": edit the heading without code.
  const copy = usePageCopy("reviews", { title: "Customer Reviews" });

  const [products, setProducts] = useState([]);
  const [aggregates, setAggregates] = useState({});
  const [recent, setRecent] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [store, setStore] = useState({ average: 0, count: 0, reviews: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [showStoreForm, setShowStoreForm] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(false);
    Promise.all([
      fetchProducts(undefined, 500),
      fetchReviewsAggregate(),
      fetchRecentReviews(60),
      fetchStoreReviews(24),
    ])
      .then(([prods, aggs, rec, st]) => {
        setProducts(prods.items || []);
        setAggregates(aggs || {});
        // Media-first: reviews with photos lead (they're the strongest social
        // proof), then the rest — each group kept in its recency order.
        const list = rec || [];
        const withPhotos = list.filter((r) => r.photos && r.photos.length > 0);
        const withoutPhotos = list.filter((r) => !r.photos || r.photos.length === 0);
        setRecent([...withPhotos, ...withoutPhotos]);
        setStore(st || { average: 0, count: 0, reviews: [] });
      })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Filtering happens in the browser: the whole catalogue is already loaded for
  // the ratings, so a round trip per keystroke would be slower and no more accurate.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.name || ""} ${p.brand || ""} ${p.category || ""}`.toLowerCase().includes(q)
    );
  }, [products, query]);

  // A search that shortens the list can strand you on a page that no longer
  // exists, which reads as "no products" rather than "wrong page".
  useEffect(() => { setPage(0); }, [query, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const overallTotal = Object.values(aggregates).reduce((a, b) => a + b.count, 0);
  const overallAvg = overallTotal
    ? (Object.values(aggregates).reduce((a, b) => a + b.average * b.count, 0) / overallTotal).toFixed(1)
    : "—";

  // Page numbers, windowed so 40 pages don't render 40 buttons.
  const pageNumbers = useMemo(() => {
    const span = 2;
    const out = [];
    for (let i = 0; i < totalPages; i++) {
      if (i === 0 || i === totalPages - 1 || Math.abs(i - safePage) <= span) out.push(i);
      else if (out[out.length - 1] !== "gap") out.push("gap");
    }
    return out;
  }, [totalPages, safePage]);

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-16 -left-16 w-[360px] h-[360px] rounded-full bg-[#7bc67e]/20 blur-3xl" />
        <div className="max-w-7xl mx-auto px-6 py-16 relative">
          <h1 className="font-nunito font-black text-5xl lg:text-6xl">{copy.title}</h1>
          <div className="mt-4 flex items-center gap-3 text-[#1a1a1a]">
            <StarRating value={Number(overallAvg) || 0} size={22} />
            <span className="text-xl font-nunito font-extrabold">{overallAvg}</span>
            <span className="text-sm text-[#4b5563]">· {overallTotal} verified reviews on this site</span>
          </div>
          <p className="text-[#4b5563] mt-3 max-w-xl">Read what real customers are saying — and leave your own review with photos if you've ordered with us.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">

        <div className="bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-3xl p-6 mb-12" data-testid="store-review-block">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-white grid place-items-center flex-shrink-0 border border-[#dcfce7]">
              <Store className="text-[#7bc67e]" size={22} />
            </div>
            <div className="flex-1 min-w-[240px]">
              <h2 className="font-nunito font-extrabold text-xl">Rather review us than a product?</h2>
              <p className="text-sm text-[#4b5563] mt-1">
                Tell us how the whole experience went &mdash; ordering, artwork, delivery, the lot. No need to
                hunt down the exact garment you bought.
              </p>
              {store.count > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <StarRating value={store.average} size={14} />
                  <span className="text-xs text-[#4b5563]">{store.average} from {store.count} review{store.count === 1 ? "" : "s"} about the shop</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowStoreForm((v) => !v)}
              className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold rounded-full px-5 py-2.5 transition-colors"
              data-testid="store-review-toggle"
            >
              {showStoreForm ? <><X size={16} /> Close</> : <><PenLine size={16} /> Review the shop</>}
            </button>
          </div>
          {showStoreForm && (
            <div className="mt-5 pt-5 border-t border-[#dcfce7]">
              <ReviewForm
                productId={STORE_ID}
                productName="Your Own Print"
                onDone={() => { setShowStoreForm(false); load(); }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap mt-14 mb-5">
          <h2 className="font-nunito font-extrabold text-2xl">What customers are saying</h2>
          <label className="inline-flex items-center gap-2 text-sm font-bold cursor-pointer bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-full px-4 py-2" data-testid="reviews-media-toggle">
            <input type="checkbox" checked={mediaOnly} onChange={(e) => setMediaOnly(e.target.checked)} className="w-4 h-4 accent-[#7bc67e]" />
            <Camera size={15} className="text-[#7bc67e]" /> With photos only
          </label>
        </div>
        {recent.length === 0 ? (
          <div className="bg-[#f0fdf4] rounded-2xl p-8 text-center border border-[#dcfce7]">
            <Camera className="mx-auto text-[#7bc67e]" size={28} />
            <div className="font-nunito font-extrabold text-xl mt-2">No reviews yet &mdash; be the first!</div>
            <div className="text-sm text-[#4b5563] mt-1">Leave a review with photos below.</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(mediaOnly ? recent.filter((r) => r.photos && r.photos.length > 0) : recent).map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border-2 border-[#dcfce7] overflow-hidden flex flex-col">
                {r.photos && r.photos.length > 0 && (
                  <div className={`grid gap-0.5 ${r.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {r.photos.slice(0, r.photos.length === 3 ? 3 : 4).map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightbox(src)}
                        className={`relative overflow-hidden bg-[#f1f5f9] ${r.photos.length === 1 ? "aspect-[4/3]" : "aspect-square"} ${r.photos.length === 3 && i === 0 ? "col-span-2" : ""}`}
                        data-testid="recent-review-photo"
                      >
                        <SiteImage src={src} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" testid="recent-review-photo-img" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <StarRating value={r.rating} />
                    <span className="text-xs text-[#4b5563]">{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                  </div>
                  {r.title && <h3 className="font-nunito font-extrabold text-lg mt-2">{r.title}</h3>}
                  <p className="text-[#4b5563] text-sm mt-1 flex-1">&ldquo;{r.body}&rdquo;</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-nunito font-bold flex-wrap">
                    <span className="text-[#7bc67e]">&mdash; {r.reviewer_name}</span>
                    {r.product_id === STORE_ID && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-[#f0fdf4] border border-[#dcfce7] text-[#4b5563] px-1.5 py-0.5 rounded-full">
                        <Store size={9} /> About the shop
                      </span>
                    )}
                    {r.verified && <span className="inline-flex items-center gap-0.5 text-[10px] bg-[#7bc67e] text-[#1a1a1a] px-1.5 py-0.5 rounded-full"><ShieldCheck size={8} /> Verified</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox for enlarging review photos */}
        {lightbox && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 grid place-items-center p-6 cursor-zoom-out"
            onClick={() => setLightbox(null)}
            data-testid="reviews-lightbox"
          >
            <img src={lightbox} alt="Review photo" className="max-w-full max-h-full rounded-2xl object-contain" />
          </div>
        )}

        {/* Leave a review — collapsed by default so the reviews above stay the focus.
            Opens a search-only picker (no wall of products); type to find yours. */}
        <div className="mt-14 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-3xl p-6" data-testid="leave-review-block">
          {!showPicker ? (
            <div className="flex items-center gap-4 flex-wrap justify-between">
              <div className="flex items-start gap-4 flex-1 min-w-[240px]">
                <div className="w-12 h-12 rounded-2xl bg-white grid place-items-center flex-shrink-0 border border-[#dcfce7]">
                  <PenLine className="text-[#7bc67e]" size={22} />
                </div>
                <div>
                  <h2 className="font-nunito font-extrabold text-xl">Ordered with us? Leave a review</h2>
                  <p className="text-sm text-[#4b5563] mt-1">Search for the product you bought and tell others what you thought.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold rounded-full px-5 py-2.5"
                data-testid="leave-review-open"
              >
                <PenLine size={16} /> Leave a review
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h2 className="font-nunito font-extrabold text-xl">Find the product you bought</h2>
                <button type="button" onClick={() => { setShowPicker(false); setQuery(""); }} className="text-sm font-bold text-[#4b5563] hover:text-[#1a1a1a] inline-flex items-center gap-1">
                  <X size={15} /> Close
                </button>
              </div>
              <div className="relative max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5563]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type the product name… e.g. hoodie, polo, t-shirt"
                  aria-label="Search products"
                  data-testid="reviews-product-search"
                  autoFocus
                  className="pl-10 pr-9 py-3 text-sm rounded-full border-2 border-[#dcfce7] focus:border-[#7bc67e] outline-none w-full bg-white"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4b5563] hover:text-[#1a1a1a]">
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Results only appear once they've typed — no default wall of products */}
              {query.trim().length === 0 ? (
                <p className="text-sm text-[#4b5563] mt-4">Start typing to find your product.</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-[#4b5563] mt-4">Nothing matched &ldquo;{query}&rdquo; — try a shorter word, or review the shop as a whole above.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-5">
                  {filtered.slice(0, 12).map((p) => {
                    const agg = aggregates[p.id];
                    return (
                      <Link key={p.id} to={`/product/${p.id}`} data-testid={`reviews-product-${p.id}`} className="bg-white rounded-2xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md transition-all overflow-hidden">
                        <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                          <SiteImage src={p.image} loading="lazy" className="w-full h-full object-contain hover:scale-105 transition-transform duration-500" testid={`reviews-product-image-${p.id}`} />
                        </div>
                        <div className="p-3">
                          <div className="font-nunito font-bold text-sm text-[#1a1a1a] truncate">{p.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {agg ? (<><StarRating value={agg.average} size={11} /><span className="text-xs text-[#4b5563]">{agg.count}</span></>) : (<span className="text-xs text-[#4b5563]">Be the first!</span>)}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              {query.trim().length > 0 && filtered.length > 12 && (
                <p className="text-xs text-[#4b5563] mt-3">Showing the first 12 matches — keep typing to narrow it down.</p>
              )}
            </div>
          )}
        </div>

      </div>

      <BoldFooter />
    </div>
  );
}
