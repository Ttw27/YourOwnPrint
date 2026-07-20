import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import { ReviewForm } from "../components/bold/ProductReviews";
import SiteImage from "../components/bold/SiteImage";
import {
  fetchProducts, fetchRecentReviews, fetchReviewsAggregate, fetchStoreReviews,
} from "../lib/api";
import usePageTitle from "../hooks/usePageTitle";
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

  const [products, setProducts] = useState([]);
  const [aggregates, setAggregates] = useState({});
  const [recent, setRecent] = useState([]);
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
      fetchRecentReviews(24),
      fetchStoreReviews(24),
    ])
      .then(([prods, aggs, rec, st]) => {
        setProducts(prods.items || []);
        setAggregates(aggs || {});
        setRecent(rec || []);
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

        <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
          <h2 className="font-nunito font-extrabold text-2xl">Pick a product to review</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                aria-label="Search products"
                data-testid="reviews-product-search"
                className="pl-9 pr-8 py-2 text-sm rounded-full border-2 border-[#dcfce7] focus:border-[#7bc67e] outline-none w-[220px]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4b5563] hover:text-[#1a1a1a]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <label className="text-xs text-[#4b5563] inline-flex items-center gap-1.5">
              Show
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                data-testid="reviews-page-size"
                className="rounded-full border-2 border-[#dcfce7] focus:border-[#7bc67e] outline-none px-2.5 py-1.5 text-xs font-bold"
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </div>

        {err ? (
          <div className="bg-white border-2 border-rose-200 rounded-3xl p-10 text-center" data-testid="reviews-error">
            <AlertTriangle className="mx-auto text-rose-500 mb-2" size={30} />
            <div className="font-nunito font-extrabold text-lg">Couldn&rsquo;t load the reviews</div>
            <p className="text-sm text-[#4b5563] mt-1">Something went wrong fetching them. Have another go in a moment.</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold rounded-full px-5 py-2.5"
              data-testid="reviews-retry"
            >
              <RefreshCw size={15} /> Try again
            </button>
          </div>
        ) : loading ? (
          <div className="text-[#4b5563]">Loading&hellip;</div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#f0fdf4] rounded-2xl p-10 text-center border border-[#dcfce7]" data-testid="reviews-no-products">
            <div className="font-nunito font-extrabold text-lg">Nothing matched &ldquo;{query}&rdquo;</div>
            <p className="text-sm text-[#4b5563] mt-1">Try a shorter word, or review the shop as a whole above.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-3 text-sm font-nunito font-extrabold text-[#166534] hover:underline">
              Clear the search
            </button>
          </div>
        ) : (
          <>
            <div className="text-xs text-[#4b5563] mb-3" data-testid="reviews-product-count">
              Showing {safePage * pageSize + 1}&ndash;{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length} product{filtered.length === 1 ? "" : "s"}
              {query && " matching your search"}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {visible.map((p) => {
                const agg = aggregates[p.id];
                return (
                  <Link key={p.id} to={`/product/${p.id}`} data-testid={`reviews-product-${p.id}`} className="bg-white rounded-2xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md transition-all overflow-hidden">
                    <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                      <SiteImage src={p.image} loading="lazy" className="w-full h-full object-contain hover:scale-105 transition-transform duration-500" testid={`reviews-product-image-${p.id}`} />
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-8 flex-wrap" data-testid="reviews-pagination">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  className="inline-flex items-center gap-1 text-sm font-nunito font-extrabold text-[#166534] disabled:opacity-30 px-2 py-1.5"
                >
                  <ChevronLeft size={15} /> Prev
                </button>
                {pageNumbers.map((n, i) =>
                  n === "gap" ? (
                    <span key={`gap-${i}`} className="px-1.5 text-[#4b5563]">&hellip;</span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      aria-current={n === safePage ? "page" : undefined}
                      data-testid={`reviews-page-${n + 1}`}
                      className={`min-w-[36px] px-2.5 py-1.5 rounded-full text-sm font-nunito font-extrabold transition-colors ${
                        n === safePage
                          ? "bg-[#7bc67e] text-[#1a1a1a]"
                          : "border-2 border-[#dcfce7] hover:border-[#7bc67e] text-[#1a1a1a]"
                      }`}
                    >
                      {n + 1}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                  disabled={safePage + 1 >= totalPages}
                  className="inline-flex items-center gap-1 text-sm font-nunito font-extrabold text-[#166534] disabled:opacity-30 px-2 py-1.5"
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}

        <h2 className="font-nunito font-extrabold text-2xl mt-14 mb-5">Most Recent Reviews</h2>
        {recent.length === 0 ? (
          <div className="bg-[#f0fdf4] rounded-2xl p-8 text-center border border-[#dcfce7]">
            <Camera className="mx-auto text-[#7bc67e]" size={28} />
            <div className="font-nunito font-extrabold text-xl mt-2">No reviews yet &mdash; be the first!</div>
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
                <p className="text-[#4b5563] text-sm mt-1">&ldquo;{r.body}&rdquo;</p>
                {r.photos && r.photos.length > 0 && (
                  <div className="mt-3 flex gap-1.5">
                    {r.photos.slice(0, 4).map((src, i) => (
                      <SiteImage key={i} src={src} loading="lazy" className="w-14 h-14 object-cover rounded-lg" testid="recent-review-photo" />
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs font-nunito font-bold flex-wrap">
                  <span className="text-[#7bc67e]">&mdash; {r.reviewer_name}</span>
                  {r.product_id === STORE_ID && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-white border border-[#dcfce7] text-[#4b5563] px-1.5 py-0.5 rounded-full">
                      <Store size={9} /> About the shop
                    </span>
                  )}
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
