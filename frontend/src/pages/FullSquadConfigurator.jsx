import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchKitDetails, submitQuoteRequest, createCartCheckout, uploadOrderArtwork } from "../lib/api";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import { KitPicker } from "../components/bold/TeamKitConfigurator";
import { useClubBag, ClubBagCard, clubBagItem } from "../components/bold/ClubBagAddon";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck, Loader2, Check, Camera, Upload, ShoppingCart, Send } from "lucide-react";
import { ExVat } from "../components/bold/PriceTag";

/**
 * Full Squad Configurator - one order for a whole squad, built from the real
 * kits (routers/team_kits.py): Match Day (Classic or Contrast kit), optional
 * Training Kit and Club Tracksuit. Each set has its own colours + options
 * (same KitPicker + prices as the kit pages); ONE roster - name, number and
 * size per player, entered once - fills every set. Pays online as a basket of
 * kit lines (server re-prices each), or sends a quote for big squads.
 */
const QUOTE_THRESHOLD = 25;

// One kit's state: details from the server, options, colours.
export function useKit(pid) {
  const [kit, setKit] = useState(null);
  const [opts, setOpts] = useState({ socks: true, names: true });
  const [cols, setCols] = useState({});
  useEffect(() => {
    if (!pid) return;
    fetchKitDetails(pid).then((k) => {
      setKit(k);
      setOpts({ socks: !!k.defaults?.socks, names: !!k.defaults?.names });
      const pick = (c) => (c.find((x) => /^(jet |deep )?black$/i.test(x.name)) || c[0] || {}).name;
      setCols(Object.fromEntries(k.parts.map((pt) => [pt.key, pick(pt.colours)])));
    }).catch(() => {});
  }, [pid]);
  const unit = (size) => {
    if (!kit) return 0;
    const pr = kit.prices || {};
    if (pr.adult && pr.adult.fixed != null) return pr.adult.fixed;
    const g = (kit.kids_sizes || []).includes(size) ? "kids" : "adult";
    return pr[g]?.[`${opts.socks ? "socks" : "nosocks"}_${opts.names ? "names" : "badge"}`] || 0;
  };
  const parts = kit ? kit.parts.filter((pt) => pt.key !== "socks" || opts.socks) : [];
  return { pid, kit, opts, setOpts, cols, setCols, unit, parts };
}

const blankPlayer = () => ({ name: "", number: "", size: "M", tracksuit: "" });

