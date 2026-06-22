import React from "react";
import Theme1Industrial from "../components/themes/Theme1Industrial";
import Theme2Clean from "../components/themes/Theme2Clean";
import Theme3Bold from "../components/themes/Theme3Bold";
import Theme4Premium from "../components/themes/Theme4Premium";

export default function ThemeShowcase() {
  return (
    <div data-testid="theme-showcase">
      {/* Sticky pick-a-theme banner at very top */}
      <div className="bg-black text-white border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs uppercase tracking-[0.3em] text-neutral-400">Your Own Print — Theme Showcase</div>
          <div className="flex gap-2 text-xs">
            <a href="#theme-1" className="px-3 py-1.5 bg-[#ff6b35] text-black font-bold uppercase tracking-wider hover:opacity-90">1 Industrial</a>
            <a href="#theme-2" className="px-3 py-1.5 bg-[#0066ff] text-white font-bold uppercase tracking-wider hover:opacity-90">2 Clean</a>
            <a href="#theme-3" className="px-3 py-1.5 bg-[#7bc67e] text-black font-bold uppercase tracking-wider hover:opacity-90">3 Bold</a>
            <a href="#theme-4" className="px-3 py-1.5 bg-[#c9a84c] text-black font-bold uppercase tracking-wider hover:opacity-90">4 Premium</a>
          </div>
        </div>
      </div>

      <div id="theme-1"><Theme1Industrial inShowcase={true} themeNumber={1} /></div>
      <div id="theme-2"><Theme2Clean inShowcase={true} themeNumber={2} /></div>
      <div id="theme-3"><Theme3Bold inShowcase={true} themeNumber={3} /></div>
      <div id="theme-4"><Theme4Premium inShowcase={true} themeNumber={4} /></div>
    </div>
  );
}
