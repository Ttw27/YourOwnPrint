import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { adminListPortfolio, adminCreatePortfolio, adminUpdatePortfolio, adminDeletePortfolio, fetchPortfolioCategories } from "../lib/api";
import { Upload, Trash2, Star, Eye, EyeOff, Loader2, Save, Image as ImageIcon } from "lucide-react";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminPortfolio() {
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
        <h1 className="font-black text-3xl mb-1">Portfolio</h1>
        <p className="text-sm text-[#4b5563] mb-8">Upload customer prints, finished kits, or studio shots. Anything you tick <strong>Featured</strong> will show first on the public gallery and homepage strip.</p>

        {/* Add new */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-6 mb-10" data-testid="admin-portfolio-create">
          <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold mb-3">Add a new piece</div>
          <div className="grid md:grid-cols-2 gap-5">
            <label className="block">
              <div className="text-xs font-extrabold mb-1">Image</div>
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
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="input" placeholder="e.g. Tigers FC — full home kit" />
              </Field>
              <Field label="Category" testid="admin-portfolio-cat">
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="input">
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Caption (optional)" testid="admin-portfolio-caption">
                <textarea value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} className="input min-h-[60px]" placeholder="Short story behind the print" />
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
            <p className="text-sm text-[#4b5563] mt-3">No items yet — upload your first piece above.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="admin-portfolio-list">
            {items.map((it) => (
              <div key={it.id} className={`bg-white border-2 rounded-3xl overflow-hidden ${it.is_hidden ? "opacity-50 border-[#fee2e2]" : "border-[#dcfce7]"}`} data-testid={`admin-portfolio-row-${it.id}`}>
                <div className="aspect-square bg-[#f0fdf4] relative">
                  <img src={it.image_url} alt={it.alt_text || it.title} className="w-full h-full object-cover" />
                  {it.featured && <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold bg-[#fde68a] text-[#1a1a1a]">Featured</span>}
                </div>
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
