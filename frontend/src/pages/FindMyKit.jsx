import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Loader2, ArrowRight, Search } from "lucide-react";
import { findMyKit, fetchIndustries } from "../lib/api";

/**
 * Find My Kit — the concierge. A customer picks their industry or types their
 * trade, and the AI hands back a balanced, grouped, head-to-toe kit drawn from
 * what the shop actually stocks. Read-only; each item links to its product page.
 */
export default function FindMyKit() {
  const [industries, setIndustries] = useState([]);
  const [industry, setIndustry] = useState("");
  const [trade, setTrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchIndustries().then((d) => {
      // API may return an array of {slug,title} or {industries:[...]}
      const list = Array.isArray(d) ? d : (d?.industries || d?.items || []);
      setIndustries(list.filter((i) => i && i.slug));
    }).catch(() => setIndustries([]));
  }, []);

  const run = async () => {
    if (!industry && !trade.trim()) {
      setError("Pick your industry or type your trade to get started.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await findMyKit({ industry: industry || undefined, trade: trade.trim() || undefined });
      if (!res?.ok) {
        setError(res?.message || "We couldn't build a kit for that just yet — try a broader trade.");
      } else {
        setResult(res);
      }
    } catch (e) {
      setError("Something went wrong building your kit. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => { if (e.key === "Enter") run(); };

  return (
    <div className="min-h-screen bg-white font-nunito text-[#1a1a1a]">
      {/* Hero */}
      <div className="bg-gradient-to-b from-[#f0fdf4] to-white border-b border-[#dcfce7]">
        <div className="max-w-4xl mx-auto px-6 pt-14 pb-10 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.25em] text-[#7bc67e]">
            <Sparkles size={15} /> Find My Kit
          </div>
          <h1 className="font-black text-4xl sm:text-5xl mt-4 leading-tight">
            Tell us your trade.<br />We'll build your kit.
          </h1>
          <p className="text-[#4b5563] mt-4 max-w-xl mx-auto">
            No wading through pages. Pick your industry or type your job, and we'll put together a
            head-to-toe kit from what we stock — ready to brand with your logo.
          </p>

          {/* Controls */}
          <div className="mt-8 bg-white border-2 border-[#dcfce7] rounded-3xl p-4 sm:p-5 shadow-sm max-w-2xl mx-auto">
            <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
              <select
                value={industry}
                onChange={(e) => { setIndustry(e.target.value); }}
                className="bg-[#f9fafb] border border-[#dcfce7] rounded-full px-4 py-3 text-sm w-full"
                data-testid="fmk-industry"
              >
                <option value="">Choose your industry…</option>
                {industries.map((i) => (
                  <option key={i.slug} value={i.slug}>{i.title || i.slug}</option>
                ))}
              </select>

              <span className="text-xs text-[#9ca3af] font-bold text-center">or</span>

              <div className="relative w-full">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="type your job… e.g. dog groomer"
                  className="bg-[#f9fafb] border border-[#dcfce7] rounded-full pl-9 pr-4 py-3 text-sm w-full"
                  data-testid="fmk-trade"
                />
              </div>
            </div>

            <button
              onClick={run}
              disabled={loading}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-extrabold rounded-full px-6 py-3.5"
              data-testid="fmk-go"
            >
              {loading ? <><Loader2 size={17} className="animate-spin" /> Building your kit…</> : <><Sparkles size={17} /> Build my kit</>}
            </button>
            {error && <p className="text-rose-500 text-sm font-bold mt-3" data-testid="fmk-error">{error}</p>}
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="max-w-5xl mx-auto px-6 py-12 text-center text-[#4b5563]">
          <Loader2 className="animate-spin text-[#7bc67e] mx-auto" size={28} />
          <p className="mt-3 text-sm">Putting together the right kit for you…</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="max-w-5xl mx-auto px-6 py-12" data-testid="fmk-result">
          {result.intro && (
            <p className="text-lg text-center text-[#1a1a1a] font-bold max-w-2xl mx-auto mb-10">{result.intro}</p>
          )}

          {result.sections.map((sec, si) => (
            <div key={si} className="mb-12">
              <h2 className="font-black text-2xl mb-5 flex items-center gap-3">
                <span className="w-8 h-[3px] bg-[#7bc67e] rounded-full" /> {sec.title}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {sec.items.map((it) => (
                  <Link
                    key={it.id}
                    to={`/product/${it.id}`}
                    className="group bg-white border-2 border-[#eef2f7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-colors"
                    data-testid={`fmk-item-${it.id}`}
                  >
                    <div className="aspect-square bg-[#f9fafb] overflow-hidden">
                      {it.image
                        ? <img src={it.image} alt={it.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" loading="lazy" />
                        : <div className="w-full h-full grid place-items-center text-[#cbd5e1] text-xs">No image</div>}
                    </div>
                    <div className="p-4">
                      <div className="font-nunito font-extrabold leading-tight">{it.name}</div>
                      {it.reason && <div className="text-xs text-[#4b5563] mt-1.5 italic">{it.reason}</div>}
                      <div className="mt-2 text-sm font-black text-[#166534]">from £{Number(it.price).toFixed(2)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* CTA footer */}
          <div className="mt-6 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-3xl p-6 text-center">
            <p className="font-extrabold text-lg">Want a hand or a bulk price?</p>
            <p className="text-[#4b5563] text-sm mt-1">Tap any item to pick colours, sizes and print — or get a quote for the whole kit.</p>
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              <Link to="/contact" className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold rounded-full px-5 py-2.5">Get a quote <ArrowRight size={15} /></Link>
              <button onClick={() => { setResult(null); setTrade(""); setIndustry(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-2 border-2 border-[#7bc67e] text-[#166534] hover:bg-white font-extrabold rounded-full px-5 py-2.5">Try another trade</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
