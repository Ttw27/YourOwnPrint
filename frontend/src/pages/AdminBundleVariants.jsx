import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchTeamKitBrands, createTeamKitBrand, updateTeamKitBrand, deleteTeamKitBrand } from "../lib/api";
import { Plus, Trash2, Upload, Save, Loader2, ChevronDown, Image as ImageIcon } from "lucide-react";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Bundle-eligible product ids (kept in sync with backend BUNDLE_ELIGIBLE_IDS).
const ELIGIBLE_BUNDLES = [
  { id: "football-kit-bundle", name: "Football Kit Bundle" },
  { id: "football-premium-bundle", name: "Football Premium Bundle" },
  { id: "football-kit-front-only", name: "Football Kit — Front Print Only" },
  { id: "football-premium-front-only", name: "Football Premium — Front Print Only" },
  { id: "rugby-kit-bundle", name: "Rugby Kit Bundle" },
  { id: "rugby-kit-front-only", name: "Rugby Kit — Front Print Only" },
  { id: "training-tracksuit", name: "Training Tracksuit" },
  { id: "training-tee", name: "Training Tee" },
  { id: "training-pack-bundle", name: "Training Pack Bundle" },
  { id: "training-pack-front-only", name: "Training Pack — Front Print Only" },
  { id: "sports-team-bundle", name: "Sports Team Kit Bundle (generic)" },
];

