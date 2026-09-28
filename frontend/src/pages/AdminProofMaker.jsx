import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Loader2, ImagePlus, Trash2, Download, Crosshair, X } from "lucide-react";
import { fetchAllProductsAdmin, fetchProofProduct, fetchProofPhoto } from "../lib/api";

/**
 * Proof maker - mock up a customer's logo on any product + colour and download
 * a watermarked PNG proof to send them.
 *
 * Everything lives on a 4:5 "stage". Artwork positions are stored as % of the
 * stage (x/y = top-left corner, w = width; height follows the image's own
 * shape), so the on-screen preview and the exported canvas use the same maths.
 * The garment photo is fetched through the backend (/admin/proof/photo) as a
 * blob, because a canvas can't be exported if it contains a cross-site image.
 */

const STAGE_ASPECT = 4 / 5;           // width / height
const EXPORT_W = 1600;                // exported stage size in px
const EXPORT_H = EXPORT_W / STAGE_ASPECT;
const FOOTER_H = 300;                 // info strip under the garment in the export
const STAGE_BG = "#f6f7f6";
const WATERMARK_OPACITY = 0.3;
const PRINT_POSITIONS = ["Front - centre", "Front - left chest", "Front - right chest", "Back - centre", "Back - neck", "Left sleeve", "Right sleeve"];

let nextId = 1;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// logo.png is dark lettering on a solid white background, so it can't be tiled
// as-is (faint white boxes, and invisible on dark garments). Turn it into a
// mid-grey mark whose transparency follows the lettering - white becomes
// see-through - so it reads on light AND dark garments. Returns a canvas.
function makeWatermarkMark(logo) {
  const scale = 4; // the source is only 250px wide - upscale before sampling for smoother edges
  const c = document.createElement("canvas");
  c.width = logo.naturalWidth * scale;
  c.height = logo.naturalHeight * scale;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logo, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i + 3] = Math.max(0, Math.min(255, (255 - lum) * 1.4)) * (px[i + 3] / 255);
    px[i] = px[i + 1] = px[i + 2] = 128;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

