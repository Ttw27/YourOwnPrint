import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchFullSquadConfig, submitQuoteRequest } from "../lib/api";
import NeedHelpCTA from "../components/bold/NeedHelpCTA";
import { toast } from "sonner";
import { Plus, Minus, Trash2, ShieldCheck, Truck, ArrowRight, Loader2, Upload, Info } from "lucide-react";

/** Full Squad Configurator — mix match-day + training + tracksuit sets in one order,
 * each item independently priced. Player roster at top applied to match-day items.
 * Non-match-day items can OPT IN to a back print upload (adds a fee).
 */
export default function FullSquadConfigurator() {
  const [cfg, setCfg] = useState(null);
  const [team, setTeam] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "", badge: null });
  const [roster, setRoster] = useState([{ name: "", number: "" }]);
  // items map: { [sectionKey_productId]: { section, product, sizes:{S:n,M:n...}, back_upload_data, sleeve_print:bool }}
  const [items, setItems] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchFullSquadConfig().then(setCfg).catch(() => setCfg(null)); }, []);

  if (!cfg) {
    return <div className="min-h-screen grid place-items-center bg-white"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  }
  const { sections, addons, proof_days } = cfg;

  const keyFor = (section, product) => `${section.key}_${product.id}`;
  const upsertItem = (section, product, patch) => {
    const k = keyFor(section, product);
    setItems((prev) => ({
      ...prev,
      [k]: { section, product, sizes: {}, back_upload_data: null, sleeve_print: false, ...(prev[k] || {}), ...patch },
    }));
  };
  const removeItem = (k) => setItems((prev) => { const n = { ...prev }; delete n[k]; return n; });
  const bumpSize = (k, sz, d) => setItems((prev) => {
    const it = prev[k];
    if (!it) return prev;
    const cur = Number(it.sizes[sz] || 0);
    const nq = Math.max(0, cur + d);
    const sizes = { ...it.sizes, [sz]: nq };
    if (nq === 0) delete sizes[sz];
    return { ...prev, [k]: { ...it, sizes } };
  });

  const qtyOfItem = (it) => Object.values(it.sizes).reduce((a, b) => a + Number(b || 0), 0);
  const linePriceOfItem = (it) => {
    const qty = qtyOfItem(it);
    let unit = Number(it.product.price || 0);
    if (it.sleeve_print) unit += Number(addons.sleeve_print_price || 0);
    if (it.back_upload_data && !it.section.supports_names_numbers) unit += Number(addons.back_upload_print_price || 0);
    return { unit, total: unit * qty, qty };
  };
  const totals = useMemo(() => {
    let subtotal = 0, totalQty = 0;
    Object.values(items).forEach((it) => {
      const l = linePriceOfItem(it);
      subtotal += l.total;
      totalQty += l.qty;
    });
    return { subtotal, totalQty };
  }, [items, addons]);

  const bumpPlayer = (i, patch) => setRoster((r) => r.map((row, j) => j === i ? { ...row, ...patch } : row));
  const addPlayer = () => setRoster((r) => [...r, { name: "", number: "" }]);
  const removePlayer = (i) => setRoster((r) => r.filter((_, j) => j !== i));

  const canSubmit = team.name.trim() && team.contact_email.trim() && totals.totalQty > 0 &&
    Object.values(items).every((it) => qtyOfItem(it) > 0);

  const onSubmit = async () => {
    if (!canSubmit) { toast.error("Fill team name + email and add at least one item."); return; }
    setBusy(true);
    try {
      const summary = Object.values(items).map((it) => {
        const sizes = Object.entries(it.sizes).map(([s, q]) => `${s}×${q}`).join(", ");
        return `[${it.section.title}] ${it.product.name} — ${sizes}${it.sleeve_print ? " +sleeve" : ""}${it.back_upload_data ? " +back-upload" : ""}`;
      }).join(" | ");
      await submitQuoteRequest({
        flow: "full-squad-configurator",
        team_name: team.name,
        contact_name: team.contact_name,
        contact_email: team.contact_email,
        contact_phone: team.contact_phone,
        message: `Full Squad quote — Roster: ${roster.filter(r => r.name.trim()).length} players. Items: ${summary}. Estimated subtotal £${totals.subtotal.toFixed(2)}.`,
      });
      toast.success("Quote sent — we'll be in touch within 1 working day with a proof and price.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't send the quote — try WhatsApp instead.");
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
          <p className="text-zinc-300 mt-3 max-w-2xl">Build the whole squad's setup at once. Match-day gets names + numbers on the back. Training and tracksuit stay clean — or add a back print upload for a small upgrade.</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 space-y-6" data-testid="fsc-main">
          {/* 1. Team */}
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="fsc-team">
            <h2 className="font-nunito font-black text-2xl mb-3"><span className="text-[#7bc67e]">1.</span> Team details</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} placeholder="Team / club name *" className="input" data-testid="fsc-team-name" />
              <input value={team.contact_name} onChange={(e) => setTeam({ ...team, contact_name: e.target.value })} placeholder="Your name" className="input" data-testid="fsc-contact-name" />
              <input value={team.contact_email} onChange={(e) => setTeam({ ...team, contact_email: e.target.value })} placeholder="Email *" className="input" data-testid="fsc-contact-email" />
              <input value={team.contact_phone} onChange={(e) => setTeam({ ...team, contact_phone: e.target.value })} placeholder="Phone (optional)" className="input" data-testid="fsc-contact-phone" />
            </div>
          </div>

          {/* 2. Roster (applied to match-day) */}
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="fsc-roster">
            <h2 className="font-nunito font-black text-2xl mb-1"><span className="text-[#7bc67e]">2.</span> Player roster</h2>
            <div className="text-xs text-[#4b5563] mb-3 flex items-start gap-1.5"><Info size={12} className="mt-0.5" />Names & numbers only apply to <strong>match-day</strong> items. Training and tracksuit stay clean.</div>
            <div className="space-y-1.5">
              {roster.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-2" data-testid={`fsc-player-${i}`}>
                  <input value={r.name} onChange={(e) => bumpPlayer(i, { name: e.target.value })} placeholder="Name" className="col-span-8 bg-transparent px-2 py-1 text-sm focus:outline-none" data-testid={`fsc-player-${i}-name`} />
                  <input value={r.number} onChange={(e) => bumpPlayer(i, { number: e.target.value })} placeholder="No." className="col-span-3 bg-transparent px-2 py-1 text-sm text-center focus:outline-none border-l border-[#dcfce7]" data-testid={`fsc-player-${i}-number`} />
                  <button onClick={() => removePlayer(i)} className="col-span-1 text-rose-500 hover:bg-rose-50 rounded-full p-1 grid place-items-center" data-testid={`fsc-player-${i}-remove`}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={addPlayer} className="mt-2 inline-flex items-center gap-1.5 text-sm font-nunito font-extrabold text-[#7bc67e] hover:underline" data-testid="fsc-add-player"><Plus size={14} /> Add player</button>
          </div>

          {/* 3-5. Sections: match day / training / tracksuit */}
          {sections.map((section, idx) => (
            <div key={section.key} className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid={`fsc-section-${section.key}`}>
              <h2 className="font-nunito font-black text-2xl mb-1"><span className="text-[#7bc67e]">{idx + 3}.</span> {section.title}</h2>
              <p className="text-xs text-[#4b5563] mb-3">{section.subtitle}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {section.garments.map((product) => {
                  const k = keyFor(section, product);
                  const it = items[k];
                  const active = !!it;
                  return (
                    <div key={product.id} className={`rounded-2xl border-2 transition ${active ? "border-[#7bc67e] shadow-md" : "border-[#dcfce7] hover:border-[#7bc67e]"}`} data-testid={`fsc-product-${section.key}-${product.id}`}>
                      <button
                        type="button"
                        onClick={() => active ? removeItem(k) : upsertItem(section, product, {})}
                        className="w-full text-left p-3 flex items-center gap-3"
                      >
                        <img src={product.image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-sm truncate">{product.name}</div>
                          <div className="text-xs text-[#4b5563]">From £{product.price.toFixed(2)}</div>
                        </div>
                        {active
                          ? <span className="w-8 h-8 grid place-items-center rounded-full bg-[#7bc67e] text-[#1a1a1a]"><Trash2 size={14} /></span>
                          : <span className="w-8 h-8 grid place-items-center rounded-full bg-[#f0fdf4] text-[#1a1a1a]"><Plus size={16} /></span>}
                      </button>
                      {active && (
                        <div className="border-t-2 border-[#dcfce7] p-3 space-y-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold mb-1.5">Sizes &amp; qty</div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(product.sizes || []).map((sz) => {
                                const q = Number(it.sizes[sz] || 0);
                                return (
                                  <div key={sz} className={`rounded-lg border-2 p-1.5 ${q > 0 ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white"}`} data-testid={`fsc-size-${section.key}-${product.id}-${sz}`}>
                                    <div className="text-[10px] font-extrabold text-center">{sz}</div>
                                    <div className="flex items-center justify-between mt-0.5">
                                      <button onClick={() => bumpSize(k, sz, -1)} className="w-5 h-5 grid place-items-center rounded-full bg-white border" data-testid={`fsc-size-minus-${section.key}-${product.id}-${sz}`}><Minus size={9} /></button>
                                      <span className="text-xs font-bold min-w-[16px] text-center">{q}</span>
                                      <button onClick={() => bumpSize(k, sz, 1)} className="w-5 h-5 grid place-items-center rounded-full bg-[#fbbf24]" data-testid={`fsc-size-plus-${section.key}-${product.id}-${sz}`}><Plus size={9} /></button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2 text-xs">
                            <label className="inline-flex items-center gap-2 bg-[#f0fdf4] rounded-xl p-2 cursor-pointer">
                              <input type="checkbox" checked={!!it.sleeve_print} onChange={(e) => upsertItem(section, product, { sleeve_print: e.target.checked })} data-testid={`fsc-sleeve-${section.key}-${product.id}`} />
                              <span className="flex-1"><strong>Sleeve print</strong> <span className="text-[#4b5563]">+£{Number(addons.sleeve_print_price).toFixed(2)}/kit</span></span>
                            </label>
                            {!section.supports_names_numbers && (
                              <label className="inline-flex items-center gap-2 bg-[#fff7ed] rounded-xl p-2 cursor-pointer">
                                <input type="checkbox" checked={!!it.back_upload_data} onChange={(e) => upsertItem(section, product, { back_upload_data: e.target.checked ? "pending-upload" : null })} data-testid={`fsc-backprint-${section.key}-${product.id}`} />
                                <span className="flex-1"><strong>Back print</strong> <span className="text-[#4b5563]">+£{Number(addons.back_upload_print_price).toFixed(2)}/kit — you'll upload on the proof email</span></span>
                              </label>
                            )}
                          </div>
                          {section.supports_names_numbers && (
                            <div className="text-xs text-[#4b5563] bg-[#f0fdf4] rounded-xl p-2 inline-flex items-start gap-1.5"><Info size={12} className="mt-0.5" /> Names + numbers <strong className="mx-1">included</strong> — taken from the roster above.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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
            <div className="text-xs text-zinc-400">{totals.totalQty} garments across {Object.keys(items).length} lines</div>
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
              {Object.entries(items).map(([k, it]) => {
                const l = linePriceOfItem(it);
                return (
                  <div key={k} className="text-xs bg-white/5 rounded-lg p-2" data-testid={`fsc-summary-${k}`}>
                    <div className="font-extrabold">{it.product.name}</div>
                    <div className="text-zinc-400">{it.section.title} · {l.qty} × £{l.unit.toFixed(2)} = <span className="text-white font-extrabold">£{l.total.toFixed(2)}</span></div>
                  </div>
                );
              })}
              {Object.keys(items).length === 0 && <div className="text-xs text-zinc-500">Pick garments from the sections to build your squad.</div>}
            </div>
            <button
              onClick={onSubmit}
              disabled={!canSubmit || busy}
              className="mt-4 w-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-40 text-[#1a1a1a] font-extrabold py-3 rounded-xl inline-flex items-center justify-center gap-2"
              data-testid="fsc-submit"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />} Get a proof &amp; final quote
            </button>
            <div className="mt-3 space-y-1 text-[11px] text-zinc-300">
              <div className="inline-flex items-start gap-1.5"><ShieldCheck size={11} className="mt-0.5 text-[#7bc67e]" /><span>We'll send a full proof within {proof_days} working days.</span></div>
              <div className="inline-flex items-start gap-1.5"><Truck size={11} className="mt-0.5 text-[#7bc67e]" /><span>UK printed · low minimums · one point of contact.</span></div>
            </div>
          </div>
        </aside>
      </div>
      <BoldFooter />
    </div>
  );
}
