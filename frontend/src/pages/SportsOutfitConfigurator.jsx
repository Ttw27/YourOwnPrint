import React, { useEffect, useMemo, useRef, useState } from "react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchSportsOutfitConfig, submitQuoteRequest, uploadArtwork } from "../lib/api";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import { toast } from "sonner";
import {
  Plus, Minus, ShieldCheck, Truck, ArrowRight, Loader2, ChevronDown, Check, Info,
  Upload, Image as ImageIcon, X,
} from "lucide-react";

/**
 * Sports Outfit Configurator — simpler builder for gyms, PTs, boxing/thai/kick gyms.
 *
 * Two "sets": Training (top + shorts) and Tracksuit (hoodie + joggers). User can select
 * either or both.
 *
 * Print options:
 *   - FRONT (radio):  Unbranded (£0) | Breast logo (+£3) | Full front (+£6)
 *   - BACK  (opt-in checkbox, tops only): +£4
 *
 * Front breast and full-front are mutually exclusive with each other, but front-of-any-kind
 * can be combined with back. Shorts + joggers never receive back prints (server-side rule).
 *
 * File uploads: designs are uploaded on selection to /api/uploads/artwork (Emergent Object
 * Storage) and the returned URLs are attached to the quote request submission.
 */
const FRONT_MODES = [
  { id: "unbranded",  label: "Unbranded",       key: "unbranded_price" },
  { id: "breast",     label: "Breast logo",     key: "breast_print_price" },
  { id: "full_front", label: "Full front print", key: "full_front_print_price" },
];

