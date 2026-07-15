import React, { useEffect, useRef, useState } from "react";
import { Upload, X, RotateCw, Loader2 } from "lucide-react";

// Sensible default print-area boxes per placement (% of a square canvas) —
// used when there's no product photo to calibrate against, just a flat
// colour swatch. Roughly matches where each placement actually sits on a
// real garment, so the box shape alone gives the customer the right idea.
export const DEFAULT_PLACEMENT_AREAS = {
  "full-front":    { x: 22, y: 20, w: 56, h: 55 },
  "left-breast":   { x: 15, y: 18, w: 22, h: 22 },
  "right-breast":  { x: 63, y: 18, w: 22, h: 22 },
  "back-print":    { x: 22, y: 15, w: 56, h: 60 },
  "left-sleeve":   { x: 5,  y: 35, w: 15, h: 15 },
  "right-sleeve":  { x: 80, y: 35, w: 15, h: 15 },
  "left-pocket":   { x: 15, y: 58, w: 20, h: 15 },
  "right-pocket":  { x: 65, y: 58, w: 20, h: 15 },
  "neck-label":    { x: 20, y: 25, w: 60, h: 50 },
};

/**
 * SimplePrintCanvas — the one shared "position an image within a print area"
 * interaction, used both for the quick per-placement flow (background = a
 * flat colour) and reusable inside the full Design Your Own builder
 * (background = a real garment photo). Deliberately does NOT support
 * multiple items, text, rotation of the print area, or layering — that
 * complexity lives only in the full builder, not here.
 *
 * Props:
 *   background   — {type: "color", value: "#hex"} or {type: "image", value: url}
 *   printArea    — {x,y,w,h} as % — the boundary the artwork must stay within
 *   artworkUrl   — the customer's uploaded image (or null if none yet)
 *   onUpload(file) — called with the raw File when the customer picks one
 *   onClear()    — called to remove the current artwork
 *   busy         — shows a loading state (e.g. while uploading)
 */
export default function SimplePrintCanvas({ background, printArea, artworkUrl, onUpload, onClear, busy, size = 320 }) {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  // Position/scale of the artwork *within* the print area, as a fraction
  // (0-1) of the print area's own size — starts centred, fills the area.
  const [art, setArt] = useState({ x: 0.5, y: 0.5, scale: 0.9 });
  const dragRef = useRef(null);

  useEffect(() => { setArt({ x: 0.5, y: 0.5, scale: 0.9 }); }, [artworkUrl]);

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const areaWpx = (printArea.w / 100) * rect.width;
      const areaHpx = (printArea.h / 100) * rect.height;
      if (dragRef.current === "move") {
        setArt((a) => ({
          ...a,
          x: Math.min(Math.max(a.x + e.movementX / areaWpx, 0), 1),
          y: Math.min(Math.max(a.y + e.movementY / areaHpx, 0), 1),
        }));
      } else if (dragRef.current === "resize") {
        setArt((a) => ({
          ...a,
          scale: Math.min(Math.max(a.scale + e.movementX / areaWpx, 0.15), 1.5),
        }));
      }
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [printArea]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  return (
    <div>
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden select-none mx-auto border border-[#e5e7eb]"
        style={{
          width: "100%", maxWidth: size, aspectRatio: "1 / 1",
          background: background?.type === "color" ? background.value : "#f0fdf4",
        }}
        data-testid="simple-print-canvas"
      >
        {background?.type === "image" && (
          <img src={background.value} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" draggable={false} />
        )}

        {/* Print area boundary */}
        <div
          className="absolute border-2 border-dashed border-white/70"
          style={{ left: `${printArea.x}%`, top: `${printArea.y}%`, width: `${printArea.w}%`, height: `${printArea.h}%` }}
        >
          {artworkUrl ? (
            <div
              className="absolute cursor-move"
              style={{
                left: `${art.x * 100}%`, top: `${art.y * 100}%`,
                width: `${art.scale * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
              onMouseDown={(e) => { e.preventDefault(); dragRef.current = "move"; }}
              data-testid="print-canvas-artwork"
            >
              <img src={artworkUrl} alt="Your artwork" className="w-full h-auto pointer-events-none drop-shadow" draggable={false} />
              <div
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); dragRef.current = "resize"; }}
                className="absolute -right-1.5 -bottom-1.5 w-4 h-4 bg-[#7bc67e] rounded-full border-2 border-white cursor-nwse-resize"
                data-testid="print-canvas-resize-handle"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white bg-black/10 hover:bg-black/20 transition-colors"
              data-testid="print-canvas-upload-trigger"
            >
              {busy ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
              <span className="text-xs font-bold">Upload artwork</span>
            </button>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} data-testid="print-canvas-file-input" />

      {artworkUrl && (
        <div className="flex items-center justify-center gap-3 mt-2">
          <button type="button" onClick={() => setArt({ x: 0.5, y: 0.5, scale: 0.9 })} className="text-[11px] font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1">
            <RotateCw size={11} /> Re-centre
          </button>
          <button type="button" onClick={onClear} className="text-[11px] font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1">
            <X size={11} /> Remove
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[11px] font-extrabold text-[#166534] hover:underline">
            Replace file
          </button>
        </div>
      )}
    </div>
  );
}
