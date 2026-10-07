import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import GroupKitBuilder, { BuilderTicks } from "../components/bold/GroupKitBuilder";
import usePageTitle from "../hooks/usePageTitle";

/** /sports-day/order - the sports day / house colours order builder (routers/group_kits.py page "sports-day"). */
export default function SportsDayOrder() {
  usePageTitle("Sports day, house & inter-school kit - order builder", { description: "Build your sports day, house colour or inter-school team order - sports tees, vests, polos, hoodies and caps for pupils and staff." });
  return (
    <div className="bg-white min-h-screen">
      <BoldNavbar />
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white font-nunito">
        <div className="absolute inset-0 opacity-40 bg-gradient-to-r from-[#dc2626] via-[#2563eb] to-[#16a34a]" />
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <Link to="/sports-day" className="text-xs text-[#fde68a] hover:underline">← Sports day, house & inter-school kit</Link>
          <h1 className="font-black text-4xl lg:text-6xl mt-2">Build your school sports order.</h1>
          <p className="text-zinc-200 mt-3 max-w-2xl">Add a colour for each house or team, your school badge on the front and the house or team name on the back - then sizes for pupils and staff.</p>
          <BuilderTicks items={["One order, every house or team colour", "Bulk discount on the whole school", "Card payment or school invoice"]} />
        </div>
      </header>
      <GroupKitBuilder page="sports-day" eventLabel="Event date (optional)" />
      <BoldFooter />
    </div>
  );
}
