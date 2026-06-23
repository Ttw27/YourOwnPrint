import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createCheckout, submitQuoteRequest } from "../../lib/api";
import { WhatsAppInline } from "./WhatsAppFAB";
import { Upload, Plus, Trash2, Loader2, Users, ShoppingCart, Send, Lock, Info, Camera } from "lucide-react";

const QUOTE_THRESHOLD = 15;
const SPONSOR_UPCHARGE = 2.50;
const DEFAULT_SIZE = "M";

export default function TeamKitConfigurator({ product }) {
  const navigate = useNavigate();
  const [multiTeam, setMultiTeam] = useState(false);
  const [activeTeam, setActiveTeam] = useState(0);
  const [teams, setTeams] = useState([blankTeam(1)]);
  const [sponsors, setSponsors] = useState([]); // shared across all teams
  const [submitting, setSubmitting] = useState(false);
  const sponsorRef = useRef(null);

  const totalKits = useMemo(() => teams.reduce((s, t) => s + t.roster.reduce((a, r) => a + (Number(r.qty) || 0), 0), 0), [teams]);
  const totalPlayers = useMemo(() => teams.reduce((s, t) => s + t.roster.length, 0), [teams]);
  const quoteOnly = totalKits > QUOTE_THRESHOLD || teams.length > 1 || sponsors.length > 0;

  // Pricing per kit = base + size upcharge (applied per row) + sponsor upcharge (per kit, per sponsor)
  const sponsorAddPerKit = sponsors.length * SPONSOR_UPCHARGE;
  const upcharges = product.size_upcharges || {};
  const lineTotal = useMemo(() => {
    let total = 0;
    teams.forEach((t) => {
      t.roster.forEach((r) => {
        const qty = Number(r.qty) || 0;
        if (qty <= 0) return;
        const unit = product.price + (upcharges[r.size] || 0) + sponsorAddPerKit;
        total += unit * qty;
      });
    });
    return total;
  }, [teams, product, upcharges, sponsorAddPerKit]);

  // ---- Team / roster mutations ----
  const updateTeam = (idx, patch) =>
    setTeams((prev) => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  const addTeam = () => {
    setMultiTeam(true);
    setTeams((prev) => [...prev, blankTeam(prev.length + 1)]);
    setActiveTeam(teams.length);
  };
  const removeTeam = (idx) => {
    setTeams((prev) => prev.filter((_, i) => i !== idx));
    setActiveTeam(0);
    if (teams.length <= 2) setMultiTeam(false);
  };
  const updateRoster = (tIdx, rIdx, patch) =>
    setTeams((prev) => prev.map((t, i) => i === tIdx ? { ...t, roster: t.roster.map((r, j) => j === rIdx ? { ...r, ...patch } : r) } : t));
  const addRow = (tIdx) =>
    setTeams((prev) => prev.map((t, i) => i === tIdx ? { ...t, roster: [...t.roster, blankRow()] } : t));
  const removeRow = (tIdx, rIdx) =>
    setTeams((prev) => prev.map((t, i) => i === tIdx ? { ...t, roster: t.roster.filter((_, j) => j !== rIdx) } : t));
  const quickFill = (tIdx, n) =>
    setTeams((prev) => prev.map((t, i) => i === tIdx ? { ...t, roster: Array.from({ length: n }).map(() => blankRow()) } : t));

  // ---- Image upload helpers ----
  const onPickBadge = (tIdx, file) => readImage(file, (url) => updateTeam(tIdx, { badge: url }));
  const onPickSponsors = (e) => {
    Array.from(e.target.files || []).forEach((f) => readImage(f, (url) => setSponsors((p) => [...p, url])));
    e.target.value = "";
  };
  const removeSponsor = (i) => setSponsors((prev) => prev.filter((_, idx) => idx !== i));

  // ---- Submission ----
  const validate = () => {
    if (teams.some((t) => !t.name.trim())) return "Each team needs a name";
    if (teams.some((t) => !t.badge)) return "Upload a club badge for each team";
    if (totalKits < 1) return "Add at least 1 player to a roster";
    if (teams.some((t) => t.roster.some((r) => !r.size))) return "Each player needs a size";
    return null;
  };

  const submitQuote = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      // Flatten all artwork (every badge + every sponsor)
      const artwork = [...teams.map((t) => t.badge).filter(Boolean), ...sponsors];
      const roster = teams.flatMap((t) => t.roster.map((r) => ({ team: t.name, name: r.name, number: r.number, size: r.size, qty: Number(r.qty) || 1 })));
      const message = [
        `Product: ${product.name} (£${product.price.toFixed(2)}/player)`,
        `Teams (${teams.length}):`,
        ...teams.map((t, i) => `  • ${t.name} — ${t.roster.length} players, ${t.roster.reduce((s, r) => s + (Number(r.qty) || 0), 0)} kits`),
        `Sponsors uploaded: ${sponsors.length}`,
        `Total kits: ${totalKits}`,
        `Indicative total: £${lineTotal.toFixed(2)}`,
      ].join("\n");
      const t0 = teams[0];
      await submitQuoteRequest({
        kind: "team_kit",
        name: t0.contact_name || t0.name,
        email: t0.contact_email,
        phone: t0.contact_phone,
        company: t0.name,
        sport: product.id.includes("rugby") ? "rugby" : "football",
        kit_type: product.id,
        quantity: totalKits,
        message,
        artwork,
        roster,
        product_id: product.id,
      });
      toast.success("Quote request sent! Free proof inbound 🎉");
      navigate("/team-kits");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const directCheckout = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const size_qtys = {};
      teams[0].roster.forEach((r) => {
        const q = Number(r.qty) || 0;
        if (q > 0) size_qtys[r.size] = (size_qtys[r.size] || 0) + q;
      });
      const rosterLines = teams[0].roster
        .map((r) => `${r.name || "—"}#${r.number || "—"}/${r.size}×${r.qty}`)
        .join("|")
        .slice(0, 380);
      const { url } = await createCheckout({
        product_id: product.id,
        size_qtys,
        color: "Custom (per team)",
        placements: [],   // bundle price already includes badge + names
        blank: false,
        origin_url: window.location.origin,
        design_meta: {
          flow: "team_kit_bundle",
          team_name: teams[0].name,
          contact: teams[0].contact_name || "",
          roster: rosterLines,
        },
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Checkout failed");
      setSubmitting(false);
    }
  };

  const team = teams[activeTeam] || teams[0];

  return (
    <div className="space-y-5" data-testid="team-kit-configurator">
      {/* Mode toggle */}
      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="text-[#7bc67e]" size={20} />
            <span className="font-nunito font-extrabold">{multiTeam ? `${teams.length} teams` : "Single team"}</span>
            <span className="text-xs text-[#4b5563]">· {totalKits} kits · {totalPlayers} players</span>
          </div>
          {!multiTeam ? (
            <button data-testid="enable-multi-team" onClick={addTeam} className="inline-flex items-center gap-1.5 text-xs font-nunito font-extrabold bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] px-3 py-1.5 rounded-full transition-colors">
              <Plus size={12} /> Add another team
            </button>
          ) : (
            <button data-testid="add-team" onClick={addTeam} className="inline-flex items-center gap-1.5 text-xs font-nunito font-extrabold bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] px-3 py-1.5 rounded-full transition-colors">
              <Plus size={12} /> Add team
            </button>
          )}
        </div>

        {/* Team tabs */}
        {multiTeam && (
          <div className="mt-4 flex gap-1.5 overflow-x-auto no-scrollbar" data-testid="team-tabs">
            {teams.map((t, i) => (
              <button
                key={i}
                data-testid={`team-tab-${i}`}
                onClick={() => setActiveTeam(i)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-nunito font-extrabold transition-colors ${activeTeam === i ? "bg-[#1a1a1a] text-white" : "bg-[#f0fdf4] hover:bg-[#dcfce7]"}`}
              >
                {t.name || `Team ${i + 1}`} <span className="text-[#7bc67e]">·{t.roster.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active team details */}
      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5" data-testid="active-team-card">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="font-nunito font-extrabold text-lg">Team {activeTeam + 1} details</h3>
          {teams.length > 1 && (
            <button data-testid={`remove-team-${activeTeam}`} onClick={() => removeTeam(activeTeam)} className="text-xs font-nunito font-extrabold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-full inline-flex items-center gap-1">
              <Trash2 size={12} /> Remove team
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <LabeledInput label="Team / club name *" testId={`team-${activeTeam}-name`} v={team.name} onV={(v) => updateTeam(activeTeam, { name: v })} />
          <LabeledInput label="Contact name" testId={`team-${activeTeam}-contact-name`} v={team.contact_name} onV={(v) => updateTeam(activeTeam, { contact_name: v })} />
          <LabeledInput label="Contact email *" type="email" testId={`team-${activeTeam}-contact-email`} v={team.contact_email} onV={(v) => updateTeam(activeTeam, { contact_email: v })} />
          <LabeledInput label="Contact phone" testId={`team-${activeTeam}-contact-phone`} v={team.contact_phone} onV={(v) => updateTeam(activeTeam, { contact_phone: v })} />
        </div>

        {/* Badge */}
        <div className="mt-4">
          <div className="text-xs font-nunito font-bold text-[#1a1a1a] mb-2">Club badge *</div>
          <BadgeUpload badge={team.badge} onPick={(file) => onPickBadge(activeTeam, file)} onClear={() => updateTeam(activeTeam, { badge: null })} testId={`team-${activeTeam}-badge`} />
        </div>

        {/* Roster */}
        <div className="mt-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="text-xs font-nunito font-bold text-[#1a1a1a]">Roster <span className="text-[#4b5563]">({team.roster.length} players)</span></div>
            <select data-testid={`team-${activeTeam}-quick-fill`} onChange={(e) => quickFill(activeTeam, Number(e.target.value))} className="bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-3 py-1.5 text-xs font-bold" defaultValue="">
              <option value="" disabled>Quick add…</option>
              {[5, 11, 15, 18, 22, 25].map((n) => <option key={n} value={n}>{n} blank rows</option>)}
            </select>
          </div>
          <div className="space-y-1.5" data-testid={`team-${activeTeam}-roster`}>
            <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-nunito font-bold uppercase tracking-wider text-[#4b5563] px-2">
              <span className="col-span-5">Name on back</span>
              <span className="col-span-2 text-center">No.</span>
              <span className="col-span-2">Size</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-1" />
            </div>
            {team.roster.map((r, j) => (
              <div key={j} data-testid={`team-${activeTeam}-row-${j}`} className="grid grid-cols-12 gap-2 items-center bg-white border border-[#dcfce7] rounded-xl p-2">
                <input data-testid={`team-${activeTeam}-row-${j}-name`} value={r.name} onChange={(e) => updateRoster(activeTeam, j, { name: e.target.value })} placeholder="Name" className="col-span-5 bg-transparent px-2 py-1 text-sm focus:outline-none" />
                <input data-testid={`team-${activeTeam}-row-${j}-number`} value={r.number} onChange={(e) => updateRoster(activeTeam, j, { number: e.target.value })} placeholder="No." className="col-span-2 bg-transparent px-2 py-1 text-sm text-center focus:outline-none border-l border-[#dcfce7]" />
                <select data-testid={`team-${activeTeam}-row-${j}-size`} value={r.size} onChange={(e) => updateRoster(activeTeam, j, { size: e.target.value })} className="col-span-2 bg-transparent text-sm focus:outline-none">
                  {(product.sizes || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input data-testid={`team-${activeTeam}-row-${j}-qty`} type="number" min={1} value={r.qty} onChange={(e) => updateRoster(activeTeam, j, { qty: e.target.value })} className="col-span-2 bg-transparent text-sm text-center focus:outline-none border-l border-[#dcfce7]" />
                <button data-testid={`team-${activeTeam}-row-${j}-remove`} onClick={() => removeRow(activeTeam, j)} className="col-span-1 text-rose-500 hover:bg-rose-50 rounded-full p-1 grid place-items-center"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button data-testid={`team-${activeTeam}-add-row`} onClick={() => addRow(activeTeam)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-nunito font-extrabold text-[#7bc67e] hover:underline">
            <Plus size={14} /> Add player
          </button>
        </div>
      </div>

      {/* Sponsors (shared) */}
      <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-nunito font-extrabold">Sponsor logos <span className="text-xs text-[#4b5563] font-bold">(optional · +£{SPONSOR_UPCHARGE.toFixed(2)}/kit per sponsor)</span></h3>
          <div className="text-xs font-nunito font-bold text-[#4b5563]">{sponsors.length}/12 uploaded</div>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="sponsor-uploads">
          {sponsors.map((src, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl bg-white border border-[#dcfce7] overflow-hidden">
              <img src={src} alt="" className="w-full h-full object-contain p-1" />
              <button onClick={() => removeSponsor(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center">×</button>
            </div>
          ))}
          {sponsors.length < 12 && (
            <button data-testid="add-sponsor" onClick={() => sponsorRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-[#7bc67e] grid place-items-center text-[#7bc67e] hover:bg-[#f0fdf4]">
              <Plus size={18} />
            </button>
          )}
          <input ref={sponsorRef} type="file" accept="image/*" multiple hidden onChange={onPickSponsors} />
        </div>
        <div className="mt-2 text-xs text-[#4b5563]"><Info size={10} className="inline mr-1" />Sponsors trigger our quote flow so we can lay them out cleanly and send a free proof.</div>
      </div>

      {/* Price summary + CTAs */}
      <div className="bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="kit-price-summary">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Indicative total</div>
            <div className="font-nunito font-black text-4xl mt-1" data-testid="kit-total-price">£{lineTotal.toFixed(2)}</div>
            <div className="text-xs text-neutral-400 mt-1">{totalKits} kits · £{product.price.toFixed(2)}/player base · names+numbers+badge included</div>
            {sponsors.length > 0 && <div className="text-xs text-neutral-400">+ {sponsors.length} sponsor{sponsors.length > 1 ? "s" : ""} (£{(sponsorAddPerKit * totalKits).toFixed(2)} total)</div>}
          </div>
          <div className="max-w-sm text-sm text-neutral-300">
            {quoteOnly ? (
              <>
                {totalKits > QUOTE_THRESHOLD && <>15+ kits — </>}
                {teams.length > 1 && <>multiple teams — </>}
                {sponsors.length > 0 && <>sponsors uploaded — </>}
                we'll send a <strong className="text-[#7bc67e]">free proof</strong> and tailored quote within 1 working day.
              </>
            ) : (
              <>Under 15 kits, single team, no sponsors — pay securely with Stripe. We'll send a proof for sign-off before printing.</>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {quoteOnly ? (
            <button data-testid="submit-quote" onClick={submitQuote} disabled={submitting} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5">
              {submitting ? <><Loader2 className="animate-spin" size={16} /> Sending…</> : <><Send size={16} /> Send quote request</>}
            </button>
          ) : (
            <>
              <button data-testid="kit-direct-checkout" onClick={directCheckout} disabled={submitting} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5">
                {submitting ? <><Loader2 className="animate-spin" size={16} /> Redirecting…</> : <><ShoppingCart size={16} /> Checkout £{lineTotal.toFixed(2)}</>}
              </button>
              <button data-testid="kit-quote-anyway" onClick={submitQuote} disabled={submitting} className="inline-flex items-center gap-2 border-2 border-[#7bc67e] hover:bg-[#7bc67e] hover:text-[#1a1a1a] text-[#7bc67e] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-colors">
                Get a quote first
              </button>
            </>
          )}
          <WhatsAppInline preset={`Hi! Putting together a team kit for ${team.name || "our club"} (~${totalKits} kits${teams.length > 1 ? `, ${teams.length} teams` : ""}).`} label="WhatsApp" />
        </div>
      </div>
    </div>
  );
}

// ---- Helpers ----
function blankTeam(n) {
  return { name: n === 1 ? "First Team" : `Team ${n}`, contact_name: "", contact_email: "", contact_phone: "", badge: null, roster: [blankRow()] };
}
function blankRow() { return { name: "", number: "", size: DEFAULT_SIZE, qty: 1 }; }

function readImage(file, onDone) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 800;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      onDone(c.toDataURL("image/png"));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function LabeledInput({ label, v, onV, type = "text", testId }) {
  return (
    <div>
      <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-1">{label}</label>
      <input data-testid={testId} type={type} value={v} onChange={(e) => onV(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm" />
    </div>
  );
}

function BadgeUpload({ badge, onPick, onClear, testId }) {
  const ref = useRef(null);
  return (
    <div className="flex items-center gap-4">
      <div className="w-24 h-24 rounded-2xl bg-[#f0fdf4] border-2 border-dashed border-[#7bc67e] grid place-items-center overflow-hidden">
        {badge ? <img src={badge} alt="" className="w-full h-full object-contain p-1.5" /> : <Camera className="text-[#7bc67e]" size={26} />}
      </div>
      <div className="flex flex-col gap-1.5">
        <button data-testid={`${testId}-upload`} onClick={() => ref.current?.click()} className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-4 py-2 rounded-full text-sm transition-colors inline-flex items-center gap-1.5">
          <Upload size={14} /> {badge ? "Replace" : "Upload badge"}
        </button>
        {badge && <button data-testid={`${testId}-clear`} onClick={onClear} className="text-xs font-nunito font-bold text-rose-500 hover:underline">Remove</button>}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
