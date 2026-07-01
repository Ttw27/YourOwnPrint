import React, { useEffect, useMemo, useState } from "react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchFullSquadConfig, submitQuoteRequest } from "../lib/api";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import { toast } from "sonner";
import {
  Plus, Minus, Trash2, ShieldCheck, Truck, ArrowRight, Loader2,
  Info, ChevronDown, Check, ShoppingBag,
} from "lucide-react";

/**
 * Full Squad Configurator — team-focused (Football / Rugby / kit sports).
 *
 * Three "sets" managed by admin as bundle brand variants (see /admin/bundle-variants):
 *   - Match Day  (Shirt + Shorts + Socks, per-player roster with split Top/Bottom/Sock sizes)
 *   - Training   (Top + Shorts + Socks, bulk grid + optional split-size toggle)
 *   - Tracksuit  (Hoodie/Jacket + Joggers, bulk grid + optional split-size toggle)
 *
 * For each set the customer picks ONE brand tile, then a colour, then sizes.
 * Submits as a QuoteRequest — the whole build lives in the message + roster fields.
 */
export default function FullSquadConfigurator() {
  const [cfg, setCfg] = useState(null);
  const [team, setTeam] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [state, setState] = useState({}); // { [sectionKey]: { variant_id, colour, roster, bulk } }

  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchFullSquadConfig().then(setCfg).catch(() => setCfg(null)); }, []);

  const activeSets = useMemo(() => Object.entries(state).filter(([, v]) => v?.variant_id), [state]);
  const gymBagPrice = Number(cfg?.addons?.gym_bag_addon_price || 0);
  const totals = useMemo(() => {
    let subtotal = 0, totalQty = 0, gymBags = 0;
    activeSets.forEach(([, v]) => {
      subtotal += (v.__unit_price || 0) * (v.__qty || 0);
      totalQty += (v.__qty || 0);
      if (v.include_gym_bag) {
        gymBags += (v.__qty || 0);
        subtotal += gymBagPrice * (v.__qty || 0);
      }
    });
    return { subtotal, totalQty, gymBags };
  }, [activeSets, gymBagPrice]);

  if (!cfg) {
    return <div className="min-h-screen grid place-items-center bg-white"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  }
  const { sections, proof_days } = cfg;

  const patchSection = (key, patch) => setState((s) => ({ ...s, [key]: { ...(s[key] || {}), ...patch } }));

  const onSubmit = async () => {
    if (!team.name.trim() || !team.contact_email.trim()) {
      toast.error("Please fill in team name and email."); return;
    }
    if (!activeSets.length || totals.totalQty === 0) {
      toast.error("Pick a brand and add at least one player."); return;
    }
    setBusy(true);
    try {
      // Build a rich message summary + a merged roster list.
      const summaryLines = [];
      const mergedRoster = [];
      activeSets.forEach(([sectionKey, v]) => {
        const sec = sections.find((s) => s.key === sectionKey);
        const variant = sec?.variants.find((x) => x.id === v.variant_id);
        const brandLabel = `${variant?.brand ? variant.brand + " " : ""}${variant?.name || "Standard"}`.trim();
        summaryLines.push(`[${sec.title}] ${brandLabel} — colour: ${v.colour || "n/a"} — ${v.__qty} kits @ £${(v.__unit_price || 0).toFixed(2)}`);
        (v.roster || []).filter((r) => r.name || r.number || r.top || r.bottom || r.sock).forEach((r) => {
          mergedRoster.push({ set: sec.title, ...r });
          const numPart = sec.supports_names_numbers ? ` #${r.number || "-"}` : "";
          summaryLines.push(`  •${numPart} ${r.name || "-"} — top ${r.top || "-"} / bottom ${r.bottom || "-"}${r.sock ? " / sock " + r.sock : ""}`);
        });
        if (v.include_gym_bag) {
          summaryLines.push(`  · +Printed gym bag with badge & player name: ${v.__qty} × £${gymBagPrice.toFixed(2)}`);
        }
      });
      await submitQuoteRequest({
        kind: "team_kit",
        name: team.contact_name?.trim() || team.name.trim(),
        email: team.contact_email.trim(),
        phone: team.contact_phone || "",
        company: team.name.trim(),
        sport: "",
        kit_type: "full-squad-configurator",
        quantity: totals.totalQty,
        deadline: "",
        message: `Full Squad Configurator quote — estimated subtotal £${totals.subtotal.toFixed(2)}.\n${summaryLines.join("\n")}`,
        roster: mergedRoster,
      });
      toast.success("Quote sent — we'll be in touch within 1 working day with a proof and price.");
    } catch (e) {
      const d = e?.response?.data?.detail;
      const msg = typeof d === "string"
        ? d
        : Array.isArray(d)
          ? d.map((x) => x?.msg || String(x)).join(", ")
          : "Couldn't send the quote — try WhatsApp instead.";
      toast.error(msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid="full-squad-page">
      <BoldNavbar />

      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-[#7bc67e] via-[#fde68a] to-[#f87171]" />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Full squad configurator</span>
          <h1 className="font-black text-4xl lg:text-6xl mt-2">Match day, training and tracksuit — one order.</h1>
          <p className="text-zinc-300 mt-3 max-w-2xl">Pick a kit brand for each set, choose your colour and sizes. <strong className="text-white">Every kit is labelled with the player&apos;s name</strong> — no more mix-ups in the changing room. Match Day comes with names + numbers on the back.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 font-extrabold">
              <Check size={12} className="text-[#7bc67e]" /> Free per-player name label on every kit
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 font-extrabold">
              <ShoppingBag size={12} className="text-[#fbbf24]" /> Add a printed gym bag with badge + name from £4
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 font-extrabold">
              <ShieldCheck size={12} className="text-[#7bc67e]" /> UK printed · proof in 2 days
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 space-y-6" data-testid="fsc-main">
          {/* 1. Team */}
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="fsc-team">
            <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">1.</span> Team details</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} placeholder="Team / club name *" className="fsc-input" data-testid="fsc-team-name" />
              <input value={team.contact_name} onChange={(e) => setTeam({ ...team, contact_name: e.target.value })} placeholder="Your name" className="fsc-input" data-testid="fsc-contact-name" />
              <input value={team.contact_email} onChange={(e) => setTeam({ ...team, contact_email: e.target.value })} placeholder="Email *" className="fsc-input" data-testid="fsc-contact-email" />
              <input value={team.contact_phone} onChange={(e) => setTeam({ ...team, contact_phone: e.target.value })} placeholder="Phone (optional)" className="fsc-input" data-testid="fsc-contact-phone" />
            </div>
          </div>

          {/* 2+. Sections */}
          {sections.map((section, idx) => (
            <SectionBuilder
              key={section.key}
              index={idx + 2}
              section={section}
              gymBagPrice={gymBagPrice}
              value={state[section.key] || {}}
              onChange={(patch) => patchSection(section.key, patch)}
            />
          ))}

          <NeedHelpCTA
            title="Big squad? Multiple age groups? We'll design and quote it end-to-end."
            body="If you've got 20+ kits or multiple squads, send us the details on WhatsApp and we'll handle the design, mock-ups and proofs — one point of contact, one price."
            presetMessage="Hi! I'd like to kit out our full squad — can I send you the details?"
            testid="fsc-need-help"
            variant="banner"
          />
        </section>

        {/* Sticky summary sidebar */}
        <aside className="lg:col-span-4" data-testid="fsc-summary">
          <div className="bg-[#1a1a1a] text-white rounded-3xl p-5 sticky top-24">
            <div className="text-[#7bc67e] text-xs uppercase tracking-[0.3em] font-extrabold">Full squad summary</div>
            <div className="mt-2 text-3xl font-black">£{totals.subtotal.toFixed(2)}</div>
            <div className="text-xs text-zinc-400">{totals.totalQty} kits across {activeSets.length} set{activeSets.length === 1 ? "" : "s"}{totals.gymBags > 0 ? ` · +${totals.gymBags} gym bag${totals.gymBags === 1 ? "" : "s"}` : ""}</div>
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
              {activeSets.map(([k, v]) => {
                const sec = sections.find((s) => s.key === k);
                const variant = sec?.variants.find((x) => x.id === v.variant_id);
                return (
                  <div key={k} className="text-xs bg-white/5 rounded-lg p-2" data-testid={`fsc-summary-${k}`}>
                    <div className="font-extrabold">{sec.title}</div>
                    <div className="text-zinc-400">{variant?.brand} {variant?.name} · {v.colour || "colour tbc"} · {v.__qty} × £{(v.__unit_price || 0).toFixed(2)}</div>
                    {v.include_gym_bag && v.__qty > 0 && (
                      <div className="text-[10px] text-[#fbbf24] mt-0.5 inline-flex items-center gap-1"><ShoppingBag size={9} /> +{v.__qty} gym bag{v.__qty === 1 ? "" : "s"} · £{(v.__qty * gymBagPrice).toFixed(2)}</div>
                    )}
                  </div>
                );
              })}
              {activeSets.length === 0 && <div className="text-xs text-zinc-500">Pick a kit brand under Match Day / Training / Tracksuit to start.</div>}
            </div>
            <button
              onClick={onSubmit}
              disabled={busy}
              className="mt-4 w-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-40 text-[#1a1a1a] font-extrabold py-3 rounded-xl inline-flex items-center justify-center gap-2"
              data-testid="fsc-submit"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />} Get a proof &amp; final quote
            </button>
            <div className="mt-3 space-y-1 text-[11px] text-zinc-300">
              <div className="inline-flex items-start gap-1.5"><ShieldCheck size={11} className="mt-0.5 text-[#7bc67e]" /><span>We&apos;ll send a full proof within {proof_days} working days.</span></div>
              <div className="inline-flex items-start gap-1.5"><Truck size={11} className="mt-0.5 text-[#7bc67e]" /><span>UK printed · low minimums · one point of contact.</span></div>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .fsc-input { width: 100%; padding: 0.65rem 0.9rem; border-radius: 0.85rem; border: 2px solid #dcfce7; background: white; font-size: 0.875rem; }
        .fsc-input:focus { outline: none; border-color: #7bc67e; }
        .fsc-select { appearance: none; padding: 0.4rem 1.6rem 0.4rem 0.6rem; border-radius: 0.6rem; border: 1.5px solid #dcfce7; background: white; font-size: 0.75rem; font-weight: 700; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%237bc67e' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.5rem center; }
        .fsc-select:focus { outline: none; border-color: #7bc67e; }
      `}</style>
      <BoldFooter />
    </div>
  );
}

// ============================================================================
// SectionBuilder — one card per set (Match Day / Training / Tracksuit)
// ============================================================================
function SectionBuilder({ index, section, gymBagPrice, value, onChange }) {
  const [detailsOpen, setDetailsOpen] = useState({}); // { [variant_id]: true }
  const chosenVariant = section.variants.find((v) => v.id === value.variant_id) || null;
  const hasVariant = !!chosenVariant;

  // Recompute qty + unit price whenever inputs change.
  useEffect(() => {
    if (!hasVariant) {
      if (value.__qty || value.__unit_price) onChange({ __qty: 0, __unit_price: 0 });
      return;
    }
    let qty = 0;
    qty = (value.roster || []).filter((r) => r?.name?.trim() || r?.number?.trim()).length;
    const unit = Number(chosenVariant.price || 0);
    if (value.__qty !== qty || value.__unit_price !== unit) {
      onChange({ __qty: qty, __unit_price: unit });
    }
  }, [value.roster, value.variant_id]);

  const setRoster = (idx, patch) => {
    const cur = value.roster || [];
    const next = cur.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange({ roster: next });
  };
  const addRosterRow = () => onChange({ roster: [...(value.roster || []), { name: "", number: "", top: "", bottom: "", sock: "" }] });
  const removeRosterRow = (idx) => onChange({ roster: (value.roster || []).filter((_, i) => i !== idx) });

  return (
    <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid={`fsc-section-${section.key}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-nunito font-black text-2xl"><span className="text-[#7bc67e]">{index}.</span> {section.title}</h2>
          <p className="text-xs text-[#4b5563] mt-0.5">{section.subtitle}</p>
        </div>
        {(section.included_items || []).length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[45%]">
            {section.included_items.map((it) => (
              <span key={it} className="text-[10px] uppercase tracking-wider font-extrabold bg-[#f0fdf4] text-[#166534] rounded-full px-2 py-0.5">
                {it} included
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Brand tiles */}
      <div className="mt-4 grid sm:grid-cols-2 gap-3" data-testid={`fsc-brands-${section.key}`}>
        {section.variants.map((variant) => {
          const isChosen = value.variant_id === variant.id;
          const isOpen = detailsOpen[variant.id] || false;
          return (
            <div
              key={variant.id}
              className={`rounded-2xl border-2 transition ${isChosen ? "border-[#7bc67e] shadow-md bg-[#f0fdf4]" : "border-[#dcfce7] hover:border-[#7bc67e]"}`}
              data-testid={`fsc-brand-${section.key}-${variant.id}`}
            >
              <button
                type="button"
                onClick={() => onChange({
                  variant_id: isChosen ? null : variant.id,
                  colour: isChosen ? null : (variant.colours?.[0]?.name || ""),
                  roster: isChosen ? [] : [{ name: "", number: "", top: "", bottom: "", sock: "" }],
                  include_gym_bag: false,
                })}
                className="w-full text-left p-3 flex items-center gap-3"
              >
                {variant.image
                  ? <img src={variant.image} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-16 h-16 rounded-xl bg-[#dcfce7] grid place-items-center flex-shrink-0"><Check size={22} className="text-[#7bc67e]" /></div>}
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-sm truncate">{variant.brand} {variant.name}</div>
                  <div className="text-xs text-[#4b5563]">£{Number(variant.price).toFixed(2)} per kit</div>
                </div>
                <span className={`w-8 h-8 grid place-items-center rounded-full ${isChosen ? "bg-[#7bc67e] text-[#1a1a1a]" : "bg-[#f0fdf4]"}`}>
                  {isChosen ? <Check size={14} /> : <Plus size={16} />}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDetailsOpen((d) => ({ ...d, [variant.id]: !d[variant.id] }))}
                className="w-full px-3 pb-2 pt-0.5 flex items-center justify-between text-[11px] font-extrabold text-[#4b5563] hover:text-[#1a1a1a]"
                data-testid={`fsc-brand-details-${section.key}-${variant.id}`}
              >
                <span>Details, sizes &amp; description</span>
                <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t-2 border-[#dcfce7] p-3 text-xs space-y-2 bg-white rounded-b-2xl">
                  {variant.description && <p className="text-[#4b5563]">{variant.description}</p>}
                  {(variant.included_items || []).length > 0 && (
                    <div><strong className="text-[#166534]">Includes:</strong> {(variant.included_items).join(", ")}</div>
                  )}
                  {(variant.colours || []).length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong>Colours:</strong>
                      {(variant.colours || []).map((c) => (
                        <span key={c.name} className="inline-flex items-center gap-1 bg-[#f0fdf4] rounded-full px-2 py-0.5">
                          <span className="w-2.5 h-2.5 rounded-full border border-white shadow-inner" style={{ background: c.hex }} /> {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {(variant.sizes || []).length > 0 && (
                    <div><strong>Available sizes:</strong> {(variant.sizes).join(" · ")}</div>
                  )}
                  {variant.size_guide && (
                    <div className="mt-2 p-2 rounded-lg bg-[#f8fafc] whitespace-pre-wrap text-[11px] text-[#374151]">
                      {variant.size_guide}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Colour + sizing appear once a brand is chosen */}
      {hasVariant && (
        <div className="mt-4 space-y-4 border-t-2 border-[#dcfce7] pt-4" data-testid={`fsc-config-${section.key}`}>
          {(chosenVariant.colours || []).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold mb-1.5">Colour</div>
              <div className="flex flex-wrap gap-2">
                {(chosenVariant.colours || []).map((c) => {
                  const active = value.colour === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => onChange({ colour: c.name })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-extrabold transition ${active ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#dcfce7] hover:border-[#7bc67e]"}`}
                      data-testid={`fsc-colour-${section.key}-${c.name}`}
                    >
                      <span className="w-3 h-3 rounded-full border border-white shadow-inner" style={{ background: c.hex }} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {section.requires_per_player_roster ? (
            <RosterEditor
              sectionKey={section.key}
              roster={value.roster || []}
              sizes={chosenVariant.sizes || []}
              sockSizes={chosenVariant.sock_sizes || []}
              showNumbers={!!section.supports_names_numbers}
              includeSocks={(section.included_items || []).some((i) => i.toLowerCase().includes("sock"))}
              onAdd={addRosterRow}
              onPatch={setRoster}
              onRemove={removeRosterRow}
            />
          ) : null}

          {/* Optional printed gym bag +£X per player, badge + player name */}
          <GymBagOptIn
            sectionKey={section.key}
            checked={!!value.include_gym_bag}
            price={gymBagPrice}
            qty={value.__qty || 0}
            onChange={(next) => onChange({ include_gym_bag: next })}
          />
        </div>
      )}
    </div>
  );
}

// ---------- Gym Bag opt-in ----------
function GymBagOptIn({ sectionKey, checked, price, qty, onChange }) {
  return (
    <label className="flex items-start gap-2 rounded-xl bg-[#f0fdf4] border-2 border-dashed border-[#7bc67e] p-3 cursor-pointer" data-testid={`fsc-gym-bag-${sectionKey}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#7bc67e]"
        data-testid={`fsc-gym-bag-toggle-${sectionKey}`}
      />
      <div className="flex-1 text-xs">
        <div className="font-extrabold flex items-center gap-2 flex-wrap">
          <ShoppingBag size={12} className="text-[#166534]" />
          Add a printed drawstring gym bag per player
          <span className="inline-flex bg-[#fef3c7] text-[#78350f] rounded-full px-2 py-0.5 text-[10px] font-extrabold">+£{price.toFixed(2)} each</span>
        </div>
        <div className="text-[#4b5563] mt-0.5">Badge + player name printed on the bag — perfect for match day kit, training gear or travel. {qty > 0 && checked ? <span className="font-extrabold text-[#166534]">{qty} bag{qty === 1 ? "" : "s"} · £{(qty * price).toFixed(2)}</span> : null}</div>
      </div>
    </label>
  );
}

// ---------- Per-player Roster (Match Day) ----------
function RosterEditor({ sectionKey, roster, sizes, sockSizes, showNumbers = false, includeSocks = true, onAdd, onPatch, onRemove }) {
  // Static tailwind class combos (Tailwind can't compile dynamic `col-span-${n}` at build time).
  // Layouts:
  //   showNumbers + includeSocks : name-4 · #-1 · top-2 · bottom-2 · sock-2 · del-1  (total 12)
  //   showNumbers, no socks       : name-5 · #-1 · top-3 · bottom-2 · del-1          (total 12)
  //   no #, includeSocks          : name-5 · top-2 · bottom-2 · sock-2 · del-1        (total 12)  (11 → +1 gap absorbed)
  //   no # + no socks             : name-6 · top-2 · bottom-3 · del-1                  (total 12)
  const cls = showNumbers && includeSocks
    ? { name: "md:col-span-4", num: "md:col-span-1", top: "md:col-span-2", bottom: "md:col-span-2", sock: "md:col-span-2" }
    : showNumbers && !includeSocks
      ? { name: "md:col-span-5", num: "md:col-span-1", top: "md:col-span-3", bottom: "md:col-span-2" }
      : !showNumbers && includeSocks
        ? { name: "md:col-span-5", top: "md:col-span-2", bottom: "md:col-span-2", sock: "md:col-span-2" }
        : { name: "md:col-span-6", top: "md:col-span-2", bottom: "md:col-span-3" };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold">Squad roster · labelled by name</div>
      </div>
      <div className="text-xs text-[#4b5563] mb-2 flex items-start gap-1.5">
        <Info size={12} className="mt-0.5" /> Each row = one player. Every kit is labelled with the player&apos;s name — top / bottom{includeSocks ? " / sock" : ""} sizes can differ per player.
      </div>
      <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-[#4b5563] font-extrabold mb-1 px-2">
        <div className={cls.name}>Name</div>
        {showNumbers && <div className={cls.num}>#</div>}
        <div className={cls.top}>Top</div>
        <div className={cls.bottom}>Bottom</div>
        {includeSocks && <div className={cls.sock}>Sock</div>}
        <div className="md:col-span-1"></div>
      </div>
      <div className="space-y-1.5">
        {roster.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-2" data-testid={`fsc-player-${sectionKey}-${i}`}>
            <input
              value={r.name || ""} onChange={(e) => onPatch(i, { name: e.target.value })}
              placeholder="Player name" data-testid={`fsc-player-${sectionKey}-${i}-name`}
              className={`col-span-12 ${cls.name} bg-transparent px-2 py-1 text-sm focus:outline-none`}
            />
            {showNumbers && (
              <input
                value={r.number || ""} onChange={(e) => onPatch(i, { number: e.target.value })}
                placeholder="#" data-testid={`fsc-player-${sectionKey}-${i}-number`}
                className={`col-span-3 ${cls.num} bg-transparent px-2 py-1 text-sm md:text-center focus:outline-none md:border-l md:border-[#dcfce7]`}
              />
            )}
            <select
              value={r.top || ""} onChange={(e) => onPatch(i, { top: e.target.value })} className={`col-span-3 ${cls.top} fsc-select`}
              data-testid={`fsc-player-${sectionKey}-${i}-top`}
            >
              <option value="">Top</option>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={r.bottom || ""} onChange={(e) => onPatch(i, { bottom: e.target.value })} className={`col-span-3 ${cls.bottom} fsc-select`}
              data-testid={`fsc-player-${sectionKey}-${i}-bottom`}
            >
              <option value="">Bottom</option>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {includeSocks && (
              <select
                value={r.sock || ""} onChange={(e) => onPatch(i, { sock: e.target.value })} className={`col-span-2 ${cls.sock} fsc-select`}
                data-testid={`fsc-player-${sectionKey}-${i}-sock`}
              >
                <option value="">Sock</option>
                {sockSizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <button
              onClick={() => onRemove(i)} type="button"
              className="col-span-1 md:col-span-1 text-rose-500 hover:bg-rose-50 rounded-full p-1 grid place-items-center justify-self-end"
              data-testid={`fsc-player-${sectionKey}-${i}-remove`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAdd} className="mt-2 inline-flex items-center gap-1.5 text-sm font-nunito font-extrabold text-[#7bc67e] hover:underline" data-testid={`fsc-add-player-${sectionKey}`}>
        <Plus size={14} /> Add player
      </button>
    </div>
  );
}

// ---------- Bulk size grid removed — Full Squad is now roster-only across all sets.
