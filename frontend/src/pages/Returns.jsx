import React from "react";
import LegalPageLayout, { LegalSection } from "../components/bold/LegalPageLayout";

export default function Returns() {
  return (
    <LegalPageLayout title="Delivery, Returns & Refunds" updated="July 2026">
      <LegalSection title="Delivery">
        <p>
          We're based in Leicester and deliver across the whole of the UK. Dispatch times depend on
          the product and order size — bespoke and bulk orders (team kits, workwear, leavers hoodies)
          usually need a design proof approved first, which we'll always confirm with you before
          production starts.
        </p>
      </LegalSection>

      <LegalSection title="Personalised & custom items">
        <p>
          Almost everything we make is personalised to your order — your logo, your design, your
          names and numbers, your sizing. Because of this, once production has started, personalised
          orders generally can't be cancelled or returned just because you've changed your mind — this
          is standard across the UK for made-to-order goods, under the Consumer Contracts Regulations
          2013.
        </p>
        <p>
          If you need to change or cancel something, get in touch as soon as possible — if production
          hasn't started yet, we'll always try to help.
        </p>
      </LegalSection>

      <LegalSection title="If something's gone wrong">
        <p>We want every order to be right. If your order arrives and:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>it's faulty, damaged, or has a printing/embroidery error on our part</li>
          <li>it's the wrong size, colour, or design compared to what you ordered</li>
          <li>it hasn't arrived within a reasonable time and we haven't been in touch about a delay</li>
        </ul>
        <p>
          — contact us with your order details and, where possible, a photo. We'll sort it out with a
          reprint, replacement, or refund, whichever's right for the situation.
        </p>
      </LegalSection>

      <LegalSection title="Non-personalised items">
        <p>
          For any blank/non-personalised stock items, you have the standard 14-day right to change
          your mind, as long as the item is unused and in its original condition. Contact us to
          arrange a return.
        </p>
      </LegalSection>

      <LegalSection title="Get in touch">
        <p>
          Whatever the situation, the fastest way to sort it out is our{" "}
          <a href="/contact" className="text-[#7bc67e] font-bold">contact page</a> — tell us your
          order details and what's happened, and we'll take it from there.
        </p>
      </LegalSection>

      <p className="text-xs text-[#9ca3af] pt-4 border-t border-[#e5e7eb]">
        This page is a general starting-point template and isn't a substitute for professional legal
        advice. We'd recommend a quick review by a solicitor to make sure it fully fits your business
        before you rely on it.
      </p>
    </LegalPageLayout>
  );
}
