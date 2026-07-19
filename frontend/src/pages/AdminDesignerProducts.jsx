import React, { useEffect, useState, useRef } from "react";
import { fetchAdminDesignerProducts, updateDesignerSettings, uploadAdminImage } from "../lib/api";
import { toast } from "sonner";
import { Save, Loader2, Sparkles, Check, X, Image as ImageIcon, ChevronLeft, ChevronRight, Upload } from "lucide-react";

const PAGE_SIZE = 25;
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filter), 350);
    return () => clearTimeout(t);
  }, [filter]);

  const reload = async (targetPage = page) => {
    setLoading(true);
    try {
      const d = await fetchAdminDesignerProducts(targetPage * PAGE_SIZE, PAGE_SIZE, debouncedFilter);
      setProducts(d.items || []);
      setTotal(d.total || 0);
    } finally { setLoading(false); }
  };
  useEffect(() => { setPage(0); reload(0); }, [debouncedFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id, patch) => setProducts((prev) => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  const updatePA = (id, key, value) => setProducts((prev) => prev.map(p => p.id === id ? { ...p, designer_print_area: { ...(p.designer_print_area || DEFAULT_PA), [key]: Number(value) } } : p));
  const updatePABack = (id, key, value) => setProducts((prev) => prev.map(p => p.id === id ? { ...p, designer_print_area_back: { ...(p.designer_print_area_back || p.designer_print_area || DEFAULT_PA), [key]: Number(value) } } : p));

  const save = async (p) => {
    setBusy(true);
    try {
      const pa = p.designer_print_area || DEFAULT_PA;
      const paBack = p.designer_print_area_back || null;
      await updateDesignerSettings(p.id, {
        designer_enabled: p.designer_enabled,
        designer_image: p.designer_image || p.main_image,
        designer_print_area: { x: Number(pa.x), y: Number(pa.y), w: Number(pa.w), h: Number(pa.h) },
        designer_images_by_colour: p.designer_images_by_colour || {},
        designer_image_back: p.designer_image_back || null,
        designer_print_area_back: paBack ? { x: Number(paBack.x), y: Number(paBack.y), w: Number(paBack.w), h: Number(paBack.h) } : null,
        designer_images_by_colour_back: p.designer_images_by_colour_back || {},
        composition: p.composition || "",
        description_long: p.description_long || "",
        use_cases: p.use_cases || [],
      });
      toast.success(`${p.name} saved`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };

  const [uploadingId, setUploadingId] = useState(null); // tracks which product/colour combo is mid-upload

  const uploadMainImage = async (p, file) => {
    setUploadingId(p.id);
    try {
      const { url } = await uploadAdminImage(file, "designer-images");
      update(p.id, { designer_image: url });
      toast.success("Image uploaded");
    } catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); }
    finally { setUploadingId(null); }
  };

  const uploadColourImage = async (p, colourName, file) => {
    const key = `${p.id}:${colourName}`;
    setUploadingId(key);
    try {
      const { url } = await uploadAdminImage(file, "designer-images");
      setProducts((prev) => prev.map(x => x.id === p.id
        ? { ...x, designer_images_by_colour: { ...(x.designer_images_by_colour || {}), [colourName]: url } }
        : x));
      toast.success(`${colourName} image uploaded`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); }
    finally { setUploadingId(null); }
  };

  const clearColourImage = (p, colourName) => {
    setProducts((prev) => prev.map(x => {
      if (x.id !== p.id) return x;
      const next = { ...(x.designer_images_by_colour || {}) };
      delete next[colourName];
      return { ...x, designer_images_by_colour: next };
    }));
  };

  const uploadMainImageBack = async (p, file) => {
    const key = `${p.id}:back`;
    setUploadingId(key);
    try {
      const { url } = await uploadAdminImage(file, "designer-images");
      update(p.id, { designer_image_back: url });
      toast.success("Back image uploaded");
    } catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); }
    finally { setUploadingId(null); }
  };

  const uploadColourImageBack = async (p, colourName, file) => {
    const key = `${p.id}:back:${colourName}`;
    setUploadingId(key);
    try {
      const { url } = await uploadAdminImage(file, "designer-images");
      setProducts((prev) => prev.map(x => x.id === p.id
        ? { ...x, designer_images_by_colour_back: { ...(x.designer_images_by_colour_back || {}), [colourName]: url } }
        : x));
      toast.success(`${colourName} back image uploaded`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); }
    finally { setUploadingId(null); }
  };

  const clearColourImageBack = (p, colourName) => {
    setProducts((prev) => prev.map(x => {
      if (x.id !== p.id) return x;
      const next = { ...(x.designer_images_by_colour_back || {}) };
      delete next[colourName];
      return { ...x, designer_images_by_colour_back: next };
    }));
  };
  const toggleUseCase = (id, uc) => setProducts((prev) => prev.map(p => p.id === id ? { ...p, use_cases: (p.use_cases || []).includes(uc) ? (p.use_cases || []).filter(x => x !== uc) : [...(p.use_cases || []), uc] } : p));

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Admin</div>
        <h1 className="font-nunito font-black text-4xl lg:text-5xl mt-2">Designer Products</h1>
        <p className="text-[#4b5563] mt-3 max-w-2xl">Choose which products customers can customise in <strong>Design Your Own</strong>. For each one, set the photo they design on top of, and drag out the area their artwork is allowed to sit in. Upload a photo per colour and the designer shows the real garment in that colour &mdash; without one, it falls back to a plain block of that colour so the customer never sees the wrong shade.</p>

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <input data-testid="dp-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search products…" className="bg-white border border-[#dcfce7] rounded-full px-4 py-2 text-sm w-full sm:w-80" />
          <div className="text-xs text-[#4b5563]">{total} product{total === 1 ? "" : "s"}{debouncedFilter ? " matching" : " total"} · showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</div>
        </div>

        {loading ? (
          <div className="mt-10 text-center text-sm text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4 mt-6" data-testid="dp-list">
              {products.map((p) => {
              const pa = p.designer_print_area || DEFAULT_PA;
              const paBack = p.designer_print_area_back || pa;
              return (
                <div key={p.id} data-testid={`dp-${p.id}`} className={`rounded-3xl border-2 p-4 ${p.designer_enabled ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#dcfce7] bg-white"}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-[#dcfce7] overflow-hidden flex-shrink-0">
                      {p.designer_image ? <img src={p.designer_image} alt="" className="w-full h-full object-contain" /> : <ImageIcon size={24} className="m-auto" />}
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
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Front photo used in the designer</label>
                        <div className="flex items-center gap-2">
                          <input data-testid={`dp-image-${p.id}`} value={p.designer_image || ""} onChange={(e) => update(p.id, { designer_image: e.target.value })} className="flex-1 bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-xs" placeholder="https://… or upload a file" />
                          <label className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#166534] border border-[#7bc67e] rounded-full px-2.5 py-1.5 hover:bg-white cursor-pointer whitespace-nowrap">
                            {uploadingId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadMainImage(p, e.target.files[0])} />
                          </label>
                        </div>
                        <p className="text-[10px] text-[#4b5563] mt-1">This is a separate photo just for the design canvas — it never appears in the product's normal photo gallery customers browse.</p>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Print area — drag the box on the image</label>
                        <PrintAreaPicker image={p.designer_image} value={pa} onChange={(next) => update(p.id, { designer_print_area: next })} />
                        <div className="grid grid-cols-4 gap-1.5 mt-2">
                          {["x","y","w","h"].map(k => (
                            <div key={k} className="bg-white border border-[#e5e7eb] rounded-xl px-2 py-1 text-xs flex items-center gap-1">
                              <span className="font-bold text-[#4b5563] uppercase">{k}</span>
                              <input data-testid={`dp-${k}-${p.id}`} type="number" min={0} max={100} value={pa[k]} onChange={(e) => updatePA(p.id, k, e.target.value)} className="w-full bg-transparent focus:outline-none text-right" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {p.colors?.length > 0 && (
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">A front photo for each colour (optional)</label>
                          <p className="text-[10px] text-[#4b5563] mb-2">Upload a matching blank photo per colour so the canvas shows the right garment colour once a customer picks one. Colours left blank just use the main image above.</p>
                          <div className="grid grid-cols-2 gap-2">
                            {p.colors.map((c) => {
                              const img = (p.designer_images_by_colour || {})[c.name];
                              const key = `${p.id}:${c.name}`;
                              return (
                                <div key={c.name} className="flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-xl p-1.5">
                                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#e5e7eb] flex-shrink-0 bg-[#f0fdf4]">
                                    {img ? <img src={img} className="w-full h-full object-contain" alt="" /> : <span className="w-full h-full block" style={{ background: c.hex || "#ccc" }} />}
                                  </div>
                                  <span className="text-[10px] font-bold truncate flex-1">{c.name}</span>
                                  {img && <button onClick={() => clearColourImage(p, c.name)} className="text-rose-500 hover:bg-rose-50 rounded-full p-1"><X size={10} /></button>}
                                  <label className="text-[9px] font-extrabold text-[#166534] border border-[#7bc67e] rounded-full px-1.5 py-1 hover:bg-[#f0fdf4] cursor-pointer whitespace-nowrap">
                                    {uploadingId === key ? <Loader2 size={9} className="animate-spin" /> : <Upload size={9} />}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadColourImage(p, c.name, e.target.files[0])} />
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-dashed border-[#dcfce7]">
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Back photo (optional — used when the customer switches to Back)</label>
                        <p className="text-[10px] text-[#4b5563] mb-1.5">Add this if the product supports back print — customers switching to "back" in the designer will see this photo instead of the front one. Leave blank and it just falls back to the front photo, same as before.</p>
                        <div className="flex items-center gap-2">
                          <input data-testid={`dp-image-back-${p.id}`} value={p.designer_image_back || ""} onChange={(e) => update(p.id, { designer_image_back: e.target.value })} className="flex-1 bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-xs" placeholder="https://… or upload a file" />
                          <label className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#166534] border border-[#7bc67e] rounded-full px-2.5 py-1.5 hover:bg-white cursor-pointer whitespace-nowrap">
                            {uploadingId === `${p.id}:back` ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadMainImageBack(p, e.target.files[0])} />
                          </label>
                        </div>
                      </div>

                      {p.designer_image_back && (
                        <>
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Back print area — drag the box on the image</label>
                            <PrintAreaPicker image={p.designer_image_back} value={paBack} onChange={(next) => update(p.id, { designer_print_area_back: next })} />
                            <div className="grid grid-cols-4 gap-1.5 mt-2">
                              {["x","y","w","h"].map(k => (
                                <div key={k} className="bg-white border border-[#e5e7eb] rounded-xl px-2 py-1 text-xs flex items-center gap-1">
                                  <span className="font-bold text-[#4b5563] uppercase">{k}</span>
                                  <input data-testid={`dp-${k}-back-${p.id}`} type="number" min={0} max={100} value={paBack[k]} onChange={(e) => updatePABack(p.id, k, e.target.value)} className="w-full bg-transparent focus:outline-none text-right" />
                                </div>
                              ))}
                            </div>
                          </div>

                          {p.colors?.length > 0 && (
                            <div>
                              <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">A back photo for each colour (optional)</label>
                              <div className="grid grid-cols-2 gap-2">
                                {p.colors.map((c) => {
                                  const img = (p.designer_images_by_colour_back || {})[c.name];
                                  const key = `${p.id}:back:${c.name}`;
                                  return (
                                    <div key={c.name} className="flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-xl p-1.5">
                                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#e5e7eb] flex-shrink-0 bg-[#f0fdf4]">
                                        {img ? <img src={img} className="w-full h-full object-contain" alt="" /> : <span className="w-full h-full block" style={{ background: c.hex || "#ccc" }} />}
                                      </div>
                                      <span className="text-[10px] font-bold truncate flex-1">{c.name}</span>
                                      {img && <button onClick={() => clearColourImageBack(p, c.name)} className="text-rose-500 hover:bg-rose-50 rounded-full p-1"><X size={10} /></button>}
                                      <label className="text-[9px] font-extrabold text-[#166534] border border-[#7bc67e] rounded-full px-1.5 py-1 hover:bg-[#f0fdf4] cursor-pointer whitespace-nowrap">
                                        {uploadingId === key ? <Loader2 size={9} className="animate-spin" /> : <Upload size={9} />}
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadColourImageBack(p, c.name, e.target.files[0])} />
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Composition</label>
                        <input data-testid={`dp-composition-${p.id}`} value={p.composition || ""} onChange={(e) => update(p.id, { composition: e.target.value })} placeholder="e.g. 180 GSM · 100% ring-spun cotton" className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Longer description shown on the product page</label>
                        <textarea data-testid={`dp-description-${p.id}`} value={p.description_long || ""} onChange={(e) => update(p.id, { description_long: e.target.value })} placeholder="2-3 sentences shown in the Designer's product info card" rows={2} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-xs resize-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Small tags shown on the product (e.g. "Great for teams")</label>
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

            {!loading && total > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 mt-6" data-testid="dp-pagination">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline" data-testid="dp-page-prev">
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="text-xs text-[#4b5563]">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
                <button onClick={() => setPage((p) => (p + 1) * PAGE_SIZE < total ? p + 1 : p)} disabled={(page + 1) * PAGE_SIZE >= total} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline" data-testid="dp-page-next">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Visual print-area editor: drag the dashed box to move it, drag the corner
 * handle to resize — updates the real x/y/w/h (% of image) live rather than
 * requiring the admin to guess numbers blind.
 */
function PrintAreaPicker({ image, value, onChange }) {
  const containerRef = useRef(null);
  const modeRef = useRef(null); // "move" | "resize" while a drag is active

  useEffect(() => {
    function onMove(e) {
      if (!modeRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dxPct = (e.movementX / rect.width) * 100;
      const dyPct = (e.movementY / rect.height) * 100;
      if (modeRef.current === "move") {
        const nx = Math.min(Math.max(value.x + dxPct, 0), 100 - value.w);
        const ny = Math.min(Math.max(value.y + dyPct, 0), 100 - value.h);
        onChange({ ...value, x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 });
      } else {
        const nw = Math.min(Math.max(value.w + dxPct, 5), 100 - value.x);
        const nh = Math.min(Math.max(value.h + dyPct, 5), 100 - value.y);
        onChange({ ...value, w: Math.round(nw * 10) / 10, h: Math.round(nh * 10) / 10 });
      }
    }
    function onUp() { modeRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [value, onChange]);

  return (
    <div
      ref={containerRef}
      className="relative bg-white border border-[#e5e7eb] rounded-xl overflow-hidden select-none mx-auto"
      style={{ width: "100%", maxWidth: 280, aspectRatio: "1 / 1" }}
      data-testid="print-area-picker"
    >
      {image
        ? <img src={image} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} />
        : <div className="w-full h-full grid place-items-center text-[#4b5563] text-xs">No photo yet</div>}
      <div
        onMouseDown={(e) => { e.preventDefault(); modeRef.current = "move"; }}
        className="absolute border-2 border-dashed border-[#7bc67e] bg-[#7bc67e]/10 cursor-move"
        style={{ left: `${value.x}%`, top: `${value.y}%`, width: `${value.w}%`, height: `${value.h}%` }}
        data-testid="print-area-box"
      >
        <div
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); modeRef.current = "resize"; }}
          className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-[#7bc67e] rounded-full border-2 border-white cursor-nwse-resize"
          data-testid="print-area-resize-handle"
        />
      </div>
    </div>
  );
}
