import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchTeamKitBrands, createTeamKitBrand, updateTeamKitBrand, deleteTeamKitBrand,
  fetchSockSizes, adminUpdateSockSizes,
} from "../lib/api";
import {
  Plus, Trash2, Upload, Save, Loader2, ChevronDown, Image as ImageIcon, Palette, X,
} from "lucide-react";

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
  // Full Squad Configurator set slots
  { id: "full-squad-match-day", name: "Full Squad — Match Day Set", group: "Full Squad Configurator" },
  { id: "full-squad-training", name: "Full Squad — Training Set", group: "Full Squad Configurator" },
  { id: "full-squad-tracksuit", name: "Full Squad — Tracksuit Set", group: "Full Squad Configurator" },
  // Sports Outfit Configurator set slots
  { id: "sports-outfit-training", name: "Sports Outfit — Training Kit", group: "Sports Outfit Configurator" },
  { id: "sports-outfit-tracksuit", name: "Sports Outfit — Tracksuit", group: "Sports Outfit Configurator" },
];

const EMPTY_DRAFT = {
  product_id: ELIGIBLE_BUNDLES[0].id,
  brand: "", name: "", description: "", price: "",
  image: "", active: true,
  colours: [],           // [{name, hex}]
  sizes: [],             // ["S","M","L",...]
  sock_sizes: [],        // ["3–5","6–8",...] — falls back to global
  size_guide: "",        // free-form text/markdown
  included_items: [],    // ["Shirt","Shorts","Socks"]
};

