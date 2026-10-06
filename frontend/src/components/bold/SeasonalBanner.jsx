import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { OCCASIONS, currentOccasion } from "../../lib/occasions";

/** Homepage strip that changes with the season: leavers (Jan-Mar), Christmas
 *  (Oct-Dec), back to school (Aug-Sep), stag & hen (Apr-Jul). */
export default function SeasonalBanner() {
  const m = new Date().getMonth() + 1;
  const slug = m <= 3 ? null : currentOccasion();
  const o = slug ? OCCASIONS[slug] : null;
  const b = o
    ? { kicker: o.kicker, title: o.title, to: `/occasions/${slug}`, accent: o.accent }
    : { kicker: "Leavers season", title: "Leavers hoodies for the class of " + new Date().getFullYear() + " - order now for summer.", to: "/leavers-hoodies", accent: "from-[#7bc67e] via-[#0ea5e9] to-[#1a1a1a]" };
  return (
    <section className="px-6 my-10" data-testid="seasonal-banner">
      <Link to={b.to} className="group relative block max-w-6xl mx-auto overflow-hidden rounded-[2rem] bg-[#1a1a1a] text-white">
        <div className={`absolute inset-0 opacity-50 bg-gradient-to-r ${b.accent}`} />
        <div className="relative px-8 py-8 sm:px-12 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#bbf7d0]">{b.kicker}</div>
            <div className="font-black text-2xl lg:text-3xl mt-1 max-w-2xl">{b.title}</div>
          </div>
          <span className="inline-flex items-center gap-2 bg-[#7bc67e] text-[#1a1a1a] font-extrabold px-5 py-3 rounded-full group-hover:bg-white transition self-start sm:self-auto whitespace-nowrap">See ideas <ArrowRight size={16} /></span>
        </div>
      </Link>
    </section>
  );
}
