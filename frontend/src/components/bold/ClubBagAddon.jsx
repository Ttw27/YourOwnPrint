import React, { useEffect, useMemo, useState } from "react";
import { fetchClubBags } from "../../lib/api";

/**
 * Kit bag add-on for the Sports Outfit + Full Squad builders. Real bags
 * (routers/dance_kit.CLUB_BAG_SET): barrel bag, holdalls, boot bag, gymsac.
 * Logo on the front included (£3), each player's name on the bag optional (+£3).
 * Ordered as its own basket line, design_meta.flow "club_bag" - the server
 * prices it (dance_print).
 */
const BASIC = { black: "#111111", white: "#ffffff", grey: "#9ca3af", navy: "#1e2a4a", red: "#c81e1e", royal: "#1d4ed8", blue: "#1d4ed8", green: "#166534", putty: "#d6c7a1", pink: "#f472b6", fuchsia: "#d946ef", purple: "#7e22ce", orange: "#f97316", yellow: "#facc15" };
const hexFor = (name, fallback) => {
  const n = name.toLowerCase();
  const k = Object.keys(BASIC).find((w) => n.includes(w));
  return k ? BASIC[k] : fallback;
};
export const bagSwatch = (c) => {
  if (!c.name.includes("/")) return c.hex;
  const [a, b] = c.name.split("/");
  return `linear-gradient(135deg, ${hexFor(a, c.hex)} 50%, ${hexFor(b, c.hex)} 50%)`;
};

export function useClubBag() {
  const [cfg, setCfg] = useState(null);
  const [on, setOn] = useState(false);
  const [optId, setOptId] = useState("");
  const [colour, setColour] = useState("");
  const [name, setName] = useState(false);
  useEffect(() => {
    fetchClubBags().then((c) => {
      if (!c?.set) return;
      setCfg(c);
      const o = c.set.options[0];
      setOptId(o.id);
      setColour((o.colours.find((x) => /^black(\/black)*$/i.test(x.name)) || o.colours[0] || {}).name || "");
    }).catch(() => {});
  }, []);
  const opt = useMemo(() => cfg?.set.options.find((o) => o.id === optId) || cfg?.set.options[0], [cfg, optId]);
  const colourObj = opt?.colours.find((c) => c.name === colour);
  const pickOpt = (id) => {
    const o = cfg.set.options.find((x) => x.id === id);
    setOptId(id);
    setColour((o.colours.find((c) => c.name === colour) || o.colours.find((c) => /^black/i.test(c.name)) || o.colours[0] || {}).name || "");
  };
  const unit = opt ? opt.adult.price + Number(opt.adult.colour_upcharges?.[colour] || 0) + (cfg.prices.logo) + (name ? cfg.prices.name : 0) : 0;
  return { cfg, on, setOn, opt, pickOpt, colour, setColour, colourObj, name, setName, unit, ready: !!cfg };
}

/** Basket line for the bags - people = [{name}] who get one. */
export function clubBagItem(bag, people, meta = {}) {
  if (!bag.on || !bag.opt || !people.length) return null;
  return {
    product_id: bag.opt.adult.product_id,
    size_qtys: { [bag.opt.adult.sizes[0]?.value || "ONE"]: people.length },
    color: bag.colour,
    placements: ["logo", ...(bag.name ? ["name"] : [])],
    blank: false,
    design_meta: { flow: "club_bag", ...meta, names: bag.name ? people.map((p) => p.name || "-").join(", ").slice(0, 480) : "" },
  };
}

export function ClubBagCard({ bag, n, logo, testid = "club-bag" }) {
  if (!bag.ready) return null;
  const { cfg, opt } = bag;
  return (
    <div className={`bg-white border-2 rounded-3xl overflow-hidden ${bag.on ? "border-[#7bc67e]" : "border-[#dcfce7]"}`} data-testid={testid}>
      <label className="flex items-start gap-3 p-5 cursor-pointer">
        <input type="checkbox" checked={bag.on} onChange={(e) => bag.setOn(e.target.checked)} className="mt-1.5 w-5 h-5 accent-[#7bc67e]" data-testid={`${testid}-toggle`} />
        <div className="flex-1">
          <h2 className="font-black text-2xl"><span className="text-[#7bc67e]">{n}.</span> Kit bag <span className="text-sm font-bold text-[#4b5563]">(optional)</span></h2>
          <div className="text-sm text-[#4b5563]">Barrel bag, holdall or boot bag with your logo - add each player&apos;s name too. From £{(Math.min(...cfg.set.options.map((o) => o.adult.price)) + cfg.prices.logo).toFixed(2)}.</div>
        </div>
      </label>
      {bag.on && opt && (
        <div className="px-5 pb-5 grid md:grid-cols-5 gap-4">
          <div className="md:col-span-2 relative aspect-square rounded-2xl bg-[#f9fafb] border border-[#eef2f7] overflow-hidden">
            {bag.colourObj?.image && <img src={bag.colourObj.image} alt={`${opt.label} in ${bag.colour}`} className="absolute inset-0 w-full h-full object-contain" />}
            {logo && <img src={logo} alt="" aria-hidden="true" className="absolute object-contain opacity-90" style={{ left: "38%", top: "40%", width: "24%" }} />}
          </div>
          <div className="md:col-span-3 space-y-3 min-w-0">
            <div className="grid grid-cols-2 gap-1.5">
              {cfg.set.options.map((o) => (
                <button key={o.id} type="button" onClick={() => bag.pickOpt(o.id)}
                  className={`text-left rounded-xl border-2 px-2.5 py-2 ${opt.id === o.id ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] hover:border-[#7bc67e]"}`} data-testid={`${testid}-opt-${o.id}`}>
                  <div className="text-xs font-extrabold">{o.label} <span className="font-bold text-[#4b5563]">£{(o.adult.price + cfg.prices.logo).toFixed(2)}</span></div>
                  <div className="text-[10px] text-[#4b5563] leading-tight">{o.note}</div>
                </button>
              ))}
            </div>
            <div>
              <div className="text-xs font-extrabold mb-1">Colour: <span className="text-[#4b5563]">{bag.colour}</span></div>
              <div className="flex flex-wrap gap-1.5">
                {opt.colours.map((c) => (
                  <button key={c.name} type="button" title={c.name} onClick={() => bag.setColour(c.name)}
                    className={`w-7 h-7 rounded-full border-2 ${bag.colour === c.name ? "border-[#1a1a1a] ring-2 ring-[#7bc67e]" : "border-[#e5e7eb]"}`}
                    style={{ background: bagSwatch(c) }} data-testid={`${testid}-colour-${c.name}`} />
                ))}
              </div>
            </div>
            <div className="text-xs"><strong>Logo on the front</strong> <span className="text-[#4b5563]">included</span></div>
            <label className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 cursor-pointer text-xs ${bag.name ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb]"}`} data-testid={`${testid}-name`}>
              <input type="checkbox" checked={bag.name} onChange={(e) => bag.setName(e.target.checked)} className="accent-[#7bc67e]" />
              <span className="flex-1"><strong>Player&apos;s name on the bag</strong> <span className="text-[#4b5563]">(from the list below)</span></span>
              <span className="text-[#4b5563] font-bold">+£{cfg.prices.name.toFixed(2)}</span>
            </label>
            <div className="text-[11px] text-[#4b5563]">Untick &quot;Bag&quot; in the list below for anyone who doesn&apos;t need one.</div>
          </div>
        </div>
      )}
    </div>
  );
}
