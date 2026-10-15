import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { X, Copy, Check } from "lucide-react";
import { useLaunchOffer } from "../../lib/launchOffer";

/**
 * Thin bar at the very top of every page while the launch offer is on (Admin >
 * Launch offer). Not sticky - it scrolls away - and can be closed for the visit.
 */
const KEY = "yop_launch_banner_closed";
const QUIET = /^\/(admin|checkout)/;

function endsText(ends) {
  const d = new Date(`${ends}T12:00:00`);
  return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export default function LaunchBanner() {
  const loc = useLocation();
  const offer = useLaunchOffer();
  const [closed, setClosed] = useState(() => { try { return !!sessionStorage.getItem(KEY); } catch { return false; } });
  const [copied, setCopied] = useState(false);
  if (!offer || !offer.on || closed || QUIET.test(loc.pathname)) return null;
  const close = () => { setClosed(true); try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ } };
  const copy = async () => {
    try { await navigator.clipboard.writeText(offer.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  return (
    <div className="bg-[#1a1a1a] text-white font-nunito text-xs sm:text-sm" data-testid="launch-banner">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2 sm:gap-3 relative pr-10 flex-wrap">
        <span className="font-extrabold"><span className="text-[#7bc67e]">New website!</span> {offer.pct}% off with code</span>
        <button onClick={copy} className="inline-flex items-center gap-1 bg-[#7bc67e] text-[#1a1a1a] font-black tracking-wider rounded-full px-3 py-0.5" data-testid="launch-banner-code" aria-label={`Copy code ${offer.code}`}>
          {offer.code} {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        <span className="text-white/70">until {endsText(offer.ends)} · not with bulk discounts</span>
        <button onClick={close} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10" aria-label="Close" data-testid="launch-banner-close"><X size={14} /></button>
      </div>
    </div>
  );
}