export default function AdminBundleVariants() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    product_id: ELIGIBLE_BUNDLES[0].id, brand: "", name: "", description: "", price: "",
    image: "", active: true,
  });

  async function refresh() {
    setLoading(true);
    try {
      const perBundle = await Promise.all(
        ELIGIBLE_BUNDLES.map((b) => fetchTeamKitBrands(b.id).catch(() => []))
      );
      setItems(perBundle.flat());
    } catch { toast.error("Failed to load bundle variants"); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function onFile(e, target) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) { toast.error("Image too large (max 8 MB)"); return; }
    const url = await fileToDataUrl(file);
    if (target === "draft") setDraft((d) => ({ ...d, image: url }));
    else {
      const v = items.find((i) => i.id === target);
      if (!v) return;
      try { await updateTeamKitBrand(target, { ...v, image: url }); toast.success("Image replaced"); refresh(); }
      catch { toast.error("Update failed"); }
    }
  }

  async function onCreate() {
    if (!draft.product_id || !draft.name.trim() || !draft.price) {
      toast.error("Bundle, name, and price are required.");
      return;
    }
    setSaving(true);
    try {
      await createTeamKitBrand({
        product_id: draft.product_id,
        brand: draft.brand.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        price: parseFloat(draft.price),
        image: draft.image || "",
        active: draft.active,
      });
      toast.success("Variant added");
      setDraft((d) => ({ ...d, brand: "", name: "", description: "", price: "", image: "" }));
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  }

  async function patch(id, p) {
    const v = items.find((i) => i.id === id);
    if (!v) return;
    try { await updateTeamKitBrand(id, { ...v, ...p }); refresh(); }
    catch { toast.error("Update failed"); }
  }

  async function remove(id) {
    if (!window.confirm("Delete this variant permanently?")) return;
    try { await deleteTeamKitBrand(id); toast.success("Deleted"); refresh(); }
    catch { toast.error("Delete failed"); }
  }

  const grouped = items.reduce((acc, it) => {
    (acc[it.product_id] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-bundle-variants">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Bundle variants</h1>
        <p className="text-sm text-[#4b5563] mb-6">Add brand/tier options for each kit bundle (e.g. AWD, Nike, Umbro, Pro tier). Each variant shows up as a "Pick your kit" tile on the customer configurator with its own photo, description, size guide and price.</p>

        {/* Add */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5 mb-8" data-testid="admin-bundle-variants-create">
          <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold mb-3">Add a new variant</div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block" data-testid="abv-bundle">
              <div className="text-xs font-extrabold mb-1">Bundle</div>
              <select value={draft.product_id} onChange={(e) => setDraft({ ...draft, product_id: e.target.value })} className="input">
                {ELIGIBLE_BUNDLES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="block" data-testid="abv-brand">
              <div className="text-xs font-extrabold mb-1">Brand (e.g. Nike, AWD, Umbro)</div>
              <input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} className="input" placeholder="AWD" />
            </label>
            <label className="block" data-testid="abv-name">
              <div className="text-xs font-extrabold mb-1">Variant name</div>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="input" placeholder="Just Cool Kit" />
            </label>
            <label className="block" data-testid="abv-price">
              <div className="text-xs font-extrabold mb-1">Price per kit (£)</div>
              <input type="number" step="0.01" min="0.5" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="input" placeholder="24.99" />
            </label>
            <label className="block md:col-span-2" data-testid="abv-description">
              <div className="text-xs font-extrabold mb-1">Description</div>
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input min-h-[80px]" placeholder="Short paragraph shown on the variant tile." />
            </label>
            <label className="block" data-testid="abv-image">
              <div className="text-xs font-extrabold mb-1">Image</div>
              <div className="flex gap-3 items-center">
                <div className="w-20 h-20 bg-[#f0fdf4] border-2 border-dashed border-[#7bc67e] rounded-xl grid place-items-center overflow-hidden">
                  {draft.image ? <img src={draft.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-[#7bc67e]" />}
                </div>
                <label className="inline-flex items-center gap-1 px-3 py-2 bg-[#f0fdf4] hover:bg-[#dcfce7] rounded-full text-xs font-extrabold cursor-pointer">
                  <Upload size={12} /> Choose image
                  <input type="file" accept="image/*" onChange={(e) => onFile(e, "draft")} className="hidden" />
                </label>
              </div>
            </label>
            <label className="block" data-testid="abv-active">
              <div className="text-xs font-extrabold mb-1">Status</div>
              <label className="inline-flex items-center gap-1 text-xs font-extrabold">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Live on the site
              </label>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={onCreate}
              disabled={saving}
              className="px-5 py-3 bg-[#7bc67e] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-[#5eb062] disabled:opacity-50"
              data-testid="abv-save"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Add variant
            </button>
          </div>
        </div>

        {/* List by bundle */}
        {loading ? (
          <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white border-2 border-[#dcfce7] rounded-2xl p-10 text-center text-sm text-[#4b5563]" data-testid="abv-empty">
            No variants yet — add one above and it'll show up on the corresponding bundle page instantly.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([bundleId, list]) => (
              <details key={bundleId} className="group bg-white border-2 border-[#dcfce7] rounded-3xl p-4" open data-testid={`abv-group-${bundleId}`}>
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <div className="font-black text-lg">{ELIGIBLE_BUNDLES.find((b) => b.id === bundleId)?.name || bundleId}</div>
                  <ChevronDown size={16} className="text-[#7bc67e] group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map((v) => (
                    <div key={v.id} className="border-2 border-[#dcfce7] rounded-2xl p-3 space-y-2" data-testid={`abv-row-${v.id}`}>
                      <div className="aspect-video bg-[#f0fdf4] rounded-xl overflow-hidden">
                        {v.image ? <img src={v.image} alt={v.name} className="w-full h-full object-cover" /> : <div className="grid place-items-center h-full text-[#4b5563]"><ImageIcon size={22} /></div>}
                      </div>
                      <input defaultValue={v.brand} placeholder="Brand" onBlur={(e) => e.target.value !== v.brand && patch(v.id, { brand: e.target.value })} className="input text-xs" />
                      <input defaultValue={v.name} onBlur={(e) => e.target.value !== v.name && patch(v.id, { name: e.target.value })} className="input font-extrabold" />
                      <textarea defaultValue={v.description} onBlur={(e) => e.target.value !== v.description && patch(v.id, { description: e.target.value })} className="input text-xs min-h-[60px]" placeholder="Description" />
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-extrabold inline-flex items-center gap-1">£
                          <input type="number" step="0.01" min="0.5" defaultValue={v.price} onBlur={(e) => parseFloat(e.target.value) !== v.price && patch(v.id, { price: parseFloat(e.target.value) })} className="input w-24 text-xs" />
                        </label>
                        <label className="text-xs font-extrabold inline-flex items-center gap-1 ml-auto">
                          <input type="checkbox" checked={v.active} onChange={(e) => patch(v.id, { active: e.target.checked })} /> Live
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <label className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-[#f0fdf4] hover:bg-[#dcfce7] text-xs rounded-full font-extrabold cursor-pointer">
                          <Upload size={12} /> Replace image
                          <input type="file" accept="image/*" onChange={(e) => onFile(e, v.id)} className="hidden" />
                        </label>
                        <button onClick={() => remove(v.id)} className="px-2 py-1.5 bg-[#fee2e2] hover:bg-[#fecaca] text-xs rounded-full font-extrabold inline-flex items-center gap-1" data-testid={`abv-delete-${v.id}`}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
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
