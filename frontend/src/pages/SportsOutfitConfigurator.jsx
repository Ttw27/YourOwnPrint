import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { submitQuoteRequest, createCartCheckout, uploadOrderArtwork, fetchTeamKitAddons } from "../lib/api";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import { useKit, OptionalSet, ImageSlot } from "./FullSquadConfigurator";
import { useClubBag, ClubBagCard, clubBagItem } from "../components/bold/ClubBagAddon";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck, Loader2, Check, ShoppingCart, Send } from "lucide-react";
import { ExVat } from "../components/bold/PriceTag";

/**
 * Sports Outfit Configurator - gyms, PTs, boxing / thai / kickboxing clubs.
 * Built on the same real kits as Team Kits (routers/team_kits.py):
 *   Training kit = AWDis Cool T (JC001) + Cool Shorts (JC080), adults + kids
 *   Tracksuit    = AWDis College Hoodie (JH001) + Cuffed Joggers (JH072), adults
 * Logo on the front of everything is included; a big logo on the back of the
 * top / hoodie is an add-on (team-kit "back-print" price). One list of people
 * (name optional + a size per set). Pays online as kit lines in the basket
 * (server re-prices each), or a quote for big orders.
 */
const QUOTE_THRESHOLD = 25;

const blankPerson = () => ({ name: "", size: "M", tracksuit: "" });