// Size + position of an "object-contain" image inside a box.
function containRect(imgW, imgH, boxW, boxH) {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * scale, h = imgH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

export default function AdminProofMaker() {
  // Product picking
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState(null);   // from /admin/proof/product/{id}
  const [colour, setColour] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");   // blob: URL of the garment photo
  const [photoLoading, setPhotoLoading] = useState(false);

  // Artwork + proof details
  const [items, setItems] = useState([]);         // {id, src, name, x, y, w, aspect}
  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState({ customer: "", position: PRINT_POSITIONS[0], size: "", notes: "" });
  const [watermark, setWatermark] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [watermarkSrc, setWatermarkSrc] = useState("");  // data URL of the grey mark, for the preview
  const stageRef = useRef(null);
  const dragRef = useRef(null);   // {id, mode: "move"|"resize", startX, startY, orig}
  const fileRef = useRef(null);

  useEffect(() => {
    loadImage("/logo.png").then((logo) => setWatermarkSrc(makeWatermarkMark(logo).toDataURL("image/png"))).catch(() => {});
  }, []);

  // Debounced product search
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetchAllProductsAdmin(0, 12, q)
        .then((d) => setResults(d.items || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Garment photo for the chosen product + colour
  useEffect(() => {
    if (!product) return;
    let alive = true;
    let objectUrl = "";
    setPhotoLoading(true);
    fetchProofPhoto(product.id, colour)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setPhotoUrl(objectUrl);
      })
      .catch(() => {
        if (alive) { setPhotoUrl(""); toast.error("Couldn't load a photo for this product - the proof will use a plain background."); }
      })
      .finally(() => alive && setPhotoLoading(false));
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [product, colour]);

  const pickProduct = async (p) => {
    try {
      const full = await fetchProofProduct(p.id);
      setProduct({ ...full, thumb: p.image });
      const firstWithPhoto = (full.colors || []).find((c) => c.has_photo);
      setColour(firstWithPhoto ? firstWithPhoto.name : (full.colors?.[0]?.name || ""));
      setQuery("");
      setResults([]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't load that product");
    }
  };

  const addFiles = async (files) => {
    for (const file of Array.from(files || [])) {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} isn't an image`); continue; }
      if (file.size > 15 * 1024 * 1024) { toast.error(`${file.name} is over 15MB`); continue; }
      try {
        const src = await readFile(file);
        const img = await loadImage(src);
        const aspect = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 1;
        // Start centred in the print area, at half its width.
        const pa = product?.print_area || { x: 22, y: 20, w: 56, h: 55 };
        const w = pa.w * 0.5;
        const h = (w * STAGE_ASPECT) / aspect;   // % of stage height
        const item = { id: nextId++, src, name: file.name, aspect, w, x: pa.x + (pa.w - w) / 2, y: pa.y + Math.max(0, (pa.h - h) / 3) };
        setItems((prev) => [...prev, item]);
        setSelectedId(item.id);
      } catch {
        toast.error(`Couldn't read ${file.name}`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const updateItem = (id, patch) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id) => { setItems((prev) => prev.filter((it) => it.id !== id)); if (selectedId === id) setSelectedId(null); };
  const selected = items.find((it) => it.id === selectedId) || null;
  const itemH = (it) => (it.w * STAGE_ASPECT) / it.aspect;

  const centreSelected = () => {
    if (!selected) return;
    const pa = product?.print_area || { x: 22, y: 20, w: 56, h: 55 };
    updateItem(selected.id, { x: pa.x + (pa.w - selected.w) / 2, y: pa.y + (pa.h - itemH(selected)) / 2 });
  };

  // Drag to move / corner-drag to resize (pointer events work for mouse + touch)
  const onPointerDown = (e, it, mode) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(it.id);
    dragRef.current = { id: it.id, mode, startX: e.clientX, startY: e.clientY, orig: { ...it } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const dx = ((e.clientX - d.startX) / rect.width) * 100;
    const dy = ((e.clientY - d.startY) / rect.height) * 100;
    if (d.mode === "move") updateItem(d.id, { x: d.orig.x + dx, y: d.orig.y + dy });
    else updateItem(d.id, { w: Math.max(3, Math.min(150, d.orig.w + dx)) });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const colourObj = (product?.colors || []).find((c) => c.name === colour);

  const exportProof = async () => {
    if (!product) { toast.error("Pick a product first"); return; }
    if (!items.length) { toast.error("Add a logo or image first"); return; }
    setExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = EXPORT_W;
      canvas.height = EXPORT_H + FOOTER_H;
      const ctx = canvas.getContext("2d");

      // Stage background + garment photo (object-contain, same as the preview)
      ctx.fillStyle = STAGE_BG;
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
      if (photoUrl) {
        const g = await loadImage(photoUrl);
        const r = containRect(g.naturalWidth, g.naturalHeight, EXPORT_W, EXPORT_H);
        ctx.drawImage(g, r.x, r.y, r.w, r.h);
      }

      // Artwork
      for (const it of items) {
        const img = await loadImage(it.src);
        ctx.drawImage(img, (it.x / 100) * EXPORT_W, (it.y / 100) * EXPORT_H, (it.w / 100) * EXPORT_W, (itemH(it) / 100) * EXPORT_H);
      }

      const logo = await loadImage("/logo.png").catch(() => null);

      // Watermark - the logo tiled diagonally across the garment AND the artwork
      if (watermark && logo) {
        const mark = makeWatermarkMark(logo);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, EXPORT_W, EXPORT_H);
        ctx.clip();
        ctx.globalAlpha = WATERMARK_OPACITY;
        ctx.translate(EXPORT_W / 2, EXPORT_H / 2);
        ctx.rotate(-Math.PI / 6);
        const lw = EXPORT_W * 0.28;
        const lh = lw * (mark.height / mark.width);
        const stepX = lw * 1.5, stepY = lh * 3;
        const span = Math.hypot(EXPORT_W, EXPORT_H);
        let row = 0;
        for (let y = -span; y < span; y += stepY, row++) {
          for (let x = -span + (row % 2) * (stepX / 2); x < span; x += stepX) ctx.drawImage(mark, x, y, lw, lh);
        }
        ctx.restore();
      }

      // Footer info strip
      const fy = EXPORT_H;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, fy, EXPORT_W, FOOTER_H);
      ctx.fillStyle = "#7bc67e";
      ctx.fillRect(0, fy, EXPORT_W, 8);
      if (logo) {
        const lh = 110, lw = lh * (logo.naturalWidth / logo.naturalHeight);
        ctx.drawImage(logo, 60, fy + 60, Math.min(lw, 420), lh * Math.min(1, 420 / lw));
      }
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "800 40px Nunito, Arial, sans-serif";
      ctx.fillText("DESIGN PROOF", 60, fy + 235);
      ctx.font = "400 26px Nunito, Arial, sans-serif";
      ctx.fillStyle = "#4b5563";
      ctx.fillText(`yourownprint.co.uk  ·  ${new Date().toLocaleDateString("en-GB")}`, 60, fy + 272);

      const lines = [
        details.customer && ["For", details.customer],
        ["Product", `${product.name}${product.sku ? ` (${product.sku})` : ""}`],
        colour && ["Colour", colour],
        ["Print", [details.position, details.size].filter(Boolean).join(" - ")],
        details.notes && ["Notes", details.notes],
      ].filter(Boolean);
      const colX = 620, maxW = EXPORT_W - colX - 60;
      let ly = fy + 78;
      for (const [label, value] of lines.slice(0, 5)) {
        ctx.font = "800 26px Nunito, Arial, sans-serif";
        ctx.fillStyle = "#1a1a1a";
        ctx.fillText(label, colX, ly);
        ctx.font = "400 26px Nunito, Arial, sans-serif";
        ctx.fillStyle = "#374151";
        let v = String(value);
        while (v.length > 1 && ctx.measureText(v).width > maxW - 130) v = v.slice(0, -2);
        ctx.fillText(v === String(value) ? v : `${v}…`, colX + 130, ly);
        ly += 44;
      }
      ctx.font = "400 20px Nunito, Arial, sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("Colours and placement are a guide - please check and approve before we print.", colX, fy + 272);

      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("export failed");
      const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `proof-${slug(details.customer || product.name)}${colour ? `-${slug(colour)}` : ""}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast.success("Proof downloaded");
    } catch (e) {
      toast.error("Couldn't create the proof - try a different photo or image file.");
    } finally {
      setExporting(false);
    }
  };

  const pa = product?.print_area;
  const ic = "w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#7bc67e]";

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-xs uppercase tracking-[0.2em] text-[#7bc67e] font-extrabold">Admin</div>
        <h1 className="font-nunito font-black text-4xl mt-1">Proof maker</h1>
        <p className="text-[#4b5563] mt-2 max-w-2xl">Put a customer's logo on any product, in any colour, and download a watermarked proof to send them.</p>

        <div className="mt-8 grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-8 items-start">
          {/* ---- Controls ---- */}
          <div className="space-y-4 min-w-0">
            <Card title="1. Product" hint="Search by name, brand or product code.">
              {product ? (
                <div className="flex items-center gap-3 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-xl p-2" data-testid="proof-selected-product">
                  {product.thumb && <img src={product.thumb} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold truncate">{product.name}</div>
                    <div className="text-[11px] text-[#4b5563] truncate">{[product.brand, product.sku].filter(Boolean).join(" · ")}</div>
                  </div>
                  <button onClick={() => { setProduct(null); setPhotoUrl(""); setColour(""); }} className="text-[#4b5563] hover:text-rose-500 p-1" title="Choose a different product" data-testid="proof-change-product"><X size={16} /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Gildan hoodie" className={ic + " pl-8"} data-testid="proof-search" autoFocus />
                  {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#7bc67e]" />}
                  {results.length > 0 && (
                    <div className="mt-2 border border-[#e5e7eb] rounded-xl divide-y divide-[#f3f4f6] max-h-80 overflow-y-auto" data-testid="proof-results">
                      {results.map((p) => (
                        <button key={p.id} onClick={() => pickProduct(p)} className="w-full flex items-center gap-3 p-2 text-left hover:bg-[#f9fafb]" data-testid={`proof-result-${p.id}`}>
                          <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-[#f0fdf4]" />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold truncate">{p.name}</span>
                            <span className="block text-[11px] text-[#4b5563] truncate">{[p.brand, p.sku].filter(Boolean).join(" · ")}{p.hidden ? " · hidden" : ""}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!searching && query.trim() && results.length === 0 && <div className="text-xs text-[#4b5563] mt-2">No products found.</div>}
                </div>
              )}
            </Card>

            {product && (
              <Card title="2. Colour" hint={(product.colors || []).length ? "Colours with a photo show the real garment in that colour." : "This product has no colour options - its main photo will be used."}>
                {(product.colors || []).length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full border border-[#e5e7eb] flex-shrink-0" style={{ background: colourObj?.hex || "#fff" }} />
                    <select value={colour} onChange={(e) => setColour(e.target.value)} className={ic} data-testid="proof-colour">
                      {product.colors.map((c) => <option key={c.name} value={c.name}>{c.name}{c.has_photo ? "" : " (no photo - uses main photo)"}</option>)}
                    </select>
                  </div>
                )}
              </Card>
            )}

            {product && (
              <Card title="3. Logo or artwork" hint="PNG with a transparent background looks best. Drag it on the garment to move it, and drag the corner to resize.">
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} className="hidden" data-testid="proof-file" />
                <button onClick={() => fileRef.current?.click()} className="w-full inline-flex items-center justify-center gap-2 border-2 border-dashed border-[#7bc67e] rounded-xl py-3 text-sm font-extrabold text-[#166534] hover:bg-[#f0fdf4]" data-testid="proof-add-image">
                  <ImagePlus size={16} /> {items.length ? "Add another image" : "Upload a logo or image"}
                </button>
                {items.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {items.map((it) => (
                      <div key={it.id} onClick={() => setSelectedId(it.id)} className={`flex items-center gap-2 rounded-xl p-2 border-2 cursor-pointer ${it.id === selectedId ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#f3f4f6]"}`}>
                        <img src={it.src} alt="" className="w-8 h-8 object-contain bg-white rounded flex-shrink-0" />
                        <span className="text-xs font-bold truncate flex-1">{it.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeItem(it.id); }} className="text-rose-500 p-1" title="Remove"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {selected && (
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-[#4b5563] mb-1"><span>Size</span><span>{Math.round(selected.w)}%</span></div>
                        <input type="range" min="3" max="120" step="0.5" value={selected.w} onChange={(e) => updateItem(selected.id, { w: Number(e.target.value) })} className="w-full accent-[#7bc67e]" data-testid="proof-size" />
                        <button onClick={centreSelected} className="mt-2 text-xs font-extrabold text-[#166534] inline-flex items-center gap-1 hover:underline"><Crosshair size={12} /> Centre in print area</button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {product && (
              <Card title="4. Proof details" hint="Optional - printed along the bottom of the proof.">
                <div className="space-y-2">
                  <input value={details.customer} onChange={(e) => setDetails({ ...details, customer: e.target.value })} placeholder="Customer or company name" className={ic} data-testid="proof-customer" />
                  <select value={details.position} onChange={(e) => setDetails({ ...details, position: e.target.value })} className={ic}>
                    {PRINT_POSITIONS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <input value={details.size} onChange={(e) => setDetails({ ...details, size: e.target.value })} placeholder="Print size, e.g. 28cm wide" className={ic} />
                  <input value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} placeholder="Notes, e.g. white print, 2 colours" className={ic} />
                </div>
              </Card>
            )}

            {product && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                  <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} className="w-4 h-4 accent-[#7bc67e]" data-testid="proof-watermark" />
                  Add Your Own Print watermark
                </label>
                <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                  <input type="checkbox" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} className="w-4 h-4 accent-[#7bc67e]" />
                  Show print area guide <span className="font-normal text-[#4b5563]">(not included in the proof)</span>
                </label>
                <button onClick={exportProof} disabled={exporting || !items.length} className="w-full inline-flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-black disabled:opacity-40 text-white font-extrabold rounded-full py-3" data-testid="proof-download">
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download proof (PNG)
                </button>
              </div>
            )}
          </div>

          {/* ---- Stage / preview ---- */}
          <div className="min-w-0">
            <div
              ref={stageRef}
              onPointerDown={() => setSelectedId(null)}
              className="relative w-full max-w-[560px] mx-auto rounded-2xl overflow-hidden border-2 border-[#e5e7eb] select-none touch-none"
              style={{ aspectRatio: "4 / 5", background: STAGE_BG }}
              data-testid="proof-stage"
            >
              {!product && (
                <div className="absolute inset-0 grid place-items-center text-center p-8 text-sm text-[#4b5563]">Search for a product on the left to start.</div>
              )}
              {product && photoUrl && <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" draggable={false} />}
              {product && photoLoading && <div className="absolute inset-0 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>}

              {product && showGuide && pa && (
                <div className="absolute border-2 border-dashed border-[#7bc67e]/70 rounded pointer-events-none" style={{ left: `${pa.x}%`, top: `${pa.y}%`, width: `${pa.w}%`, height: `${pa.h}%` }} />
              )}

              {items.map((it) => (
                <div
                  key={it.id}
                  onPointerDown={(e) => onPointerDown(e, it, "move")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className={`absolute cursor-move ${it.id === selectedId ? "outline outline-2 outline-[#7bc67e]" : ""}`}
                  style={{ left: `${it.x}%`, top: `${it.y}%`, width: `${it.w}%`, height: `${itemH(it)}%` }}
                  data-testid={`proof-item-${it.id}`}
                >
                  <img src={it.src} alt="" className="w-full h-full pointer-events-none" draggable={false} />
                  {it.id === selectedId && (
                    <span
                      onPointerDown={(e) => onPointerDown(e, it, "resize")}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      className="absolute -right-2 -bottom-2 w-4 h-4 bg-white border-2 border-[#7bc67e] rounded-full cursor-nwse-resize"
                      title="Drag to resize"
                    />
                  )}
                </div>
              ))}

              {/* Watermark preview - roughly matches what's drawn into the export */}
              {product && watermark && watermarkSrc && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="absolute"
                    style={{
                      left: "-50%", top: "-50%", width: "200%", height: "200%",
                      transform: "rotate(-30deg)",
                      // Each tile = logo (28% of stage width) plus the same gaps the export uses.
                      backgroundImage: `url(${watermarkSrc})`, backgroundRepeat: "space",
                      backgroundSize: "14% auto",
                      opacity: WATERMARK_OPACITY,
                    }}
                  />
                </div>
              )}
            </div>
            {product && <p className="text-center text-[11px] text-[#4b5563] mt-2">The downloaded proof also includes a strip along the bottom with your logo and the proof details.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, hint, children }) {
  return (
    <div className="bg-white border-2 border-[#eef2f7] rounded-2xl p-4">
      <div className="font-nunito font-black text-sm text-[#1a1a1a]">{title}</div>
      {hint && <div className="text-[11px] text-[#4b5563] mt-0.5 mb-3">{hint}</div>}
      {!hint && <div className="mt-3" />}
      {children}
    </div>
  );
}
