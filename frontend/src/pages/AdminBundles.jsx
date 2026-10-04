import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Plus, Search, Trash2, Sparkles, RefreshCw, ExternalLink } from "lucide-react";
import { fetchAllProductsAdmin, fetchBundleTemplates, createTemplateBundles, createCustomBundle, rebuildBundleImage, previewBundlePrice, fetchMyBundles, patchProductOverride } from "../lib/api";

/**
 * Bundle builder - bulk packs (fixed quantities, e.g. 20 x tees or a team pack)
 * and per-person sets, made from products already on the site. Logo included
 * (one print position on every item); the bigger the bundle, the bigger the
 * saving; prices end in .99 - all worked out by the server
 * (backend/routers/bundles.py). The picture is built automatically. New
 * bundles are created HIDDEN - check them in Product settings, then "Show on site".
 */

export default function AdminBundles() {
  const [templates, setTemplates] = useState([]);
  const [mine, setMine] = useState([]);           // every bundle created so far (hidden or live)
  const [zoom, setZoom] = useState(null);         // picture opened full size
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");          // what's running, for the spinner text
  const [cutout, setCutout] = useState("auto");  // "auto" | "removebg"

  // custom bundle
  const [name, setName] = useState("");
  const [kind, setKind] = useState("pack");        // "pack" | "set"
  const [preview, setPreview] = useState(null);    // {price, full_price, saving_pct, item_count}
  const [items, setItems] = useState([]);        // [{id, name, price, image, qty}]
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [t, m] = await Promise.all([fetchBundleTemplates(), fetchMyBundles().catch(() => ({ bundles: [] }))]);
      setTemplates(t.templates || []);
      setMine(m.bundles || []);
    }
    catch (e) { toast.error(e?.response?.data?.detail || "Couldn't load suggested bundles"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    const t = setTimeout(() => {
      fetchAllProductsAdmin(0, 10, q).then((d) => setResults(d.items || [])).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const report = (r) => {
    const made = (r.created || []).length;
    const failed = r.failed || [];
    if (made) toast.success(`${made} bundle${made === 1 ? "" : "s"} created - hidden until you show ${made === 1 ? "it" : "them"} in Product settings`);
    failed.forEach((f) => toast.error(`${f.name}: ${f.reason}`));
    if (!made && !failed.length) toast("Nothing new to create");
  };

  const createTemplates = async (names) => {
    setBusy(names ? `Creating ${names[0]}…` : "Creating bundles - building the pictures can take a minute…");
    try { report(await createTemplateBundles(names, cutout)); await load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Couldn't create bundles"); }
    finally { setBusy(""); }
  };

  // Show / hide a bundle on the site straight from here (same as Product settings' visible tick).
  const setLive = async (b, live) => {
    setBusy(live ? "Putting it on the site…" : "Hiding it…");
    try {
      await patchProductOverride(b.id, { active: live });
      setMine((list) => list.map((x) => (x.id === b.id ? { ...x, live } : x)));
      toast.success(live ? `${b.name} is now on the site` : `${b.name} hidden from the site`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't change it"); }
    finally { setBusy(""); }
  };

  const rebuild = async (t) => {
    setBusy(`Remaking the picture for ${t.name}…`);
    try { await rebuildBundleImage(t.id, cutout); toast.success("Picture remade"); await load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Couldn't remake the picture"); }
    finally { setBusy(""); }
  };

  const addItem = (p) => {
    if (items.length >= 5) { toast.error("A bundle can have up to 5 products"); return; }
    if (items.some((i) => i.id === p.id)) { toast("Already in the bundle - change its quantity instead"); return; }
    setItems([...items, { id: p.id, name: p.name, price: p.price, image: p.image, qty: 1 }]);
    setQuery(""); setResults([]);
  };
  // Price comes from the server so it always matches what the bundle will cost.
  useEffect(() => {
    if (!items.length) { setPreview(null); return; }
    const t = setTimeout(() => {
      previewBundlePrice(items.map((i) => [i.id, i.qty])).then(setPreview).catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [items]);

  const createCustom = async () => {
    if (!name.trim()) { toast.error("Give the bundle a name"); return; }
    if (kind === "set" ? items.length < 2 : items.length < 1) { toast.error(kind === "set" ? "A set needs at least 2 products" : "Add at least 1 product"); return; }
    setBusy(`Creating ${name}…`);
    try {
      const r = await createCustomBundle({ name: name.trim(), kind, items: items.map((i) => [i.id, i.qty]), cutout });
      toast.success(`${r.name} created at £${r.price.toFixed(2)} - hidden until you show it in Product settings`);
      setName(""); setItems([]); await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't create the bundle"); }
    finally { setBusy(""); }
  };

  const groups = [...new Set(templates.map((t) => t.group))];
  const remaining = templates.filter((t) => !t.created && !t.missing.length).length;
  const ic = "w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#7bc67e]";

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-xs uppercase tracking-[0.2em] text-[#7bc67e] font-extrabold">Admin</div>
        <h1 className="font-nunito font-black text-4xl mt-1">Bundle builder</h1>
        <p className="text-[#4b5563] mt-2 max-w-3xl">
          <strong>Bulk packs</strong> (e.g. 20 &times; tees, or a team pack) and <strong>per-person sets</strong>, made from products already on the site.
          Every price includes <strong>your customer&rsquo;s logo on every item</strong>, the saving grows with the size of the bundle
          (5% &rarr; 12%), and prices end in .99. The picture is made automatically from the items&rsquo; own photos.
          New bundles start <strong>hidden</strong>: check them in Product settings, then click &ldquo;Show on site&rdquo;.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3 bg-[#f9fafb] border-2 border-[#eef2f7] rounded-2xl p-3">
          <span className="text-sm font-extrabold">Photo cut-out:</span>
          <select value={cutout} onChange={(e) => setCutout(e.target.value)} className="bg-white border border-[#e5e7eb] rounded-full px-3 py-1.5 text-sm" data-testid="bundle-cutout">
            <option value="auto">Automatic (free - great on plain studio photos)</option>
            <option value="removebg">remove.bg (best quality - uses remove.bg credits)</option>
          </select>
          {busy && <span className="inline-flex items-center gap-2 text-sm text-[#166534] font-bold"><Loader2 size={14} className="animate-spin" /> {busy}</span>}
        </div>

        {/* Your bundles - everything created so far, with its picture */}
        {mine.length > 0 && (
          <div className="mt-8" data-testid="bundle-mine">
            <h2 className="font-nunito font-black text-2xl">Your bundles <span className="text-base text-[#4b5563] font-bold">({mine.length})</span></h2>
            <p className="text-sm text-[#4b5563]">Click a picture to see it full size. Hidden ones aren&rsquo;t on the site yet - press <strong>Show on site</strong> when you&rsquo;re happy with one.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
              {mine.map((b) => (
                <div key={b.id} className="border-2 border-[#eef2f7] rounded-2xl overflow-hidden bg-white" data-testid={`bundle-mine-${b.id}`}>
                  <button onClick={() => setZoom(b)} className="block w-full aspect-square bg-[#f0fdf4]" title="View full size">
                    {b.image ? <img src={b.image} alt={b.name} className="w-full h-full object-cover" loading="lazy" /> : null}
                  </button>
                  <div className="p-2.5">
                    <div className="text-xs font-extrabold leading-snug line-clamp-2">{b.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-black">£{b.price.toFixed(2)}</span>
                      <span className={`text-[9px] font-extrabold rounded-full px-2 py-0.5 ${b.live ? "bg-[#dcfce7] text-[#166534]" : "bg-[#e5e7eb] text-[#4b5563]"}`}>{b.live ? "LIVE" : "HIDDEN"}</span>
                    </div>
                    <button
                      onClick={() => setLive(b, !b.live)}
                      disabled={!!busy}
                      className={`mt-2 w-full text-[11px] font-extrabold rounded-full py-1.5 disabled:opacity-40 ${b.live ? "bg-[#f3f4f6] text-[#4b5563] hover:bg-[#e5e7eb]" : "bg-[#7bc67e] text-[#1a1a1a] hover:bg-[#5eb062]"}`}
                      data-testid={`bundle-live-${b.id}`}
                    >{b.live ? "Hide from site" : "Show on site"}</button>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] font-bold whitespace-nowrap">
                      <a href={`/admin/product-settings?q=${encodeURIComponent(b.name)}`} className="text-[#166534] hover:underline" title="Edit it, or show / hide it on the site">Edit</a>
                      {b.live && <a href={`/product/${b.id}`} target="_blank" rel="noopener noreferrer" className="text-[#166534] hover:underline">View</a>}
                      <button onClick={() => rebuild(b)} disabled={!!busy} className="text-[#4b5563] hover:underline disabled:opacity-40 ml-auto" title="Make the picture again">Remake</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {zoom && (
          <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setZoom(null)} data-testid="bundle-zoom">
            <div className="bg-white rounded-2xl p-3 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              <img src={zoom.image} alt={zoom.name} className="w-full rounded-xl" />
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="font-black text-sm">{zoom.name}</span>
                <button onClick={() => setZoom(null)} className="text-sm font-bold text-[#4b5563] hover:underline">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Suggested bundles */}
        <div className="mt-8 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-nunito font-black text-2xl">Suggested bundles</h2>
            <p className="text-sm text-[#4b5563]">Made from matching-brand products on your site, so one colour choice suits every item.</p>
          </div>
          <button onClick={() => createTemplates(null)} disabled={!!busy || !remaining} className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black disabled:opacity-40 text-white font-extrabold text-sm rounded-full px-5 py-2.5" data-testid="bundle-create-all">
            <Sparkles size={15} /> Create all {remaining ? `${remaining} ` : ""}remaining
          </button>
        </div>

        {loading ? <div className="mt-8 text-sm text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={14} />Loading…</div> : groups.map((g) => (
          <div key={g} className="mt-6">
            <div className="text-xs uppercase tracking-wider font-extrabold text-[#4b5563] mb-2">{g}</div>
            <div className="grid md:grid-cols-2 gap-3">
              {templates.filter((t) => t.group === g).map((t) => (
                <div key={t.name} className={`border-2 rounded-2xl p-4 ${t.created ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#eef2f7] bg-white"}`} data-testid={`bundle-template-${t.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider rounded-full px-2 py-0.5 mb-1 ${t.kind === "pack" ? "bg-[#1a1a1a] text-white" : "bg-[#eef2ff] text-[#4338ca]"}`}>{t.kind === "pack" ? `Pack · ${t.item_count} items` : "Per-person set"}</span>
                      <div className="font-nunito font-black">{t.name}</div>
                      <div className="text-xs text-[#4b5563] mt-0.5">{t.blurb}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-lg">£{t.price.toFixed(2)}</div>
                      <div className="text-[11px] text-[#4b5563]"><span className="line-through">£{t.full_price.toFixed(2)}</span> · save {t.saving_pct}%</div>
                      <div className="text-[10px] text-[#4b5563]">£{(t.price / 1.2).toFixed(2)} ex VAT · per {t.kind === "pack" ? "pack" : "set"}, logo incl.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {t.items.map((i) => (
                      <span key={i.product_id} className="inline-flex items-center gap-1.5 bg-white border border-[#e5e7eb] rounded-full pl-1 pr-2.5 py-1 text-[11px] font-bold">
                        {i.image && <img src={i.image} alt="" className="w-6 h-6 rounded-full object-cover" />}
                        {i.qty > 1 ? `${i.qty} × ` : ""}{i.name.length > 34 ? `${i.name.slice(0, 34)}…` : i.name} · £{i.price.toFixed(2)}
                      </span>
                    ))}
                  </div>
                  {t.missing.length > 0 && <div className="mt-2 text-xs text-amber-700 font-bold">Can&rsquo;t be created - not available: {t.missing.join(", ")}.</div>}
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    {t.created ? (
                      <>
                        <span className="text-xs font-extrabold text-[#166534]">✓ Created</span>
                        <a href={`/admin/product-settings?q=${encodeURIComponent(t.name)}`} className="text-xs font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1">Check &amp; show it in Product settings <ExternalLink size={11} /></a>
                        <button onClick={() => rebuild(t)} disabled={!!busy} className="text-xs font-bold text-[#4b5563] hover:underline inline-flex items-center gap-1 disabled:opacity-40"><RefreshCw size={11} /> Remake picture</button>
                      </>
                    ) : !t.missing.length && (
                      <button onClick={() => createTemplates([t.name])} disabled={!!busy} className="inline-flex items-center gap-1.5 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-40 text-[#1a1a1a] font-extrabold text-xs rounded-full px-4 py-2" data-testid={`bundle-create-${t.id}`}>
                        <Package size={13} /> Create this bundle
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Custom bundle */}
        <div className="mt-12 border-2 border-[#eef2f7] rounded-2xl p-5">
          <h2 className="font-nunito font-black text-2xl">Make your own bundle</h2>
          <p className="text-sm text-[#4b5563]">Pick up to 5 products and how many of each. Tip: choose the same brand where you can, so the colours match.</p>
          <div className="mt-3 inline-flex rounded-full border-2 border-[#e5e7eb] overflow-hidden" data-testid="bundle-kind">
            <button onClick={() => setKind("pack")} className={`px-4 py-1.5 text-xs font-extrabold ${kind === "pack" ? "bg-[#1a1a1a] text-white" : "bg-white text-[#4b5563]"}`}>Bulk pack (fixed quantities)</button>
            <button onClick={() => setKind("set")} className={`px-4 py-1.5 text-xs font-extrabold ${kind === "set" ? "bg-[#1a1a1a] text-white" : "bg-white text-[#4b5563]"}`}>Per-person set</button>
          </div>
          <div className="grid md:grid-cols-2 gap-5 mt-4">
            <div className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bundle name, e.g. Gym Starter Set - Tee + Joggers" className={ic} data-testid="bundle-name" />
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products to add…" className={ic + " pl-8"} data-testid="bundle-search" />
              </div>
              {results.length > 0 && (
                <div className="border border-[#e5e7eb] rounded-xl divide-y divide-[#f3f4f6] max-h-72 overflow-y-auto">
                  {results.map((p) => (
                    <button key={p.id} onClick={() => addItem(p)} className="w-full flex items-center gap-3 p-2 text-left hover:bg-[#f9fafb]">
                      <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-[#f0fdf4]" />
                      <span className="min-w-0 flex-1"><span className="block text-sm font-bold truncate">{p.name}</span><span className="block text-[11px] text-[#4b5563]">£{p.price.toFixed(2)}{p.brand ? ` · ${p.brand}` : ""}</span></span>
                      <Plus size={16} className="text-[#166534]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              {items.length === 0 ? <div className="text-sm text-[#4b5563] bg-[#f9fafb] rounded-xl p-4">No products added yet.</div> : (
                <div className="space-y-2">
                  {items.map((i) => (
                    <div key={i.id} className="flex items-center gap-2 border border-[#e5e7eb] rounded-xl p-2">
                      <img src={i.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      <span className="text-sm font-bold flex-1 min-w-0 truncate">{i.name}</span>
                      <input type="number" min="1" max="200" value={i.qty} onChange={(e) => setItems(items.map((x) => x.id === i.id ? { ...x, qty: Math.max(1, Math.min(200, Number(e.target.value) || 1)) } : x))} className="w-16 border border-[#e5e7eb] rounded-lg px-2 py-1 text-sm" title={kind === "pack" ? "How many of this item in the pack" : "How many of this item per person"} />
                      <span className="text-xs w-14 text-right">£{(i.price * i.qty).toFixed(2)}</span>
                      <button onClick={() => setItems(items.filter((x) => x.id !== i.id))} className="text-rose-500 p-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {preview && (
                    <div className="flex items-center justify-between pt-2 text-sm">
                      <span className="text-[#4b5563]">{preview.item_count} items, logo incl. - separately £{preview.full_price.toFixed(2)}, save {preview.saving_pct}%:</span>
                      <span className="text-right"><span className="font-black text-lg block" data-testid="bundle-custom-price">£{preview.price.toFixed(2)}</span><span className="text-[10px] text-[#4b5563]">£{(preview.price / 1.2).toFixed(2)} ex VAT</span></span>
                    </div>
                  )}
                </div>
              )}
              <button onClick={createCustom} disabled={!!busy || !items.length || (kind === "set" && items.length < 2) || !name.trim()} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-black disabled:opacity-40 text-white font-extrabold rounded-full py-3" data-testid="bundle-create-custom">
                <Package size={16} /> Create {kind === "pack" ? "pack" : "set"} (hidden)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
