import React, { useEffect, useState } from "react";
import { HelpCircle, X, Info } from "lucide-react";
import { fetchSiteWhatsApp } from "../../lib/api";

/**
 * Floating help button — bottom-left (so it doesn't collide with the WhatsApp FAB
 * on the bottom-right). Opens a compact modal explaining how the Designer works
 * with a direct WhatsApp CTA using the site-configured number.
 */
export default function DesignerHelpFAB() {
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    fetchSiteWhatsApp().then((d) => setWhatsapp(d?.number || "")).catch(() => {});
  }, []);

  const cleanedWa = whatsapp.replace(/[^0-9]/g, "");
  const waHref = cleanedWa
    ? `https://wa.me/${cleanedWa}?text=${encodeURIComponent("Hi! I'm using your Design Your Own tool and need a hand — can you help?")}`
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="designer-help-fab"
        aria-label="Help using the designer"
        className="designer-help-fab fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-nunito font-extrabold pl-3 pr-4 py-3 rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
      >
        <span className="w-9 h-9 grid place-items-center bg-[#fde68a] rounded-full text-[#1a1a1a]">
          <HelpCircle size={20} />
        </span>
        <span className="hidden sm:inline-block text-sm">Need a hand?</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 grid place-items-center" onClick={() => setOpen(false)} data-testid="designer-help-modal">
          <div onClick={(e) => e.stopPropagation()} className="bg-white text-[#0a0a0a] rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7]" data-testid="designer-help-close" aria-label="Close help">
              <X size={16} />
            </button>
            <div className="inline-flex items-center gap-2 bg-[#fef3c7] text-[#1a1a1a] px-3 py-1 rounded-full text-xs font-extrabold">
              <HelpCircle size={12} className="text-[#fbbf24]" /> Design help
            </div>
            <h3 className="font-black text-2xl mt-3">How the Designer works</h3>
            <ol className="mt-4 space-y-3 text-sm">
              <Step n="1">
                <strong>Pick a product</strong> — colour it appears on your garment. The list up top has every design-eligible item we sell.
              </Step>
              <Step n="2">
                <strong>Switch view</strong> — use <em>Front</em> / <em>Back</em> / <em>Neck label</em> above the canvas to place different designs on each area (back &amp; neck cost extra, shown in the tab).
              </Step>
              <Step n="3">
                <strong>Pick a colour</strong> — the <em>Colour</em> panel switches the canvas to that garment colour. If we&rsquo;ve photographed it you&rsquo;ll see the real garment; otherwise you&rsquo;ll see a flat block in exactly that colour so you always design against the right shade.
              </Step>
              <Step n="4">
                <strong>Add art or text</strong> — upload your logo/PNG (transparent works best), then drag, resize and rotate inside the dashed print area. Add text in any font — the font list previews each style so you can see it before picking. Use the <em>Layers</em> panel to reorder, duplicate or delete anything.
              </Step>
              <Step n="5">
                <strong>AI tools</strong> (optional) — select an uploaded image to unlock <em>Remove background</em> and photo effects. These use paid AI services, so you&rsquo;ll need to be logged in; you get 20 free edits a month.
              </Step>
              <Step n="6">
                <strong>Sizes &amp; checkout</strong> — set qty per size at the bottom and hit "Checkout with Stripe". We'll email you a free proof before we print.
              </Step>
            </ol>

            <div className="mt-5 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-3 flex items-start gap-2 text-xs text-[#1a1a1a]">
              <Info size={14} className="text-[#7bc67e] mt-0.5 flex-shrink-0" />
              <span>Stuck? Our UK team can jump in and mock it up for you — no cost, no pressure.</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe57] text-white font-extrabold rounded-full px-4 py-3 text-sm"
                  data-testid="designer-help-whatsapp"
                >
                  WhatsApp us
                </a>
              ) : (
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold rounded-full px-4 py-3 text-sm"
                  data-testid="designer-help-contact"
                >
                  Contact us
                </a>
              )}
              <button
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#0a0a0a] font-extrabold rounded-full px-4 py-3 text-sm"
                data-testid="designer-help-got-it"
              >
                Got it, thanks
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 w-6 h-6 grid place-items-center rounded-full bg-[#7bc67e] text-[#1a1a1a] text-xs font-extrabold">{n}</span>
      <span className="text-[#1a1a1a] leading-snug">{children}</span>
    </li>
  );
}
