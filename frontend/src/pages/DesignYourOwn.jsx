import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchProducts, createCheckout } from "../lib/api";
import { toast } from "sonner";
import { Upload, Type, Eraser, Trash2, Plus, Minus, RotateCw, ShoppingCart, Loader2, Wand2, Sparkles } from "lucide-react";

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
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#7bc67e");
  const [textFont, setTextFont] = useState(FONTS[0].value);
  const [checkingOut, setCheckingOut] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchProducts().then(setProducts); }, []);

  const product = products.find(p => p.id === productId);
  const unitPrice = product?.price ?? 6.99;
  const subtotal = (unitPrice * quantity).toFixed(2);

  const onUpload = (e) => {
    const file = e.target.files?.[0];
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
    if (!textInput.trim()) { toast.error("Type some text first"); return; }
    const id = `txt-${Date.now()}`;
    setItems(prev => [...prev, { id, type: "text", text: textInput, x: 25, y: 40, w: 50, h: 12, rot: 0, color: textColor, font: textFont, fontSize: 28 }]);
    setSelectedId(id);
    setTextInput("");
  };

  const clearAll = () => { setItems([]); setSelectedId(null); };
  const removeBgPlaceholder = () => {
    if (!selectedId) { toast.error("Select an image first"); return; }
    toast.info("Background removal — coming soon (remove.bg API to be wired)");
  };
  const removeItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const rotateSelected = () => {
    if (!selectedId) return;
    setItems(prev => prev.map(i => i.id === selectedId ? { ...i, rot: (i.rot + 15) % 360 } : i));
  };

  const onPointerDownItem = (e, item) => {
    e.stopPropagation();
    setSelectedId(item.id);
    if (e.target.dataset.handle === "resize") {
      setResizing({ id: item.id, startX: e.clientX, startY: e.clientY, w: item.w, h: item.h });
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ id: item.id, dx: e.clientX - (rect.left + (item.x / 100) * rect.width), dy: e.clientY - (rect.top + (item.y / 100) * rect.height) });
  };
  const onPointerMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    if (dragging) {
      const x = ((e.clientX - dragging.dx - rect.left) / rect.width) * 100;
      const y = ((e.clientY - dragging.dy - rect.top) / rect.height) * 100;
      setItems(prev => prev.map(i => i.id === dragging.id ? { ...i, x: Math.max(0, Math.min(85, x)), y: Math.max(0, Math.min(85, y)) } : i));
    }
    if (resizing) {
      const dx = ((e.clientX - resizing.startX) / rect.width) * 100;
      const ratio = resizing.h / Math.max(resizing.w, 1);
      const newW = Math.max(8, Math.min(70, resizing.w + dx));
      setItems(prev => prev.map(i => i.id === resizing.id ? { ...i, w: newW, h: Math.max(6, newW * ratio) } : i));
    }
  };
  const onPointerUp = () => { setDragging(null); setResizing(null); };

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
        design_meta: { items: String(items.length), filter },
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
          <div className="text-xs text-[#4b5563] font-nunito font-bold">Drag · Resize · Rotate · Preview</div>
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
              <button data-testid="designer-rotate" onClick={rotateSelected} className="w-full flex items-center justify-center gap-2 bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] py-2.5 rounded-full transition-colors text-xs font-nunito font-extrabold">
                <RotateCw size={14} /> Rotate selected
              </button>
              <button data-testid="designer-clear" onClick={clearAll} className="mt-2 w-full flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2.5 rounded-full transition-colors text-xs font-nunito font-extrabold">
                <Trash2 size={14} /> Clear canvas
              </button>
            </Panel>
          </aside>

          <main className="lg:col-span-6">
            <div className="bg-[#f0fdf4] rounded-3xl p-4 border-2 border-[#dcfce7]">
              <div
                ref={canvasRef}
                onClick={() => setSelectedId(null)}
                className="relative aspect-[4/5] bg-white rounded-2xl overflow-hidden select-none"
                style={{ filter: FILTERS.find(f => f.key === filter)?.css || "none" }}
                data-testid="design-canvas"
              >
                <img src={TSHIRT_MOCKUP} alt="t-shirt" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
                <div className="absolute left-[22%] top-[20%] w-[56%] h-[55%] border border-dashed border-black/20 pointer-events-none" />
                {items.map((item) => (
                  <div
                    key={item.id}
                    onMouseDown={(e) => onPointerDownItem(e, item)}
                    style={{
                      position: "absolute",
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      width: `${item.w}%`,
                      height: item.type === "text" ? "auto" : `${item.h}%`,
                      transform: `rotate(${item.rot}deg)`,
                      transformOrigin: "center",
                      cursor: "grab",
                      outline: selectedId === item.id ? "2px solid #7bc67e" : "none",
                    }}
                    data-testid={`design-item-${item.id}`}
                  >
                    {item.type === "image" ? (
                      <img src={item.src} alt="" draggable={false} className="w-full h-full object-contain" />
                    ) : (
                      <div style={{ color: item.color, fontFamily: item.font, fontSize: `${item.fontSize}px`, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap" }}>
                        {item.text}
                      </div>
                    )}
                    {selectedId === item.id && (
                      <>
                        <span data-handle="resize" onMouseDown={(e) => onPointerDownItem(e, item)} className="absolute -right-2 -bottom-2 w-4 h-4 bg-[#7bc67e] rounded-full cursor-se-resize" />
                        <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="absolute -top-3 -right-3 w-6 h-6 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center" data-testid={`design-item-delete-${item.id}`}>×</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-[#4b5563] mt-3 font-nunito font-bold text-center">Click an item to select · drag the dot to resize · "Rotate selected" to spin</div>
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
