import React, { useEffect, useRef, useState } from "react";
import { fetchTrustedLogos, mediaUrl } from "../../lib/api";

/**
 * "Trusted by" - customer logos in a carousel on the homepage (like the old
 * site). Logos are managed in Admin > Photo gallery > Trusted by logos.
 * Scrolls gently on its own on every screen size, can be swiped/dragged by
 * hand, pauses while touched or hovered. For "reduce motion" it doesn't move
 * by itself but still swipes. The row is doubled so it loops seamlessly.
 */
export default function TrustedBy({ className = "" }) {
  const [logos, setLogos] = useState([]);
  const ref = useRef(null);
  const paused = useRef(false);
  const resumeAt = useRef(0);
  useEffect(() => { fetchTrustedLogos().then(setLogos).catch(() => setLogos([])); }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || logos.length === 0) return undefined;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return undefined;
    let raf; let last = performance.now(); let pos = el.scrollLeft;
    const tick = (now) => {
      const dt = Math.min(64, now - last); last = now;
      if (!paused.current && now > resumeAt.current) {
        const half = el.scrollWidth / 2;
        pos = (Math.abs(el.scrollLeft - pos) > 2 ? el.scrollLeft : pos) + dt * 0.04; // ~40px a second
        if (pos >= half) pos -= half;
        el.scrollLeft = pos;
      } else {
        pos = el.scrollLeft;
        if (pos >= el.scrollWidth / 2) { pos -= el.scrollWidth / 2; el.scrollLeft = pos; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [logos]);

  if (!logos.length) return null;
  const row = [...logos, ...logos];
  const hold = () => { paused.current = true; };
  const release = () => { paused.current = false; resumeAt.current = performance.now() + 2500; };
  return (
    <section className={`py-12 ${className}`} data-testid="trusted-by">
      <h2 className="text-center font-nunito font-black text-3xl lg:text-4xl text-[#1a1a1a]">Trusted by</h2>
      <div className="mx-auto mt-3 h-1 w-24 rounded-full bg-[#7bc67e]" />
      <div
        ref={ref}
        onMouseEnter={hold} onMouseLeave={release} onTouchStart={hold} onTouchEnd={release}
        className="mt-8 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="trusted-by-track"
      >
        {row.map((l, i) => (
          <div key={i} className="w-32 h-32 sm:w-44 sm:h-44 flex-shrink-0 rounded-2xl overflow-hidden bg-white border border-[#eef2f7]" aria-hidden={i >= logos.length}>
            <img src={mediaUrl(l.image)} alt={i < logos.length ? l.name : ""} title={l.name} loading="lazy" draggable="false" className="w-full h-full object-cover select-none" />
          </div>
        ))}
      </div>
    </section>
  );
}