export default function AdminBundleVariants() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  // Global sock sizes admin panel
  const [sockSizes, setSockSizes] = useState([]);
  const [sockInput, setSockInput] = useState("");
  const [sockSaving, setSockSaving] = useState(false);

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
  async function refreshSocks() {
    try {
      const d = await fetchSockSizes();
      setSockSizes(d?.sock_sizes || []);
    } catch { /* no-op */ }
  }
  useEffect(() => { refresh(); refreshSocks(); }, []);

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
      toast.error("Bundle, name, and price are required."); return;
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
        colours: draft.colours || [],
        sizes: draft.sizes || [],
        sock_sizes: draft.sock_sizes || [],
        size_guide: draft.size_guide || "",
        included_items: draft.included_items || [],
      });
      toast.success("Variant added");
      setDraft((d) => ({ ...EMPTY_DRAFT, product_id: d.product_id }));
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

  async function saveSocks() {
    if (!sockSizes.length) { toast.error("Add at least one sock size."); return; }
    setSockSaving(true);
    try {
      const d = await adminUpdateSockSizes(sockSizes);
      setSockSizes(d?.values || []);
      toast.success("Sock sizes saved");
    } catch { toast.error("Save failed"); }
    finally { setSockSaving(false); }
  }

  const grouped = items.reduce((acc, it) => {
    (acc[it.product_id] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-bundle-variants">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Bundle variants</h1>
        <p className="text-sm text-[#4b5563] mb-6">Add brand/tier options for each kit bundle (e.g. AWD, Nike, Umbro, Pro tier). Each variant shows up as a &ldquo;Pick your kit&rdquo; tile on the customer configurator with its own photo, description, colours, sizes, sock sizes, size guide and price.</p>

        {/* Global sock sizes editor */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5 mb-8" data-testid="admin-sock-sizes">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold">Global sock sizes</div>
              <p className="text-xs text-[#4b5563] mt-1">Default sock size options offered per player on the Full Squad Configurator. UK shoe-size ranges work best. Individual variants can override via their own <em>Sock sizes</em> list below.</p>
            </div>
            <button onClick={saveSocks} disabled={sockSaving} className="px-4 py-2 bg-[#7bc67e] rounded-full text-sm font-extrabold inline-flex items-center gap-1.5 hover:bg-[#5eb062] disabled:opacity-50" data-testid="admin-sock-sizes-save">
              {sockSaving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />} Save
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sockSizes.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-[#f0fdf4] rounded-full px-3 py-1 text-xs font-extrabold" data-testid={`admin-sock-chip-${i}`}>
                {s}
                <button type="button" onClick={() => setSockSizes(sockSizes.filter((_, j) => j !== i))} className="hover:text-rose-500" aria-label="Remove">
                  <X size={11} />
                </button>
              </span>
            ))}
            <div className="inline-flex items-center gap-1">
              <input
                value={sockInput}
                onChange={(e) => setSockInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && sockInput.trim()) {
                    setSockSizes([...sockSizes, sockInput.trim()]);
                    setSockInput("");
                  }
                }}
                placeholder="e.g. 3–5"
                className="input-sm w-24"
                data-testid="admin-sock-input"
              />
              <button type="button" onClick={() => {
                if (!sockInput.trim()) return;
                setSockSizes([...sockSizes, sockInput.trim()]);
                setSockInput("");
              }} className="w-6 h-6 grid place-items-center rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7]" data-testid="admin-sock-add"><Plus size={12} /></button>
            </div>
          </div>
        </div>

        {/* Add variant */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5 mb-8" data-testid="admin-bundle-variants-create">
          <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold mb-3">Add a new variant</div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block" data-testid="abv-bundle">
              <div className="text-xs font-extrabold mb-1">Bundle</div>
              <select value={draft.product_id} onChange={(e) => setDraft({ ...draft, product_id: e.target.value })} className="input">
                {ELIGIBLE_BUNDLES.map((b) => <option key={b.id} value={b.id}>{b.group ? `${b.group} · ${b.name}` : b.name}</option>)}
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

            {/* Included items */}
            <ChipListField
              label="Included items (shown as chips on the tile)"
              placeholder="e.g. Shirt, Shorts, Socks"
              values={draft.included_items}
              onChange={(v) => setDraft({ ...draft, included_items: v })}
              testid="abv-included"
            />
            {/* Sizes */}
            <ChipListField
              label="Available sizes"
              placeholder="e.g. S, M, L, XL"
              values={draft.sizes}
              onChange={(v) => setDraft({ ...draft, sizes: v })}
              testid="abv-sizes"
            />
            {/* Sock sizes (override) */}
            <ChipListField
              label="Sock sizes (override — leave blank to use global)"
              placeholder="e.g. 3–5, 6–8, 9–11"
              values={draft.sock_sizes}
              onChange={(v) => setDraft({ ...draft, sock_sizes: v })}
              testid="abv-sock-sizes"
            />
            {/* Colours */}
            <div className="md:col-span-2" data-testid="abv-colours">
              <div className="text-xs font-extrabold mb-1">Colours</div>
              <ColourEditor colours={draft.colours} onChange={(v) => setDraft({ ...draft, colours: v })} />
            </div>
            {/* Size guide */}
            <label className="block md:col-span-2" data-testid="abv-size-guide">
              <div className="text-xs font-extrabold mb-1">Size guide (free text — appears in the dropdown)</div>
              <textarea
                value={draft.size_guide}
                onChange={(e) => setDraft({ ...draft, size_guide: e.target.value })}
                className="input min-h-[100px] font-mono text-[11px]"
                placeholder={"e.g.\nS  — Chest 36–38, Length 27\nM  — Chest 39–41, Length 28\nL  — Chest 42–44, Length 29"}
              />
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
            No variants yet — add one above and it&apos;ll show up on the corresponding bundle page instantly.
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
                    <VariantEditor
                      key={v.id}
                      variant={v}
                      onPatch={(p) => patch(v.id, p)}
                      onDelete={() => remove(v.id)}
                      onReplaceImage={(e) => onFile(e, v.id)}
                    />
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
        .input-sm { padding: 0.35rem 0.6rem; border-radius: 0.6rem; border: 2px solid #dcfce7; background: white; font-size: 0.75rem; }
        .input-sm:focus { outline: none; border-color: #7bc67e; }
      `}</style>
    </div>
  );
}

// ---------------- Sub-components ----------------
function ChipListField({ label, placeholder, values, onChange, testid }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v) return;
    // Support comma-separated bulk add
    const parts = v.split(",").map((x) => x.trim()).filter(Boolean);
    onChange([...values, ...parts]);
    setInput("");
  };
  return (
    <div data-testid={testid}>
      <div className="text-xs font-extrabold mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-[#f0fdf4] rounded-full px-2.5 py-0.5 text-xs font-extrabold">
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-rose-500" aria-label="Remove"><X size={10} /></button>
          </span>
        ))}
        <div className="inline-flex items-center gap-1">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={placeholder} className="input-sm w-32" data-testid={`${testid}-input`} />
          <button type="button" onClick={add} className="w-6 h-6 grid place-items-center rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7]" data-testid={`${testid}-add`}><Plus size={12} /></button>
        </div>
      </div>
    </div>
  );
}

function ColourEditor({ colours, onChange }) {
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#000000");
  const add = () => {
    if (!name.trim()) return;
    onChange([...(colours || []), { name: name.trim(), hex }]);
    setName("");
    setHex("#000000");
  };
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {(colours || []).map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 bg-[#f0fdf4] rounded-full px-2.5 py-1 text-xs font-extrabold">
          <span className="w-3.5 h-3.5 rounded-full border border-white shadow-inner" style={{ background: c.hex }} />
          {c.name}
          <button type="button" onClick={() => onChange(colours.filter((_, j) => j !== i))} className="hover:text-rose-500" aria-label="Remove"><X size={10} /></button>
        </span>
      ))}
      <div className="inline-flex items-center gap-1.5 bg-white border-2 border-dashed border-[#7bc67e] rounded-full pl-2 pr-1 py-0.5">
        <Palette size={12} className="text-[#7bc67e]" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-20 text-xs font-extrabold bg-transparent focus:outline-none" data-testid="abv-colour-name" />
        <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="w-6 h-6 rounded-full border-0 bg-transparent cursor-pointer" data-testid="abv-colour-hex" />
        <button type="button" onClick={add} className="w-6 h-6 grid place-items-center rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7]" data-testid="abv-colour-add"><Plus size={12} /></button>
      </div>
    </div>
  );
}

function VariantEditor({ variant: v, onPatch, onDelete, onReplaceImage }) {
  return (
    <div className="border-2 border-[#dcfce7] rounded-2xl p-3 space-y-2" data-testid={`abv-row-${v.id}`}>
      <div className="aspect-video bg-[#f0fdf4] rounded-xl overflow-hidden">
        {v.image ? <img src={v.image} alt={v.name} className="w-full h-full object-cover" /> : <div className="grid place-items-center h-full text-[#4b5563]"><ImageIcon size={22} /></div>}
      </div>
      <input defaultValue={v.brand} placeholder="Brand" onBlur={(e) => e.target.value !== v.brand && onPatch({ brand: e.target.value })} className="input text-xs" />
      <input defaultValue={v.name} onBlur={(e) => e.target.value !== v.name && onPatch({ name: e.target.value })} className="input font-extrabold" />
      <textarea defaultValue={v.description || ""} onBlur={(e) => e.target.value !== (v.description || "") && onPatch({ description: e.target.value })} className="input text-xs min-h-[60px]" placeholder="Description" />
      <div className="flex items-center gap-2">
        <label className="text-xs font-extrabold inline-flex items-center gap-1">£
          <input type="number" step="0.01" min="0.5" defaultValue={v.price} onBlur={(e) => parseFloat(e.target.value) !== v.price && onPatch({ price: parseFloat(e.target.value) })} className="input w-24 text-xs" />
        </label>
        <label className="text-xs font-extrabold inline-flex items-center gap-1 ml-auto">
          <input type="checkbox" checked={v.active} onChange={(e) => onPatch({ active: e.target.checked })} /> Live
        </label>
      </div>

      {/* Included items */}
      <ChipListField
        label="Included items"
        placeholder="Shirt"
        values={v.included_items || []}
        onChange={(next) => onPatch({ included_items: next })}
        testid={`abv-row-${v.id}-included`}
      />
      {/* Sizes */}
      <ChipListField
        label="Sizes"
        placeholder="M"
        values={v.sizes || []}
        onChange={(next) => onPatch({ sizes: next })}
        testid={`abv-row-${v.id}-sizes`}
      />
      {/* Sock sizes */}
      <ChipListField
        label="Sock sizes (override)"
        placeholder="6–8"
        values={v.sock_sizes || []}
        onChange={(next) => onPatch({ sock_sizes: next })}
        testid={`abv-row-${v.id}-sock`}
      />
      {/* Colours */}
      <div>
        <div className="text-xs font-extrabold mb-1">Colours</div>
        <ColourEditor colours={v.colours || []} onChange={(next) => onPatch({ colours: next })} />
      </div>
      {/* Size guide */}
      <textarea
        defaultValue={v.size_guide || ""}
        onBlur={(e) => e.target.value !== (v.size_guide || "") && onPatch({ size_guide: e.target.value })}
        className="input text-[11px] min-h-[70px] font-mono"
        placeholder="Size guide (shown in the dropdown)"
      />

      <div className="flex gap-2 pt-1">
        <label className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-[#f0fdf4] hover:bg-[#dcfce7] text-xs rounded-full font-extrabold cursor-pointer">
          <Upload size={12} /> Replace image
          <input type="file" accept="image/*" onChange={onReplaceImage} className="hidden" />
        </label>
        <button onClick={onDelete} className="px-2 py-1.5 bg-[#fee2e2] hover:bg-[#fecaca] text-xs rounded-full font-extrabold inline-flex items-center gap-1" data-testid={`abv-delete-${v.id}`}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
