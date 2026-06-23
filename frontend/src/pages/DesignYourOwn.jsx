import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchProducts, createCheckout } from "../lib/api";
import { toast } from "sonner";
import { Upload, Type, Trash2, Plus, Minus, RotateCw, ShoppingCart, Loader2, Wand2, Sparkles, ArrowUp, ArrowDown, Copy, Pencil } from "lucide-react";

const FILTERS = [
  { key: "none", label: "None", css: "none" },
  { key: "vintage", label: "Vintage", css: "sepia(0.5) contrast(0.9) saturate(1.1)" },
  { key: "bw", label: "B&W", css: "grayscale(1) contrast(1.05)" },
  { key: "warm", label: "Warm", css: "hue-rotate(-10deg) saturate(1.3) brightness(1.05)" },
  { key: "cool", label: "Cool", css: "hue-rotate(20deg) saturate(1.2) brightness(1.0)" },
];

const FONTS = [
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Plus Jakarta", value: "'Plus Jakarta Sans', sans-serif" },
  { label: "Manrope", value: "Manrope, sans-serif" },
  { label: "Oswald", value: "Oswald, sans-serif" },
  { label: "Cormorant", value: "'Cormorant Garamond', serif" },
];

const SIZES = ["S", "M", "L", "XL", "XXL"];
const TSHIRT_MOCKUP = "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg?auto=compress&cs=tinysrgb&w=900";

