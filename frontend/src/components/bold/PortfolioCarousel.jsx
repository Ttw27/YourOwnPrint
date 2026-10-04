import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchPortfolio, mediaUrl } from "../../lib/api";
import { ChevronLeft, ChevronRight, Loader2, Image as ImageIcon } from "lucide-react";
import { WhatsAppInline } from "./WhatsAppFAB";
import ImageSwiper from "./ImageSwiper";

/**
 * Horizontally scrollable carousel of portfolio images filtered by category.
 * Admin manages ordering + captions via /admin/portfolio. When no items exist
 * for the category, renders an inline "Send us photos" prompt (fallback CTA).
 */
export default function PortfolioCarousel({
  category,
  title = "See it in action",
  eyebrow = "Real work",
  emptyCTA = "Got photos to share? Send them over - we'll feature them here.",
  emptyPreset = "Hi! I've got photos to share for your portfolio.",
  className = "",
  testid = "portfolio-carousel",
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const scroller = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPortfolio({ category, limit: 40 })
      .then((d) => { if (alive) setItems(d?.items || []); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [category]);

  const canScroll = items.length > 2;
  const scroll = (dir) => {
    if (!scroller.current) return;
    scroller.current.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className={`bg-white border-2 border-[#dcfce7] rounded-3xl p-5 grid place-items-center ${className}`} data-testid={testid}>
        <Loader2 className="animate-spin text-[#7bc67e]" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`bg-white border-2 border-[#dcfce7] rounded-3xl p-5 ${className}`} data-testid={`${testid}-empty`}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#7bc67e] font-extrabold">{eyebrow}</div>
            <h3 className="font-nunito font-extrabold text-lg mt-1">{title}</h3>
          </div>
        </div>
        <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-4 flex items-start gap-3">
          <ImageIcon size={22} className="text-[#7bc67e] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-nunito font-extrabold text-[#1a1a1a]">Be one of our first features here</div>
            <div className="text-xs text-[#4b5563] mt-0.5">{emptyCTA}</div>
          </div>
          <WhatsAppInline preset={emptyPreset} label="Send" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border-2 border-[#dcfce7] rounded-3xl p-5 ${className}`} data-testid={testid}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#7bc67e] font-extrabold">{eyebrow}</div>
          <h3 className="font-nunito font-extrabold text-lg mt-1">{title}</h3>
        </div>
        {canScroll && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll(-1)}
              className="w-9 h-9 grid place-items-center rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a]"
              aria-label="Scroll left"
              data-testid={`${testid}-prev`}
            ><ChevronLeft size={16} /></button>
            <button
              onClick={() => scroll(1)}
              className="w-9 h-9 grid place-items-center rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a]"
              aria-label="Scroll right"
              data-testid={`${testid}-next`}
            ><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      <div
        ref={scroller}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid={`${testid}-scroller`}
      >
        {items.map((it) => (
          <div
            key={it.id}
            role="button"
            tabIndex={0}
            onClick={() => setLightbox(it)}
            onKeyDown={(e) => { if (e.key === "Enter") setLightbox(it); }}
            className="group relative cursor-pointer flex-shrink-0 w-64 md:w-72 aspect-square overflow-hidden rounded-2xl bg-[#f0fdf4] border border-[#dcfce7] hover:border-[#7bc67e] snap-start"
            data-testid={`${testid}-item-${it.id}`}
          >
            {/* Every photo of the job (swipe / arrows), web-ready copies, positioned as set in admin */}
            <ImageSwiper images={it.images || [it.image_url]} meta={it.image_meta || []} size="thumb" alt={it.alt_text || it.title} imgClassName="w-full h-full object-cover" />
            {(it.images || []).length > 1 && (
              <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-extrabold rounded-full px-2 py-0.5 pointer-events-none">{it.images.length} photos</span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 via-black/20 to-transparent text-left pointer-events-none">
              <div className="text-white text-xs font-extrabold leading-tight line-clamp-2">{it.title}</div>
            </div>
          </div>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4"
          onClick={() => setLightbox(null)}
          data-testid={`${testid}-lightbox`}
        >
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="w-full h-[70vh] rounded-2xl bg-white overflow-hidden">
              <ImageSwiper images={lightbox.images || [lightbox.image_url]} meta={(lightbox.image_meta || []).map((m) => ({ ...m, fit: "contain", zoom: 1 }))} size="web" alt={lightbox.alt_text || lightbox.title} imgClassName="w-full h-full object-contain" />
            </div>
            {(lightbox.images || []).length > 1 && <div className="text-zinc-400 text-xs mt-2">Swipe or use the arrows to see all {lightbox.images.length} photos</div>}
            {lightbox.title && (
              <div className="text-white mt-3">
                <div className="font-black text-lg">{lightbox.title}</div>
                {lightbox.caption && <p className="text-zinc-300 text-sm mt-1">{lightbox.caption}</p>}
              </div>
            )}
            <button
              onClick={() => setLightbox(null)}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs text-white"
              data-testid={`${testid}-lightbox-close`}
            >Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
