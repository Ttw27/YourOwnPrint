import React from "react";
import { BoldNavbar, BoldFooter } from "./BoldLayout";

export default function LegalPageLayout({ title, updated, children }) {
  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <div className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="font-black text-3xl lg:text-4xl">{title}</h1>
        {updated && <p className="text-xs text-[#4b5563] mt-2">Last updated: {updated}</p>}
        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-[#374151]">
          {children}
        </div>
      </div>
      <BoldFooter />
    </div>
  );
}

export function LegalSection({ title, children }) {
  return (
    <section>
      <h2 className="font-extrabold text-lg text-[#1a1a1a] mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