export default function FullSquadConfigurator() {
  const [team, setTeam] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [badge, setBadge] = useState(null);
  const [sponsor, setSponsor] = useState(null);
  const [matchStyle, setMatchStyle] = useState("kit-classic");
  const classic = useKit("kit-classic");
  const contrast = useKit("kit-contrast");
  const training = useKit("kit-training");
  const tracksuit = useKit("kit-tracksuit");
  const match = matchStyle === "kit-contrast" ? contrast : classic;
  const [withTraining, setWithTraining] = useState(false);
  const [withTracksuit, setWithTracksuit] = useState(false);
  const [players, setPlayers] = useState(Array.from({ length: 5 }, blankPlayer));
  const [busy, setBusy] = useState(false);
  const bag = useClubBag();

  const active = useMemo(() => players.filter((p) => p.size), [players]);
  const kidsIn = (k) => active.some((p) => (k.kit?.kids_sizes || []).includes(p.size));
  const kidsProblem = (k) => (kidsIn(k) ? k.parts.map((pt) => {
    const c = pt.colours.find((x) => x.name === k.cols[pt.key]);
    return c && c.kids === false ? `${pt.label} in ${c.name}` : null;
  }).filter(Boolean) : []);

  // Sets in this order: which kit, and each player's size for it.
  const sets = useMemo(() => {
    const out = [{ label: "Match day kit", k: match, sizeOf: (p) => p.size }];
    if (withTraining) out.push({ label: "Training kit", k: training, sizeOf: (p) => p.size });
    if (withTracksuit) out.push({ label: "Club tracksuit", k: tracksuit, sizeOf: (p) => p.tracksuit || "" });
    return out;
  }, [match, training, tracksuit, withTraining, withTracksuit]);

  const lines = sets.map((s) => {
    const size_qtys = {};
    let total = 0;
    active.forEach((p) => {
      const sz = s.sizeOf(p);
      if (!sz) return;
      size_qtys[sz] = (size_qtys[sz] || 0) + 1;
      total += s.k.unit(sz);
    });
    const qty = Object.values(size_qtys).reduce((a, b) => a + b, 0);
    return { ...s, size_qtys, qty, total };
  });
  const bagPeople = bag.on ? active.filter((p) => !p.nobag) : [];
  const bagTotal = bagPeople.length * bag.unit;
  const grandTotal = lines.reduce((a, l) => a + l.total, 0) + bagTotal;
  const totalKits = lines.reduce((a, l) => a + l.qty, 0) + bagPeople.length;
  const quoteOnly = active.length > QUOTE_THRESHOLD;

  const setPlayer = (i, patch) => setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const adultSizes = classic.kit?.adult_sizes || ["XS", "S", "M", "L", "XL", "XXL"];
  const kidsSizes = classic.kit?.kids_sizes || [];

  const validate = () => {
    if (!team.name.trim()) return "Add your team / club name";
    if (!team.contact_email.trim()) return "Add a contact email";
    if (!badge) return "Upload your club badge";
    if (!active.length) return "Add your players";
    if (match.kit?.options && match.opts.names && active.some((p) => !p.name.trim() && !p.number.trim())) return "Add a name or number for each player (or untick names & numbers)";
    for (const s of sets) {
      if (s.k.parts.some((pt) => !s.k.cols[pt.key])) return `Pick the colours for the ${s.label.toLowerCase()}`;
      const kp = kidsProblem(s.k);
      if (s.k !== tracksuit && kp.length) return `${s.label}: ${kp.join(", ")} isn't made in kids sizes - pick another colour`;
    }
    if (withTracksuit && !active.some((p) => p.tracksuit)) return "Pick a tracksuit size for at least one player (or untick the tracksuit)";
    if (bag.on && bag.name && bagPeople.some((p) => !p.name.trim())) return "Add a name for every player getting a bag (or untick names on the bag)";
    return null;
  };

  const rosterText = active.map((p) => `${p.name || "-"} #${p.number || "-"} ${p.size}${withTracksuit && p.tracksuit ? ` / tracksuit ${p.tracksuit}` : ""}`);
  const setSummary = lines.map((l) => `${l.label}: ${l.k.kit?.garments || l.k.pid} - ${l.k.parts.map((pt) => `${pt.label} ${l.k.cols[pt.key]}`).join(", ")}` +
    (l.k.kit?.options ? ` (${l.k.opts.socks ? "with socks" : "no socks"}, ${l.k.opts.names ? "names & numbers" : "badge only"})` : "") + ` x${l.qty} = £${l.total.toFixed(2)}`);

  const checkout = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      const art = await uploadOrderArtwork({ badge, "front-sponsor": sponsor }, "full-squad");
      const items = lines.filter((l) => l.qty > 0).map((l) => ({
        product_id: l.k.pid,
        size_qtys: l.size_qtys,
        color: l.k.parts.map((pt) => `${pt.label}: ${l.k.cols[pt.key]}`).join(" / "),
        placements: [],
        blank: false,
        design_meta: {
          flow: "full_squad", team_name: team.name, set: l.label,
          kit_socks: l.k.opts.socks ? "yes" : "no", kit_names: l.k.opts.names ? "yes" : "no",
          ...Object.fromEntries(l.k.parts.map((pt) => [`${pt.key}_colour`, l.k.cols[pt.key]])),
          garments: l.k.kit?.garments || "",
          roster: rosterText.join(" | ").slice(0, 1500),
          ...art,
        },
      }));
      const bagLine = clubBagItem(bag, bagPeople, { team_name: team.name, set: "Kit bag", ...art });
      if (bagLine) items.push(bagLine);
      const { url } = await createCartCheckout(items, team.contact_email);
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Checkout failed");
      setBusy(false);
    }
  };

  const quote = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      await submitQuoteRequest({
        kind: "full_squad", name: team.contact_name || team.name, email: team.contact_email, phone: team.contact_phone,
        company: team.name, sport: "football", kit_type: "full squad", quantity: totalKits,
        message: [`Full squad order for ${team.name} (${active.length} players)`, ...setSummary, ...(bagPeople.length ? [`Kit bag: ${bag.opt.label} (${bag.opt.adult.name}) in ${bag.colour}${bag.name ? ", names on the bags" : ""} x${bagPeople.length} = £${bagTotal.toFixed(2)}`] : []), `Indicative total: £${grandTotal.toFixed(2)}`].join("\n"),
        artwork: [badge, sponsor].filter(Boolean),
        roster: active.map((p) => ({ name: p.name, number: p.number, size: p.size, qty: 1, tracksuit: p.tracksuit })),
        product_id: "full-squad",
      });
      toast.success("Quote request sent - we'll be in touch with a proof and price.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't send - try WhatsApp instead.");
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid="full-squad-page">
      <BoldNavbar />
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-[#7bc67e] via-[#fde68a] to-[#f87171]" />
        <div className="relative max-w-7xl mx-auto px-6 py-14">
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Full squad builder</span>
          <h1 className="font-black text-4xl lg:text-6xl mt-2">Match day, training and tracksuits - one order.</h1>
          <p className="text-zinc-300 mt-3 max-w-2xl">Pick your kits and colours, add your players once, and we&rsquo;ll kit out the whole squad. Club badge on everything, names and numbers on the match kit.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            {["Real kits in your club colours", "Adults and kids in one squad", "UK printed · free proof"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 font-extrabold"><Check size={12} className="text-[#7bc67e]" /> {t}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 space-y-6 min-w-0" data-testid="fsc-main">
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="fsc-team">
            <h2 className="font-black text-2xl mb-3"><span className="text-[#7bc67e]">1.</span> Team details</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[["name", "Team / club name *"], ["contact_name", "Your name"], ["contact_email", "Email *"], ["contact_phone", "Phone (optional)"]].map(([k, ph]) => (
                <input key={k} value={team[k]} onChange={(e) => setTeam({ ...team, [k]: e.target.value })} placeholder={ph}
                  className="w-full bg-white border-2 border-[#dcfce7] focus:border-[#7bc67e] rounded-xl px-3 py-2.5 text-sm outline-none" data-testid={`fsc-${k}`} />
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <ImageSlot label="Club badge *" hint="Front of every kit" value={badge} onChange={setBadge} testid="fsc-badge" />
              <ImageSlot label="Front sponsor (optional)" hint="On the match kit front - free" value={sponsor} onChange={setSponsor} testid="fsc-sponsor" />
            </div>
          </div>

          <div className="space-y-3" data-testid="fsc-match">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-2xl"><span className="text-[#7bc67e]">2.</span> Match day kit</h2>
              <div className="inline-flex rounded-full border-2 border-[#dcfce7] overflow-hidden ml-auto" data-testid="fsc-match-style">
                {[["kit-classic", "Classic"], ["kit-contrast", "Contrast"]].map(([id, l]) => (
                  <button key={id} type="button" onClick={() => setMatchStyle(id)}
                    className={`px-4 py-1.5 text-sm font-extrabold ${matchStyle === id ? "bg-[#7bc67e]" : "bg-white"}`} data-testid={`fsc-style-${id}`}>{l}</button>
                ))}
              </div>
            </div>
            {match.kit && <KitPicker title="Colours & options" kit={match.kit} opts={match.opts} setOpts={match.setOpts} cols={match.cols} setCols={match.setCols} parts={match.parts} kitUnit={match.unit} kidsProblem={kidsProblem(match)} />}
          </div>

          <OptionalSet n={3} title="Training kit" sub="Top + shorts with your badge - add socks or names if you want." on={withTraining} setOn={setWithTraining} k={training} kidsProblem={kidsProblem(training)} testid="fsc-training" />
          <OptionalSet n={4} title="Club tracksuit" sub="College hoodie + cuffed joggers, badge on both. Adult sizes." on={withTracksuit} setOn={setWithTracksuit} k={tracksuit} kidsProblem={[]} testid="fsc-tracksuit" />
          <ClubBagCard bag={bag} n={5} logo={badge} testid="fsc-bag" />

          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="fsc-roster">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="font-black text-2xl"><span className="text-[#7bc67e]">6.</span> Your squad <span className="text-sm text-[#4b5563] font-bold">({active.length} players)</span></h2>
              <select onChange={(e) => setPlayers(Array.from({ length: Number(e.target.value) }, (_, i) => players[i] || blankPlayer()))} defaultValue=""
                className="bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-3 py-1.5 text-xs font-bold" data-testid="fsc-quick-rows">
                <option value="" disabled>Number of players…</option>
                {[5, 7, 11, 15, 18, 22, 25].map((n) => <option key={n} value={n}>{n} players</option>)}
              </select>
            </div>
            <div className="text-xs text-[#4b5563] mb-2">One line per player - their name and number go on the back of the match kit, and the size is used for every set.{withTracksuit ? " Tracksuits come in adult sizes - leave blank for anyone who doesn't need one." : ""}</div>
            <div className="space-y-1.5">
              {players.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-white border border-[#dcfce7] rounded-xl p-2" data-testid={`fsc-player-${i}`}>
                  <input value={p.name} onChange={(e) => setPlayer(i, { name: e.target.value })} placeholder="Name on back" className={`${withTracksuit ? (bag.on ? "col-span-3" : "col-span-4") : (bag.on ? "col-span-5" : "col-span-6")} text-sm px-2 py-1 outline-none bg-transparent min-w-0`} />
                  <input value={p.number} onChange={(e) => setPlayer(i, { number: e.target.value })} placeholder="No." className="col-span-2 text-sm text-center px-1 py-1 outline-none bg-transparent border-l border-[#dcfce7] min-w-0" />
                  <select value={p.size} onChange={(e) => setPlayer(i, { size: e.target.value })} className="col-span-3 text-sm bg-transparent outline-none min-w-0" data-testid={`fsc-player-${i}-size`}>
                    <optgroup label="Adult">{adultSizes.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>
                    {kidsSizes.length > 0 && <optgroup label="Kids (age)">{kidsSizes.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>}
                  </select>
                  {withTracksuit && (
                    <select value={p.tracksuit} onChange={(e) => setPlayer(i, { tracksuit: e.target.value })} className="col-span-2 text-xs bg-transparent outline-none min-w-0 border-l border-[#dcfce7]" title="Tracksuit size">
                      <option value="">No tracksuit</option>
                      {(tracksuit.kit?.adult_sizes || adultSizes).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {bag.on && (
                    <label className="col-span-1 flex flex-col items-center text-[9px] font-extrabold text-[#4b5563] cursor-pointer" title="Kit bag">
                      <input type="checkbox" checked={!p.nobag} onChange={(e) => setPlayer(i, { nobag: !e.target.checked })} className="accent-[#7bc67e]" data-testid={`fsc-player-${i}-bag`} />Bag
                    </label>
                  )}
                  <button type="button" onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))} className="col-span-1 text-rose-500 hover:bg-rose-50 rounded-full p-1 grid place-items-center" aria-label="Remove player"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setPlayers((ps) => [...ps, blankPlayer()])} className="mt-2 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#7bc67e] hover:underline" data-testid="fsc-add-player"><Plus size={14} /> Add player</button>
          </div>
          <NeedHelpCTA title="Easier to send it over?" body="Send your squad list, badge and colours on WhatsApp or email and we'll set the order up for you." presetMessage="Hi! I'd like a full squad kit order." />
        </section>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="fsc-summary">
            <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Full squad summary</div>
            <div className="font-black text-4xl mt-2" data-testid="fsc-total">£{grandTotal.toFixed(2)}</div>
            <ExVat amount={grandTotal} className="text-[11px] text-neutral-400" />
            <div className="mt-4 space-y-2 text-sm">
              {lines.map((l) => (
                <div key={l.label} className="flex justify-between gap-3 border-b border-white/10 pb-2">
                  <span><strong>{l.label}</strong><br /><span className="text-xs text-neutral-400">{l.qty} × {l.k.parts.map((pt) => l.k.cols[pt.key]).filter(Boolean).join(" / ")}</span></span>
                  <span className="font-extrabold">£{l.total.toFixed(2)}</span>
                </div>
              ))}
              {bagPeople.length > 0 && (
                <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                  <span><strong>{bag.opt.label}</strong><br /><span className="text-xs text-neutral-400">{bagPeople.length} × {bag.colour}{bag.name ? " · names" : ""}</span></span>
                  <span className="font-extrabold">£{bagTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="mt-5 space-y-2">
              {!quoteOnly && (
                <button onClick={checkout} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-extrabold px-5 py-3.5 rounded-full" data-testid="fsc-checkout">
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <ShoppingCart size={16} />} Checkout £{grandTotal.toFixed(2)}
                </button>
              )}
              <button onClick={quote} disabled={busy} className={`w-full inline-flex items-center justify-center gap-2 font-extrabold px-5 py-3.5 rounded-full ${quoteOnly ? "bg-[#7bc67e] text-[#1a1a1a]" : "border-2 border-[#7bc67e] text-[#7bc67e]"}`} data-testid="fsc-quote">
                <Send size={16} /> {quoteOnly ? "Get a proof & quote" : "Get a quote first"}
              </button>
            </div>
            <div className="mt-4 text-xs text-neutral-400 flex items-start gap-1.5"><ShieldCheck size={12} className="mt-0.5 text-[#7bc67e]" /> We send a free proof before anything is printed.{quoteOnly ? ` Squads over ${QUOTE_THRESHOLD} players get a tailored quote.` : ""}</div>
            <div className="mt-2 text-xs text-neutral-400">Just need one kit? <Link to="/team-kits" className="text-[#7bc67e] underline">Order a single kit</Link></div>
          </div>
        </aside>
      </div>
      <BoldFooter />
    </div>
  );
}

export function OptionalSet({ n, title, sub, on, setOn, k, kidsProblem, testid }) {
  return (
    <div className="space-y-3" data-testid={testid}>
      <label className={`flex items-start gap-3 bg-white border-2 rounded-3xl p-5 cursor-pointer ${on ? "border-[#7bc67e]" : "border-[#dcfce7]"}`}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1.5 w-5 h-5 accent-[#7bc67e]" data-testid={`${testid}-toggle`} />
        <div className="flex-1">
          <h2 className="font-black text-2xl"><span className="text-[#7bc67e]">{n}.</span> {title} <span className="text-sm font-bold text-[#4b5563]">(optional)</span></h2>
          <div className="text-sm text-[#4b5563]">{sub}{k.kit ? ` From £${k.unit("M").toFixed(2)} per player.` : ""}</div>
        </div>
      </label>
      {on && k.kit && <KitPicker title={`${title} colours`} kit={k.kit} opts={k.opts} setOpts={k.setOpts} cols={k.cols} setCols={k.setCols} parts={k.parts} kitUnit={k.unit} kidsProblem={kidsProblem} />}
    </div>
  );
}

export function ImageSlot({ label, hint, value, onChange, testid }) {
  const ref = useRef(null);
  const pick = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, 1000 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        onChange(c.toDataURL("image/png"));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  };
  return (
    <div className="flex items-center gap-3" data-testid={testid}>
      <div className="w-20 h-20 rounded-2xl bg-[#f0fdf4] border-2 border-dashed border-[#7bc67e] grid place-items-center overflow-hidden flex-shrink-0">
        {value ? <img src={value} alt="" className="w-full h-full object-contain p-1" /> : <Camera className="text-[#7bc67e]" size={22} />}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-extrabold">{label}</div>
        <div className="text-xs text-[#4b5563]">{hint}</div>
        <div className="flex gap-2 mt-1.5">
          <button type="button" onClick={() => ref.current?.click()} className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-3 py-1.5 rounded-full text-xs inline-flex items-center gap-1"><Upload size={12} /> {value ? "Replace" : "Upload"}</button>
          {value && <button type="button" onClick={() => onChange(null)} className="text-xs font-bold text-rose-500 hover:underline">Remove</button>}
        </div>
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}
