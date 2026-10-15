import { useEffect, useState } from "react";
import { api } from "./api";

// Site-wide launch offer (routers/launch_offer.py) - fetched once per page load.
let cached = null;
export function fetchLaunchOffer() {
  if (!cached) cached = api.get("/site/launch-offer").then((r) => r.data || { on: false }).catch(() => ({ on: false }));
  return cached;
}

export function useLaunchOffer() {
  const [offer, setOffer] = useState(null);
  useEffect(() => { let live = true; fetchLaunchOffer().then((o) => live && setOffer(o)); return () => { live = false; }; }, []);
  return offer; // null while loading, then {on, code, pct, ends}
}
