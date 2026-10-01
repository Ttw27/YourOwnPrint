import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, mediaUrl } from "../../lib/api";

// Letter colours of the old site's "YOUR OWN PRINT" banner lettering.
const LETTERS = [
  ["Y", "#f07c74"], ["O", "#d9b36b"], ["U", "#9ed9d6"], ["R", "#4fb3c8"], [" ", ""],
  ["O", "#e6bf55"], ["W", "#f4a3b6"], ["N", "#3f3f46"], [" ", ""],
  ["P", "#f07c74"], ["R", "#f4a3b6"], ["I", "#4fb3c8"], ["N", "#9ed9d6"], ["T", "#e6bf55"],
];

/**
 * Homepage "Design it yourself" banner - a real screenshot of our designer on
 * the left (swap it in Admin > Page Copy > Home, image "designer:banner"),
 * the old site's lettering + Design Now button on the right. The "from" price
 * is read live from the Personalised T-Shirt.
 */
export default function DesignerBanner({ image }) {
  const [from, setFrom] = useState(null);
  useEffect(() => {
    api.get("/products/personalised-tee").then(({ data }) => setFrom(Number(data.price) || null)).catch(() => {});
  }, []);
  return (
    <section className="bg-white border-y border-[#eef2f7]" data-testid="home-designer-banner">
      <div className="max-w-7xl mx-auto px-6 py-14 grid lg:grid-cols-[1.25fr_1fr] gap-10 items-center">
        <Link to="/design" className="block min-w-0 rounded-2xl overflow-hidden border-2 border-[#eef2f7] shadow-sm hover:shadow-md transition-shadow" aria-label="Open the designer">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#f8fafc] border-b border-[#eef2f7]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f87171]" /><span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" /><span className="w-2.5 h-2.5 rounded-full bg-[#4ade80]" />
            <span className="ml-3 text-[11px] text-[#9ca3af] font-bold truncate">yourownprint.co.uk/design</span>
          </div>
          <img src={mediaUrl(image)} alt="Our online designer - a logo placed on a navy t-shirt" loading="lazy" className="w-full h-auto block" />
        </Link>
        <div className="text-center min-w-0">
          <div className="font-nunito font-black text-xl sm:text-2xl tracking-wide text-[#1a1a1a]">DESIGN IT YOURSELF WITH</div>
          <div className="mt-1 font-black tracking-tight leading-none whitespace-nowrap" style={{ fontSize: "clamp(1.8rem, 8.5vw, 3.75rem)" }} aria-label="Your Own Print">
            {LETTERS.map(([l, c], i) => <span key={i} style={{ color: c }}>{l === " " ? " " : l}</span>)}
          </div>
          <div className="mt-6 inline-block bg-[#f3f4f6] px-6 py-4 font-nunito font-extrabold text-lg sm:text-xl leading-snug">
            YOU DESIGN IT<br />YOUR WAY<br />{from ? `T-SHIRTS FROM £${from.toFixed(2)}` : "T-SHIRTS, HOODIES & MORE"}
          </div>
          <p className="mt-6 text-[#374151] font-bold text-lg max-w-md mx-auto">Design in our easy-to-use designer - add your own text, images, photos and more on a wide range of clothing and accessories.</p>
          <Link to="/design" data-testid="home-design-cta" className="mt-7 inline-block bg-[#f07c74] hover:bg-[#e8645b] text-white font-black text-2xl tracking-wide px-10 py-4 transition-colors">
            DESIGN NOW
          </Link>
        </div>
      </div>
    </section>
  );
}