export default function DesignYourOwn() {
  const [searchParams] = useSearchParams();
  const initialProduct = searchParams.get("product") || "personalised-tee";
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(initialProduct);
  const [size, setSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [filter, setFilter] = useState("none");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [drag, setDrag] = useState(null);         // {id, mode: 'move'|'resize'|'rotate', ...}
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#1a1a1a");
  const [textFont, setTextFont] = useState(FONTS[0].value);
  const [checkingOut, setCheckingOut] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchProducts().then(setProducts); }, []);

  const product = products.find(p => p.id === productId);
  const unitPrice = product?.price ?? 6.99;
  const subtotal = (unitPrice * quantity).toFixed(2);
  const selected = items.find(i => i.id === selectedId) || null;

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = `img-${Date.now()}`;
      setItems(prev => [...prev, { id, type: "image", src: reader.result, x: 35, y: 30, w: 30, h: 30, rot: 0 }]);
      setSelectedId(id);
    };
    reader.readAsDataURL(file);
  };

  const addText = () => {
    const txt = textInput.trim() || "Your text";
    const id = `txt-${Date.now()}`;
    setItems(prev => [...prev, { id, type: "text", text: txt, x: 25, y: 40, w: 50, rot: 0, color: textColor, font: textFont, fontSize: 28 }]);
    setSelectedId(id);
    setTextInput("");
  };

  const clearAll = () => { setItems([]); setSelectedId(null); setEditingId(null); };
  const removeBgPlaceholder = () => {
    if (!selectedId) { toast.error("Select an image first"); return; }
    toast.info("Background removal — coming soon (remove.bg API to be wired)");
  };
  const aiEffectPlaceholder = (label) => {
    if (!selectedId) { toast.error("Select an image first"); return; }
    toast.info(`AI ${label} — coming soon (Cutout.pro API to be wired)`);
  };
  const removeItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  };
  const duplicateItem = (id) => {
    const it = items.find(i => i.id === id);
    if (!it) return;
    const copy = { ...it, id: `${it.type}-${Date.now()}`, x: Math.min(80, it.x + 4), y: Math.min(80, it.y + 4) };
    setItems(prev => [...prev, copy]);
    setSelectedId(copy.id);
  };
  const moveLayer = (id, dir) => {
    setItems(prev => {
      const i = prev.findIndex(p => p.id === id);
      if (i < 0) return prev;
      const j = dir === "up" ? Math.min(prev.length - 1, i + 1) : Math.max(0, i - 1);
      if (i === j) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const updateItem = (id, patch) => setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  // ---- Pointer interactions ----
  const onPointerDownItem = (e, item, mode = "move") => {
    e.stopPropagation();
    if (editingId === item.id && mode === "move") return; // don't drag while editing text
    setSelectedId(item.id);
    const rect = canvasRef.current.getBoundingClientRect();
    if (mode === "rotate") {
      const cx = rect.left + ((item.x + item.w / 2) / 100) * rect.width;
      const cy = rect.top + ((item.y + (item.h || 12) / 2) / 100) * rect.height;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      setDrag({ id: item.id, mode, cx, cy, startAngle, startRot: item.rot });
    } else if (mode === "resize") {
      setDrag({ id: item.id, mode, startX: e.clientX, startY: e.clientY, w: item.w, h: item.h || (item.fontSize ? item.fontSize / 4 : 12), fontSize: item.fontSize });
    } else {
      setDrag({ id: item.id, mode, dx: e.clientX - (rect.left + (item.x / 100) * rect.width), dy: e.clientY - (rect.top + (item.y / 100) * rect.height) });
    }
  };

  const onPointerMove = (e) => {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    if (drag.mode === "move") {
      const x = ((e.clientX - drag.dx - rect.left) / rect.width) * 100;
      const y = ((e.clientY - drag.dy - rect.top) / rect.height) * 100;
      updateItem(drag.id, { x: Math.max(0, Math.min(90, x)), y: Math.max(0, Math.min(90, y)) });
    } else if (drag.mode === "resize") {
      const dx = ((e.clientX - drag.startX) / rect.width) * 100;
      const it = items.find(i => i.id === drag.id);
      if (!it) return;
      if (it.type === "text") {
        const scale = Math.max(0.4, 1 + dx / 30);
        updateItem(drag.id, { fontSize: Math.max(10, Math.min(180, drag.fontSize * scale)), w: Math.max(10, Math.min(90, drag.w + dx)) });
      } else {
        const ratio = drag.h / Math.max(drag.w, 1);
        const newW = Math.max(8, Math.min(85, drag.w + dx));
        updateItem(drag.id, { w: newW, h: Math.max(6, newW * ratio) });
      }
    } else if (drag.mode === "rotate") {
      const angle = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180 / Math.PI;
      const rot = (drag.startRot + (angle - drag.startAngle) + 360) % 360;
      updateItem(drag.id, { rot });
    }
  };
  const onPointerUp = () => setDrag(null);

  useEffect(() => {
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    return () => { window.removeEventListener("mousemove", onPointerMove); window.removeEventListener("mouseup", onPointerUp); };
  });

  const checkout = async () => {
    setCheckingOut(true);
    try {
      const { url } = await createCheckout({
        product_id: productId,
        quantity,
        size,
        origin_url: window.location.origin,
        design_meta: { items: String(items.length), filter, text_count: String(items.filter(i => i.type === "text").length), image_count: String(items.filter(i => i.type === "image").length) },
      });
      window.location.href = url;
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Checkout failed";
      toast.error(`Checkout failed: ${msg}`);
      setCheckingOut(false);
    }
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-8">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f0fdf4] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs"><Sparkles size={12} className="text-[#7bc67e]" /> Designer</div>
            <h1 className="font-nunito font-black text-3xl lg:text-5xl mt-2">Design Your Own</h1>
          </div>
          <div className="text-xs text-[#4b5563] font-nunito font-bold">Drag · Resize · Rotate · Double-click text to edit · Multiple layers</div>
        </div>

        <div className="grid lg:grid-cols-12 gap-5">
          <aside className="lg:col-span-3 space-y-4">
            <Panel title="Upload">
              <button data-testid="designer-upload-btn" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#7bc67e] hover:bg-[#f0fdf4] text-[#7bc67e] py-6 rounded-2xl transition-colors">
                <Upload size={18} /><span className="font-nunito font-extrabold text-sm">Upload image</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onUpload} />
              <button data-testid="designer-removebg-btn" onClick={removeBgPlaceholder} className="w-full mt-3 flex items-center justify-center gap-2 bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] py-3 rounded-full font-nunito font-extrabold text-xs transition-colors">
                <Wand2 size={14} /> Remove Background
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { id: "poster", label: "Poster" },
                  { id: "sketch", label: "Sketch" },
                  { id: "cartoon", label: "Cartoon" },
                  { id: "enhance", label: "Enhance" },
                ].map((fx) => (
                  <button key={fx.id} data-testid={`designer-ai-${fx.id}`} onClick={() => aiEffectPlaceholder(fx.label)} className="text-xs font-nunito font-extrabold bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] py-2 rounded-full transition-colors">{fx.label}</button>
                ))}
              </div>
              <div className="text-[10px] text-[#4b5563] mt-2 font-bold text-center">AI effects via Cutout.pro — coming soon</div>
            </Panel>

            <Panel title="Add Text">
              <input data-testid="designer-text-input" value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Your text" className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <select data-testid="designer-font" value={textFont} onChange={(e) => setTextFont(e.target.value)} className="bg-white border border-[#e5e7eb] rounded-xl px-2 py-2 text-xs">
                  {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <input data-testid="designer-color" type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-9 bg-white border border-[#e5e7eb] rounded-xl" />
              </div>
              <button data-testid="designer-add-text" onClick={addText} className="mt-3 w-full bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold text-xs py-2.5 rounded-full transition-colors flex items-center justify-center gap-2">
                <Type size={14} /> Add to design
              </button>
            </Panel>

            <Panel title="Filters">
              <div className="grid grid-cols-3 gap-2">
                {FILTERS.map(f => (
                  <button key={f.key} data-testid={`designer-filter-${f.key}`} onClick={() => setFilter(f.key)} className={`text-xs font-nunito font-extrabold py-2 rounded-full transition-colors ${filter === f.key ? "bg-[#7bc67e] text-[#1a1a1a]" : "bg-[#f0fdf4] text-[#1a1a1a] hover:bg-[#dcfce7]"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Canvas">
              <button data-testid="designer-clear" onClick={clearAll} className="w-full flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2.5 rounded-full transition-colors text-xs font-nunito font-extrabold">
                <Trash2 size={14} /> Clear canvas
              </button>
              <div className="text-[10px] text-[#4b5563] mt-2 font-bold text-center">{items.length} layer{items.length === 1 ? "" : "s"}</div>
            </Panel>
          </aside>

          <main className="lg:col-span-6">
            <div className="bg-[#f0fdf4] rounded-3xl p-4 border-2 border-[#dcfce7]">
              <div
                ref={canvasRef}
                onMouseDown={() => { setSelectedId(null); setEditingId(null); }}
                className="relative aspect-[4/5] bg-white rounded-2xl overflow-hidden select-none"
                style={{ filter: FILTERS.find(f => f.key === filter)?.css || "none" }}
                data-testid="design-canvas"
              >
                <img src={TSHIRT_MOCKUP} alt="t-shirt" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
                <div className="absolute left-[22%] top-[20%] w-[56%] h-[55%] border border-dashed border-black/20 pointer-events-none" />
                {items.map((item) => {
                  const isSelected = selectedId === item.id;
                  const isEditing = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => onPointerDownItem(e, item, "move")}
                      onDoubleClick={(e) => { e.stopPropagation(); if (item.type === "text") setEditingId(item.id); }}
                      style={{
                        position: "absolute",
                        left: `${item.x}%`,
                        top: `${item.y}%`,
                        width: `${item.w}%`,
                        height: item.type === "text" ? "auto" : `${item.h}%`,
                        transform: `rotate(${item.rot}deg)`,
                        transformOrigin: "center",
                        cursor: isEditing ? "text" : "grab",
                        outline: isSelected ? "2px solid #7bc67e" : "none",
                      }}
                      data-testid={`design-item-${item.id}`}
                    >
                      {item.type === "image" ? (
                        <img src={item.src} alt="" draggable={false} className="w-full h-full object-contain" />
                      ) : isEditing ? (
                        <input
                          autoFocus
                          data-testid={`design-text-edit-${item.id}`}
                          value={item.text}
                          onChange={(e) => updateItem(item.id, { text: e.target.value })}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => { if (e.key === "Enter") setEditingId(null); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{ color: item.color, fontFamily: item.font, fontSize: `${item.fontSize}px`, fontWeight: 800, lineHeight: 1.1, width: "100%", background: "rgba(255,255,255,0.6)", border: "1px dashed #7bc67e", borderRadius: 4, outline: "none" }}
                        />
                      ) : (
                        <div style={{ color: item.color, fontFamily: item.font, fontSize: `${item.fontSize}px`, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap" }}>
                          {item.text}
                        </div>
                      )}
                      {isSelected && !isEditing && (
                        <>
                          {/* rotate handle (top centre) */}
                          <span
                            data-testid={`handle-rotate-${item.id}`}
                            onMouseDown={(e) => onPointerDownItem(e, item, "rotate")}
                            className="absolute -top-6 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-[#7bc67e] rounded-full cursor-grab grid place-items-center"
                            title="Rotate"
                          >
                            <RotateCw size={10} className="text-[#7bc67e]" />
                          </span>
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 mt-[10px] w-px h-[10px] bg-[#7bc67e]" style={{ top: "-12px" }} />
                          {/* resize handle (bottom-right) */}
                          <span
                            data-testid={`handle-resize-${item.id}`}
                            onMouseDown={(e) => onPointerDownItem(e, item, "resize")}
                            className="absolute -right-2 -bottom-2 w-4 h-4 bg-[#7bc67e] rounded-full cursor-se-resize border-2 border-white"
                            title="Resize"
                          />
                          {/* edit (text only) + delete */}
                          {item.type === "text" && (
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setEditingId(item.id)} className="absolute -top-3 -left-3 w-6 h-6 bg-white border-2 border-[#7bc67e] text-[#7bc67e] rounded-full text-xs grid place-items-center" data-testid={`design-item-edit-${item.id}`} title="Edit text">
                              <Pencil size={10} />
                            </button>
                          )}
                          <button onMouseDown={(e) => e.stopPropagation()} onClick={() => removeItem(item.id)} className="absolute -top-3 -right-3 w-6 h-6 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center" data-testid={`design-item-delete-${item.id}`} title="Delete">×</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-xs text-[#4b5563] mt-3 font-nunito font-bold text-center">
              Click an item to select · drag the bottom-right dot to resize · drag the top knob to rotate · double-click text to edit
            </div>

            {/* Selected item properties */}
            {selected && (
              <div className="mt-4 bg-white rounded-2xl border-2 border-[#dcfce7] p-4" data-testid="selected-properties">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-nunito font-extrabold uppercase tracking-[0.3em] text-[#7bc67e]">Selected · {selected.type}</div>
                  <div className="flex items-center gap-1.5">
                    <IconBtn testId="layer-down" onClick={() => moveLayer(selected.id, "down")} title="Send back"><ArrowDown size={12} /></IconBtn>
                    <IconBtn testId="layer-up" onClick={() => moveLayer(selected.id, "up")} title="Bring forward"><ArrowUp size={12} /></IconBtn>
                    <IconBtn testId="layer-duplicate" onClick={() => duplicateItem(selected.id)} title="Duplicate"><Copy size={12} /></IconBtn>
                    <IconBtn testId="layer-delete" onClick={() => removeItem(selected.id)} className="bg-rose-50 text-rose-600 hover:bg-rose-100" title="Delete"><Trash2 size={12} /></IconBtn>
                  </div>
                </div>
                {selected.type === "text" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input data-testid="sel-text" value={selected.text} onChange={(e) => updateItem(selected.id, { text: e.target.value })} className="col-span-2 bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm" placeholder="Text" />
                    <select data-testid="sel-font" value={selected.font} onChange={(e) => updateItem(selected.id, { font: e.target.value })} className="bg-white border border-[#e5e7eb] rounded-xl px-2 py-2 text-xs">
                      {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <input data-testid="sel-color" type="color" value={selected.color} onChange={(e) => updateItem(selected.id, { color: e.target.value })} className="w-full h-9 bg-white border border-[#e5e7eb] rounded-xl" />
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-[10px] font-nunito font-extrabold text-[#4b5563]">SIZE</span>
                      <input data-testid="sel-fontsize" type="range" min={12} max={120} value={selected.fontSize} onChange={(e) => updateItem(selected.id, { fontSize: Number(e.target.value) })} className="flex-1 accent-[#7bc67e]" />
                      <span className="text-xs font-bold w-8 text-right">{Math.round(selected.fontSize)}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-[10px] font-nunito font-extrabold text-[#4b5563]">ROTATE</span>
                      <input data-testid="sel-rotate" type="range" min={0} max={360} value={Math.round(selected.rot)} onChange={(e) => updateItem(selected.id, { rot: Number(e.target.value) })} className="flex-1 accent-[#7bc67e]" />
                      <span className="text-xs font-bold w-10 text-right">{Math.round(selected.rot)}°</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-[10px] font-nunito font-extrabold text-[#4b5563]">SIZE</span>
                      <input data-testid="sel-imgsize" type="range" min={8} max={85} value={Math.round(selected.w)} onChange={(e) => { const ratio = selected.h / Math.max(selected.w, 1); const w = Number(e.target.value); updateItem(selected.id, { w, h: Math.max(6, w * ratio) }); }} className="flex-1 accent-[#7bc67e]" />
                      <span className="text-xs font-bold w-10 text-right">{Math.round(selected.w)}%</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-[10px] font-nunito font-extrabold text-[#4b5563]">ROTATE</span>
                      <input data-testid="sel-rotate" type="range" min={0} max={360} value={Math.round(selected.rot)} onChange={(e) => updateItem(selected.id, { rot: Number(e.target.value) })} className="flex-1 accent-[#7bc67e]" />
                      <span className="text-xs font-bold w-10 text-right">{Math.round(selected.rot)}°</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          <aside className="lg:col-span-3 space-y-4">
            <Panel title="Product">
              <select data-testid="designer-product" value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm">
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — £{p.price.toFixed(2)}</option>)}
              </select>
            </Panel>

            <Panel title="Size">
              <div className="grid grid-cols-5 gap-2">
                {SIZES.map(s => (
                  <button key={s} data-testid={`designer-size-${s}`} onClick={() => setSize(s)} className={`py-2 font-nunito font-extrabold text-sm rounded-full transition-colors ${size === s ? "bg-[#7bc67e] text-[#1a1a1a]" : "bg-[#f0fdf4] text-[#1a1a1a] hover:bg-[#dcfce7]"}`}>{s}</button>
                ))}
              </div>
            </Panel>

            <Panel title="Quantity">
              <div className="flex items-center gap-2">
                <button data-testid="designer-qty-minus" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7] grid place-items-center"><Minus size={14} /></button>
                <input data-testid="designer-qty" type="number" min={1} max={500} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value || "1"))))} className="w-full text-center bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-lg font-nunito font-extrabold" />
                <button data-testid="designer-qty-plus" onClick={() => setQuantity(q => Math.min(500, q + 1))} className="w-10 h-10 rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7] grid place-items-center"><Plus size={14} /></button>
              </div>
            </Panel>

            <Panel title="Total">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-nunito font-bold text-[#4b5563]">£{unitPrice.toFixed(2)} × {quantity}</span>
                <span data-testid="designer-total" className="text-[#7bc67e] font-nunito font-black text-3xl">£{subtotal}</span>
              </div>
              <button data-testid="designer-checkout" onClick={checkout} disabled={checkingOut} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold rounded-full px-6 py-4 shadow-md hover:-translate-y-0.5 transition-transform">
                {checkingOut ? <><Loader2 className="animate-spin" size={16} /> Redirecting…</> : <><ShoppingCart size={16} /> Checkout with Stripe</>}
              </button>
              <div className="text-[10px] text-[#4b5563] mt-3 font-bold text-center">Test mode — no real charge</div>
            </Panel>
          </aside>
        </div>
      </div>

      <BoldFooter />
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#dcfce7] p-4">
      <div className="text-[10px] font-nunito font-extrabold uppercase tracking-[0.3em] text-[#7bc67e] mb-3">{title}</div>
      {children}
    </div>
  );
}

function IconBtn({ children, onClick, title, testId, className = "" }) {
  return (
    <button data-testid={testId} onClick={onClick} title={title} className={`w-7 h-7 grid place-items-center rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] transition-colors ${className}`}>{children}</button>
  );
}
