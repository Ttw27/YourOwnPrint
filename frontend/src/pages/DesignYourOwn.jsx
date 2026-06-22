import React, { useEffect, useRef, useState } from "react";
import { IndustrialNavbar, IndustrialFooter } from "../components/IndustrialLayout";
import { fetchProducts, createCheckout } from "../lib/api";
import { toast } from "sonner";
import { Upload, Type, Image as ImageIcon, Eraser, Trash2, Plus, Minus, RotateCw, ShoppingCart, Loader2, Wand2 } from "lucide-react";

const FILTERS = [
  { key: "none", label: "None", css: "none" },
  { key: "vintage", label: "Vintage", css: "sepia(0.5) contrast(0.9) saturate(1.1)" },
  { key: "bw", label: "B&W", css: "grayscale(1) contrast(1.05)" },
  { key: "warm", label: "Warm", css: "hue-rotate(-10deg) saturate(1.3) brightness(1.05)" },
  { key: "cool", label: "Cool", css: "hue-rotate(20deg) saturate(1.2) brightness(1.0)" },
];

const FONTS = [
  { label: "Oswald", value: "Oswald, sans-serif" },
  { label: "IBM Plex", value: "'IBM Plex Sans', sans-serif" },
  { label: "Manrope", value: "Manrope, sans-serif" },
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Cormorant", value: "'Cormorant Garamond', serif" },
];

const SIZES = ["S", "M", "L", "XL", "XXL"];
const TSHIRT_MOCKUP = "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg?auto=compress&cs=tinysrgb&w=900";

