import React from "react";
import LegalPageLayout, { LegalSection } from "../components/bold/LegalPageLayout";

export default function Privacy() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="July 2026">
      <LegalSection title="1. Who we are">
        <p>
          Your Own Print ("we", "us") is based in Leicester, United Kingdom, and operates
          yourownprint.co.uk. This policy explains what personal data we collect, why, and how it's
          used and protected.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <ul className="list-disc pl-5 space-y-1">
          <li>Contact details you give us — name, email, phone number, delivery address</li>
          <li>Order details — what you've bought, sizes, design/artwork files you upload</li>
          <li>Account details, if you create one — email and a securely hashed password</li>
          <li>Payment information — handled entirely by Stripe; we never see or store full card details</li>
          <li>Basic technical data — pages visited, general usage, to help us keep the site working well</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Why we collect it">
        <ul className="list-disc pl-5 space-y-1">
          <li>To process and deliver your order</li>
          <li>To respond to enquiries and quote requests</li>
          <li>To send order confirmations and updates</li>
          <li>To improve the site and the products/services we offer</li>
          <li>To meet our legal and accounting obligations</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Who we share it with">
        <p>We use a small number of trusted service providers to run the business, including:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Stripe</strong> — payment processing</li>
          <li><strong>Resend</strong> — sending order and enquiry emails</li>
          <li><strong>Cloudflare (R2)</strong> — secure storage for uploaded artwork and product images</li>
          <li><strong>MongoDB Atlas</strong> — secure database hosting</li>
        </ul>
        <p>
          We don't sell your personal data to anyone, and we only share what's needed for these
          providers to do their job.
        </p>
      </LegalSection>

      <LegalSection title="5. How long we keep it">
        <p>
          We keep order and account information for as long as needed to fulfil legal, accounting, or
          reporting requirements (typically up to 6 years for financial records), and for as long as
          you keep an account with us.
        </p>
      </LegalSection>

      <LegalSection title="6. Your rights">
        <p>Under UK GDPR, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ask what personal data we hold about you</li>
          <li>Ask us to correct or delete it</li>
          <li>Ask us to restrict or object to certain processing</li>
          <li>Ask for your data in a portable format</li>
        </ul>
        <p>
          To exercise any of these, contact us via our{" "}
          <a href="/contact" className="text-[#7bc67e] font-bold">contact page</a>. You can also
          complain to the UK's Information Commissioner's Office (ICO) at ico.org.uk if you're
          unhappy with how we've handled your data.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>
          We use only the essential cookies/local storage needed to make the site function — for
          example, keeping you logged in and remembering your cart. We don't use third-party
          advertising trackers.
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
