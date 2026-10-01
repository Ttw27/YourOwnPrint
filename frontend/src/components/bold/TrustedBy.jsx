import React, { useEffect, useState } from "react";
import { fetchTrustedLogos, mediaUrl } from "../../lib/api";

/**
 * "Trusted by" - customer logos scrolling gently across the homepage (like the
 * old site). Logos are managed in Admin > Photo gallery > Trusted by logos.
 * Renders nothing until at least one logo is set. The row is doubled so the
 * scroll loops seamlessly; it pauses on hover and stays still for people who
 * prefer reduced motion.
 */
export default function TrustedBy({ className = "" }) {
  const [logos, setLogos] = useState([]);
  useEffect(() => { fetchTrustedLogos().then(setLogos).catch(() => setLogos([])); }, []);
  if (!logos.length) return null;
  const row = [...logos, ...logos];
  const secs = Math.max(20, logos.length * 4);
  return (
    <section className={`py-12 ${className}`} data-testid="trusted-by">
      <h2 className="text-center font-nunito font-black text-3xl lg:text-4xl text-[#1a1a1a]">Trusted by</h2>
      <div className="mx-auto mt-3 h-1 w-24 rounded-full bg-[#7bc67e]" />
      <div className="mt-8 overflow-hidden group" style={{ maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}>
        <div className="flex gap-4 w-max yop-marquee group-hover:[animation-play-state:paused]" style={{ animationDuration: `${secs}s` }}>
          {row.map((l, i) => (
            <div key={i} className="w-36 h-36 sm:w-44 sm:h-44 flex-shrink-0 rounded-2xl overflow-hidden bg-white border border-[#eef2f7]" aria-hidden={i >= logos.length}>
              <img src={mediaUrl(l.image)} alt={i < logos.length ? l.name : ""} title={l.name} loading="lazy" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes yop-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .yop-marquee { animation: yop-marquee linear infinite; }
        @media (prefers-reduced-motion: reduce) { .yop-marquee { animation: none; flex-wrap: wrap; justify-content: center; width: auto; } }
      `}</style>
    </section>
  );
}