export default function DesignYourOwn() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("personalised-tee");
  const [size, setSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [filter, setFilter] = useState("none");
  const [items, setItems] = useState([]); // {id,type:'image'|'text', src/text, x,y,w,h,rot,color,font,fontSize}
  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#ff6b35");
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
    toast.info("Background removal — coming soon (remove.bg API integration).");
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const rotateSelected = () => {
    if (!selectedId) return;
    setItems(prev => prev.map(i => i.id === selectedId ? { ...i, rot: (i.rot + 15) % 360 } : i));
  };

  // Drag handlers (mouse coordinates → percent of canvas)
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
      const dy = ((e.clientY - resizing.startY) / rect.height) * 100;
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
      const designSummary = {
        items: String(items.length),
        filter,
      };
      const { url } = await createCheckout({
        product_id: productId,
        quantity,
        size,
        origin_url: window.location.origin,
        design_meta: designSummary,
      });
      window.location.href = url;
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Checkout failed";
      toast.error(`Checkout failed: ${msg}`);
      setCheckingOut(false);
    }
  };

  return (
    <div className="bg-[#0d0d0d] min-h-screen text-white font-ibm">
      <IndustrialNavbar />

      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-8">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="text-[#ff6b35] font-oswald uppercase text-xs tracking-[0.3em]">Designer</div>
            <h1 className="font-oswald uppercase text-3xl lg:text-4xl font-bold mt-1">Design Your Own</h1>
          </div>
          <div className="text-xs text-neutral-500 font-oswald uppercase tracking-widest">Drag · Resize · Rotate · Preview</div>
        </div>

        <div className="grid lg:grid-cols-12 gap-5">
          {/* Left panel */}
          <aside className="lg:col-span-3 space-y-5">
            <Panel title="Upload">
              <button data-testid="designer-upload-btn" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#333] hover:border-[#ff6b35] text-neutral-300 hover:text-[#ff6b35] py-6 transition-colors">
                <Upload size={18} /><span className="font-oswald uppercase tracking-wider text-sm">Upload image</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onUpload} />
              <button data-testid="designer-removebg-btn" onClick={removeBgPlaceholder} className="w-full mt-3 flex items-center justify-center gap-2 border border-[#333] hover:border-[#ff6b35] text-neutral-300 hover:text-[#ff6b35] py-3 transition-colors">
                <Wand2 size={16} /><span className="font-oswald uppercase tracking-wider text-xs">Remove Background</span>
              </button>
            </Panel>

            <Panel title="Add Text">
              <input data-testid="designer-text-input" value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Your text" className="w-full bg-[#0d0d0d] border border-[#333] focus:border-[#ff6b35] outline-none px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <select data-testid="designer-font" value={textFont} onChange={(e) => setTextFont(e.target.value)} className="bg-[#0d0d0d] border border-[#333] outline-none px-2 py-2 text-xs">
                  {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <input data-testid="designer-color" type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-9 bg-[#0d0d0d] border border-[#333]" />
              </div>
              <button data-testid="designer-add-text" onClick={addText} className="mt-3 w-full bg-[#ff6b35] hover:bg-[#e55a2b] text-white font-oswald uppercase tracking-wider text-xs py-2.5 transition-colors flex items-center justify-center gap-2">
                <Type size={14} /> Add to design
              </button>
            </Panel>

            <Panel title="Filters">
              <div className="grid grid-cols-3 gap-2">
                {FILTERS.map(f => (
                  <button key={f.key} data-testid={`designer-filter-${f.key}`} onClick={() => setFilter(f.key)} className={`text-xs font-oswald uppercase tracking-wider py-2 border ${filter === f.key ? "border-[#ff6b35] text-[#ff6b35]" : "border-[#333] text-neutral-300 hover:text-white"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Canvas">
              <button data-testid="designer-rotate" onClick={rotateSelected} className="w-full flex items-center justify-center gap-2 border border-[#333] hover:border-[#ff6b35] text-neutral-300 hover:text-[#ff6b35] py-2.5 transition-colors text-xs uppercase tracking-wider font-oswald">
                <RotateCw size={14} /> Rotate selected
              </button>
              <button data-testid="designer-clear" onClick={clearAll} className="mt-2 w-full flex items-center justify-center gap-2 border border-[#333] hover:border-red-500 text-neutral-300 hover:text-red-500 py-2.5 transition-colors text-xs uppercase tracking-wider font-oswald">
                <Trash2 size={14} /> Clear canvas
              </button>
            </Panel>
          </aside>

          {/* Center canvas */}
          <main className="lg:col-span-6">
            <div className="bg-[#111] border border-[#222] p-3">
              <div
                ref={canvasRef}
                onClick={() => setSelectedId(null)}
                className="relative aspect-[4/5] bg-white overflow-hidden select-none"
                style={{ filter: FILTERS.find(f => f.key === filter)?.css || "none" }}
                data-testid="design-canvas"
              >
                <img src={TSHIRT_MOCKUP} alt="t-shirt" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
                {/* Print area outline */}
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
                      outline: selectedId === item.id ? "2px solid #ff6b35" : "none",
                    }}
                    data-testid={`design-item-${item.id}`}
                  >
                    {item.type === "image" ? (
                      <img src={item.src} alt="" draggable={false} className="w-full h-full object-contain" />
                    ) : (
                      <div style={{ color: item.color, fontFamily: item.font, fontSize: `${item.fontSize}px`, fontWeight: 700, lineHeight: 1.1, whiteSpace: "nowrap" }}>
                        {item.text}
                      </div>
                    )}
                    {selectedId === item.id && (
                      <>
                        <span data-handle="resize" onMouseDown={(e) => onPointerDownItem(e, item)} className="absolute -right-2 -bottom-2 w-4 h-4 bg-[#ff6b35] cursor-se-resize" />
                        <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="absolute -top-3 -right-3 w-6 h-6 bg-black text-white rounded-full text-xs grid place-items-center" data-testid={`design-item-delete-${item.id}`}>×</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-neutral-500 mt-3 font-oswald uppercase tracking-widest">Tip: click an item to select · drag corner to resize · "Rotate selected" to spin</div>
          </main>

          {/* Right panel */}
          <aside className="lg:col-span-3 space-y-5">
            <Panel title="Product">
              <select data-testid="designer-product" value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full bg-[#0d0d0d] border border-[#333] focus:border-[#ff6b35] outline-none px-3 py-2.5 text-sm">
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — £{p.price.toFixed(2)}</option>)}
              </select>
            </Panel>

            <Panel title="Size">
              <div className="grid grid-cols-5 gap-2">
                {SIZES.map(s => (
                  <button key={s} data-testid={`designer-size-${s}`} onClick={() => setSize(s)} className={`py-2 font-oswald uppercase tracking-wider text-sm border ${size === s ? "border-[#ff6b35] text-[#ff6b35]" : "border-[#333] text-neutral-300 hover:text-white"}`}>{s}</button>
                ))}
              </div>
            </Panel>

            <Panel title="Quantity">
              <div className="flex items-center gap-3">
                <button data-testid="designer-qty-minus" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 border border-[#333] hover:border-[#ff6b35] grid place-items-center"><Minus size={14} /></button>
                <input data-testid="designer-qty" type="number" min={1} max={500} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value || "1"))))} className="w-full text-center bg-[#0d0d0d] border border-[#333] px-3 py-2 text-lg font-oswald" />
                <button data-testid="designer-qty-plus" onClick={() => setQuantity(q => Math.min(500, q + 1))} className="w-10 h-10 border border-[#333] hover:border-[#ff6b35] grid place-items-center"><Plus size={14} /></button>
              </div>
            </Panel>

            <Panel title="Total">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-oswald uppercase tracking-widest text-neutral-400">Unit £{unitPrice.toFixed(2)} × {quantity}</span>
                <span data-testid="designer-total" className="text-[#ff6b35] font-oswald text-3xl font-bold">£{subtotal}</span>
              </div>
              <button data-testid="designer-checkout" onClick={checkout} disabled={checkingOut} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#ff6b35] hover:bg-[#e55a2b] disabled:opacity-60 text-white font-oswald uppercase tracking-wider px-6 py-4 transition-transform hover:-translate-y-1">
                {checkingOut ? <><Loader2 className="animate-spin" size={16} /> Redirecting…</> : <><ShoppingCart size={16} /> Checkout with Stripe</>}
              </button>
              <div className="text-[10px] text-neutral-500 mt-3 uppercase tracking-widest text-center">Test mode — no real charge</div>
            </Panel>
          </aside>
        </div>
      </div>

      <IndustrialFooter />
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-[#111] border border-[#222] p-4">
      <div className="text-[10px] font-oswald uppercase tracking-[0.3em] text-[#ff6b35] mb-3">{title}</div>
      {children}
    </div>
  );
}
