import React, { useEffect, useState } from "react";
import { api, getDeliveryRegion } from "../../lib/api";

/** "Delivering to" - shown next to Buy now / Pay buttons when we ship abroad. Saved in
 *  the same place as the basket's choice; createCheckout sends it to the server. */
export default function DeliveryRegionPicker({ dark = false, className = "" }) {
  const [zones, setZones] = useState(null);
  const [region, setRegion] = useState(getDeliveryRegion);
  useEffect(() => { api.get("/delivery/info").then((r) => setZones(r.data.international || {})).catch(() => setZones({})); }, []);
  if (!zones || !Object.keys(zones).length) return null;
  const pick = (r) => { setRegion(r); try { localStorage.setItem("yop_delivery_region", r); } catch { /* storage blocked */ } };
  return (
    <label className={`flex items-center justify-between gap-2 text-xs font-nunito font-extrabold ${dark ? "text-white/80" : "text-[#1a1a1a]"} ${className}`} data-testid="delivery-region-picker">
      Delivering to
      <select value={zones[region] || region === "uk" ? region : "uk"} onChange={(e) => pick(e.target.value)}
        className="border border-[#e5e7eb] rounded-lg px-2 py-1 bg-white text-[#1a1a1a] text-xs">
        <option value="uk">United Kingdom</option>
        {zones.europe && <option value="europe">Europe</option>}
        {zones.world && <option value="world">Rest of the world</option>}
      </select>
    </label>
  );
}
