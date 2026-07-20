import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminFetchReviews, adminFetchReviewStats, adminUpdateReview,
  adminDeleteReview, adminBulkDeleteReviews, fetchProducts,
} from "../lib/api";
import { toast } from "sonner";
import {
  Loader2, Trash2, Pencil, Save, X, Star, Search, ChevronLeft, ChevronRight,
  RefreshCw, AlertTriangle,
} from "lucide-react";

const PAGE_SIZE = 25;

function Stars({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={onChange ? () => onChange(n) : undefined}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          title={onChange ? `Set to ${n} star${n > 1 ? "s" : ""}` : undefined}
        >
          <Star
            size={14}
            className={n <= value ? "text-[#fbbf24] fill-[#fbbf24]" : "text-[#d1d5db]"}
          />
        </button>
      ))}
    </div>
  );
}

export default function AdminReviews() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [source, setSource] = useState("");
  const [rating, setRating] = useState("");
  const [productId, setProductId] = useState("");

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [selected, setSelected] = useState([]);

  const productName = useCallback(
    (id) => (products.find((p) => p.id === id) || {}).name || id,
    [products]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr(false);
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      if (source) params.source = source;
      if (rating) params.rating = Number(rating);
      if (productId) params.product_id = productId;
      const [d, s] = await Promise.all([adminFetchReviews(params), adminFetchReviewStats()]);
      setItems(d.items || []);
      setTotal(d.total || 0);
      setStats(s);
    } catch (e) {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }, [page, search, source, rating, productId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchProducts(undefined, 500).then((d) => setProducts(d.items || [])).catch(() => {}); }, []);

  // Any filter change puts us back on page 1 — otherwise you can land on an
  // empty page 4 of a result set that now only has 2 pages.
  const applyFilter = (fn) => { setPage(0); setSelected([]); fn(); };

  const startEdit = (r) => {
    setEditing(r.id);
    setDraft({
      reviewer_name: r.reviewer_name || "",
      rating: r.rating || 5,
      title: r.title || "",
      body: r.body || "",
      product_id: r.product_id || "",
      photos: (r.photos || []).join("\n"),
    });
  };

  const cancelEdit = () => { setEditing(null); setDraft({}); };

  const saveEdit = async (id) => {
    setSavingId(id);
    try {
      const payload = {
        reviewer_name: draft.reviewer_name,
        rating: Number(draft.rating),
        title: draft.title,
        body: draft.body,
        product_id: draft.product_id,
        photos: (draft.photos || "").split("\n").map((s) => s.trim()).filter(Boolean),
      };
      const updated = await adminUpdateReview(id, payload);
      setItems((list) => list.map((r) => (r.id === id ? updated : r)));
      toast.success("Review updated");
      cancelEdit();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't save that review");
    } finally {
      setSavingId(null);
    }
  };

  const removeOne = async (r) => {
    if (!window.confirm(`Delete this review from ${r.reviewer_name}? This can't be undone.`)) return;
    try {
      await adminDeleteReview(r.id);
      toast.success("Review deleted");
      setSelected((s) => s.filter((x) => x !== r.id));
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    }
  };

  const removeSelected = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`Delete ${selected.length} review${selected.length > 1 ? "s" : ""}? This can't be undone.`)) return;
    try {
      const res = await adminBulkDeleteReviews(selected);
      toast.success(`Deleted ${res.deleted} review${res.deleted === 1 ? "" : "s"}`);
      setSelected([]);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    }
  };

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOnPageSelected = items.length > 0 && items.every((r) => selected.includes(r.id));
  const toggleAllOnPage = () =>
    setSelected((s) =>
      allOnPageSelected ? s.filter((id) => !items.some((r) => r.id === id))
                        : [...new Set([...s, ...items.map((r) => r.id)])]
    );

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-reviews">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Reviews</h1>
        <p className="text-sm text-[#4b5563] mb-5">
          Every review on the site — the ones customers left themselves and the ones brought over from
          Judge.me. Fix a typo, correct which product a review is attached to, or delete one entirely.
          To bring more over, use{" "}
          <Link to="/admin/import-reviews" className="text-[#166534] font-bold underline">Reviews import</Link>.
        </p>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" data-testid="admin-reviews-stats">
            {[
              { label: "Total reviews", value: stats.total },
              { label: "From Judge.me", value: stats.by_source?.judgeme || 0 },
              { label: "Left on the site", value: stats.by_source?.native || 0 },
              { label: "With photos", value: stats.with_photos || 0 },
            ].map((s) => (
              <div key={s.label} className="bg-white border-2 border-[#dcfce7] rounded-2xl p-4">
                <div className="text-2xl font-black">{s.value}</div>
                <div className="text-[11px] text-[#4b5563] font-bold">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-4 mb-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <div className="text-[11px] font-extrabold mb-1">Search</div>
              <div className="flex gap-1.5">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyFilter(() => setSearch(searchInput)); }}
                  placeholder="Name, title or wording"
                  className="input flex-1 text-xs"
                  data-testid="admin-reviews-search"
                />
                <button
                  type="button"
                  onClick={() => applyFilter(() => setSearch(searchInput))}
                  className="px-3 rounded-full border-2 border-[#dcfce7] hover:border-[#7bc67e]"
                  title="Search"
                >
                  <Search size={13} />
                </button>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-extrabold mb-1">Where it came from</div>
              <select value={source} onChange={(e) => applyFilter(() => setSource(e.target.value))} className="input text-xs w-full" data-testid="admin-reviews-source">
                <option value="">Anywhere</option>
                <option value="judgeme">Judge.me import</option>
                <option value="native">Left on the site</option>
              </select>
            </div>
            <div>
              <div className="text-[11px] font-extrabold mb-1">Star rating</div>
              <select value={rating} onChange={(e) => applyFilter(() => setRating(e.target.value))} className="input text-xs w-full" data-testid="admin-reviews-rating">
                <option value="">Any rating</option>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[11px] font-extrabold mb-1">Product</div>
              <select value={productId} onChange={(e) => applyFilter(() => setProductId(e.target.value))} className="input text-xs w-full" data-testid="admin-reviews-product">
                <option value="">All products</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#dcfce7] flex-wrap gap-2">
            <div className="text-[11px] text-[#4b5563]">
              {loading ? "Loading…" : `${total} review${total === 1 ? "" : "s"} match`}
              {selected.length > 0 && ` · ${selected.length} selected`}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={load} className="inline-flex items-center gap-1 text-[11px] font-extrabold border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-full px-3 py-1.5">
                <RefreshCw size={12} /> Refresh
              </button>
              {selected.length > 0 && (
                <button type="button" onClick={removeSelected} className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-rose-500 hover:bg-rose-600 text-white rounded-full px-3 py-1.5" data-testid="admin-reviews-bulk-delete">
                  <Trash2 size={12} /> Delete {selected.length}
                </button>
              )}
            </div>
          </div>
        </div>

        {err ? (
          <div className="bg-white border-2 border-rose-200 rounded-3xl p-8 text-center">
            <AlertTriangle className="mx-auto text-rose-500 mb-2" size={28} />
            <div className="font-extrabold">Couldn&rsquo;t load the reviews</div>
            <p className="text-xs text-[#4b5563] mt-1">The server didn&rsquo;t respond. Try again in a moment.</p>
            <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold bg-[#7bc67e] text-[#1a1a1a] rounded-full px-4 py-2">
              <RefreshCw size={12} /> Try again
            </button>
          </div>
        ) : loading ? (
          <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-10 text-center">
            <div className="font-extrabold">No reviews match those filters</div>
            <p className="text-xs text-[#4b5563] mt-1">Try clearing the search or choosing a different product.</p>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 text-[11px] font-extrabold mb-2 cursor-pointer">
              <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} data-testid="admin-reviews-select-all" />
              Select everything on this page
            </label>

            <div className="space-y-3">
              {items.map((r) => {
                const isEditing = editing === r.id;
                return (
                  <div key={r.id} className="bg-white border-2 border-[#dcfce7] rounded-3xl p-4" data-testid={`admin-review-${r.id}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={() => toggle(r.id)}
                        className="mt-1.5"
                        data-testid={`admin-review-select-${r.id}`}
                      />

                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid sm:grid-cols-2 gap-2">
                              <div>
                                <div className="text-[10px] font-extrabold mb-1">Customer name</div>
                                <input value={draft.reviewer_name} onChange={(e) => setDraft({ ...draft, reviewer_name: e.target.value })} className="input text-xs w-full" />
                              </div>
                              <div>
                                <div className="text-[10px] font-extrabold mb-1">Product this review is about</div>
                                <select value={draft.product_id} onChange={(e) => setDraft({ ...draft, product_id: e.target.value })} className="input text-xs w-full">
                                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-extrabold mb-1">Star rating</div>
                              <Stars value={Number(draft.rating)} onChange={(n) => setDraft({ ...draft, rating: n })} />
                            </div>
                            <div>
                              <div className="text-[10px] font-extrabold mb-1">Headline</div>
                              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="input text-xs w-full" />
                            </div>
                            <div>
                              <div className="text-[10px] font-extrabold mb-1">What they wrote</div>
                              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="input text-xs w-full min-h-[90px]" />
                            </div>
                            <div>
                              <div className="text-[10px] font-extrabold mb-1">Photo links &mdash; one per line</div>
                              <textarea value={draft.photos} onChange={(e) => setDraft({ ...draft, photos: e.target.value })} className="input text-[11px] font-mono w-full min-h-[60px]" placeholder="https://…" />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button type="button" onClick={() => saveEdit(r.id)} disabled={savingId === r.id} className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] rounded-full px-4 py-2 disabled:opacity-50">
                                {savingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save changes
                              </button>
                              <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1 text-[11px] font-extrabold border-2 border-[#dcfce7] rounded-full px-4 py-2">
                                <X size={12} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Stars value={r.rating} />
                              <span className="font-extrabold text-sm">{r.reviewer_name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-[#f0fdf4] text-[#166534]">
                                {r.source === "judgeme" ? "Judge.me" : "Left on the site"}
                              </span>
                              {r.edited_at && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-[#fde68a] text-[#1a1a1a]">Edited</span>
                              )}
                            </div>
                            {r.title && <div className="font-extrabold mt-1.5">{r.title}</div>}
                            {r.body && <p className="text-xs text-[#4b5563] mt-1 leading-relaxed whitespace-pre-line">{r.body}</p>}
                            <div className="text-[10px] text-[#4b5563] mt-2">
                              {productName(r.product_id)}
                              {r.created_at && ` · ${String(r.created_at).slice(0, 10)}`}
                            </div>
                            {(r.photos || []).length > 0 && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {r.photos.map((src, i) => (
                                  <a key={i} href={src} target="_blank" rel="noreferrer" className="w-14 h-14 rounded-lg overflow-hidden border border-[#e5e7eb] bg-[#f0fdf4] grid place-items-center">
                                    <img src={src} alt="" className="w-full h-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button type="button" onClick={() => startEdit(r)} className="inline-flex items-center gap-1 text-[11px] font-extrabold border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-full px-3 py-1.5" data-testid={`admin-review-edit-${r.id}`}>
                            <Pencil size={11} /> Edit
                          </button>
                          <button type="button" onClick={() => removeOne(r)} className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-600 border-2 border-rose-200 hover:bg-rose-50 rounded-full px-3 py-1.5" data-testid={`admin-review-delete-${r.id}`}>
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8" data-testid="admin-reviews-pagination">
                <button type="button" onClick={() => { setPage((p) => Math.max(0, p - 1)); setSelected([]); }} disabled={page === 0} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#166534] disabled:opacity-30">
                  <ChevronLeft size={13} /> Prev
                </button>
                <span className="text-[11px] text-[#4b5563]">Page {page + 1} of {pages}</span>
                <button type="button" onClick={() => { setPage((p) => (p + 1 < pages ? p + 1 : p)); setSelected([]); }} disabled={page + 1 >= pages} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#166534] disabled:opacity-30">
                  Next <ChevronRight size={13} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