export default function SportsOutfitConfigurator() {
  const [cfg, setCfg] = useState(null);
  const [team, setTeam] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [state, setState] = useState({}); // { [sectionKey]: {variant_id, colour, sizes, front_mode, back_on, front_artwork, back_artwork} }
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchSportsOutfitConfig().then(setCfg).catch(() => setCfg(null)); }, []);

  const activeSets = useMemo(() => Object.entries(state).filter(([, v]) => v?.variant_id), [state]);
  // Helper: given a v.sizes state (either {S:n,M:n} legacy or {_split, top:{}, bottom:{}}), compute qty.
  const qtyOf = (sizes) => {
    if (!sizes) return 0;
    if ("top" in sizes || "bottom" in sizes) {
      const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + Number(b || 0), 0);
      return sizes._split ? Math.max(sum(sizes.top), sum(sizes.bottom)) : sum(sizes.top);
    }
    return Object.values(sizes).reduce((a, b) => a + Number(b || 0), 0);
  };
  const printCostOf = (v) => {
    if (!cfg) return 0;
    const frontKey = FRONT_MODES.find((m) => m.id === (v.front_mode || "unbranded"))?.key || "unbranded_price";
    const frontCost = Number(cfg.addons?.[frontKey] || 0);
    const backCost = v.back_on ? Number(cfg.addons?.back_print_price || 0) : 0;
    return frontCost + backCost;
  };
  const totals = useMemo(() => {
    if (!cfg) return { subtotal: 0, totalQty: 0 };
    let subtotal = 0, totalQty = 0;
    activeSets.forEach(([, v]) => {
      const qty = qtyOf(v.sizes);
      const unit = Number(v.__unit_price || 0) + printCostOf(v);
      subtotal += unit * qty;
      totalQty += qty;
    });
    return { subtotal, totalQty };
  }, [activeSets, cfg]);

  if (!cfg) {
    return <div className="min-h-screen grid place-items-center bg-white"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  }
  const { sections, addons, proof_days } = cfg;

  const patchSection = (key, patch) => setState((s) => ({ ...s, [key]: { ...(s[key] || {}), ...patch } }));

  const onSubmit = async () => {
    if (!team.name.trim() || !team.contact_email.trim()) {
      toast.error("Please fill in team / gym name and email."); return;
    }
    if (!activeSets.length || totals.totalQty === 0) {
      toast.error("Pick a kit and add at least one size."); return;
    }
    setBusy(true);
    try {
      const summaryLines = [];
      const attachments = [];
      activeSets.forEach(([sectionKey, v]) => {
        const sec = sections.find((s) => s.key === sectionKey);
        const variant = sec?.variants.find((x) => x.id === v.variant_id);
        const brandLabel = `${variant?.brand ? variant.brand + " " : ""}${variant?.name || "Standard"}`.trim();
        const qty = qtyOf(v.sizes);
        const frontLabel = FRONT_MODES.find((m) => m.id === (v.front_mode || "unbranded"))?.label || "Unbranded";
        const unit = Number(variant?.price || 0) + printCostOf(v);
        const printParts = [frontLabel];
        if (v.back_on) printParts.push("Back print");
        summaryLines.push(`[${sec.title}] ${brandLabel} — colour: ${v.colour || "n/a"} — print: ${printParts.join(" + ")} — ${qty} kits @ £${unit.toFixed(2)}`);
        const sizeParts = [];
        const sz = v.sizes || {};
        const splitOn = !!sz._split;
        Object.entries(sz.top || {}).forEach(([s, q]) => q > 0 && sizeParts.push(`${s}×${q}${splitOn ? " (top)" : ""}`));
        if (splitOn) Object.entries(sz.bottom || {}).forEach(([s, q]) => q > 0 && sizeParts.push(`${s}×${q} (bottom)`));
        if (sizeParts.length) summaryLines.push(`  · sizes: ${sizeParts.join(", ")}`);
        if (v.front_artwork) {
          summaryLines.push(`  · front artwork: ${v.front_artwork.filename} (${v.front_artwork.absolute_url})`);
          attachments.push({ ...v.front_artwork, section: sec.title, purpose: "front-artwork" });
        }
        if (v.back_on && v.back_artwork) {
          summaryLines.push(`  · back artwork: ${v.back_artwork.filename} (${v.back_artwork.absolute_url})`);
          attachments.push({ ...v.back_artwork, section: sec.title, purpose: "back-artwork" });
        }
      });
      await submitQuoteRequest({
        kind: "team_kit",
        name: team.contact_name?.trim() || team.name.trim(),
        email: team.contact_email.trim(),
        phone: team.contact_phone || "",
        company: team.name.trim(),
        sport: "",
        kit_type: "sports-outfit-configurator",
        quantity: totals.totalQty,
        deadline: "",
        message: `Sports Outfit Configurator quote — estimated subtotal £${totals.subtotal.toFixed(2)}.\n${summaryLines.join("\n")}`,
        roster: [],
        attachments,
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
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid="sports-outfit-page">
      <BoldNavbar />

      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-[#7bc67e] via-[#fbbf24] to-[#60a5fa]" />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Sports outfit configurator</span>
          <h1 className="font-black text-4xl lg:text-6xl mt-2">Kit your gym, box or class.</h1>
          <p className="text-zinc-300 mt-3 max-w-2xl">Pick a training kit, a tracksuit — or both. Unbranded or add a logo where you want it. Perfect for gyms, PTs, boxing / thai / kick gyms and dance studios.</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 space-y-6" data-testid="soc-main">
          {/* 1. Business */}
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="soc-team">
            <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">1.</span> Your details</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} placeholder="Gym / studio / class name *" className="soc-input" data-testid="soc-team-name" />
              <input value={team.contact_name} onChange={(e) => setTeam({ ...team, contact_name: e.target.value })} placeholder="Your name" className="soc-input" data-testid="soc-contact-name" />
              <input value={team.contact_email} onChange={(e) => setTeam({ ...team, contact_email: e.target.value })} placeholder="Email *" className="soc-input" data-testid="soc-contact-email" />
              <input value={team.contact_phone} onChange={(e) => setTeam({ ...team, contact_phone: e.target.value })} placeholder="Phone (optional)" className="soc-input" data-testid="soc-contact-phone" />
            </div>
          </div>

          {sections.map((section, idx) => (
            <SportsSectionBuilder
              key={section.key}
              index={idx + 2}
              section={section}
              addons={addons}
              value={state[section.key] || {}}
              onChange={(patch) => patchSection(section.key, patch)}
            />
          ))}

          <NeedHelpCTA
            title="Not sure on quantities? Want mockups before you commit?"
            body="Message us with your logo and rough numbers — we'll send back proofs, a tailored quote and colour options."
            presetMessage="Hi! I'd like to kit out my gym / studio — can we chat?"
            testid="soc-need-help"
            variant="banner"
          />
        </section>

        <aside className="lg:col-span-4" data-testid="soc-summary">
          <div className="bg-[#1a1a1a] text-white rounded-3xl p-5 sticky top-24">
            <div className="text-[#7bc67e] text-xs uppercase tracking-[0.3em] font-extrabold">Sports outfit summary</div>
            <div className="mt-2 text-3xl font-black">£{totals.subtotal.toFixed(2)}</div>
            <div className="text-xs text-zinc-400">{totals.totalQty} kits across {activeSets.length} set{activeSets.length === 1 ? "" : "s"}</div>
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
              {activeSets.map(([k, v]) => {
                const sec = sections.find((s) => s.key === k);
                const variant = sec?.variants.find((x) => x.id === v.variant_id);
                const qty = qtyOf(v.sizes);
                const unit = Number(variant?.price || 0) + printCostOf(v);
                return (
                  <div key={k} className="text-xs bg-white/5 rounded-lg p-2" data-testid={`soc-summary-${k}`}>
                    <div className="font-extrabold">{sec.title}</div>
                    <div className="text-zinc-400">{variant?.brand} {variant?.name} · {v.colour || "colour tbc"} · {qty} × £{unit.toFixed(2)}</div>
                  </div>
                );
              })}
              {activeSets.length === 0 && <div className="text-xs text-zinc-500">Pick a kit under Training or Tracksuit to start.</div>}
            </div>
            <button onClick={onSubmit} disabled={busy} className="mt-4 w-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-40 text-[#1a1a1a] font-extrabold py-3 rounded-xl inline-flex items-center justify-center gap-2" data-testid="soc-submit">
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
        .soc-input { width: 100%; padding: 0.65rem 0.9rem; border-radius: 0.85rem; border: 2px solid #dcfce7; background: white; font-size: 0.875rem; }
        .soc-input:focus { outline: none; border-color: #7bc67e; }
      `}</style>
      <BoldFooter />
    </div>
  );
}

function SportsSectionBuilder({ index, section, addons, value, onChange }) {
  const [detailsOpen, setDetailsOpen] = useState({});
  const chosenVariant = section.variants.find((v) => v.id === value.variant_id) || null;
  const hasVariant = !!chosenVariant;

  useEffect(() => {
    if (!hasVariant) {
      if (value.__unit_price) onChange({ __unit_price: 0 });
      return;
    }
    const unit = Number(chosenVariant.price || 0);
    if (value.__unit_price !== unit) onChange({ __unit_price: unit });
  }, [value.variant_id]);

  const bumpSize = (kind, sz, delta) => {
    const sizes = value.sizes || { _split: false, top: {}, bottom: {} };
    const cur = Number(sizes[kind]?.[sz] || 0);
    const nq = Math.max(0, cur + delta);
    const next = { ...sizes, [kind]: { ...(sizes[kind] || {}), [sz]: nq } };
    if (nq === 0) delete next[kind][sz];
    onChange({ sizes: next });
  };
  const toggleSplit = () => {
    const sizes = value.sizes || { _split: false, top: {}, bottom: {} };
    onChange({ sizes: { ...sizes, _split: !sizes._split } });
  };
  const setPrintMode = (id) => onChange({ front_mode: id });
  const toggleBack = () => onChange({ back_on: !value.back_on });
  const currentFrontMode = value.front_mode || "unbranded";
  const currentFrontCost = addons?.[FRONT_MODES.find((p) => p.id === currentFrontMode)?.key || "unbranded_price"] || 0;
  const currentBackCost = value.back_on ? Number(addons?.back_print_price || 0) : 0;

  return (
    <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid={`soc-section-${section.key}`}>
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

      <div className="mt-4 grid sm:grid-cols-2 gap-3" data-testid={`soc-brands-${section.key}`}>
        {section.variants.map((variant) => {
          const isChosen = value.variant_id === variant.id;
          const isOpen = detailsOpen[variant.id] || false;
          return (
            <div key={variant.id} className={`rounded-2xl border-2 transition ${isChosen ? "border-[#7bc67e] shadow-md bg-[#f0fdf4]" : "border-[#dcfce7] hover:border-[#7bc67e]"}`} data-testid={`soc-brand-${section.key}-${variant.id}`}>
              <button
                type="button"
                onClick={() => onChange({
                  variant_id: isChosen ? null : variant.id,
                  colour: isChosen ? null : (variant.colours?.[0]?.name || ""),
                  sizes: isChosen ? null : { _split: false, top: {}, bottom: {} },
                  front_mode: isChosen ? null : "unbranded",
                  back_on: isChosen ? false : false,
                  front_artwork: null,
                  back_artwork: null,
                })}
                className="w-full text-left p-3 flex items-center gap-3"
              >
                {variant.image
                  ? <img src={variant.image} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-16 h-16 rounded-xl bg-[#dcfce7] grid place-items-center flex-shrink-0"><Check size={22} className="text-[#7bc67e]" /></div>}
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-sm truncate">{variant.brand} {variant.name}</div>
                  <div className="text-xs text-[#4b5563]">£{Number(variant.price).toFixed(2)} per kit (before print)</div>
                </div>
                <span className={`w-8 h-8 grid place-items-center rounded-full ${isChosen ? "bg-[#7bc67e] text-[#1a1a1a]" : "bg-[#f0fdf4]"}`}>
                  {isChosen ? <Check size={14} /> : <Plus size={16} />}
                </span>
              </button>
              <button type="button" onClick={() => setDetailsOpen((d) => ({ ...d, [variant.id]: !d[variant.id] }))} className="w-full px-3 pb-2 pt-0.5 flex items-center justify-between text-[11px] font-extrabold text-[#4b5563] hover:text-[#1a1a1a]" data-testid={`soc-brand-details-${section.key}-${variant.id}`}>
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
                    <div className="flex items-center gap-1.5 flex-wrap"><strong>Colours:</strong>
                      {(variant.colours || []).map((c) => (
                        <span key={c.name} className="inline-flex items-center gap-1 bg-[#f0fdf4] rounded-full px-2 py-0.5">
                          <span className="w-2.5 h-2.5 rounded-full border border-white shadow-inner" style={{ background: c.hex }} /> {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {(variant.sizes || []).length > 0 && (<div><strong>Sizes:</strong> {(variant.sizes).join(" · ")}</div>)}
                  {variant.size_guide && (
                    <div className="mt-2 p-2 rounded-lg bg-[#f8fafc] whitespace-pre-wrap text-[11px] text-[#374151]">{variant.size_guide}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasVariant && (
        <div className="mt-4 space-y-4 border-t-2 border-[#dcfce7] pt-4" data-testid={`soc-config-${section.key}`}>
          {(chosenVariant.colours || []).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold mb-1.5">Colour</div>
              <div className="flex flex-wrap gap-2">
                {(chosenVariant.colours || []).map((c) => {
                  const active = value.colour === c.name;
                  return (
                    <button key={c.name} type="button" onClick={() => onChange({ colour: c.name })} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-extrabold transition ${active ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#dcfce7] hover:border-[#7bc67e]"}`} data-testid={`soc-colour-${section.key}-${c.name}`}>
                      <span className="w-3 h-3 rounded-full border border-white shadow-inner" style={{ background: c.hex }} />{c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold mb-1.5">Print — front &amp; back</div>
            <div className="text-xs text-[#4b5563] mb-2 flex items-start gap-1.5">
              <Info size={12} className="mt-0.5" /> Pick a front option — breast and full-front are mutually exclusive with each other. Back print can be added on top of any front option (tops only — shorts &amp; joggers never receive back prints).
            </div>

            {/* FRONT — radio */}
            <div className="text-[11px] font-extrabold text-[#4b5563] mb-1">Front</div>
            <div className="grid sm:grid-cols-3 gap-2">
              {FRONT_MODES.map((m) => {
                const active = currentFrontMode === m.id;
                const cost = Number(addons?.[m.key] || 0);
                return (
                  <button key={m.id} type="button" onClick={() => setPrintMode(m.id)} className={`text-left rounded-xl border-2 p-3 flex items-start gap-2 ${active ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#dcfce7] hover:border-[#7bc67e]"}`} data-testid={`soc-front-${section.key}-${m.id}`}>
                    <span className={`w-4 h-4 rounded-full border-2 mt-0.5 grid place-items-center ${active ? "bg-[#7bc67e] border-[#7bc67e]" : "border-[#dcfce7]"}`}>
                      {active && <Check size={10} className="text-[#1a1a1a]" />}
                    </span>
                    <div className="flex-1">
                      <div className="text-xs font-extrabold">{m.label}</div>
                      <div className="text-[11px] text-[#4b5563]">{cost > 0 ? `+£${cost.toFixed(2)} per kit` : "Included"}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Front artwork uploader — appears when front is not 'unbranded' */}
            {currentFrontMode !== "unbranded" && (
              <div className="mt-3">
                <ArtworkUploader
                  label={`Upload your ${currentFrontMode === "full_front" ? "full-front" : "breast-logo"} artwork`}
                  helper="PNG/JPEG/PDF/AI/EPS/SVG up to 10 MB. High-res preferred. We'll come back with a proof."
                  value={value.front_artwork}
                  onChange={(next) => onChange({ front_artwork: next })}
                  purpose="front-artwork"
                  testid={`soc-front-upload-${section.key}`}
                />
              </div>
            )}

            {/* BACK — checkbox */}
            <div className="text-[11px] font-extrabold text-[#4b5563] mt-4 mb-1">Back (tops only)</div>
            <label className="flex items-start gap-2 rounded-xl border-2 border-dashed border-[#7bc67e] bg-[#f0fdf4] p-3 cursor-pointer" data-testid={`soc-back-${section.key}`}>
              <input type="checkbox" checked={!!value.back_on} onChange={toggleBack} className="mt-0.5 accent-[#7bc67e]" data-testid={`soc-back-toggle-${section.key}`} />
              <div className="flex-1 text-xs">
                <div className="font-extrabold">Add a centred back print</div>
                <div className="text-[#4b5563] mt-0.5">+£{Number(addons?.back_print_price || 0).toFixed(2)} per kit. Applied to the top — never the shorts or joggers.</div>
              </div>
            </label>

            {/* Back artwork uploader */}
            {value.back_on && (
              <div className="mt-3">
                <ArtworkUploader
                  label="Upload your back print artwork"
                  helper="PNG/JPEG/PDF/AI/EPS/SVG up to 10 MB. High-res preferred."
                  value={value.back_artwork}
                  onChange={(next) => onChange({ back_artwork: next })}
                  purpose="back-artwork"
                  testid={`soc-back-upload-${section.key}`}
                />
              </div>
            )}

            {(currentFrontCost > 0 || currentBackCost > 0) && (
              <div className="mt-2 text-[11px] text-[#166534] font-extrabold">
                Selected print: +£{(currentFrontCost + currentBackCost).toFixed(2)} per kit
                {currentFrontCost > 0 && currentBackCost > 0 && (
                  <span className="text-[#4b5563] font-normal"> (front £{currentFrontCost.toFixed(2)} + back £{currentBackCost.toFixed(2)})</span>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold">Sizes &amp; quantities</div>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#4b5563] cursor-pointer" data-testid={`soc-split-toggle-${section.key}`}>
                <input type="checkbox" checked={!!(value.sizes?._split)} onChange={toggleSplit} />
                Different sizes for tops &amp; bottoms?
              </label>
            </div>
            {(() => {
              const splitOn = !!(value.sizes?._split);
              const rows = splitOn ? [{ key: "top", label: "Tops" }, { key: "bottom", label: "Bottoms" }] : [{ key: "top", label: "Kits" }];
              return rows.map((row) => (
                <div key={row.key} className="mb-2">
                  {splitOn && <div className="text-[11px] font-extrabold text-[#4b5563] mb-1">{row.label}</div>}
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5" data-testid={`soc-sizes-${section.key}-${row.key}`}>
                    {(chosenVariant.sizes || []).map((sz) => {
                      const q = Number(value.sizes?.[row.key]?.[sz] || 0);
                      return (
                        <div key={sz} className={`rounded-lg border-2 p-1.5 ${q > 0 ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white"}`}>
                          <div className="text-[10px] font-extrabold text-center">{sz}</div>
                          <div className="flex items-center justify-between mt-0.5">
                            <button onClick={() => bumpSize(row.key, sz, -1)} type="button" className="w-5 h-5 grid place-items-center rounded-full bg-white border" data-testid={`soc-size-minus-${section.key}-${row.key}-${sz}`}><Minus size={9} /></button>
                            <span className="text-xs font-bold min-w-[16px] text-center">{q}</span>
                            <button onClick={() => bumpSize(row.key, sz, 1)} type="button" className="w-5 h-5 grid place-items-center rounded-full bg-[#fbbf24]" data-testid={`soc-size-plus-${section.key}-${row.key}-${sz}`}><Plus size={9} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Artwork uploader (uploads on selection, shows thumbnail + filename) ----------
function ArtworkUploader({ label, helper, value, onChange, purpose, testid }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) { toast.error("File too large (max 10 MB)"); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const uploaded = await uploadArtwork({ dataUrl, filename: file.name, purpose });
      onChange({ ...uploaded, preview: dataUrl.startsWith("data:image/") ? dataUrl : null });
      toast.success(`Uploaded ${file.name}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed — try a smaller file.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = () => onChange(null);

  if (value) {
    return (
      <div className="rounded-xl border-2 border-[#7bc67e] bg-[#f0fdf4] p-3 flex items-center gap-3" data-testid={testid}>
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-white grid place-items-center flex-shrink-0">
          {value.preview ? <img src={value.preview} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-[#7bc67e]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-extrabold truncate">{value.filename}</div>
          <div className="text-[11px] text-[#4b5563]">Uploaded · {(value.size_bytes / 1024).toFixed(0)} KB</div>
        </div>
        <button type="button" onClick={clear} className="text-[#4b5563] hover:text-rose-500 rounded-full p-1" data-testid={`${testid}-remove`}>
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <label className="rounded-xl border-2 border-dashed border-[#7bc67e] bg-[#f0fdf4] p-4 flex items-center gap-3 cursor-pointer hover:bg-[#dcfce7] transition" data-testid={testid}>
      <input ref={inputRef} type="file" accept="image/*,.pdf,.ai,.eps,.svg" onChange={onFile} className="hidden" data-testid={`${testid}-input`} />
      <div className="w-14 h-14 rounded-lg bg-white grid place-items-center flex-shrink-0">
        {uploading ? <Loader2 size={20} className="animate-spin text-[#7bc67e]" /> : <Upload size={20} className="text-[#7bc67e]" />}
      </div>
      <div className="flex-1 text-xs">
        <div className="font-extrabold">{label}</div>
        <div className="text-[#4b5563] mt-0.5">{helper}</div>
      </div>
    </label>
  );
}
