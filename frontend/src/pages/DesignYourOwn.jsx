import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import DesignerHelpFAB from "../components/bold/DesignerHelpFAB";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import { fetchDesignerProducts, createCheckout, saveDesignerArtwork, designerRemoveBg, designerAiEffect } from "../lib/api";
import usePageCopy from "../hooks/usePageCopy";
import { toast } from "sonner";
import { Upload, Type, Trash2, Plus, Minus, RotateCw, ShoppingCart, Loader2, Wand2, Sparkles, ArrowUp, ArrowDown, Copy, Pencil, Image as ImageIcon, Layers, Tag, Info } from "lucide-react";

const FONTS = [
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Plus Jakarta", value: "'Plus Jakarta Sans', sans-serif" },
  { label: "Manrope", value: "Manrope, sans-serif" },
  { label: "Oswald", value: "Oswald, sans-serif" },
  { label: "Cormorant", value: "'Cormorant Garamond', serif" },
];

// Neck label canvas aspect (width:height) — landscape, mimics a ~60×30mm sewn-in label
const NECK_LABEL_ASPECT = 2;  // 2:1 wide:high
// Default print area within the neck label canvas
const NECK_LABEL_PRINT_AREA = { x: 5, y: 10, w: 90, h: 80 };
const USE_CASE_LABELS = {
  "workwear": "Workwear",
  "branded-to-sell": "Branded to sell",
  "daily-use": "Daily use",
  "sports": "Sports",
  "kids": "Kids",
  "eco": "Eco",
};

