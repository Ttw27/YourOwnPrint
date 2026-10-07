import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Wrench } from "lucide-react";
import { api } from "../../lib/api";
import { useSiteImages } from "../../hooks/usePageCopy";

/**
 * "Build your kit" promos for the order builders, so they aren't only reachable
 * from one hero button:
 *   <KitBuilderBanner builder="dance" />  wide card under a sport page's trust strip
 *   <KitBuilderTile builder="dance" />    first card in a sport page's product grid
 *   <KitBuildersRow />                    homepage row, one tile per builder
 * Photos: real garment photos (/api/kit-builders/photos) or the kit photos in
 * public/kits; each can be replaced in Admin > Page copy > "Pictures used across
 * the whole site" (builder:<key>).
 */
export const KIT_BUILDERS = {
  team: { title: "Team kits", who: "Football & rugby clubs", to: "/full-squad-configurator", cta: "Build your squad's kit",
    headline: "Kit out the whole squad in one go", image: "/kits/classic-black.jpg",
    steps: ["Pick your kit & colours", "Add your badge & sponsor", "Names, numbers & sizes"] },
  gym: { title: "Gym & fight club kit", who: "Gyms, PTs, boxing & martial arts", to: "/sports-outfit-configurator", cta: "Build your club's kit",
    headline: "Kit out your gym or club in one go", image: "/kits/training-black.jpg",
    steps: ["Pick tops, hoodies & joggers", "Your logo - included", "Names & sizes for everyone"] },
  dance: { title: "Dance studio kit", who: "Dance schools & crews", to: "/dance-studio-kit", cta: "Build your studio kit",
    headline: "Kit out the whole studio in one go",
    steps: ["Pick tops, bottoms & hoodies", "Your studio logo - included", "Dancers' names & sizes"] },
  "school-trip": { title: "School trip tops", who: "Trips, residentials & events", to: "/school-trips", cta: "Build your school order",
    headline: "Matching tops for the whole trip", steps: ["Pick tees, hoodies or caps", "Add your school badge", "Kids & staff sizes"] },
  "sports-day": { title: "Sports day & house kit", who: "House colours & inter-school", to: "/sports-day", cta: "Build your school sports order",
    headline: "Every house colour, one order", steps: ["A colour per house", "Badge front, house name back", "Kids & staff sizes"] },
  leavers: { title: "Leavers hoodies", who: "Year 6, Year 11 & sixth form", to: "/leavers-hoodies", cta: "Design your leavers hoodies",
    headline: "Leavers hoodies with every name", steps: ["Pick a hoodie & colour", "Choose or upload a design", "Names & sizes"] },
};

let _photos = null;
function useBuilderPhotos() {
  const [photos, setPhotos] = React.useState(_photos || {});
  React.useEffect(() => {
    if (_photos) return;
    api.get("/kit-builders/photos").then(({ data }) => { _photos = data || {}; setPhotos(_photos); }).catch(() => {});
  }, []);
  return photos;
}
function useBuilderImage(key) {
  const site = useSiteImages();
  const photos = useBuilderPhotos();
  return site.image(`builder:${key}`, KIT_BUILDERS[key]?.image || photos[key] || "");
}

export function KitBuilderBanner({ builder }) {
  const b = KIT_BUILDERS[builder];
  const img = useBuilderImage(builder);
  if (!b) return null;
  return (
    <section className="max-w-7xl mx-auto px-6 pt-10" data-testid={`kit-builder-banner-${builder}`}>
      <div className="bg-[#1a1a1a] text-white rounded-3xl overflow-hidden grid md:grid-cols-[1.5fr_1fr] items-stretch">
        <div className="p-7 sm:p-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#7bc67e] text-[#1a1a1a] font-extrabold rounded-full text-xs"><Wrench size={13} /> The easy way to order</div>
          <h2 className="font-black text-2xl sm:text-3xl mt-3 leading-tight">{b.headline}</h2>
          <ol className="mt-5 grid sm:grid-cols-3 gap-3">
            {b.steps.map((s, i) => (
              <li key={s} className="bg-white/5 border border-white/10 rounded-2xl p-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-[#7bc67e] text-[#1a1a1a] font-black text-xs inline-grid place-items-center mr-1">{i + 1}</span> {s}
              </li>
            ))}
          </ol>
          <Link to={b.to} className="mt-6 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-white text-[#1a1a1a] font-extrabold rounded-full px-6 py-3.5 transition" data-testid={`kit-builder-banner-cta-${builder}`}>
            {b.cta} <ArrowRight size={16} />
          </Link>
          <div className="text-xs text-zinc-400 mt-3">Free proof before we print · pay by card or get a quote</div>
        </div>
        <div className="bg-white hidden sm:flex items-center justify-center p-6">
          {img && <img src={img} alt={b.title} loading="lazy" className="max-h-64 w-auto object-contain" />}
        </div>
      </div>
    </section>
  );
}

export function KitBuilderTile({ builder }) {
  const b = KIT_BUILDERS[builder];
  if (!b) return null;
  return (
    <Link to={b.to} className="group bg-[#1a1a1a] text-white rounded-3xl p-5 flex flex-col justify-between border-2 border-[#1a1a1a] hover:border-[#7bc67e] transition" data-testid={`kit-builder-tile-${builder}`}>
      <div>
        <Wrench className="text-[#7bc67e]" size={22} />
        <div className="font-black text-lg sm:text-xl mt-3 leading-tight">Easier: build the whole kit in one go</div>
        <p className="text-xs sm:text-sm text-zinc-300 mt-2">{b.steps.join(" · ")}. Free proof before we print.</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-extrabold text-[#7bc67e] group-hover:translate-x-0.5 transition-transform">{b.cta} <ArrowRight size={14} /></span>
    </Link>
  );
}

function RowTile({ k }) {
  const b = KIT_BUILDERS[k];
  const img = useBuilderImage(k);
  return (
    <Link to={b.to} className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition hover:shadow-md" data-testid={`kit-builders-row-${k}`}>
      <div className="aspect-square bg-white">{img && <img src={img} alt={b.title} loading="lazy" className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500" />}</div>
      <div className="p-4 border-t border-[#dcfce7]">
        <div className="font-black leading-tight">{b.title}</div>
        <div className="text-xs text-[#4b5563] mt-0.5">{b.who}</div>
        <div className="text-xs font-extrabold text-[#16a34a] mt-2 inline-flex items-center gap-1">Build it <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" /></div>
      </div>
    </Link>
  );
}

export function KitBuildersRow() {
  return (
    <section className="max-w-7xl mx-auto px-6 pb-16" data-testid="kit-builders-row">
      <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold text-center">Kit builders</div>
      <h2 className="font-nunito font-black text-4xl lg:text-5xl text-center mt-2">Build your whole kit in one go</h2>
      <p className="text-center text-[#4b5563] mt-3 max-w-2xl mx-auto">Pick the garments, add your logo, then everyone's names and sizes - one order, one proof, done.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-10">
        {Object.keys(KIT_BUILDERS).map((k) => <RowTile key={k} k={k} />)}
      </div>
    </section>
  );
}
