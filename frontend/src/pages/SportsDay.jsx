import React from "react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import GroupKitBuilder, { BuilderTicks } from "../components/bold/GroupKitBuilder";
import usePageTitle from "../hooks/usePageTitle";
import { Trophy, Palette, Users } from "lucide-react";

/** /sports-day - sports day & inter-house kit (routers/group_kits.py page "sports-day", house colours). */
export default function SportsDay() {
  usePageTitle("Sports day & house t-shirts", { description: "House colour sports t-shirts, vests and hoodies for sports day and inter-house competitions - adults and kids, your school logo, house names on the back." });
  return (
    <div className="bg-white min-h-screen">
      <BoldNavbar />
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white font-nunito">
        <div className="absolute inset-0 opacity-40 bg-gradient-to-r from-[#dc2626] via-[#2563eb] to-[#16a34a]" />
        <div className="relative max-w-7xl mx-auto px-6 py-14">
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#fde68a]">Sports day · house competitions · inter-school sport</span>
          <h1 className="font-black text-4xl lg:text-6xl mt-2 max-w-4xl">House colours for the whole school, in one order.</h1>
          <p className="text-zinc-200 mt-3 max-w-2xl">Wicking sports tees, vests, polos and hoodies in every house colour - your school badge on the front and the house name on the back. Pupils and staff, adults and kids sizes.</p>
          <BuilderTicks items={["One order, every house colour", "Bulk discount on the whole school", "Free proof before printing"]} />
        </div>
      </header>
      <section className="max-w-6xl mx-auto px-6 pt-10 grid sm:grid-cols-3 gap-4 font-nunito text-[#1a1a1a]">
        {[[Palette, "Every house colour", "Add a colour for each house - red, blue, green, yellow... each with its own sizes."], [Trophy, "Built for sport", "AWDis Cool wicking tees and vests that stay light all day."], [Users, "Pupils + staff", "Kids sizes from age 3 and adult sizes, plus matching staff hoodies or polos."]].map(([I, t, d]) => (
          <div key={t} className="bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-4"><I className="text-[#16a34a]" size={22} /><div className="font-black mt-2">{t}</div><div className="text-sm text-[#4b5563] mt-1">{d}</div></div>
        ))}
      </section>
      <GroupKitBuilder page="sports-day" eventLabel="Event date (optional)" />
      <BoldFooter />
    </div>
  );
}