export default function DesignYourOwn() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [productId, setProductId] = useState(searchParams.get("product") || "");
  const dyoCopy = usePageCopy("design-your-own", {
    title: "Design Your Own",
    subtitle: "Drag · Resize · Rotate · Double-click text · Print-ready PNG sent on checkout",
  });
  const [sizeQtys, setSizeQtys] = useState({});
  const [view, setView] = useState("front");                 // "front" | "back" | "neck"
  const [backEnabled, setBackEnabled] = useState(false);     // adds back-print to checkout
  const [neckEnabled, setNeckEnabled] = useState(false);     // adds neck-label to checkout
  const [frontItems, setFrontItems] = useState([]);
  const [backItems, setBackItems]   = useState([]);
  const [neckItems, setNeckItems]   = useState([]);
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

  const items = view === "front" ? frontItems : view === "back" ? backItems : neckItems;
  const setItems = (updater) => {
    if (view === "front")     setFrontItems(typeof updater === "function" ? updater(frontItems) : updater);
    else if (view === "back") setBackItems(typeof updater === "function" ? updater(backItems)   : updater);
    else                      setNeckItems(typeof updater === "function" ? updater(neckItems)   : updater);
  };

  useEffect(() => {
    fetchDesignerProducts().then((list) => {
      setProducts(list);
      if (!productId && list[0]) setProductId(list[0].id);
    }).catch(() => {
      toast.error("Couldn't load the designer — please refresh the page");
      setLoadError(true);
    });
  }, []);

  const product = products.find(p => p.id === productId);
  const garmentPrintArea = product?.print_area || { x: 22, y: 20, w: 56, h: 55 };
  const printArea = view === "neck" ? NECK_LABEL_PRINT_AREA : garmentPrintArea;
  const unitPrice = product?.price ?? 0;
  const backPrintPrice = product?.back_print_price ?? 0;
  const neckLabelPrice = product?.neck_label_price ?? 1.5;
  const totalQty = useMemo(() => Object.values(sizeQtys).reduce((a, b) => a + (Number(b) || 0), 0), [sizeQtys]);
  const subtotal = useMemo(() => {
    if (!product) return 0;
    const u = product.size_upcharges || {};
    const extra = (backEnabled ? backPrintPrice : 0) + (neckEnabled ? neckLabelPrice : 0);
    let t = 0;
    Object.entries(sizeQtys).forEach(([sz, q]) => {
      const qn = Number(q) || 0;
      if (qn <= 0) return;
      t += (unitPrice + (u[sz] || 0) + extra) * qn;
    });
    return t;
  }, [sizeQtys, unitPrice, product, backEnabled, backPrintPrice, neckEnabled, neckLabelPrice]);
  const selected = items.find(i => i.id === selectedId) || null;

  // Reset state when product changes
  useEffect(() => {
    setSizeQtys({});
    setFrontItems([]);
    setBackItems([]);
    setNeckItems([]);
    setBackEnabled(false);
    setNeckEnabled(false);
    setView("front");
    setSelectedId(null);
    setEditingId(null);
  }, [productId]);

  // Clear transient selection state when switching view
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

  const addSizeToken = () => {
    if (view !== "neck") { toast.error("Switch to the Neck label canvas to add a {SIZE} token"); return; }
    if (neckItems.some(it => it.isSizeToken)) { toast.error("Only one {SIZE} token allowed"); return; }
    const id = `size-${Date.now()}`;
    setItems(prev => [...prev, { id, type: "text", text: "{SIZE}", isSizeToken: true, x: 35, y: 55, rot: 0, color: textColor, font: textFont, fontSize: 32 }]);
    setSelectedId(id);
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

  const removeBgReal = async () => {
    if (!selectedId) { toast.error("Select an image first"); return; }
    const sel = items.find(i => i.id === selectedId);
    if (!sel || sel.type !== "image") { toast.error("Select an image first"); return; }
    if (!sel.src) { toast.error("Image is missing source data"); return; }
    updateItem(sel.id, { _busy: true });
    const t = toast.loading("Removing background…");
    try {
      const res = await designerRemoveBg(sel.src);
      if (!res?.image_base64) throw new Error("no image returned");
      updateItem(sel.id, { src: res.image_base64, _busy: false });
      toast.success("Background removed", { id: t });
    } catch (e) {
      updateItem(sel.id, { _busy: false });
      const msg = e?.response?.data?.detail || e?.message || "Background removal failed";
      toast.error(msg, { id: t });
    }
  };
  const aiEffectReal = async (effectId, label) => {
    if (!selectedId) { toast.error("Select an image first"); return; }
    const sel = items.find(i => i.id === selectedId);
    if (!sel || sel.type !== "image") { toast.error("Select an image first"); return; }
    if (!sel.src) { toast.error("Image is missing source data"); return; }
    updateItem(sel.id, { _busy: true });
    const t = toast.loading(`Applying ${label}…`);
    try {
      const res = await designerAiEffect(sel.src, effectId);
      const nextSrc = res?.image_base64 || res?.image_url;
      if (!nextSrc) throw new Error("no image returned");
      updateItem(sel.id, { src: nextSrc, _busy: false });
      toast.success(`${label} applied`, { id: t });
    } catch (e) {
      updateItem(sel.id, { _busy: false });
      const msg = e?.response?.data?.detail || e?.message || "Effect failed";
      toast.error(msg, { id: t });
    }
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
  // sizePx — canvas dimensions; itemsList — items to render; substituteSize — when set, swap {SIZE} tokens.
  const composeArtwork = async (sizePx, itemsList, substituteSize = null, aspect = 1) => {
    const c = document.createElement("canvas");
    c.width = sizePx; c.height = Math.round(sizePx / aspect);
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    for (const it of itemsList) {
      const cx = (it.x / 100) * c.width + ((it.w || 0) / 100) * c.width / 2;
      const cy = (it.y / 100) * c.height + (it.type === "text" ? (it.fontSize || 28) / 2 : ((it.h || 0) / 100) * c.height / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((it.rot || 0) * Math.PI / 180);
      if (it.type === "image") {
        const w = (it.w / 100) * c.width;
        const h = (it.h / 100) * c.height;
        await new Promise((resolve) => {
          const im = new Image(); im.crossOrigin = "anonymous";
          im.onload = () => { ctx.drawImage(im, -w / 2, -h / 2, w, h); resolve(); };
          im.onerror = resolve;
          im.src = it.src;
        });
      } else {
        const text = (it.isSizeToken && substituteSize) ? substituteSize : it.text;
        const fontPx = (it.fontSize / 100) * (c.width / 4); // scale text proportionally
        ctx.fillStyle = it.color || "#000";
        ctx.font = `800 ${fontPx}px ${it.font || "Nunito, sans-serif"}`;
        ctx.textBaseline = "middle"; ctx.textAlign = "center";
        ctx.fillText(text, 0, 0);
      }
      ctx.restore();
    }
    return c.toDataURL("image/png");
  };

  const checkout = async () => {
    if (!product) { toast.error("Pick a product"); return; }
    if (totalQty < 1) { toast.error("Pick at least one size & quantity"); return; }
    if (frontItems.length === 0 && backItems.length === 0 && neckItems.length === 0) {
      toast.error("Add at least one image or text to your design"); return;
    }
    if (backEnabled && backItems.length === 0) { toast.error("Add at least one element to the back design (or turn off back print)"); return; }
    if (neckEnabled && neckItems.length === 0) { toast.error("Add at least one element to the neck label (or turn off neck label)"); return; }
    setCheckingOut(true);
    try {
      // Front always
      const [frontPreview, frontFull] = await Promise.all([
        composeArtwork(1000, frontItems),
        composeArtwork(2000, frontItems),
      ]);
      // Back only if enabled
      let backFull = null, backPreview = null;
      if (backEnabled) {
        [backPreview, backFull] = await Promise.all([
          composeArtwork(1000, backItems),
          composeArtwork(2000, backItems),
        ]);
      }
      // Neck label — one PNG per unique size if enabled
      let neckPngs = null, neckPreviewPngs = null;
      if (neckEnabled) {
        neckPngs = {}; neckPreviewPngs = {};
        const sizesUsed = Object.entries(sizeQtys).filter(([, q]) => Number(q) > 0).map(([s]) => s);
        for (const sz of sizesUsed) {
          // Print resolution 1500x750 (2:1) ≈ 60×30mm @ ~600dpi
          neckPngs[sz]        = await composeArtwork(1500, neckItems, sz, NECK_LABEL_ASPECT);
          neckPreviewPngs[sz] = await composeArtwork(600,  neckItems, sz, NECK_LABEL_ASPECT);
        }
      }
      const placements = [];
      if (backEnabled) placements.push("back-print");
      if (neckEnabled) placements.push("neck-label");
      const { id: artwork_id } = await saveDesignerArtwork({
        product_id: productId,
        artwork_png: frontFull,
        preview_png: frontPreview,
        back_png: backFull,
        back_preview_png: backPreview,
        neck_label_pngs: neckPngs,
        neck_label_preview_pngs: neckPreviewPngs,
        items_count: frontItems.length,
        back_items_count: backItems.length,
        neck_label_items_count: neckItems.length,
        width: 2000, height: 2000,
      });
      const { url } = await createCheckout({
        product_id: productId,
        size_qtys: sizeQtys,
        origin_url: window.location.origin,
        blank: false,
        placements,
        design_meta: {
          flow: "designer",
          items: String(frontItems.length),
          back_items: String(backItems.length),
          neck_items: String(neckItems.length),
          text_count: String(frontItems.filter(i => i.type === "text").length + backItems.filter(i => i.type === "text").length + neckItems.filter(i => i.type === "text").length),
          image_count: String(frontItems.filter(i => i.type === "image").length + backItems.filter(i => i.type === "image").length + neckItems.filter(i => i.type === "image").length),
          artwork_id,
          back_print: backEnabled ? "yes" : "no",
          neck_label: neckEnabled ? "yes" : "no",
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
        <div className="p-12 text-center text-sm text-[#4b5563]">
          {loadError ? (
            <>
              <p>Something went wrong loading the designer.</p>
              <button onClick={() => window.location.reload()} className="mt-4 inline-flex bg-[#7bc67e] text-[#1a1a1a] font-extrabold px-5 py-2.5 rounded-full">Try again</button>
            </>
          ) : "Loading designer…"}
        </div>
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
            <h1 className="font-nunito font-black text-3xl lg:text-5xl mt-2" data-testid="dyo-hero-title">{dyoCopy.title}</h1>
          </div>
          <div className="text-xs text-[#4b5563] font-nunito font-bold" data-testid="dyo-hero-subtitle">{dyoCopy.subtitle}</div>
        </div>

        <div className="grid lg:grid-cols-12 gap-5">
          {/* Right aside — split into TOP (Product picker) and BOTTOM (Sizes + Total + Checkout) so mobile order is:
              1. Product   2. Canvas + view toggle   3. Layers/Upload/Text   4. Sizes & Checkout */}
          <aside className="lg:col-span-3 space-y-4 order-1 lg:order-3 lg:col-start-10 lg:row-start-1" data-testid="designer-product-aside">
            <Panel title="Product">
              <select data-testid="designer-product" value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm">
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — £{p.price.toFixed(2)}</option>)}
              </select>
              {product && (product.composition || product.description_long || (product.use_cases || []).length > 0) && (
                <div className="mt-3 space-y-2 text-xs" data-testid="product-info-card">
                  {product.composition && (
                    <div className="flex items-start gap-1.5 text-[#1a1a1a]">
                      <Info size={11} className="text-[#7bc67e] mt-0.5 flex-shrink-0" />
                      <span className="font-nunito font-bold leading-snug" data-testid="product-composition">{product.composition}</span>
                    </div>
                  )}
                  {product.description_long && (
                    <p className="text-[#4b5563] font-nunito leading-snug" data-testid="product-description-long">{product.description_long}</p>
                  )}
                  {(product.use_cases || []).length > 0 && (
                    <div className="flex flex-wrap gap-1" data-testid="product-use-cases">
                      {product.use_cases.map((uc) => (
                        <span key={uc} data-testid={`product-use-case-${uc}`} className="inline-flex items-center gap-1 bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-2 py-0.5 text-[10px] font-nunito font-extrabold text-[#1a1a1a]">
                          {USE_CASE_LABELS[uc] || uc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="text-[10px] text-[#4b5563] mt-2 font-bold">{products.length} products available · admin manages list</div>
            </Panel>
          </aside>

          <aside className="lg:col-span-3 space-y-4 order-3 lg:order-1 lg:col-start-1 lg:row-start-1 lg:row-span-2" data-testid="designer-left-aside">
            <Panel title="Upload">
              <button data-testid="designer-upload-btn" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#7bc67e] hover:bg-[#f0fdf4] text-[#7bc67e] py-6 rounded-2xl transition-colors">
                <Upload size={18} /><span className="font-nunito font-extrabold text-sm">Upload image</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onUpload} />
              <button data-testid="designer-removebg-btn" onClick={removeBgReal} className="w-full mt-3 flex items-center justify-center gap-2 bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] py-3 rounded-full font-nunito font-extrabold text-xs transition-colors">
                <Wand2 size={14} /> Remove Background
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { id: "poster",  label: "Poster" },
                  { id: "sketch",  label: "Sketch" },
                  { id: "cartoon", label: "Cartoon" },
                  { id: "enhance", label: "Enhance" },
                ].map((fx) => (
                  <button key={fx.id} data-testid={`designer-ai-${fx.id}`} onClick={() => aiEffectReal(fx.id, fx.label)} className="text-xs font-nunito font-extrabold bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] py-2 rounded-full transition-colors">{fx.label}</button>
                ))}
              </div>
              <div className="text-[10px] text-[#4b5563] mt-2 font-bold text-center">AI effects via Cutout.pro · background removal via remove.bg</div>
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
              {view === "neck" && (
                <button data-testid="designer-add-size-token" onClick={addSizeToken} className="mt-2 w-full bg-[#1a1a1a] hover:bg-black text-[#7bc67e] font-nunito font-extrabold text-xs py-2 rounded-full transition-colors flex items-center justify-center gap-2">
                  <Tag size={12} /> Add &#123;SIZE&#125; token
                </button>
              )}
              {view === "neck" && (
                <div className="text-[10px] text-[#4b5563] mt-2 font-bold leading-snug">
                  The &#123;SIZE&#125; token is swapped for the actual garment size (M, L, XL…) when we print — one label per size in your order.
                </div>
              )}
            </Panel>

            <Panel title={`Layers · ${view} ${items.length}${(backEnabled || neckEnabled) && view !== "back" && backEnabled ? ` · back ${backItems.length}` : ""}${(backEnabled || neckEnabled) && view !== "neck" && neckEnabled ? ` · neck ${neckItems.length}` : ""}${view !== "front" ? ` · front ${frontItems.length}` : ""}`}>
              {items.length === 0 ? (
                <div className="text-xs text-[#4b5563] text-center py-2">No layers yet</div>
              ) : (
                <ul className="space-y-1.5" data-testid="layers-list">
                  {items.slice().reverse().map((it, revIdx) => {
                    const idx = items.length - 1 - revIdx;
                    const isTop = idx === items.length - 1;
                    const isBottom = idx === 0;
                    return (
                      <li key={it.id}
                          onClick={() => setSelectedId(it.id)}
                          data-testid={`layer-${it.id}`}
                          className={`flex items-center gap-1 p-1.5 rounded-xl border cursor-pointer transition-colors ${selectedId === it.id ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#dcfce7] hover:bg-[#f0fdf4]"}`}>
                        <div className="w-7 h-7 rounded-md bg-white border border-[#dcfce7] grid place-items-center overflow-hidden flex-shrink-0">
                          {it.type === "image" ? <img src={it.src} alt="" className="w-full h-full object-contain" /> : <Type size={12} className="text-[#7bc67e]" />}
                        </div>
                        <div className="text-xs font-nunito font-extrabold truncate flex-1">{it.type === "text" ? (it.text || "Text") : "Image"}</div>
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(it.id, "up"); }} disabled={isTop} data-testid={`layer-up-${it.id}`} title="Bring forward" className="w-6 h-6 grid place-items-center rounded-full bg-white border border-[#dcfce7] disabled:opacity-30 hover:bg-[#dcfce7]"><ArrowUp size={10} /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(it.id, "down"); }} disabled={isBottom} data-testid={`layer-down-${it.id}`} title="Send back" className="w-6 h-6 grid place-items-center rounded-full bg-white border border-[#dcfce7] disabled:opacity-30 hover:bg-[#dcfce7]"><ArrowDown size={10} /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeItem(it.id); }} data-testid={`layer-remove-${it.id}`} title="Delete" className="w-6 h-6 grid place-items-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 size={11} /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {items.length > 0 && (
                <button data-testid="designer-clear" onClick={clearAll} className="w-full mt-3 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2 rounded-full transition-colors text-[11px] font-nunito font-extrabold">
                  <Trash2 size={12} /> Clear all layers
                </button>
              )}
            </Panel>
          </aside>

          <main className="lg:col-span-6 order-2 lg:order-2 lg:col-start-4 lg:row-start-1 lg:row-span-2" data-testid="designer-canvas-main">
            {/* Front / Back / Neck tabs + back/neck enable toggles */}
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
                <button
                  data-testid="designer-view-neck"
                  onClick={() => { if (!neckEnabled) setNeckEnabled(true); setView("neck"); }}
                  className={`px-4 py-1.5 rounded-full font-nunito font-extrabold text-sm transition-colors ${view === "neck" ? "bg-[#7bc67e] text-[#1a1a1a]" : "text-[#4b5563] hover:text-[#1a1a1a]"}`}
                >Neck label {neckEnabled && <span className="ml-1 text-[10px]">+£{neckLabelPrice.toFixed(2)}</span>}</button>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer bg-white border-2 border-[#dcfce7] rounded-full px-3 py-1.5" data-testid="designer-back-toggle">
                  <input
                    type="checkbox"
                    checked={backEnabled}
                    onChange={(e) => { const on = e.target.checked; setBackEnabled(on); if (!on && view === "back") setView("front"); }}
                    className="w-4 h-4 accent-[#7bc67e]"
                  />
                  <span className="text-xs font-nunito font-extrabold">Back +£{backPrintPrice.toFixed(2)}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer bg-white border-2 border-[#dcfce7] rounded-full px-3 py-1.5" data-testid="designer-neck-toggle">
                  <input
                    type="checkbox"
                    checked={neckEnabled}
                    onChange={(e) => { const on = e.target.checked; setNeckEnabled(on); if (!on && view === "neck") setView("front"); }}
                    className="w-4 h-4 accent-[#7bc67e]"
                  />
                  <span className="text-xs font-nunito font-extrabold inline-flex items-center gap-1"><Tag size={11} /> Neck +£{neckLabelPrice.toFixed(2)}</span>
                </label>
              </div>
            </div>

            <div className="bg-[#f0fdf4] rounded-3xl p-4 border-2 border-[#dcfce7]">
              <div
                ref={canvasRef}
                onMouseDown={() => { setSelectedId(null); setEditingId(null); }}
                className={`relative bg-white rounded-2xl overflow-hidden select-none ${view === "neck" ? "aspect-[2/1]" : "aspect-[4/5]"}`}
                data-testid="design-canvas"
              >
                {view === "neck" ? (
                  <div className="absolute inset-0 bg-gradient-to-b from-neutral-50 to-neutral-100 grid place-items-center pointer-events-none">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-300 font-nunito font-extrabold">Neck label · approx 60 × 30 mm</div>
                  </div>
                ) : (
                  <img src={product?.image} alt={product?.name || "garment"} className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
                )}
                {/* Side badge */}
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-[10px] font-nunito font-extrabold uppercase tracking-[0.2em] text-[#1a1a1a] border border-[#dcfce7]" data-testid="designer-side-badge">
                  {view === "front" ? "Front view" : view === "back" ? "Back view" : "Neck label"}
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
                          onDoubleClick={(e) => { e.stopPropagation(); if (!item.isSizeToken) setEditingId(item.id); }}
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
                          {isEditing && !item.isSizeToken ? (
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
                            <span data-testid={item.isSizeToken ? `size-token-${item.id}` : undefined} style={{ color: item.color, fontFamily: item.font, fontSize: `${item.fontSize}px`, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", display: "inline-block" }}>
                              {item.isSizeToken ? "{SIZE}" : item.text}
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
                              {!item.isSizeToken && (
                                <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setEditingId(item.id)} data-testid={`design-item-edit-${item.id}`} className="absolute -top-3 -left-3 w-6 h-6 bg-white border-2 border-[#7bc67e] text-[#7bc67e] rounded-full text-xs grid place-items-center" title="Edit text">
                                  <Pencil size={10} />
                                </button>
                              )}
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

          <aside className="lg:col-span-3 space-y-4 order-4 lg:order-3 lg:col-start-10 lg:row-start-2" data-testid="designer-right-aside">
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
                <span className="text-xs font-nunito font-bold text-[#4b5563]">{totalQty} × from £{unitPrice.toFixed(2)}{backEnabled && <> + £{backPrintPrice.toFixed(2)} back</>}{neckEnabled && <> + £{neckLabelPrice.toFixed(2)} neck</>}</span>
                <span data-testid="designer-total" className="text-[#7bc67e] font-nunito font-black text-3xl">£{subtotal.toFixed(2)}</span>
              </div>
              {totalQty > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" data-testid="size-breakdown">
                  {(product?.sizes || []).filter(sz => (sizeQtys[sz] || 0) > 0).map(sz => (
                    <span key={sz} data-testid={`size-breakdown-${sz}`} className="inline-flex items-center gap-1 bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-2 py-0.5 text-[11px] font-nunito font-extrabold text-[#1a1a1a]">
                      {sizeQtys[sz]} × <span className="text-[#7bc67e]">{sz}</span>
                    </span>
                  ))}
                </div>
              )}
              <button data-testid="designer-checkout" onClick={checkout} disabled={checkingOut} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold rounded-full px-6 py-4 shadow-md hover:-translate-y-0.5 transition-transform">
                {checkingOut ? <><Loader2 className="animate-spin" size={16} /> Saving design…</> : <><ShoppingCart size={16} /> Checkout with Stripe</>}
              </button>
              <div className="text-[10px] text-[#4b5563] mt-3 font-bold text-center">Test mode — no real charge<br /><ImageIcon size={9} className="inline" /> transparent PNG sent to production on checkout</div>
            </Panel>
          </aside>
        </div>

        {/* Full-width "let us do it for you" CTA below the designer */}
        <div className="mt-8">
          <NeedHelpCTA
            title="Don't want to fiddle with the designer? Let us set it up for you."
            body="Send us your logo or idea over WhatsApp — we'll clean up the artwork, mock it on your chosen garment, and reply with a proof to approve. Same price, zero faff."
            presetMessage="Hi! I want to order custom prints but would prefer you set the design up for me — can I send you my logo?"
            testid="designer-need-help"
            variant="banner"
          />
        </div>
      </div>

      <BoldFooter />
      <DesignerHelpFAB />
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
