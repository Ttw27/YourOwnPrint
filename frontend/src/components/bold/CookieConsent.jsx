import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { consentChoice, setConsent, trackingConfig, anyTracking, initTracking, trackPageView } from "../../lib/tracking";

/**
 * Cookie choice + page-view tracking. Only shown once the admin has added a
 * tracking ID (Admin > Integrations); until the visitor accepts, no Meta /
 * Google tags load (essential cookies only).
 */
export default function CookieConsent() {
  const [show, setShow] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    initTracking();
    if (consentChoice()) return;
    trackingConfig().then((c) => { if (anyTracking(c)) setShow(true); });
  }, []);

  useEffect(() => { trackPageView(loc.pathname + loc.search); }, [loc.pathname, loc.search]);

  if (!show) return null;
  const choose = (c) => { setConsent(c); setShow(false); if (c === "all") trackPageView(loc.pathname + loc.search); };
  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-[60] bg-white border-2 border-[#dcfce7] shadow-xl rounded-2xl p-4 font-nunito" role="dialog" aria-label="Cookie choice" data-testid="cookie-consent">
      <div className="font-extrabold text-sm text-[#1a1a1a]">Cookies</div>
      <p className="text-xs text-[#4b5563] mt-1 leading-relaxed">
        We use essential cookies to run the site (your basket and login). With your OK we&apos;d also use analytics and advertising cookies (Google, Meta) to see what&apos;s working and show you relevant offers. <Link to="/privacy" className="underline">Privacy policy</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("essential")} className="flex-1 border-2 border-[#1a1a1a] rounded-full py-2 text-xs font-extrabold" data-testid="cookie-essential">Essential only</button>
        <button type="button" onClick={() => choose("all")} className="flex-1 bg-[#7bc67e] hover:bg-[#5eb062] rounded-full py-2 text-xs font-extrabold text-[#1a1a1a]" data-testid="cookie-accept">Accept all</button>
      </div>
    </div>
  );
}
