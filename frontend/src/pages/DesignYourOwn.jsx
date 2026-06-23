import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchDesignerProducts, createCheckout, saveDesignerArtwork } from "../lib/api";
import { toast } from "sonner";
import { Upload, Type, Trash2, Plus, Minus, RotateCw, ShoppingCart, Loader2, Wand2, Sparkles, ArrowUp, ArrowDown, Copy, Pencil, Image as ImageIcon, Layers } from "lucide-react";

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

export default function DesignYourOwn() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(searchParams.get("product") || "");
  const [sizeQtys, setSizeQtys] = useState({});
  const [filter, setFilter] = useState("none");
  const [view, setView] = useState("front");                 // "front" | "back"
  const [backEnabled, setBackEnabled] = useState(false);     // adds back-print to checkout
  const [frontItems, setFrontItems] = useState([]);
  const [backItems, setBackItems]   = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#1a1a1a");
  const [textFont, setTextFont] = useState(FONTS[0].value);
  const [checkingOut, setCheckingOut] = useState(false);
  const canvasRef = useRef(null);
  const printAreaRef = useRef(null);
  const fileInputRef = useRef(null);

  const items = view === "front" ? frontItems : backItems;
  const setItems = (updater) => {
    if (view === "front") setFrontItems(typeof updater === "function" ? updater(frontItems) : updater);
    else                  setBackItems(typeof updater === "function" ? updater(backItems)  : updater);
  };

  useEffect(() => {
    fetchDesignerProducts().then((list) => {
      setProducts(list);
      if (!productId && list[0]) setProductId(list[0].id);
    });
  }, []);

  const product = products.find(p => p.id === productId);
  const printArea = product?.print_area || { x: 22, y: 20, w: 56, h: 55 };
  const unitPrice = product?.price ?? 0;
  const backPrintPrice = product?.back_print_price ?? 0;
  const totalQty = useMemo(() => Object.values(sizeQtys).reduce((a, b) => a + (Number(b) || 0), 0), [sizeQtys]);
  const subtotal = useMemo(() => {
    if (!product) return 0;
    const u = product.size_upcharges || {};
    const extra = backEnabled ? backPrintPrice : 0;
    let t = 0;
    Object.entries(sizeQtys).forEach(([sz, q]) => {
      const qn = Number(q) || 0;
      if (qn <= 0) return;
      t += (unitPrice + (u[sz] || 0) + extra) * qn;
    });
    return t;
  }, [sizeQtys, unitPrice, product, backEnabled, backPrintPrice]);
  const selected = items.find(i => i.id === selectedId) || null;

  // Reset state when product changes
  useEffect(() => {
    setSizeQtys({});
    setFrontItems([]);
    setBackItems([]);
    setBackEnabled(false);
    setView("front");
    setSelectedId(null);
    setEditingId(null);
  }, [productId]);

  // Clear transient selection state when switching front/back view
  useEffect(() => { setSelectedId(null); setEditingId(null); setDrag(null); }, [view]);

  const setSizeQty = (sz, q) => {
    const n = Math.max(0, Math.min(500, Number(q) || 0));
    setSizeQtys(prev => { const next = { ...prev }; if (n === 0) delete next[sz]; else next[sz] = n; return next; });
  };
  const bumpSize = (sz, d) => setSizeQty(sz, (sizeQtys[sz] || 0) + d);

  // ---- Items ----
  const onUpload = (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const id = `img-${Date.now()}`;
        const aspect = img.width / Math.max(img.height, 1);
        // Initial size: 50% of the print-area width, height keeps aspect
        const w = 50;
        const h = w / aspect;
        setItems(prev => [...prev, { id, type: "image", src: reader.result, x: 25, y: 25, w, h, rot: 0, naturalW: img.width, naturalH: img.height }]);
        setSelectedId(id);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const addText = () => {
    const txt = textInput.trim() || "Your text";
    const id = `txt-${Date.now()}`;
    setItems(prev => [...prev, { id, type: "text", text: txt, x: 25, y: 40, rot: 0, color: textColor, font: textFont, fontSize: 28 }]);
    setSelectedId(id);
    setTextInput("");
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  };
  const clearAll = () => { setItems([]); setSelectedId(null); setEditingId(null); };
  const duplicateItem = (id) => {
    const it = items.find(i => i.id === id); if (!it) return;
    const copy = { ...it, id: `${it.type}-${Date.now()}`, x: Math.min(80, it.x + 4), y: Math.min(80, it.y + 4) };
    setItems(prev => [...prev, copy]); setSelectedId(copy.id);
  };
  const moveLayer = (id, dir) => {
    setItems(prev => {
      const i = prev.findIndex(p => p.id === id); if (i < 0) return prev;
      const j = dir === "up" ? Math.min(prev.length - 1, i + 1) : Math.max(0, i - 1);
      if (i === j) return prev;
      const next = prev.slice(); [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  };
  const updateItem = (id, patch) => setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  const removeBgPlaceholder = () => {
    if (!selectedId) { toast.error("Select an image first"); return; }
    const sel = items.find(i => i.id === selectedId);
    if (!sel || sel.type !== "image") { toast.error("Select an image first"); return; }
    toast.info("Background removal — coming soon (remove.bg API to be wired)");
  };
  const aiEffectPlaceholder = (label) => {
    if (!selectedId) { toast.error("Select an image first"); return; }
    toast.info(`AI ${label} — coming soon (Cutout.pro API to be wired)`);
  };

  // ---- Pointer interactions (in print-area coordinate space) ----
  const onPointerDownItem = (e, item, mode = "move") => {
    e.stopPropagation();
    if (editingId === item.id && mode === "move") return;
    setSelectedId(item.id);
    const rect = printAreaRef.current.getBoundingClientRect();
    if (mode === "rotate") {
      const cx = rect.left + ((item.x + (item.w || 20) / 2) / 100) * rect.width;
      const cy = rect.top  + ((item.y + (item.h || (item.fontSize ? item.fontSize / 4 : 10)) / 2) / 100) * rect.height;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      setDrag({ id: item.id, mode, cx, cy, startAngle, startRot: item.rot });
    } else if (mode === "resize") {
      setDrag({ id: item.id, mode, startX: e.clientX, startY: e.clientY, w: item.w || 30, h: item.h || 30, fontSize: item.fontSize });
    } else {
      setDrag({ id: item.id, mode, dx: e.clientX - (rect.left + (item.x / 100) * rect.width), dy: e.clientY - (rect.top + (item.y / 100) * rect.height) });
    }
  };

  const onPointerMove = (e) => {
    if (!drag || !printAreaRef.current) return;
    const rect = printAreaRef.current.getBoundingClientRect();
    if (drag.mode === "move") {
      const x = ((e.clientX - drag.dx - rect.left) / rect.width) * 100;
      const y = ((e.clientY - drag.dy - rect.top) / rect.height) * 100;
      updateItem(drag.id, { x: Math.max(-10, Math.min(100, x)), y: Math.max(-10, Math.min(100, y)) });
    } else if (drag.mode === "resize") {
      const dx = ((e.clientX - drag.startX) / rect.width) * 100;
      const it = items.find(i => i.id === drag.id); if (!it) return;
      if (it.type === "text") {
        const scale = Math.max(0.3, 1 + dx / 30);
        const newSize = Math.max(8, Math.min(220, drag.fontSize * scale));
        updateItem(drag.id, { fontSize: newSize });
      } else {
        const ratio = drag.h / Math.max(drag.w, 1);
        const newW = Math.max(8, Math.min(100, drag.w + dx));
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

  // ---- Render to transparent PNG ----
  const composeArtwork = async (sizePx, itemsList) => {
    const c = document.createElement("canvas");
    c.width = sizePx; c.height = sizePx;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, sizePx, sizePx);
    for (const it of itemsList) {
      const cx = (it.x / 100) * sizePx + ((it.w || 0) / 100) * sizePx / 2;
      const cy = (it.y / 100) * sizePx + (it.type === "text" ? (it.fontSize || 28) / 2 : ((it.h || 0) / 100) * sizePx / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((it.rot || 0) * Math.PI / 180);
      if (it.type === "image") {
        const w = (it.w / 100) * sizePx;
        const h = (it.h / 100) * sizePx;
        await new Promise((resolve) => {
          const im = new Image(); im.crossOrigin = "anonymous";
          im.onload = () => { ctx.drawImage(im, -w / 2, -h / 2, w, h); resolve(); };
          im.onerror = resolve;
          im.src = it.src;
        });
      } else {
        const fontPx = (it.fontSize / 100) * (sizePx / 4); // scale text proportionally
        ctx.fillStyle = it.color || "#000";
        ctx.font = `800 ${fontPx}px ${it.font || "Nunito, sans-serif"}`;
        ctx.textBaseline = "middle"; ctx.textAlign = "center";
        ctx.fillText(it.text, 0, 0);
      }
      ctx.restore();
    }
    return c.toDataURL("image/png");
  };

  const checkout = async () => {
    if (!product) { toast.error("Pick a product"); return; }
    if (totalQty < 1) { toast.error("Pick at least one size & quantity"); return; }
    if (frontItems.length === 0 && backItems.length === 0) { toast.error("Add at least one image or text to your design"); return; }
    if (backEnabled && backItems.length === 0) { toast.error("Add at least one element to the back design (or turn off back print)"); return; }
    setCheckingOut(true);
    try {
      // Front always; back only if user enabled it
      const [frontPreview, frontFull] = await Promise.all([
        composeArtwork(1000, frontItems),
        composeArtwork(2000, frontItems),
      ]);
      let backFull = null, backPreview = null;
      if (backEnabled) {
        [backPreview, backFull] = await Promise.all([
          composeArtwork(1000, backItems),
          composeArtwork(2000, backItems),
        ]);
      }
      const { id: artwork_id } = await saveDesignerArtwork({
        product_id: productId,
        artwork_png: frontFull,
        preview_png: frontPreview,
        back_png: backFull,
        back_preview_png: backPreview,
        items_count: frontItems.length,
        back_items_count: backItems.length,
        width: 2000, height: 2000,
      });
      const { url } = await createCheckout({
        product_id: productId,
        size_qtys: sizeQtys,
        origin_url: window.location.origin,
        blank: false,
        placements: backEnabled ? ["back-print"] : [],
        design_meta: {
          flow: "designer",
          items: String(frontItems.length),
          back_items: String(backItems.length),
          text_count: String(frontItems.filter(i => i.type === "text").length + backItems.filter(i => i.type === "text").length),
          image_count: String(frontItems.filter(i => i.type === "image").length + backItems.filter(i => i.type === "image").length),
          artwork_id,
          filter,
          back_print: backEnabled ? "yes" : "no",
        },
      });
      window.location.href = url;
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Checkout failed";
      toast.error(`Checkout failed: ${msg}`);
      setCheckingOut(false);
    }
  };

  if (products.length === 0) {
    return (
      <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
        <BoldNavbar />
        <div className="p-12 text-center text-sm text-[#4b5563]">Loading designer…</div>
      </div>
    );
  }

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-8">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f0fdf4] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs"><Sparkles size={12} className="text-[#7bc67e]" /> Designer</div>
            <h1 className="font-nunito font-black text-3xl lg:text-5xl mt-2">Design Your Own</h1>
          </div>
          <div className="text-xs text-[#4b5563] font-nunito font-bold">Drag · Resize · Rotate · Double-click text · Print-ready PNG sent on checkout</div>
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
                  { id: "poster",  label: "Poster" },
                  { id: "sketch",  label: "Sketch" },
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

            <Panel title={`Layers · ${view} ${items.length}${backEnabled && view === "front" ? ` · back ${backItems.length}` : ""}${backEnabled && view === "back" ? ` · front ${frontItems.length}` : ""}`}>
              {items.length === 0 ? (
                <div className="text-xs text-[#4b5563] text-center py-2">No layers yet</div>
              ) : (
                <ul className="space-y-1.5" data-testid="layers-list">
                  {items.slice().reverse().map((it) => (
                    <li key={it.id}
                        onClick={() => setSelectedId(it.id)}
                        data-testid={`layer-${it.id}`}
                        className={`flex items-center gap-2 p-1.5 rounded-xl border cursor-pointer transition-colors ${selectedId === it.id ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#dcfce7] hover:bg-[#f0fdf4]"}`}>
                      <div className="w-7 h-7 rounded-md bg-white border border-[#dcfce7] grid place-items-center overflow-hidden flex-shrink-0">
                        {it.type === "image" ? <img src={it.src} alt="" className="w-full h-full object-contain" /> : <Type size={12} className="text-[#7bc67e]" />}
                      </div>
                      <div className="text-xs font-nunito font-extrabold truncate flex-1">{it.type === "text" ? (it.text || "Text") : "Image"}</div>
                      <button onClick={(e) => { e.stopPropagation(); removeItem(it.id); }} data-testid={`layer-remove-${it.id}`} className="w-6 h-6 grid place-items-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 size={11} /></button>
                    </li>
                  ))}
                </ul>
              )}
              {items.length > 0 && (
                <button data-testid="designer-clear" onClick={clearAll} className="w-full mt-3 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2 rounded-full transition-colors text-[11px] font-nunito font-extrabold">
                  <Trash2 size={12} /> Clear all layers
                </button>
              )}
            </Panel>
          </aside>

          <main className="lg:col-span-6">
            {/* Front / Back tabs + back-print enable */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3" data-testid="designer-view-tabs">
              <div className="inline-flex bg-[#f0fdf4] rounded-full p-1 border border-[#dcfce7]">
                <button
                  data-testid="designer-view-front"
                  onClick={() => setView("front")}
                  className={`px-4 py-1.5 rounded-full font-nunito font-extrabold text-sm transition-colors ${view === "front" ? "bg-[#7bc67e] text-[#1a1a1a]" : "text-[#4b5563] hover:text-[#1a1a1a]"}`}
                >Front</button>
                <button
                  data-testid="designer-view-back"
                  onClick={() => { if (!backEnabled) setBackEnabled(true); setView("back"); }}
                  className={`px-4 py-1.5 rounded-full font-nunito font-extrabold text-sm transition-colors ${view === "back" ? "bg-[#7bc67e] text-[#1a1a1a]" : "text-[#4b5563] hover:text-[#1a1a1a]"}`}
                >Back {backEnabled && <span className="ml-1 text-[10px]">+£{backPrintPrice.toFixed(2)}</span>}</button>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer bg-white border-2 border-[#dcfce7] rounded-full px-3 py-1.5" data-testid="designer-back-toggle">
                <input
                  type="checkbox"
                  checked={backEnabled}
                  onChange={(e) => { const on = e.target.checked; setBackEnabled(on); if (!on && view === "back") setView("front"); }}
                  className="w-4 h-4 accent-[#7bc67e]"
                />
                <span className="text-xs font-nunito font-extrabold">Print on back too · +£{backPrintPrice.toFixed(2)}/unit</span>
              </label>
            </div>

            <div className="bg-[#f0fdf4] rounded-3xl p-4 border-2 border-[#dcfce7]">
              <div
                ref={canvasRef}
                onMouseDown={() => { setSelectedId(null); setEditingId(null); }}
                className="relative aspect-[4/5] bg-white rounded-2xl overflow-hidden select-none"
                style={{ filter: FILTERS.find(f => f.key === filter)?.css || "none" }}
                data-testid="design-canvas"
              >
                <img src={product?.image} alt={product?.name || "garment"} className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
                {/* Side badge */}
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-[10px] font-nunito font-extrabold uppercase tracking-[0.2em] text-[#1a1a1a] border border-[#dcfce7]" data-testid="designer-side-badge">
                  {view === "front" ? "Front view" : "Back view"}
                </div>
                {/* Print area rectangle — the design overlay lives strictly inside this box */}
                <div
                  ref={printAreaRef}
                  className="absolute border border-dashed border-black/25"
                  style={{ left: `${printArea.x}%`, top: `${printArea.y}%`, width: `${printArea.w}%`, height: `${printArea.h}%` }}
                  data-testid="design-print-area"
                >
                  {items.map((item) => {
                    const isSelected = selectedId === item.id;
                    const isEditing = editingId === item.id;
                    if (item.type === "text") {
                      return (
                        <div
                          key={item.id}
                          onMouseDown={(e) => onPointerDownItem(e, item, "move")}
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingId(item.id); }}
                          style={{
                            position: "absolute",
                            left: `${item.x}%`,
                            top: `${item.y}%`,
                            display: "inline-block",
                            transform: `rotate(${item.rot}deg)`,
                            transformOrigin: "top left",
                            cursor: isEditing ? "text" : "grab",
                            outline: isSelected ? "2px solid #7bc67e" : "none",
                            outlineOffset: 2,
                            padding: "2px 4px",
                          }}
                          data-testid={`design-item-${item.id}`}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              data-testid={`design-text-edit-${item.id}`}
                              value={item.text}
                              onChange={(e) => updateItem(item.id, { text: e.target.value })}
                              onBlur={() => setEditingId(null)}
                              onKeyDown={(e) => { if (e.key === "Enter") setEditingId(null); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{ color: item.color, fontFamily: item.font, fontSize: `${item.fontSize}px`, fontWeight: 800, lineHeight: 1.1, background: "rgba(255,255,255,0.6)", border: "1px dashed #7bc67e", borderRadius: 4, outline: "none", padding: "2px 6px", width: `${Math.max(10, (item.text?.length || 4) + 2)}ch` }}
                            />
                          ) : (
                            <span style={{ color: item.color, fontFamily: item.font, fontSize: `${item.fontSize}px`, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", display: "inline-block" }}>
                              {item.text}
                            </span>
                          )}
                          {isSelected && !isEditing && (
                            <>
                              <span
                                data-testid={`handle-rotate-${item.id}`}
                                onMouseDown={(e) => onPointerDownItem(e, item, "rotate")}
                                className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-[#7bc67e] rounded-full cursor-grab grid place-items-center"
                                title="Rotate"
                              >
                                <RotateCw size={10} className="text-[#7bc67e]" />
                              </span>
                              <span
                                data-testid={`handle-resize-${item.id}`}
                                onMouseDown={(e) => onPointerDownItem(e, item, "resize")}
                                className="absolute -right-2 -bottom-2 w-4 h-4 bg-[#7bc67e] rounded-full cursor-se-resize border-2 border-white"
                                title="Resize"
                              />
                              <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setEditingId(item.id)} data-testid={`design-item-edit-${item.id}`} className="absolute -top-3 -left-3 w-6 h-6 bg-white border-2 border-[#7bc67e] text-[#7bc67e] rounded-full text-xs grid place-items-center" title="Edit text">
                                <Pencil size={10} />
                              </button>
                              <button onMouseDown={(e) => e.stopPropagation()} onClick={() => removeItem(item.id)} data-testid={`design-item-delete-${item.id}`} className="absolute -top-3 -right-3 w-6 h-6 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center" title="Delete">×</button>
                            </>
                          )}
                        </div>
                      );
                    }
                    // image item
                    return (
                      <div
                        key={item.id}
                        onMouseDown={(e) => onPointerDownItem(e, item, "move")}
                        style={{
                          position: "absolute",
                          left: `${item.x}%`,
                          top: `${item.y}%`,
                          width: `${item.w}%`,
                          height: `${item.h}%`,
                          transform: `rotate(${item.rot}deg)`,
                          transformOrigin: "center",
                          cursor: "grab",
                          outline: isSelected ? "2px solid #7bc67e" : "none",
                        }}
                        data-testid={`design-item-${item.id}`}
                      >
                        <img src={item.src} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none" />
                        {isSelected && (
                          <>
                            <span
                              data-testid={`handle-rotate-${item.id}`}
                              onMouseDown={(e) => onPointerDownItem(e, item, "rotate")}
                              className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-[#7bc67e] rounded-full cursor-grab grid place-items-center"
                              title="Rotate"
                            >
                              <RotateCw size={10} className="text-[#7bc67e]" />
                            </span>
                            <span
                              data-testid={`handle-resize-${item.id}`}
                              onMouseDown={(e) => onPointerDownItem(e, item, "resize")}
                              className="absolute -right-2 -bottom-2 w-4 h-4 bg-[#7bc67e] rounded-full cursor-se-resize border-2 border-white"
                              title="Resize"
                            />
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => removeItem(item.id)} data-testid={`design-item-delete-${item.id}`} className="absolute -top-3 -right-3 w-6 h-6 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center" title="Delete">×</button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="text-xs text-[#4b5563] mt-3 font-nunito font-bold text-center">
              Dashed box = print area · drag to move · bottom-right dot to resize · top knob to rotate · double-click text to edit
            </div>

            {/* Selected item properties */}
            {selected && (
              <div className="mt-4 bg-white rounded-2xl border-2 border-[#dcfce7] p-4" data-testid="selected-properties">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-nunito font-extrabold uppercase tracking-[0.3em] text-[#7bc67e] inline-flex items-center gap-1.5"><Layers size={11} /> Selected · {selected.type}</div>
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
                    <Slider label="SIZE"   testId="sel-fontsize" min={10} max={140} v={selected.fontSize} onV={(n) => updateItem(selected.id, { fontSize: n })} unit="" />
                    <Slider label="ROTATE" testId="sel-rotate"   min={0}  max={360} v={Math.round(selected.rot)} onV={(n) => updateItem(selected.id, { rot: n })} unit="°" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Slider label="SIZE"   testId="sel-imgsize" min={8}  max={100} v={Math.round(selected.w)} onV={(w) => { const ratio = selected.h / Math.max(selected.w, 1); updateItem(selected.id, { w, h: Math.max(6, w * ratio) }); }} unit="%" />
                    <Slider label="ROTATE" testId="sel-rotate"  min={0}  max={360} v={Math.round(selected.rot)} onV={(n) => updateItem(selected.id, { rot: n })} unit="°" />
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
              <div className="text-[10px] text-[#4b5563] mt-2 font-bold">{products.length} products available · admin manages list</div>
            </Panel>

            <Panel title={`Sizes & quantity · ${totalQty}`}>
              {(product?.sizes || []).length === 0 ? (
                <div className="text-xs text-[#4b5563]">No sizes configured</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {(product?.sizes || []).map((sz) => {
                    const q = sizeQtys[sz] || 0;
                    const up = product?.size_upcharges?.[sz] || 0;
                    return (
                      <div key={sz} data-testid={`designer-size-${sz}`} className={`rounded-xl border-2 p-2 ${q > 0 ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white"}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-nunito font-extrabold text-xs">{sz}</span>
                          {up > 0 && <span className="text-[9px] text-[#4b5563]">+£{up.toFixed(2)}</span>}
                        </div>
                        <div className="flex items-center gap-0.5 mt-1">
                          <button data-testid={`designer-size-${sz}-minus`} onClick={() => bumpSize(sz, -1)} className="w-5 h-5 grid place-items-center rounded-full bg-white border disabled:opacity-40" disabled={q === 0}><Minus size={9} /></button>
                          <input data-testid={`designer-size-${sz}-qty`} type="number" min={0} value={q} onChange={(e) => setSizeQty(sz, e.target.value)} className="w-full text-center bg-transparent text-xs font-bold focus:outline-none" />
                          <button data-testid={`designer-size-${sz}-plus`} onClick={() => bumpSize(sz, 1)} className="w-5 h-5 grid place-items-center rounded-full bg-white border"><Plus size={9} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="Total">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-nunito font-bold text-[#4b5563]">{totalQty} × from £{unitPrice.toFixed(2)}{backEnabled && <> + £{backPrintPrice.toFixed(2)} back</>}</span>
                <span data-testid="designer-total" className="text-[#7bc67e] font-nunito font-black text-3xl">£{subtotal.toFixed(2)}</span>
              </div>
              <button data-testid="designer-checkout" onClick={checkout} disabled={checkingOut} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold rounded-full px-6 py-4 shadow-md hover:-translate-y-0.5 transition-transform">
                {checkingOut ? <><Loader2 className="animate-spin" size={16} /> Saving design…</> : <><ShoppingCart size={16} /> Checkout with Stripe</>}
              </button>
              <div className="text-[10px] text-[#4b5563] mt-3 font-bold text-center">Test mode — no real charge<br /><ImageIcon size={9} className="inline" /> transparent PNG sent to production on checkout</div>
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
function Slider({ label, testId, min, max, v, onV, unit }) {
  return (
    <div className="col-span-2 flex items-center gap-2">
      <span className="text-[10px] font-nunito font-extrabold text-[#4b5563] w-12">{label}</span>
      <input data-testid={testId} type="range" min={min} max={max} value={v} onChange={(e) => onV(Number(e.target.value))} className="flex-1 accent-[#7bc67e]" />
      <span className="text-xs font-bold w-10 text-right">{v}{unit}</span>
    </div>
  );
}
