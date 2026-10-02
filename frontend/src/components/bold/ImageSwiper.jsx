import React, { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mediaUrl } from "../../lib/api";

/**
 * Swipe / arrow through several photos of one job (front, back, close-ups).
 * Native horizontal scroll with snap, so phones swipe naturally; arrows and
 * dots for mouse users. With one photo it's just the image.
 * Arrow clicks don't bubble, so a card can still open the full-size view.
 */
// How a photo sits in its frame (set in Admin > Photo gallery > Position):
// focus point x/y in % + fit "cover" (fill, crop around the focus) or "contain".
export function photoStyle(meta) {
  if (!meta) return undefined;
  if (meta.fit === "contain") return { objectFit: "contain" };
  const pos = `${meta.x ?? 50}% ${meta.y ?? 50}%`;
  const z = Number(meta.zoom) || 1;
  return { objectFit: "cover", objectPosition: pos, ...(z > 1 ? { transform: `scale(${z})`, transformOrigin: pos } : {}) };
}

// size: "thumb" (cards) or "web" (full-size view) - the web-ready copies made
// on upload; falls back to the original photo when a copy doesn't exist yet.
export default function ImageSwiper({ images = [], meta = [], alt = "", imgClassName = "w-full h-full object-cover", className = "", size }) {
  const list = images.filter(Boolean).map((u, i) => (size && meta[i] && meta[i][size]) || u);
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  if (list.length <= 1) {
    return <img src={mediaUrl(list[0])} alt={alt} className={imgClassName} style={photoStyle(meta[0])} loading="lazy" decoding="async" draggable="false" />;
  }
  const go = (e, dir) => {
    e.stopPropagation(); e.preventDefault();
    const el = ref.current; if (!el) return;
    const next = Math.max(0, Math.min(list.length - 1, idx + dir));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };
  const btn = "absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full grid place-items-center bg-white/90 text-[#1a1a1a] shadow hover:bg-white transition z-10";
  return (
    <div className={`relative w-full h-full group/sw ${className}`} data-testid="image-swiper">
      <div
        ref={ref}
        onScroll={(e) => { const el = e.currentTarget; setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
        className="w-full h-full flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {list.map((src, i) => (
          <div key={i} className="w-full h-full flex-shrink-0 snap-center overflow-hidden">
            <img src={mediaUrl(src)} alt={`${alt}${list.length > 1 ? ` - photo ${i + 1}` : ""}`} className={imgClassName} style={photoStyle(meta[i])} loading="lazy" decoding="async" draggable="false" />
          </div>
        ))}
      </div>
      {idx > 0 && <button type="button" aria-label="Previous photo" onClick={(e) => go(e, -1)} className={`${btn} left-2`}><ChevronLeft size={16} /></button>}
      {idx < list.length - 1 && <button type="button" aria-label="Next photo" onClick={(e) => go(e, 1)} className={`${btn} right-2`}><ChevronRight size={16} /></button>}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 bg-black/45 rounded-full px-2 py-1" aria-hidden="true">
        {list.map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/45"}`} />)}
      </div>
    </div>
  );
}
