import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { designerRemoveBg, designerAiEffect, designerAiUsage, getCustomerToken } from "../../lib/api";
import FontPicker from "./FontPicker";
import { X, Upload, Type, Trash2, RotateCw, Loader2, Wand2, ArrowUp, ArrowDown, Copy, Pencil, Layers, Check, Lock } from "lucide-react";
import { MobileToolBar, MobileSheet, useIsMobile } from "./MobileDesignerShell";

const FONTS = [
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Plus Jakarta", value: "'Plus Jakarta Sans', sans-serif" },
  { label: "Manrope", value: "Manrope, sans-serif" },
  { label: "Oswald", value: "Oswald, sans-serif" },
  { label: "Cormorant", value: "'Cormorant Garamond', serif" },
  { label: "Bebas Neue", value: "'Bebas Neue', sans-serif" },
  { label: "Pacifico", value: "Pacifico, cursive" },
  { label: "Permanent Marker", value: "'Permanent Marker', cursive" },
  { label: "Anton", value: "Anton, sans-serif" },
  { label: "Caveat", value: "Caveat, cursive" },
  { label: "Bangers", value: "Bangers, cursive" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Archivo Black", value: "'Archivo Black', sans-serif" },
  { label: "Dancing Script", value: "'Dancing Script', cursive" },
  { label: "Righteous", value: "Righteous, sans-serif" },
];

/**
 * PlacementDesignerModal — a focused popup for designing ONE specific print
 * placement. Reuses the same canvas/item model as the full Design Your Own
 * builder (upload, text, AI background removal, layers, drag/resize/rotate)
 * but scoped to a single placement — no product picker, no colour picker,
 * no checkout. On confirm, flattens everything to a PNG and hands it back.
 *
 * Props: placementLabel, printArea ({x,y,w,h} %), backgroundColor (hex),
 *        onClose(), onConfirm(dataUrl)
 */
export default function PlacementDesignerModal({ placementLabel, printArea, backgroundColor, onClose, onConfirm }) {
  // The popup is already scoped to ONE placement and says which one in the
  // header, so there's no need to shrink the working area down to that
  // placement's real position on a garment (a left-breast box is tiny and
  // was leaving customers designing in a postage stamp). Give them the full
  // canvas to work in; the artwork is flattened and scaled to the real print
  // area at production, exactly as an uploaded file would be.
  const workingArea = { x: 8, y: 8, w: 84, h: 84 };
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const isMobile = useIsMobile();
  const [sheet, setSheet] = useState(null); // which mobile tool sheet is open
  const [editingId, setEditingId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#1a1a1a");
  const [textFont, setTextFont] = useState(FONTS[0].value);
  const [confirming, setConfirming] = useState(false);
  const [aiUsage, setAiUsage] = useState(null);
  const isLoggedIn = !!getCustomerToken();

  useEffect(() => {
    if (!isLoggedIn) return;
    designerAiUsage().then(setAiUsage).catch(() => {});
  }, [isLoggedIn]);
  const printAreaRef = useRef(null);
  const fileInputRef = useRef(null);

  const selected = items.find(i => i.id === selectedId) || null;

  const onUpload = (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const id = `img-${Date.now()}`;
        const aspect = img.width / Math.max(img.height, 1);
        const w = 60;
        const h = w / aspect;
        setItems(prev => [...prev, { id, type: "image", src: reader.result, x: 20, y: 20, w, h, rot: 0 }]);
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
    if (!isLoggedIn) { toast.error("Log in to use AI tools — free, just prevents random abuse of the paid AI service."); return; }
    if (!selected || selected.type !== "image") { toast.error("Select an image first"); return; }
    updateItem(selected.id, { _busy: true });
    const t = toast.loading("Removing background…");
    try {
      const res = await designerRemoveBg(selected.src);
      if (!res?.image_base64) throw new Error("no image returned");
      updateItem(selected.id, { src: res.image_base64, _busy: false });
      if (typeof res.ai_uses_remaining === "number") setAiUsage((u) => ({ ...(u || { limit: 20 }), remaining: res.ai_uses_remaining, used: (u?.limit || 20) - res.ai_uses_remaining }));
      toast.success("Background removed", { id: t });
    } catch (e) {
      updateItem(selected.id, { _busy: false });
      toast.error(e?.response?.data?.detail || e?.message || "Background removal failed", { id: t });
    }
  };

  const aiEffectReal = async (effectId, label) => {
    if (!isLoggedIn) { toast.error("Log in to use AI tools — free, just prevents random abuse of the paid AI service."); return; }
    if (!selected || selected.type !== "image") { toast.error("Select an image first"); return; }
    updateItem(selected.id, { _busy: true });
    const t = toast.loading(`Applying ${label}…`);
    try {
      const res = await designerAiEffect(selected.src, effectId);
      const nextSrc = res?.image_base64 || res?.image_url;
      if (!nextSrc) throw new Error("no image returned");
      updateItem(selected.id, { src: nextSrc, _busy: false });
      if (typeof res.ai_uses_remaining === "number") setAiUsage((u) => ({ ...(u || { limit: 20 }), remaining: res.ai_uses_remaining, used: (u?.limit || 20) - res.ai_uses_remaining }));
      toast.success(`${label} applied`, { id: t });
    } catch (e) {
      updateItem(selected.id, { _busy: false });
      toast.error(e?.response?.data?.detail || e?.message || "Effect failed", { id: t });
    }
  };

  const onPointerDownItem = (e, item, mode = "move") => {
    e.stopPropagation();
    if (editingId === item.id && mode === "move") return;
    setSelectedId(item.id);
    const rect = printAreaRef.current.getBoundingClientRect();
    if (mode === "rotate") {
      const cx = rect.left + ((item.x + (item.w || 20) / 2) / 100) * rect.width;
      const cy = rect.top + ((item.y + (item.h || (item.fontSize ? item.fontSize / 4 : 10)) / 2) / 100) * rect.height;
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
        updateItem(drag.id, { fontSize: Math.max(8, Math.min(220, drag.fontSize * scale)) });
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

  const composeArtwork = async () => {
    const size = 1200;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    for (const it of items) {
      const cx = (it.x / 100) * size + ((it.w || 0) / 100) * size / 2;
      const cy = (it.y / 100) * size + (it.type === "text" ? (it.fontSize || 28) / 2 : ((it.h || 0) / 100) * size / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((it.rot || 0) * Math.PI / 180);
      if (it.type === "image") {
        const w = (it.w / 100) * size, h = (it.h / 100) * size;
        await new Promise((resolve) => {
          const im = new Image(); im.crossOrigin = "anonymous";
          im.onload = () => { ctx.drawImage(im, -w / 2, -h / 2, w, h); resolve(); };
          im.onerror = resolve;
          im.src = it.src;
        });
      } else {
        const fontPx = (it.fontSize / 100) * (size / 4);
        ctx.fillStyle = it.color || "#000";
        ctx.font = `800 ${fontPx}px ${it.font || "Nunito, sans-serif"}`;
        ctx.textBaseline = "middle"; ctx.textAlign = "center";
        ctx.fillText(it.text, 0, 0);
      }
      ctx.restore();
    }
    return c.toDataURL("image/png");
  };

  const handleConfirm = async () => {
    if (items.length === 0) { toast.error("Add something to your design first"); return; }
    setConfirming(true);
    try {
      const dataUrl = await composeArtwork();
      onConfirm(dataUrl);
    } catch {
      toast.error("Couldn't finish your design — try again");
    } finally {
      setConfirming(false);
    }
  };

  // The three tool panels, written once and used in both the desktop sidebar
  // and the mobile sheets, so the two layouts can never drift apart.
  const UploadTextPanel = () => (
    <div className="space-y-3">
      <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 justify-center bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold rounded-full px-4 py-2.5 text-sm" data-testid="placement-add-image">
        <Upload size={15} /> Add image
      </button>
      <div className="bg-[#f0fdf4] rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#166534]"><Type size={13} /> Add text</div>
        <input value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="e.g. 07123 456789" className="w-full text-sm bg-white border border-[#dcfce7] rounded-lg px-2 py-1.5" data-testid="placement-text-input" />
        <div className="flex gap-1.5">
          <FontPicker value={textFont} onChange={setTextFont} fonts={FONTS} className="flex-1" />
          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-8 h-8 rounded-lg border border-[#dcfce7]" />
        </div>
        <button onClick={addText} className="w-full text-xs font-extrabold bg-white border border-[#7bc67e] text-[#166534] rounded-full py-1.5 hover:bg-[#f0fdf4]" data-testid="placement-add-text">Add</button>
      </div>
    </div>
  );

  const AiPanel = () => (
    selected?.type === "image" ? (
      <div className="bg-[#f0fdf4] rounded-xl p-3 space-y-1.5">
        <div className="text-xs font-extrabold text-[#166534] flex items-center gap-1.5"><Wand2 size={13} /> AI tools</div>
        <button onClick={removeBgReal} disabled={!isLoggedIn} className={`w-full text-xs font-bold rounded-lg py-1.5 ${!isLoggedIn ? "bg-[#f9fafb] text-[#9ca3af] border border-[#e5e7eb] cursor-not-allowed" : "bg-white border border-[#dcfce7] hover:border-[#7bc67e]"}`}>
          {!isLoggedIn && <Lock size={10} className="inline mr-1 -mt-0.5" />}Remove background
        </button>
        <button onClick={() => aiEffectReal("enhance", "Enhance")} disabled={!isLoggedIn} className={`w-full text-xs font-bold rounded-lg py-1.5 ${!isLoggedIn ? "bg-[#f9fafb] text-[#9ca3af] border border-[#e5e7eb] cursor-not-allowed" : "bg-white border border-[#dcfce7] hover:border-[#7bc67e]"}`}>
          {!isLoggedIn && <Lock size={10} className="inline mr-1 -mt-0.5" />}Enhance quality
        </button>
        {!isLoggedIn ? (
          <p className="text-[9px] text-[#712B13] font-bold pt-1"><Link to="/account" className="underline font-extrabold">Log in</Link> to use these — free, just stops random abuse.</p>
        ) : aiUsage ? (
          <p className="text-[9px] text-[#4b5563] font-bold pt-1">{aiUsage.remaining} of {aiUsage.limit} free AI edits left this month</p>
        ) : null}
      </div>
    ) : (
      <p className="text-xs text-[#4b5563]">Select an image on the canvas to use the AI tools.</p>
    )
  );

  const LayersPanel = () => (
    items.length > 0 ? (
      <div className="bg-[#f0fdf4] rounded-xl p-3 space-y-1.5">
        <div className="text-xs font-extrabold text-[#166534] flex items-center gap-1.5"><Layers size={13} /> Layers · {items.length}</div>
        {items.map((it, i) => (
          <div key={it.id} onClick={() => setSelectedId(it.id)} className={`flex items-center justify-between text-xs rounded-lg px-2 py-1.5 cursor-pointer ${selectedId === it.id ? "bg-white border border-[#7bc67e]" : "bg-white/60"}`}>
            <span className="truncate flex-1">{it.type === "text" ? it.text : `Image ${i + 1}`}</span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={(e) => { e.stopPropagation(); moveLayer(it.id, "up"); }} disabled={i === items.length - 1} className="w-5 h-5 grid place-items-center rounded-full hover:bg-[#dcfce7] disabled:opacity-30"><ArrowUp size={9} /></button>
              <button onClick={(e) => { e.stopPropagation(); moveLayer(it.id, "down"); }} disabled={i === 0} className="w-5 h-5 grid place-items-center rounded-full hover:bg-[#dcfce7] disabled:opacity-30"><ArrowDown size={9} /></button>
              <button onClick={(e) => { e.stopPropagation(); duplicateItem(it.id); }} className="w-5 h-5 grid place-items-center rounded-full hover:bg-[#dcfce7]"><Copy size={9} /></button>
              <button onClick={(e) => { e.stopPropagation(); removeItem(it.id); }} className="w-5 h-5 grid place-items-center rounded-full hover:bg-rose-100 text-rose-500"><Trash2 size={9} /></button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-xs text-[#4b5563]">Nothing on the canvas yet. Add an image or some text.</p>
    )
  );

  const MOBILE_TABS = [
    { key: "add", label: "Add", icon: Upload },
    { key: "ai", label: "AI tools", icon: Wand2 },
    { key: "layers", label: "Layers", icon: Layers, badge: items.length },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" data-testid="placement-designer-modal">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto pb-20 md:pb-0">
        <div className="flex items-center justify-between p-5 border-b border-[#e5e7eb]">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#7bc67e] font-extrabold">Design your print</div>
            <h2 className="font-nunito font-black text-xl">{placementLabel}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full hover:bg-[#f0fdf4]" data-testid="placement-designer-close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid md:grid-cols-[1fr_auto] gap-6">
          {/* Canvas */}
          <div>
            <div
              className="relative mx-auto rounded-2xl overflow-hidden border border-[#e5e7eb]"
              style={{ width: "100%", maxWidth: 380, aspectRatio: "1 / 1", background: backgroundColor }}
              onMouseDown={() => { setSelectedId(null); setEditingId(null); }}
            >
              <div
                ref={printAreaRef}
                className="absolute border-2 border-dashed border-[#7bc67e]"
                style={{ left: `${workingArea.x}%`, top: `${workingArea.y}%`, width: `${workingArea.w}%`, height: `${workingArea.h}%`, boxShadow: "0 0 0 1px rgba(255,255,255,0.9)" }}
                data-testid="placement-print-area"
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
                          position: "absolute", left: `${item.x}%`, top: `${item.y}%`,
                          transform: `rotate(${item.rot}deg)`, transformOrigin: "top left",
                          cursor: isEditing ? "text" : "grab",
                          outline: isSelected ? "2px solid #7bc67e" : "none", outlineOffset: 2, padding: "2px 4px",
                        }}
                        data-testid={`placement-item-${item.id}`}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={item.text}
                            onChange={(e) => updateItem(item.id, { text: e.target.value })}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => { if (e.key === "Enter") setEditingId(null); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{ color: item.color, fontFamily: item.font, fontSize: `${item.fontSize}px`, fontWeight: 800, background: "rgba(255,255,255,0.7)", border: "1px dashed #7bc67e", borderRadius: 4, padding: "2px 6px", width: `${Math.max(10, (item.text?.length || 4) + 2)}ch` }}
                          />
                        ) : (
                          <span style={{ color: item.color, fontFamily: item.font, fontSize: `${item.fontSize}px`, fontWeight: 800, whiteSpace: "nowrap", display: "inline-block" }}>{item.text}</span>
                        )}
                        {isSelected && !isEditing && (
                          <>
                            <span onMouseDown={(e) => onPointerDownItem(e, item, "rotate")} className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-[#7bc67e] rounded-full cursor-grab grid place-items-center"><RotateCw size={10} className="text-[#7bc67e]" /></span>
                            <span onMouseDown={(e) => onPointerDownItem(e, item, "resize")} className="absolute -right-2 -bottom-2 w-4 h-4 bg-[#7bc67e] rounded-full cursor-se-resize border-2 border-white" />
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setEditingId(item.id)} className="absolute -top-3 -left-3 w-6 h-6 bg-white border-2 border-[#7bc67e] text-[#7bc67e] rounded-full grid place-items-center"><Pencil size={10} /></button>
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => removeItem(item.id)} className="absolute -top-3 -right-3 w-6 h-6 bg-[#1a1a1a] text-white rounded-full grid place-items-center text-xs">×</button>
                          </>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => onPointerDownItem(e, item, "move")}
                      style={{ position: "absolute", left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%`, transform: `rotate(${item.rot}deg)`, transformOrigin: "center", cursor: "grab", outline: isSelected ? "2px solid #7bc67e" : "none" }}
                      data-testid={`placement-item-${item.id}`}
                    >
                      <img src={item.src} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none" />
                      {item._busy && <div className="absolute inset-0 bg-white/70 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" size={20} /></div>}
                      {isSelected && !item._busy && (
                        <>
                          <span onMouseDown={(e) => onPointerDownItem(e, item, "rotate")} className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-[#7bc67e] rounded-full cursor-grab grid place-items-center"><RotateCw size={10} className="text-[#7bc67e]" /></span>
                          <span onMouseDown={(e) => onPointerDownItem(e, item, "resize")} className="absolute -right-2 -bottom-2 w-4 h-4 bg-[#7bc67e] rounded-full cursor-se-resize border-2 border-white" />
                          <button onMouseDown={(e) => e.stopPropagation()} onClick={() => removeItem(item.id)} className="absolute -top-3 -right-3 w-6 h-6 bg-[#1a1a1a] text-white rounded-full grid place-items-center text-xs">×</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[11px] text-[#4b5563] text-center mt-2">Drag to move · corner dot to resize · top knob to rotate · double-click text to edit</p>
          </div>

          {/* Toolbar — desktop only; on mobile these move into the bottom sheets */}
          <div className="hidden md:block w-full md:w-56 space-y-3">
            <UploadTextPanel />
            <AiPanel />
            <LayersPanel />
          </div>
        </div>

        {/* Shared hidden file input (used by both desktop panel and mobile sheet). */}
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onUpload} />

        {/* Mobile: tab bar + sliding sheets. Renders nothing on desktop. */}
        {isMobile && (
          <>
            <MobileToolBar tabs={MOBILE_TABS} activeKey={sheet} onSelect={setSheet} testid="placement-toolbar" />
            <MobileSheet open={sheet === "add"} title="Add image or text" onClose={() => setSheet(null)} testid="placement-sheet-add">
              <UploadTextPanel />
            </MobileSheet>
            <MobileSheet open={sheet === "ai"} title="AI tools" onClose={() => setSheet(null)} testid="placement-sheet-ai">
              <AiPanel />
            </MobileSheet>
            <MobileSheet open={sheet === "layers"} title="Layers" onClose={() => setSheet(null)} testid="placement-sheet-layers">
              <LayersPanel />
            </MobileSheet>
          </>
        )}

        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#e5e7eb]">
          <button onClick={onClose} className="text-sm font-extrabold text-[#4b5563] hover:underline">Cancel</button>
          <button onClick={handleConfirm} disabled={confirming} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 text-[#1a1a1a] font-nunito font-extrabold rounded-full px-5 py-2.5" data-testid="placement-designer-confirm">
            {confirming ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Use this design
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