export default function SportsOutfitConfigurator() {
  const [team, setTeam] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [logo, setLogo] = useState(null);
  const [backLogo, setBackLogo] = useState(null);
  const training = useKit("kit-training");
  const tracksuit = useKit("kit-tracksuit");
  const [withTraining, setWithTraining] = useState(true);
  const [withTracksuit, setWithTracksuit] = useState(false);
  const [backOn, setBackOn] = useState({ training: false, tracksuit: false });
  const [backPrice, setBackPrice] = useState(3.5);
  const [people, setPeople] = useState(Array.from({ length: 5 }, blankPerson));
  const [busy, setBusy] = useState(false);
  const bag = useClubBag();

  useEffect(() => {
    fetchTeamKitAddons().then((list) => {
      const bp = (list || []).find((a) => a.id === "back-print");
      if (bp) setBackPrice(Number(bp.price));
    }).catch(() => {});
  }, []);

  const kidsIn = (k, sizeOf) => people.some((p) => (k.kit?.kids_sizes || []).includes(sizeOf(p)));
  const kidsProblem = (k, sizeOf) => (kidsIn(k, sizeOf) ? k.parts.map((pt) => {
    const c = pt.colours.find((x) => x.name === k.cols[pt.key]);
    return c && c.kids === false ? `${pt.label} in ${c.name}` : null;
  }).filter(Boolean) : []);

  const sets = useMemo(() => {
    const out = [];
    if (withTraining) out.push({ key: "training", label: "Training kit", k: training, sizeOf: (p) => p.size, backWhat: "top" });
    if (withTracksuit) out.push({ key: "tracksuit", label: "Tracksuit", k: tracksuit, sizeOf: (p) => (withTraining ? p.tracksuit : ((tracksuit.kit?.adult_sizes || []).includes(p.size) ? p.size : "")), backWhat: "hoodie" });
    return out;
  }, [training, tracksuit, withTraining, withTracksuit]);

  const lines = sets.map((s) => {
    const size_qtys = {};
    let total = 0;
    const extra = backOn[s.key] ? backPrice : 0;
    people.forEach((p) => {
      const sz = s.sizeOf(p);
      if (!sz) return;
      size_qtys[sz] = (size_qtys[sz] || 0) + 1;
      total += s.k.unit(sz) + extra;
    });
    const qty = Object.values(size_qtys).reduce((a, b) => a + b, 0);
    return { ...s, size_qtys, qty, total, extra };
  });
  // kit bags: everyone on the list (with a size, or a name if only bags are ordered) unless "Bag" is unticked
  const bagPeople = bag.on ? people.filter((p) => !p.nobag && (sets.some((s) => s.sizeOf(p)) || (!sets.length && p.name.trim()))) : [];
  const bagTotal = bagPeople.length * bag.unit;
  const grandTotal = lines.reduce((a, l) => a + l.total, 0) + bagTotal;
  const totalItems = lines.reduce((a, l) => a + l.qty, 0) + bagPeople.length;
  const headcount = people.filter((p) => sets.some((s) => s.sizeOf(p)) || bagPeople.includes(p)).length;
  const quoteOnly = headcount > QUOTE_THRESHOLD;
  const anyBack = sets.some((s) => backOn[s.key]);

  const setPerson = (i, patch) => setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const trainingAdult = training.kit?.adult_sizes || ["XS", "S", "M", "L", "XL", "XXL"];
  const trainingKids = training.kit?.kids_sizes || [];
  const tracksuitSizes = tracksuit.kit?.adult_sizes || ["XS", "S", "M", "L", "XL", "XXL"];

  const validate = () => {
    if (!sets.length && !bag.on) return "Pick the training kit, the tracksuit, a kit bag - or all of them";
    if (!team.name.trim()) return "Add your gym / club name";
    if (!team.contact_email.trim()) return "Add a contact email";
    if (!logo) return "Upload your logo";
    if (anyBack && !backLogo) return "Upload the logo for the back (or untick the back print)";
    if (!totalItems) return "Add at least one person with a size";
    if (bag.on && bag.name && bagPeople.some((p) => !p.name.trim())) return "Add a name for everyone getting a bag (or untick names on the bag)";
    for (const s of sets) {
      if (s.k.parts.some((pt) => !s.k.cols[pt.key])) return `Pick the colours for the ${s.label.toLowerCase()}`;
      const kp = kidsProblem(s.k, s.sizeOf);
      if (kp.length) return `${s.label}: ${kp.join(", ")} isn't made in kids sizes - pick another colour`;
    }
    if (training.opts.names && withTraining && people.some((p) => p.size && !p.name.trim())) return "Add a name for each person (or untick names & numbers)";
    return null;
  };

  const peopleText = people.filter((p) => sets.some((s) => s.sizeOf(p))).map((p) =>
    `${p.name || "-"}: ${sets.map((s) => `${s.label.toLowerCase()} ${s.sizeOf(p) || "none"}`).join(", ")}`);
  const setSummary = lines.map((l) => `${l.label}: ${l.k.kit?.garments || l.k.pid} - ${l.k.parts.map((pt) => `${pt.label} ${l.k.cols[pt.key]}`).join(", ")}` +
    (l.k.kit?.options ? ` (${l.k.opts.socks ? "with socks" : "no socks"}, ${l.k.opts.names ? "names & numbers" : "logo only"})` : "") +
    (backOn[l.key] ? `, big logo on the back of the ${l.backWhat}` : "") + ` x${l.qty} = £${l.total.toFixed(2)}`);

  const checkout = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      const art = await uploadOrderArtwork({ logo, "back-print": anyBack ? backLogo : null }, "sports-outfit");
      const items = lines.filter((l) => l.qty > 0).map((l) => ({
        product_id: l.k.pid,
        size_qtys: l.size_qtys,
        color: l.k.parts.map((pt) => `${pt.label}: ${l.k.cols[pt.key]}`).join(" / "),
        placements: backOn[l.key] ? ["back-print"] : [],
        blank: false,
        design_meta: {
          flow: "sports_outfit", team_name: team.name, set: l.label,
          kit_socks: l.k.opts.socks ? "yes" : "no", kit_names: l.k.opts.names ? "yes" : "no",
          ...Object.fromEntries(l.k.parts.map((pt) => [`${pt.key}_colour`, l.k.cols[pt.key]])),
          garments: l.k.kit?.garments || "",
          roster: peopleText.join(" | ").slice(0, 1500),
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
        kind: "team_kit", name: team.contact_name || team.name, email: team.contact_email, phone: team.contact_phone,
        company: team.name, sport: "", kit_type: "sports-outfit-configurator", quantity: totalItems,
        message: [`Gym / club kit order for ${team.name} (${headcount} people)`, ...setSummary, ...(bagPeople.length ? [`Kit bag: ${bag.opt.label} (${bag.opt.adult.name}) in ${bag.colour}${bag.name ? ", names on the bags" : ""} x${bagPeople.length} = £${bagTotal.toFixed(2)}`] : []), `Indicative total: £${grandTotal.toFixed(2)}`, "", ...peopleText].join("\n"),
        artwork: [logo, anyBack ? backLogo : null].filter(Boolean),
        roster: people.filter((p) => sets.some((s) => s.sizeOf(p))).map((p) => ({ name: p.name, number: "", size: p.size, qty: 1, tracksuit: p.tracksuit })),
        product_id: "sports-outfit",
      });
      toast.success("Quote request sent - we'll be in touch with a proof and price.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't send - try WhatsApp instead.");
    } finally { setBusy(false); }
  };

  const BackToggle = ({ setKey, what }) => (
    <label className={`flex items-start gap-3 rounded-2xl border-2 p-3 cursor-pointer text-sm ${backOn[setKey] ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white"}`} data-testid={`soc-back-${setKey}`}>
      <input type="checkbox" checked={backOn[setKey]} onChange={(e) => setBackOn((b) => ({ ...b, [setKey]: e.target.checked }))} className="mt-0.5 w-4 h-4 accent-[#7bc67e]" />
      <span><strong>Big logo on the back of the {what}</strong> <span className="text-[#4b5563]">+£{backPrice.toFixed(2)} each</span>
        <span className="block text-xs text-[#4b5563]">Your front logo is included. Shorts and joggers get the front logo only.</span></span>
    </label>
  );

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid="sports-outfit-page">
      <BoldNavbar />
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-[#7bc67e] via-[#fde68a] to-[#f87171]" />
        <div className="relative max-w-7xl mx-auto px-6 py-14">
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Gym &amp; club kit builder</span>
          <h1 className="font-black text-4xl lg:text-6xl mt-2">Training kit and tracksuits - one order.</h1>
          <p className="text-zinc-300 mt-3 max-w-2xl">For gyms, PTs, boxing, Muay Thai and kickboxing clubs. Pick your colours, add your team once, and your logo goes on everything.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            {["Real AWDis kit in your colours", "Adults and kids in one order", "UK printed · free proof"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 font-extrabold"><Check size={12} className="text-[#7bc67e]" /> {t}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 space-y-6 min-w-0" data-testid="soc-main">
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="soc-team">
            <h2 className="font-black text-2xl mb-3"><span className="text-[#7bc67e]">1.</span> Your gym / club</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[["name", "Gym / club name *"], ["contact_name", "Your name"], ["contact_email", "Email *"], ["contact_phone", "Phone (optional)"]].map(([k, ph]) => (
                <input key={k} value={team[k]} onChange={(e) => setTeam({ ...team, [k]: e.target.value })} placeholder={ph}
                  className="w-full bg-white border-2 border-[#dcfce7] focus:border-[#7bc67e] rounded-xl px-3 py-2.5 text-sm outline-none" data-testid={`soc-${k}`} />
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <ImageSlot label="Your logo *" hint="Front of everything - included" value={logo} onChange={setLogo} testid="soc-logo" />
              {anyBack && <ImageSlot label="Back logo *" hint="Big print on the back of the top / hoodie" value={backLogo} onChange={setBackLogo} testid="soc-back-logo" />}
            </div>
          </div>

          <OptionalSet n={2} title="Training kit" sub="Cool wicking tee + shorts with your logo - add socks or names if you want." on={withTraining} setOn={setWithTraining} k={training} kidsProblem={kidsProblem(training, (p) => p.size)} testid="soc-training" />
          {withTraining && training.kit && <BackToggle setKey="training" what="top" />}

          <OptionalSet n={3} title="Tracksuit" sub="College hoodie + cuffed joggers, your logo on both. Adult sizes." on={withTracksuit} setOn={setWithTracksuit} k={tracksuit} kidsProblem={[]} testid="soc-tracksuit" />
          {withTracksuit && tracksuit.kit && <BackToggle setKey="tracksuit" what="hoodie" />}

          <ClubBagCard bag={bag} n={4} logo={logo} testid="soc-bag" />

          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="soc-people">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="font-black text-2xl"><span className="text-[#7bc67e]">5.</span> Who&apos;s it for <span className="text-sm text-[#4b5563] font-bold">({headcount} people)</span></h2>
              <select onChange={(e) => setPeople(Array.from({ length: Number(e.target.value) }, (_, i) => people[i] || blankPerson()))} defaultValue=""
                className="bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-3 py-1.5 text-xs font-bold" data-testid="soc-quick-rows">
                <option value="" disabled>Number of people…</option>
                {[1, 2, 3, 5, 8, 10, 15, 20, 25].map((n) => <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>)}
              </select>
            </div>
            <div className="text-xs text-[#4b5563] mb-2">
              One line per person with their size{withTraining && withTracksuit ? " for each set - leave a set blank for anyone who doesn't need it" : ""}.
              {training.opts.names && withTraining ? " The name goes on the back of the training top." : " Names are optional - just to help you hand them out."}
            </div>
            <div className="space-y-1.5">
              {people.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-white border border-[#dcfce7] rounded-xl p-2" data-testid={`soc-person-${i}`}>
                  <input value={p.name} onChange={(e) => setPerson(i, { name: e.target.value })} placeholder={training.opts.names && withTraining ? "Name on back" : "Name (optional)"} className={`${withTraining && withTracksuit ? (bag.on ? "col-span-4" : "col-span-5") : (bag.on ? "col-span-7" : "col-span-8")} text-sm px-2 py-1 outline-none bg-transparent min-w-0`} />
                  {withTraining && (
                    <select value={p.size} onChange={(e) => setPerson(i, { size: e.target.value })} className="col-span-3 text-sm bg-transparent outline-none min-w-0 border-l border-[#dcfce7]" title="Training kit size" data-testid={`soc-person-${i}-size`}>
                      {withTracksuit && <option value="">No training kit</option>}
                      <optgroup label="Adult">{trainingAdult.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>
                      {trainingKids.length > 0 && <optgroup label="Kids (age)">{trainingKids.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>}
                    </select>
                  )}
                  {withTracksuit && (
                    <select value={withTraining ? p.tracksuit : p.size} onChange={(e) => setPerson(i, withTraining ? { tracksuit: e.target.value } : { size: e.target.value })} className="col-span-3 text-sm bg-transparent outline-none min-w-0 border-l border-[#dcfce7]" title="Tracksuit size" data-testid={`soc-person-${i}-tracksuit`}>
                      {withTraining && <option value="">No tracksuit</option>}
                      {tracksuitSizes.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {!withTraining && !withTracksuit && <div className="col-span-3" />}
                  {bag.on && (
                    <label className="col-span-1 flex flex-col items-center text-[9px] font-extrabold text-[#4b5563] cursor-pointer" title="Kit bag">
                      <input type="checkbox" checked={!p.nobag} onChange={(e) => setPerson(i, { nobag: !e.target.checked })} className="accent-[#7bc67e]" data-testid={`soc-person-${i}-bag`} />Bag
                    </label>
                  )}
                  <button type="button" onClick={() => setPeople((ps) => ps.filter((_, j) => j !== i))} className="col-span-1 text-rose-500 hover:bg-rose-50 rounded-full p-1 grid place-items-center" aria-label="Remove person"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            {withTraining && withTracksuit && (
              <div className="grid grid-cols-12 gap-2 px-2 mt-1 text-[10px] uppercase tracking-wider font-extrabold text-[#4b5563]">
                <span className={bag.on ? "col-span-4" : "col-span-5"} /><span className="col-span-3">Training kit</span><span className="col-span-3">Tracksuit</span>
              </div>
            )}
            <button type="button" onClick={() => setPeople((ps) => [...ps, blankPerson()])} className="mt-2 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#7bc67e] hover:underline" data-testid="soc-add-person"><Plus size={14} /> Add person</button>
          </div>
          <NeedHelpCTA title="Easier to send it over?" body="Send your logo, colours and sizes on WhatsApp or email and we'll set the order up for you." presetMessage="Hi! I'd like training kit / tracksuits for my gym." />
        </section>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="soc-summary">
            <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Your order</div>
            <div className="font-black text-4xl mt-2" data-testid="soc-total">£{grandTotal.toFixed(2)}</div>
            <ExVat amount={grandTotal} className="text-[11px] text-neutral-400" />
            <div className="mt-4 space-y-2 text-sm">
              {lines.map((l) => (
                <div key={l.key} className="flex justify-between gap-3 border-b border-white/10 pb-2">
                  <span><strong>{l.label}</strong><br /><span className="text-xs text-neutral-400">{l.qty} × {l.k.parts.map((pt) => l.k.cols[pt.key]).filter(Boolean).join(" / ")}{l.extra ? " · back logo" : ""}</span></span>
                  <span className="font-extrabold">£{l.total.toFixed(2)}</span>
                </div>
              ))}
              {bagPeople.length > 0 && (
                <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                  <span><strong>{bag.opt.label}</strong><br /><span className="text-xs text-neutral-400">{bagPeople.length} × {bag.colour}{bag.name ? " · names" : ""}</span></span>
                  <span className="font-extrabold">£{bagTotal.toFixed(2)}</span>
                </div>
              )}
              {!lines.length && !bagPeople.length && <div className="text-xs text-neutral-400">Pick the training kit, the tracksuit, or both.</div>}
            </div>
            <div className="mt-5 space-y-2">
              {!quoteOnly && (
                <button onClick={checkout} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-extrabold px-5 py-3.5 rounded-full" data-testid="soc-checkout">
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <ShoppingCart size={16} />} Checkout £{grandTotal.toFixed(2)}
                </button>
              )}
              <button onClick={quote} disabled={busy} className={`w-full inline-flex items-center justify-center gap-2 font-extrabold px-5 py-3.5 rounded-full ${quoteOnly ? "bg-[#7bc67e] text-[#1a1a1a]" : "border-2 border-[#7bc67e] text-[#7bc67e]"}`} data-testid="soc-quote">
                <Send size={16} /> {quoteOnly ? "Get a proof & quote" : "Get a quote first"}
              </button>
            </div>
            <div className="mt-4 text-xs text-neutral-400 flex items-start gap-1.5"><ShieldCheck size={12} className="mt-0.5 text-[#7bc67e]" /> We send a free proof before anything is printed.{quoteOnly ? ` Orders for over ${QUOTE_THRESHOLD} people get a tailored quote.` : ""}</div>
            <div className="mt-2 text-xs text-neutral-400">Running a team? <Link to="/full-squad-configurator" className="text-[#7bc67e] underline">Full squad builder</Link> (match kits too)</div>
            <div className="mt-2 text-xs text-neutral-400">Members paying for their own? <Link to="/club-shop/new" className="text-[#7bc67e] underline" data-testid="soc-club-shop">Set up a club shop link</Link></div>
          </div>
        </aside>
      </div>
      <BoldFooter />
    </div>
  );
}
