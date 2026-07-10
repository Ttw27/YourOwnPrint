import React from "react";
import LegalPageLayout, { LegalSection } from "../components/bold/LegalPageLayout";

export default function Terms() {
  return (
    <LegalPageLayout title="Terms & Conditions" updated="July 2026">
      <LegalSection title="1. Who we are">
        <p>
          Your Own Print is a custom print and workwear business based in Leicester, United Kingdom,
          trading at yourownprint.co.uk. We supply personalised and printed clothing — including
          workwear, uniforms, team kits, school leavers hoodies, and custom designs — to customers
          across the whole of the UK.
        </p>
      </LegalSection>

      <LegalSection title="2. Orders and pricing">
        <p>
          All prices shown on the site are in GBP and include VAT where applicable. We reserve the
          right to correct pricing errors before an order is confirmed. An order is only accepted
          once payment has been successfully processed and you receive an order confirmation.
        </p>
      </LegalSection>

      <LegalSection title="3. Artwork, designs and personalisation">
        <p>
          Where you upload artwork, a logo, or use our design tools to personalise a product, you
          confirm that you own the rights to that artwork or have permission to use it, and that it
          doesn't infringe anyone else's intellectual property or contain unlawful content. We may
          refuse to print artwork we reasonably believe breaches this.
        </p>
        <p>
          We'll only proceed to print once any required artwork proof has been approved by you (where
          a proof stage applies to your order).
        </p>
      </LegalSection>

      <LegalSection title="4. Your right to cancel — please read this carefully">
        <p>
          Under the Consumer Contracts Regulations 2013, online shoppers normally have a 14-day right
          to cancel an order. However, this right <strong>does not apply</strong> to goods that are
          made to your specification or clearly personalised — which covers the vast majority of what
          we produce (custom printed or embroidered items, named/numbered kit, bespoke designs, etc.).
        </p>
        <p>
          In practice, this means once we've begun producing your personalised order, it generally
          can't be cancelled or returned simply because you've changed your mind. For blank,
          non-personalised stock items, the standard 14-day cancellation right does apply — contact us
          and we'll talk you through it.
        </p>
      </LegalSection>

      <LegalSection title="5. Faulty, damaged, or incorrect items">
        <p>
          This doesn't affect your statutory rights. If an item arrives faulty, damaged, or different
          from what you ordered (wrong size, wrong design, printing error on our part), contact us —
          we'll put it right with a reprint, replacement, or refund as appropriate.
        </p>
      </LegalSection>

      <LegalSection title="6. Delivery">
        <p>
          We aim to dispatch orders within the timeframe stated at checkout or agreed with you
          directly for bespoke/bulk orders. Delivery times are estimates, not guarantees — factors
          like design proofing, order size, and courier delays can affect them. We'll keep you updated
          if anything is going to take longer than expected.
        </p>
      </LegalSection>

      <LegalSection title="7. Liability">
        <p>
          We aren't liable for indirect or consequential losses arising from delays or issues with an
          order, beyond the value of the order itself, except where the law doesn't allow us to limit
          liability (for example, for death or personal injury caused by our negligence).
        </p>
      </LegalSection>

      <LegalSection title="8. Governing law">
        <p>These terms are governed by the laws of England and Wales.</p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Questions about an order or these terms? Get in touch via our{" "}
          <a href="/contact" className="text-[#7bc67e] font-bold">contact page</a>.
        </p>
      </LegalSection>

      <p className="text-xs text-[#9ca3af] pt-4 border-t border-[#e5e7eb]">
        This page is a general starting-point template for a UK personalised-goods business and isn't
        a substitute for professional legal advice. We'd recommend a quick review by a solicitor to
        make sure it fully fits your business before you rely on it.
      </p>
    </LegalPageLayout>
  );
}
