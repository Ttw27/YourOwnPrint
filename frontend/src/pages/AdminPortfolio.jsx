import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { adminListPortfolio, adminCreatePortfolio, adminUpdatePortfolio, adminDeletePortfolio, fetchPortfolioCategories, mediaUrl, fetchTrustedLogos, adminSaveTrustedLogos, uploadAdminImage, adminAddPortfolioImage, adminRemovePortfolioImage, adminSetPortfolioFocus, adminReorderPortfolioPhotos } from "../lib/api";
import { photoStyle } from "../components/bold/ImageSwiper";
import { Upload, Trash2, Star, Eye, EyeOff, Loader2, Save, Image as ImageIcon, ArrowLeft, ArrowRight } from "lucide-react";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminPortfolio() {
  const [positioning, setPositioning] = useState(null);   // {item, imageId, url, focus} - photo being positioned
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: "", category: "workwear", caption: "", alt_text: "", display_order: 0, featured: false, image_data_url: "" });

  async function refresh() {
    setLoading(true);
    try {
      const [list, c] = await Promise.all([adminListPortfolio(), fetchPortfolioCategories()]);
      setItems(list);
      setCats(c);
    } catch (e) {
      toast.error("Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  async function onUploadFile(e, isDraft = true, itemId = null) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) { toast.error("Image too large (max 8 MB)"); return; }
    const dataUrl = await fileToDataUrl(file);
    if (isDraft) setDraft((d) => ({ ...d, image_data_url: dataUrl, alt_text: d.alt_text || file.name }));
    else if (itemId) {
      try {
        await adminUpdatePortfolio(itemId, { image_data_url: dataUrl });
        toast.success("Image replaced");
        refresh();
      } catch { toast.error("Failed to replace image"); }
    }
  }

  async function onCreate() {
    if (!draft.title.trim() || !draft.image_data_url) { toast.error("Title + image required"); return; }
    setSaving(true);
    try {
      await adminCreatePortfolio({ ...draft, title: draft.title.trim() });
      toast.success("Added to portfolio");
      setDraft({ title: "", category: draft.category, caption: "", alt_text: "", display_order: 0, featured: false, image_data_url: "" });
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  }

  async function patchItem(id, patch) {
    try {
      await adminUpdatePortfolio(id, patch);
      refresh();
    } catch { toast.error("Update failed"); }
  }

  async function removeItem(id) {
    if (!window.confirm("Remove from portfolio? This hides it from the public gallery.")) return;
    try { await adminDeletePortfolio(id); toast.success("Removed"); refresh(); }
    catch { toast.error("Delete failed"); }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-portfolio">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Photo gallery</h1>
        <p className="text-sm text-[#4b5563] mb-8">Photos of real work - customer prints, finished kits, studio shots. <strong>Category</strong> decides which page each photo appears on, so it matters: pick &ldquo;Festival Tees And Brands&rdquo; and it shows in the gallery on the Festival &amp; DJ page, &ldquo;Workwear&rdquo; on the workwear pages, and so on. Tick <strong>Featured</strong> to push a photo to the front.</p>

        <TrustedLogosCard />

        {/* Add new */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-6 mb-10" data-testid="admin-portfolio-create">
          <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold mb-3">Add a photo</div>
          <div className="grid md:grid-cols-2 gap-5">
            <label className="block">
              <div className="text-xs font-extrabold mb-1">The photo</div>
              <div className="aspect-square w-full bg-[#f0fdf4] border-2 border-dashed border-[#7bc67e] rounded-2xl grid place-items-center overflow-hidden relative">
                {draft.image_data_url ? (
                  <img src={draft.image_data_url} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-6">
                    <Upload className="mx-auto text-[#7bc67e]" />
                    <div className="text-xs text-[#4b5563] mt-2">PNG / JPG / WEBP up to 8 MB</div>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={(e) => onUploadFile(e, true)} className="absolute inset-0 opacity-0 cursor-pointer" data-testid="admin-portfolio-upload" />
              </div>
            </label>
            <div className="space-y-3">
              <Field label="Title" testid="admin-portfolio-title">
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="input" placeholder="e.g. Tigers FC - full home kit" />
              </Field>
              <Field label="Which page it shows on" testid="admin-portfolio-cat">
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="input">
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Caption shown under the photo (optional)" testid="admin-portfolio-caption">
                <textarea value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} className="input min-h-[60px]" placeholder="e.g. 40 tees printed overnight for a festival set" />
              </Field>
              <Field label="Alt text (SEO/accessibility)" testid="admin-portfolio-alt">
                <input value={draft.alt_text} onChange={(e) => setDraft({ ...draft, alt_text: e.target.value })} className="input" placeholder="Describe what's in the image" />
              </Field>
              <div className="flex gap-3 items-center">
                <Field label="Display order" testid="admin-portfolio-order" small>
                  <input type="number" value={draft.display_order} onChange={(e) => setDraft({ ...draft, display_order: parseInt(e.target.value || "0", 10) })} className="input w-24" />
                </Field>
                <label className="flex items-center gap-2 text-xs font-extrabold mt-5">
                  <input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} data-testid="admin-portfolio-featured" />
                  Featured
                </label>
              </div>
              <button
                onClick={onCreate}
                disabled={saving || !draft.image_data_url || !draft.title.trim()}
                className="w-full px-5 py-3 bg-[#7bc67e] text-[#1a1a1a] rounded-full font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="admin-portfolio-save"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {saving ? "Uploading…" : "Add to portfolio"}
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-xl">All portfolio pieces ({items.length})</h2>
          <button onClick={refresh} className="text-xs underline text-[#4b5563]">Refresh</button>
        </div>

        {loading ? (
          <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white border-2 border-[#dcfce7] rounded-2xl p-10 text-center">
            <ImageIcon className="mx-auto text-[#7bc67e]" />
            <p className="text-sm text-[#4b5563] mt-3">No items yet - upload your first piece above.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="admin-portfolio-list">
            {items.map((it) => (
              <div key={it.id} className={`bg-white border-2 rounded-3xl overflow-hidden ${it.is_hidden ? "opacity-50 border-[#fee2e2]" : "border-[#dcfce7]"}`} data-testid={`admin-portfolio-row-${it.id}`}>
                <div className="aspect-square bg-[#f0fdf4] relative overflow-hidden">
                  <img src={mediaUrl(it.image_url)} alt={it.alt_text || it.title} className="w-full h-full object-cover" style={photoStyle(it.focus)} />
                  <button onClick={() => setPositioning({ item: it, imageId: null, url: it.image_url, focus: it.focus })} className="absolute bottom-2 right-2 text-[11px] font-extrabold bg-white/95 hover:bg-white rounded-full px-3 py-1.5 shadow" data-testid={`admin-portfolio-position-${it.id}`}>✥ Move photo</button>
                  {it.featured && <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold bg-[#fde68a] text-[#1a1a1a]">Featured</span>}
                </div>
                <PhotosRow item={it} onPosition={(p) => setPositioning({ item: it, imageId: p.id === "main" ? null : p.id, url: p.url, focus: p.focus })} onReload={refresh} onChange={(extra) => setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, extra_images: extra } : x)))} />
                <div className="p-4 space-y-2">
                  <input
                    value={it.title}
                    onChange={(e) => setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, title: e.target.value } : x))}
                    onBlur={(e) => e.target.value !== it.title || null}
                    onKeyDown={(e) => { if (e.key === "Enter") patchItem(it.id, { title: e.target.value }); }}
                    className="input font-extrabold text-sm"
                  />
                  <select value={it.category} onChange={(e) => patchItem(it.id, { category: e.target.value })} className="input text-xs">
                    {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <textarea defaultValue={it.caption} onBlur={(e) => e.target.value !== (it.caption || "") && patchItem(it.id, { caption: e.target.value })} className="input text-xs min-h-[40px]" placeholder="Caption" />
                  <div className="flex items-center justify-between text-xs">
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      Order
                      <input type="number" defaultValue={it.display_order} onBlur={(e) => e.target.value !== String(it.display_order) && patchItem(it.id, { display_order: parseInt(e.target.value || "0", 10) })} className="input w-16 ml-1" />
                    </label>
                    <button onClick={() => patchItem(it.id, { featured: !it.featured })} className={`px-2 py-1 rounded-full font-extrabold inline-flex items-center gap-1 ${it.featured ? "bg-[#fde68a]" : "bg-[#f0fdf4]"}`} data-testid={`admin-portfolio-toggle-featured-${it.id}`}>
                      <Star size={12} /> {it.featured ? "Featured" : "Feature"}
                    </button>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-[#f0fdf4]">
                    <label className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-[#f0fdf4] hover:bg-[#dcfce7] text-xs rounded-full font-extrabold cursor-pointer">
                      <Upload size={12} /> Replace
                      <input type="file" accept="image/*" onChange={(e) => onUploadFile(e, false, it.id)} className="hidden" />
                    </label>
                    <button onClick={() => patchItem(it.id, { is_hidden: !it.is_hidden })} className="px-2 py-1.5 bg-[#fef3c7] hover:bg-[#fde68a] text-xs rounded-full font-extrabold inline-flex items-center gap-1" data-testid={`admin-portfolio-hide-${it.id}`}>
                      {it.is_hidden ? <><Eye size={12} /> Show</> : <><EyeOff size={12} /> Hide</>}
                    </button>
                    <button onClick={() => removeItem(it.id)} className="px-2 py-1.5 bg-[#fee2e2] hover:bg-[#fecaca] text-xs rounded-full font-extrabold inline-flex items-center gap-1" data-testid={`admin-portfolio-delete-${it.id}`}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {positioning && (
        <PositionPhoto
          target={positioning}
          onClose={() => setPositioning(null)}
          onSaved={(focus) => {
            const { item, imageId } = positioning;
            setItems((arr) => arr.map((x) => (x.id !== item.id ? x : imageId
              ? { ...x, extra_images: (x.extra_images || []).map((e) => (e.id === imageId ? { ...e, focus } : e)) }
              : { ...x, focus })));
            setPositioning(null);
          }}
        />
      )}
      <style>{`
        .input { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.75rem; border: 2px solid #dcfce7; background: white; font-size: 0.875rem; }
        .input:focus { outline: none; border-color: #7bc67e; }
      `}</style>
    </div>
  );
}

function Field({ label, children, testid, small }) {
  return (
    <label className={`block ${small ? "" : ""}`} data-testid={testid}>
      <div className="text-xs font-extrabold mb-1">{label}</div>
      {children}
    </label>
  );
}

export function AdminTopBar() {
  return (
    <div className="bg-[#1a1a1a] text-white">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 font-extrabold">
          <Link to="/" className="text-[#7bc67e]">Site →</Link>
          <Link to="/admin/product-settings" className="hover:text-[#7bc67e]">Products</Link>
          <Link to="/admin/portfolio" className="hover:text-[#7bc67e]">Portfolio</Link>
          <Link to="/admin/navigation" className="hover:text-[#7bc67e]">Navigation</Link>
          <Link to="/admin/integrations" className="hover:text-[#7bc67e]">Integrations</Link>
          <Link to="/admin/leavers-templates" className="hover:text-[#7bc67e]">Leavers</Link>
          <Link to="/admin/qa" className="hover:text-[#7bc67e]">Q&amp;A</Link>
          <Link to="/admin/team-kits" className="hover:text-[#7bc67e]">Team kits</Link>
          <Link to="/admin/designer-products" className="hover:text-[#7bc67e]">Designer</Link>
        </div>
        <button onClick={() => { localStorage.removeItem("yop_admin_token"); window.location.href = "/admin/login"; }} className="text-zinc-400 hover:text-white">Sign out</button>
      </div>
    </div>
  );
}


/**
 * Trusted by logos - the customer logos that scroll across the homepage.
 * Add (upload), rename, reorder or remove; Save puts it live.
 */
function TrustedLogosCard() {
  const [logos, setLogos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { fetchTrustedLogos().then(setLogos).catch(() => setLogos([])); }, []);
  const change = (next) => { setLogos(next); setDirty(true); };
  const add = async (files) => {
    setBusy(true);
    try {
      const added = [];
      for (const f of files) {
        const r = await uploadAdminImage(f, "trusted-logos");
        added.push({ name: f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "), image: r.url });
      }
      change([...(logos || []), ...added]);
      toast.success(`${added.length} logo${added.length === 1 ? "" : "s"} added - click Save to put ${added.length === 1 ? "it" : "them"} live`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); }
    finally { setBusy(false); }
  };
  const move = (i, d) => { const n = [...logos]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; change(n); };
  const save = async () => {
    setBusy(true);
    try { setLogos(await adminSaveTrustedLogos(logos)); setDirty(false); toast.success("Trusted by logos saved - live on the homepage"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };
  if (!logos) return null;
  return (
    <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-6 mb-10" data-testid="admin-trusted-logos">
      <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold">Trusted by logos</div>
      <p className="text-sm text-[#4b5563] mt-1">Customer logos that scroll across the homepage under &ldquo;Trusted by&rdquo;. Square images look best. Only show customers who are happy for you to use their logo.</p>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {logos.map((l, i) => (
          <div key={i} className="border-2 border-[#eef2f7] rounded-2xl p-2" data-testid={`trusted-logo-${i}`}>
            <div className="aspect-square rounded-xl overflow-hidden bg-[#f8fafc]"><img src={mediaUrl(l.image)} alt={l.name} className="w-full h-full object-cover" /></div>
            <input value={l.name} onChange={(e) => change(logos.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Business name" className="mt-2 w-full border border-[#e5e7eb] rounded-lg px-2 py-1 text-xs" />
            <div className="mt-1 flex items-center justify-between">
              <span className="flex gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-[#f0fdf4] disabled:opacity-30" title="Move left"><ArrowLeft size={12} /></button>
                <button onClick={() => move(i, 1)} disabled={i === logos.length - 1} className="p-1 rounded hover:bg-[#f0fdf4] disabled:opacity-30" title="Move right"><ArrowRight size={12} /></button>
              </span>
              <button onClick={() => change(logos.filter((_, j) => j !== i))} className="p-1 rounded text-rose-500 hover:bg-rose-50" title="Remove"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        <label className="border-2 border-dashed border-[#7bc67e] rounded-2xl grid place-items-center aspect-square cursor-pointer text-[#166534] text-xs font-extrabold text-center p-2 hover:bg-[#f0fdf4]" data-testid="trusted-logo-add">
          {busy ? <Loader2 className="animate-spin" size={18} /> : <span><Upload size={18} className="mx-auto mb-1" />Add logos</span>}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && add([...e.target.files])} />
        </label>
      </div>
      <button onClick={save} disabled={!dirty || busy} className="mt-4 inline-flex items-center gap-2 bg-[#1a1a1a] text-white font-extrabold rounded-full px-5 py-2 text-sm disabled:opacity-40" data-testid="trusted-logos-save">
        <Save size={14} /> Save logos
      </button>
    </div>
  );
}


/**
 * All the photos for one job, in order - the FIRST is the main photo shown on
 * the card. Arrows reorder (so any photo can become the main one), click a
 * photo to position it in its square, + Add for more (e.g. the back).
 */
function PhotosRow({ item, onChange, onPosition, onReload }) {
  const [busy, setBusy] = useState(false);
  const extra = item.extra_images || [];
  const photos = [{ id: "main", url: item.image_url, focus: item.focus }, ...extra];
  const add = async (files) => {
    setBusy(true);
    try {
      let list = [...extra];
      for (const f of files) {
        if (f.size > 8_000_000) { toast.error(`${f.name} is over 8MB - please use a smaller photo`); continue; }
        const img = await adminAddPortfolioImage(item.id, await fileToDataUrl(f));
        list = [...list, img];
      }
      onChange(list);
      toast.success("Photo added");
    } catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); }
    finally { setBusy(false); }
  };
  const move = async (i, d) => {
    const j = i + d; if (j < 0 || j >= photos.length) return;
    const order = photos.map((p) => p.id); [order[i], order[j]] = [order[j], order[i]];
    setBusy(true);
    try { await adminReorderPortfolioPhotos(item.id, order); await onReload(); if (j === 0 || i === 0) toast.success("Main photo changed"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Couldn't reorder"); }
    finally { setBusy(false); }
  };
  const remove = async (xid) => {
    if (!window.confirm("Remove this photo from the job?")) return;
    try { await adminRemovePortfolioImage(item.id, xid); onChange(extra.filter((x) => x.id !== xid)); }
    catch (e) { toast.error(e?.response?.data?.detail || "Couldn't remove it"); }
  };
  return (
    <div className="px-4 pt-3" data-testid={`admin-portfolio-photos-${item.id}`}>
      <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#4b5563]">Photos ({photos.length}) - first one shows on the card · click a photo to move it in its square</div>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={p.id} className="w-16">
            <div className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 ${i === 0 ? "border-[#7bc67e]" : "border-[#e5e7eb]"}`}>
              <img src={mediaUrl(p.url)} alt="" className="w-full h-full object-cover cursor-pointer" style={photoStyle(p.focus)} onClick={() => onPosition(p)} title="Click to move it in its square" />
              {i === 0 && <span className="absolute bottom-0 inset-x-0 text-center text-[9px] font-black bg-[#7bc67e] text-[#1a1a1a]">MAIN</span>}
              {i > 0 && <button onClick={() => remove(p.id)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white/90 text-rose-600 text-xs font-black grid place-items-center" title="Remove">×</button>}
            </div>
            {photos.length > 1 && (
              <div className="flex justify-between mt-0.5">
                <button onClick={() => move(i, -1)} disabled={busy || i === 0} className="p-0.5 rounded hover:bg-[#f0fdf4] disabled:opacity-25" title={i === 1 ? "Make this the main photo" : "Move left"}><ArrowLeft size={12} /></button>
                <button onClick={() => move(i, 1)} disabled={busy || i === photos.length - 1} className="p-0.5 rounded hover:bg-[#f0fdf4] disabled:opacity-25" title="Move right"><ArrowRight size={12} /></button>
              </div>
            )}
          </div>
        ))}
        {extra.length < 9 && (
          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-[#7bc67e] grid place-items-center cursor-pointer text-[#166534] text-[10px] font-extrabold text-center hover:bg-[#f0fdf4]">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <span>+ Add</span>}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && add([...e.target.files])} />
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * Move a photo inside its square frame: drag it around, zoom in or out, or
 * show the whole photo. What you see in the square is what the site shows.
 */
function PositionPhoto({ target, onClose, onSaved }) {
  const [f, setF] = useState({ x: 50, y: 50, zoom: 1, fit: "cover", ...(target.focus || {}) });
  const [saving, setSaving] = useState(false);
  const drag = React.useRef(null);
  const box = React.useRef(null);
  const down = (e) => {
    if (f.fit === "contain") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fx: f.x, fy: f.y };
  };
  const moveP = (e) => {
    if (!drag.current) return;
    const size = box.current ? box.current.clientWidth : 360;
    const z = Number(f.zoom) || 1;
    const nx = drag.current.fx - ((e.clientX - drag.current.x) / size) * 100 / z;
    const ny = drag.current.fy - ((e.clientY - drag.current.y) / size) * 100 / z;
    setF((v) => ({ ...v, x: Math.max(0, Math.min(100, Math.round(nx))), y: Math.max(0, Math.min(100, Math.round(ny))) }));
  };
  const up = () => { drag.current = null; };
  const save = async () => {
    setSaving(true);
    try { onSaved(await adminSetPortfolioFocus(target.item.id, f, target.imageId)); toast.success("Photo position saved"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl max-w-md w-full max-h-[94vh] overflow-auto p-6" data-testid="portfolio-position-modal">
        <h2 className="font-black text-2xl">Move this photo</h2>
        <p className="text-sm text-[#4b5563] mt-1">Drag the photo to move it inside the square. Zoom in if it needs room to move. This square is exactly what shows on the site.</p>
        <div
          ref={box}
          onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}
          className={`mt-4 aspect-square w-full rounded-3xl overflow-hidden bg-[#f0fdf4] border-2 border-[#dcfce7] select-none touch-none ${f.fit === "contain" ? "" : "cursor-grab active:cursor-grabbing"}`}
          data-testid="portfolio-position-square"
        >
          <img src={mediaUrl(target.url)} alt="" className="w-full h-full pointer-events-none" style={photoStyle(f)} draggable="false" />
        </div>
        <label className={`mt-4 block text-sm font-extrabold ${f.fit === "contain" ? "opacity-40" : ""}`}>Zoom
          <input type="range" min="1" max="3" step="0.05" value={f.zoom || 1} disabled={f.fit === "contain"}
            onChange={(e) => setF((v) => ({ ...v, zoom: Number(e.target.value) }))} className="w-full accent-[#7bc67e]" data-testid="portfolio-position-zoom" />
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={f.fit === "contain"} onChange={(e) => setF((v) => ({ ...v, fit: e.target.checked ? "contain" : "cover" }))} />
          Show the whole photo (no cropping)
        </label>
        <button onClick={() => setF({ x: 50, y: 50, zoom: 1, fit: "cover" })} className="mt-2 text-xs font-bold text-[#166534] hover:underline">Reset</button>
        <div className="mt-5 flex gap-2">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-[#7bc67e] text-[#1a1a1a] font-extrabold rounded-full px-5 py-2.5 text-sm disabled:opacity-50" data-testid="portfolio-position-save">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-[#4b5563]">Cancel</button>
        </div>
      </div>
    </div>
  );
}
