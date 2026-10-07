import React from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import GroupKitBuilder, { BuilderTicks } from "../components/bold/GroupKitBuilder";
import usePageTitle from "../hooks/usePageTitle";

/** /school-trips/order - the school trip order builder (routers/group_kits.py page "school-trip"). */
export default function SchoolTripOrder() {
  usePageTitle("School trip order builder", { description: "Trip t-shirts, hoodies, polos, caps and hi-vis for the whole year group - adults and kids, your logo, free proof." });
  return (
    <div className="bg-white min-h-screen">
      <BoldNavbar />
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white font-nunito">
        <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-[#7bc67e] via-[#0ea5e9] to-[#1a1a1a]" />
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <Link to="/school-trips" className="text-xs text-[#7bc67e] hover:underline">← School trip t-shirts</Link>
          <h1 className="font-black text-4xl lg:text-6xl mt-2">Build your school trip order.</h1>
          <p className="text-zinc-300 mt-3 max-w-2xl">Tees, hoodies, sweatshirts, polos, caps and hi-vis for pupils and staff. Upload your logo or just type the wording, pick one bright colour and enter sizes - we send a free proof before printing.</p>
          <BuilderTicks items={["Adults + kids in one order", "Bulk discount on the whole order", "Card payment or school invoice"]} />
        </div>
      </header>
      <GroupKitBuilder page="school-trip" eventLabel="Trip date (optional)" />
      <BoldFooter />
    </div>
  );
}
