import React, { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { searchProducts } from "../lib/api";
import { ArrowRight, Loader2, SearchX, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [q]);

  const load = useCallback(() => {
    if (!q.trim()) { setData({ items: [], total: 0 }); setLoading(false); return; }
    setLoading(true); setErr(false);
    searchProducts(q, PAGE_SIZE, page * PAGE_SIZE)
      .then(setData)
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const items = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="search-results-page">
      <BoldNavbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Search</div>
        <h1 className="font-black text-4xl mt-2">
          {q ? <>Results for "{q}"</> : "Search"}
        </h1>
        {!loading && !err && <p className="text-[#4b5563] mt-2">{total} product{total === 1 ? "" : "s"} found</p>}

        <div className="mt-8">
          {loading ? (
            <div className="text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={16} /> Searching…</div>
          ) : err ? (
            <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm" data-testid="search-error">
              Couldn't search right now. <button onClick={load} className="underline text-[#166534] font-extrabold">Try again</button>.
            </div>
          ) : !q.trim() ? (
            <div className="text-[#4b5563]">Type something into the search box up top to get started.</div>
          ) : items.length === 0 ? (
            <div className="bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-8 text-center" data-testid="search-empty">
              <SearchX className="mx-auto text-[#7bc67e] mb-3" size={32} />
              <p className="font-extrabold">Nothing matches "{q}"</p>
              <p className="text-sm text-[#4b5563] mt-1">Try a shorter or more general search, or browse by <Link to="/" className="underline text-[#166534] font-extrabold">category</Link> instead.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="search-results-grid">
                {items.map((p) => (
                  <Link key={p.id} to={`/product/${p.id}`} className="group bg-white rounded-2xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md transition-all overflow-hidden" data-testid={`search-result-${p.id}`}>
                    <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                      <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="p-4">
                      <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold">{p.category}</div>
                      <div className="font-nunito font-bold text-[#1a1a1a] mt-0.5">{p.name}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[#7bc67e] font-nunito font-extrabold text-xl">£{p.price.toFixed(2)}</span>
                        <span className="text-xs inline-flex items-center gap-1 font-nunito font-bold text-[#1a1a1a]">View <ArrowRight size={12} /></span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-4 mt-10" data-testid="search-pagination">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline">
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span className="text-xs text-[#4b5563]">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
                  <button onClick={() => setPage((p) => (p + 1) * PAGE_SIZE < total ? p + 1 : p)} disabled={(page + 1) * PAGE_SIZE >= total} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline">
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <BoldFooter />
    </div>
  );
}
