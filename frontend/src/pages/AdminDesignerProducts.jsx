import React, { useEffect, useState } from "react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchAdminDesignerProducts, updateDesignerSettings } from "../lib/api";
import { toast } from "sonner";
import { Save, Loader2, Sparkles, Check, X, Image as ImageIcon } from "lucide-react";

const DEFAULT_PA = { x: 22, y: 20, w: 56, h: 55 };
const USE_CASES = [
  { id: "workwear",        label: "Workwear" },
  { id: "branded-to-sell", label: "Branded to sell" },
  { id: "daily-use",       label: "Daily use" },
  { id: "sports",          label: "Sports" },
  { id: "kids",            label: "Kids" },
  { id: "eco",             label: "Eco" },
];

export default function AdminDesignerProducts() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await fetchAdminDesignerProducts();
      setProducts(list);
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const update = (id, patch) => setProducts((prev) => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  const updatePA = (id, key, value) => setProducts((prev) => prev.map(p => p.id === id ? { ...p, designer_print_area: { ...(p.designer_print_area || DEFAULT_PA), [key]: Number(value) } } : p));

  const save = async (p) => {
    setBusy(true);
    try {
      const pa = p.designer_print_area || DEFAULT_PA;
      await updateDesignerSettings(p.id, {
        designer_enabled: p.designer_enabled,
        designer_image: p.designer_image || p.main_image,
        designer_print_area: { x: Number(pa.x), y: Number(pa.y), w: Number(pa.w), h: Number(pa.h) },
        composition: p.composition || "",
        description_long: p.description_long || "",
        use_cases: p.use_cases || [],
      });
      toast.success(`${p.name} saved`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };
  const toggleUseCase = (id, uc) => setProducts((prev) => prev.map(p => p.id === id ? { ...p, use_cases: (p.use_cases || []).includes(uc) ? (p.use_cases || []).filter(x => x !== uc) : [...(p.use_cases || []), uc] } : p));

  const visible = products.filter(p => !filter.trim() || `${p.name} ${p.id} ${p.category}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]">
      <BoldNavbar />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Admin</div>
        <h1 className="font-nunito font-black text-4xl lg:text-5xl mt-2">Designer Products</h1>
        <p className="text-[#4b5563] mt-3 max-w-2xl">Pick which products appear in the <strong>Design Your Own</strong> tool. For each enabled product set the canvas image and the printable rectangle (x/y/width/height as % of the image).</p>

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <input data-testid="dp-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter products…" className="bg-white border border-[#dcfce7] rounded-full px-4 py-2 text-sm w-full sm:w-80" />
          <div className="text-xs text-[#4b5563]">{products.filter(p => p.designer_enabled).length} of {products.length} enabled</div>
        </div>

        {loading ? (
          <div className="mt-10 text-center text-sm text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 mt-6" data-testid="dp-list">
            {visible.map((p) => {
              const pa = p.designer_print_area || DEFAULT_PA;
              return (
                <div key={p.id} data-testid={`dp-${p.id}`} className={`rounded-3xl border-2 p-4 ${p.designer_enabled ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#dcfce7] bg-white"}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-[#dcfce7] overflow-hidden flex-shrink-0 relative">
                      {p.designer_image ? (
                        <>
                          <img src={p.designer_image} alt="" className="w-full h-full object-cover" />
                          {/* Print-area preview */}
                          <div className="absolute border border-dashed border-[#7bc67e]" style={{ left: `${pa.x}%`, top: `${pa.y}%`, width: `${pa.w}%`, height: `${pa.h}%` }} />
                        </>
                      ) : <ImageIcon size={24} className="m-auto" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-nunito font-extrabold truncate">{p.name}</div>
                      <div className="text-[10px] text-[#4b5563] uppercase tracking-wider">{p.category} · {p.id}</div>
                      <label className="mt-2 inline-flex items-center gap-2 cursor-pointer">
                        <input data-testid={`dp-enabled-${p.id}`} type="checkbox" checked={!!p.designer_enabled} onChange={(e) => update(p.id, { designer_enabled: e.target.checked })} className="w-4 h-4 accent-[#7bc67e]" />
                        <span className="text-xs font-nunito font-extrabold">{p.designer_enabled ? <><Check size={11} className="inline text-[#7bc67e]" /> Enabled in designer</> : <><X size={11} className="inline text-rose-500" /> Disabled</>}</span>
                      </label>
                    </div>
                  </div>

                  {p.designer_enabled && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Designer image URL</label>
                        <input data-testid={`dp-image-${p.id}`} value={p.designer_image || ""} onChange={(e) => update(p.id, { designer_image: e.target.value })} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-xs" placeholder="https://…" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Print area (% of image)</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {["x","y","w","h"].map(k => (
                            <div key={k} className="bg-white border border-[#e5e7eb] rounded-xl px-2 py-1 text-xs flex items-center gap-1">
                              <span className="font-bold text-[#4b5563] uppercase">{k}</span>
                              <input data-testid={`dp-${k}-${p.id}`} type="number" min={0} max={100} value={pa[k]} onChange={(e) => updatePA(p.id, k, e.target.value)} className="w-full bg-transparent focus:outline-none text-right" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Composition</label>
                        <input data-testid={`dp-composition-${p.id}`} value={p.composition || ""} onChange={(e) => update(p.id, { composition: e.target.value })} placeholder="e.g. 180 GSM · 100% ring-spun cotton" className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Long description</label>
                        <textarea data-testid={`dp-description-${p.id}`} value={p.description_long || ""} onChange={(e) => update(p.id, { description_long: e.target.value })} placeholder="2-3 sentences shown in the Designer's product info card" rows={2} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-xs resize-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Use-case badges</label>
                        <div className="flex flex-wrap gap-1.5" data-testid={`dp-use-cases-${p.id}`}>
                          {USE_CASES.map(({ id, label }) => {
                            const on = (p.use_cases || []).includes(id);
                            return (
                              <button
                                key={id}
                                data-testid={`dp-use-case-${id}-${p.id}`}
                                onClick={() => toggleUseCase(p.id, id)}
                                className={`text-[10px] font-nunito font-extrabold rounded-full px-2.5 py-1 border transition-colors ${on ? "bg-[#7bc67e] text-[#1a1a1a] border-[#7bc67e]" : "bg-white text-[#4b5563] border-[#dcfce7] hover:border-[#7bc67e]"}`}
                              >{label}</button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button data-testid={`dp-save-${p.id}`} onClick={() => save(p)} disabled={busy} className="inline-flex items-center gap-1.5 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold text-xs px-4 py-2 rounded-full transition-colors">
                      {busy ? <Loader2 className="animate-spin" size={12} /> : <><Sparkles size={12} /> <Save size={11} /> Save</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BoldFooter />
    </div>
  );
}
