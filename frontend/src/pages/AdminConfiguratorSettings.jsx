import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminGetConfiguratorSettings, adminUpdateFullSquadAddons, adminUpdateSportsOutfitAddons,
  adminGetPrintPrices, adminSetPrintPrices,
  adminGetDeliverySettings, adminSaveDeliverySettings,
} from "../lib/api";
import { Loader2, Save } from "lucide-react";

const FULL_SQUAD_FIELDS = [
  { key: "sleeve_print_price", label: "Sleeve print", tip: "Optional single-arm print add-on (per kit)" },
  { key: "back_upload_print_price", label: "Back print (uploaded design)", tip: "Non-name back print (per kit)" },
  { key: "back_name_and_number_price", label: "Back name + number", tip: "Applied on Match Day set (per kit)" },
  { key: "gym_bag_addon_price", label: "Printed gym bag", tip: "Optional badge+name printed drawstring bag (per player)" },
];
const SPORTS_OUTFIT_FIELDS = [
  { key: "unbranded_price", label: "Unbranded", tip: "Should be £0 unless you want a base add-on" },
  { key: "breast_print_price", label: "Breast logo", tip: "Small left-breast logo (per kit)" },
  { key: "back_print_price", label: "Back print", tip: "Centred back print - tops only, +£ per kit" },
  { key: "full_front_print_price", label: "Full front print", tip: "Large front - replaces breast option (per kit)" },
];

export default function AdminConfiguratorSettings() {
  const [values, setValues] = useState({ full_squad: {}, sports_outfit: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setValues(await adminGetConfiguratorSettings()); }
    catch { toast.error("Failed to load settings"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const patch = (bucket, key, v) => setValues((s) => ({ ...s, [bucket]: { ...s[bucket], [key]: parseFloat(v) || 0 } }));

  const save = async () => {
    setSaving(true);
    try {
      await adminUpdateFullSquadAddons(values.full_squad);
      await adminUpdateSportsOutfitAddons(values.sports_outfit);
      toast.success("Configurator prices saved");
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-configurator-settings">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Configurator prices</h1>
        <p className="text-sm text-[#4b5563] mb-6">All configurator add-on prices in one place. Changes go live the moment you save - no restart needed.</p>

        <PrintPricesCard />
        <DeliveryCard />

        {loading ? (
          <div className="py-10 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="acs-full-squad">
              <h2 className="font-black text-lg mb-3">Full Squad Configurator</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {FULL_SQUAD_FIELDS.map((f) => (
                  <label key={f.key} className="block" data-testid={`acs-fs-${f.key}`}>
                    <div className="text-xs font-extrabold mb-1">{f.label}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-[#4b5563]">£</span>
                      <input type="number" step="0.01" min="0" value={values.full_squad[f.key] ?? ""} onChange={(e) => patch("full_squad", f.key, e.target.value)} className="input" />
                    </div>
                    <div className="text-[10px] text-[#4b5563] mt-0.5">{f.tip}</div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="acs-sports-outfit">
              <h2 className="font-black text-lg mb-3">Sports Outfit Configurator</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {SPORTS_OUTFIT_FIELDS.map((f) => (
                  <label key={f.key} className="block" data-testid={`acs-so-${f.key}`}>
                    <div className="text-xs font-extrabold mb-1">{f.label}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-[#4b5563]">£</span>
                      <input type="number" step="0.01" min="0" value={values.sports_outfit[f.key] ?? ""} onChange={(e) => patch("sports_outfit", f.key, e.target.value)} className="input" />
                    </div>
                    <div className="text-[10px] text-[#4b5563] mt-0.5">{f.tip}</div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={save} disabled={saving} className="px-5 py-3 bg-[#7bc67e] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-[#5eb062] disabled:opacity-50" data-testid="acs-save">
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save prices
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`.input { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.75rem; border: 2px solid #dcfce7; background: white; font-size: 0.875rem; } .input:focus { outline: none; border-color: #7bc67e; }`}</style>
    </div>
  );
}


// Print prices per position - used on every product page, the basket/checkout
// and by the Bundle builder (a bundle includes one chest-size print per item).
/**
 * Delivery - the choices customers get on the checkout page: free collection,
 * free local delivery (these postcodes), or UK delivery priced by the order's
 * weight (free over a set order value). Weights per garment type are below.
 */
function DeliveryCard() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { adminGetDeliverySettings().then(setS).catch(() => toast.error("Couldn't load delivery settings")); }, []);
  const set = (patch) => setS((x) => ({ ...x, ...patch }));
  const save = async () => {
    setSaving(true);
    try {
      const d = await adminSaveDeliverySettings({
        collection_enabled: s.collection_enabled, local_enabled: s.local_enabled,
        local_postcodes: String(s.local_postcodes_text ?? s.local_postcodes.join(", ")).split(/[ ,]+/).filter(Boolean),
        free_over: Number(s.free_over) || 0, bands: s.bands.map(([kg, p]) => [Number(kg), Number(p)]),
        box_kg: Number(s.box_kg) || 25, extra_box_price: Number(s.extra_box_price) || 0,
        weights: Object.fromEntries(Object.entries(s.weights).map(([k, v]) => [k, Number(v) || 0])),
        international_enabled: !!s.international_enabled,
        zones: Object.fromEntries(Object.entries(s.zones || {}).map(([k, z]) => [k, {
          bands: z.bands.map(([kg, p]) => [Number(kg), Number(p)]), box_kg: Number(z.box_kg) || 20, extra_box_price: Number(z.extra_box_price) || 0,
        }])),
      });
      setS(d); toast.success("Delivery saved - live now");
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };
  if (!s) return null;
  const inp = "border-2 border-[#e5e7eb] rounded-xl px-2 py-1 text-sm";
  return (
    <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5 mb-6" data-testid="acs-delivery">
      <h2 className="font-black text-lg">Delivery</h2>
      <p className="text-xs text-[#4b5563] mb-3">What customers choose from on the checkout page. Prices include VAT.</p>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!s.collection_enabled} onChange={(e) => set({ collection_enabled: e.target.checked })} /> Free collection from you in Leicester</label>
      <label className="flex items-center gap-2 text-sm font-bold mt-2"><input type="checkbox" checked={!!s.local_enabled} onChange={(e) => set({ local_enabled: e.target.checked })} /> Free local delivery to these postcodes:</label>
      <input value={s.local_postcodes_text ?? s.local_postcodes.join(", ")} onChange={(e) => set({ local_postcodes_text: e.target.value })} className={inp + " w-full mt-1"} placeholder="LE1, LE2, LE3" />
      <div className="mt-4 text-sm font-bold">UK delivery by order weight</div>
      <div className="mt-1 space-y-1">
        {s.bands.map(([kg, p], i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            up to <input type="number" step="0.5" value={kg} onChange={(e) => set({ bands: s.bands.map((b, j) => (j === i ? [e.target.value, b[1]] : b)) })} className={inp + " w-20"} /> kg
            = £<input type="number" step="0.01" value={p} onChange={(e) => set({ bands: s.bands.map((b, j) => (j === i ? [b[0], e.target.value] : b)) })} className={inp + " w-24"} />
            <button onClick={() => set({ bands: s.bands.filter((_, j) => j !== i) })} className="text-rose-500 text-xs">remove</button>
          </div>
        ))}
        <button onClick={() => set({ bands: [...s.bands, [Number(s.bands[s.bands.length - 1]?.[0] || 0) + 5, 0]] })} className="text-xs font-bold text-[#166534]">+ add a band</button>
      </div>
      <div className="mt-2 text-sm flex flex-wrap items-center gap-2">Heavier than that: each extra <input type="number" value={s.box_kg} onChange={(e) => set({ box_kg: e.target.value })} className={inp + " w-16"} /> kg box costs £<input type="number" step="0.01" value={s.extra_box_price} onChange={(e) => set({ extra_box_price: e.target.value })} className={inp + " w-24"} /></div>
      <div className="mt-2 text-sm flex items-center gap-2">Free UK delivery on orders over £<input type="number" value={s.free_over} onChange={(e) => set({ free_over: e.target.value })} className={inp + " w-24"} /> <span className="text-xs text-[#4b5563]">(0 = never free)</span></div>
      <div className="mt-5 border-t-2 border-[#f0fdf4] pt-4">
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!s.international_enabled} onChange={(e) => set({ international_enabled: e.target.checked })} /> International delivery (customer picks Europe / Rest of the world in the basket)</label>
        {s.international_enabled && Object.entries(s.zones || {}).map(([key, z]) => {
          const setZ = (patch) => set({ zones: { ...s.zones, [key]: { ...z, ...patch } } });
          return (
            <div key={key} className="mt-3 bg-[#f8fafc] rounded-2xl p-3" data-testid={`delivery-zone-${key}`}>
              <div className="text-sm font-black">{key === "europe" ? "Europe" : "Rest of the world"} <span className="text-xs font-normal text-[#4b5563]">({(z.countries || []).length} countries)</span></div>
              {z.bands.map(([kg, p], i) => (
                <div key={i} className="flex items-center gap-2 text-sm mt-1">
                  up to <input type="number" step="0.5" value={kg} onChange={(e) => setZ({ bands: z.bands.map((b, j) => (j === i ? [e.target.value, b[1]] : b)) })} className={inp + " w-20"} /> kg
                  = £<input type="number" step="0.01" value={p} onChange={(e) => setZ({ bands: z.bands.map((b, j) => (j === i ? [b[0], e.target.value] : b)) })} className={inp + " w-24"} />
                </div>
              ))}
              <div className="mt-1 text-sm flex flex-wrap items-center gap-2">Heavier: each extra <input type="number" value={z.box_kg} onChange={(e) => setZ({ box_kg: e.target.value })} className={inp + " w-16"} /> kg box £<input type="number" step="0.01" value={z.extra_box_price} onChange={(e) => setZ({ extra_box_price: e.target.value })} className={inp + " w-24"} /></div>
            </div>
          );
        })}
      </div>
      <details className="mt-4">
        <summary className="text-sm font-bold cursor-pointer">Garment weights (kg) - matched on the product name</summary>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(s.weights).map(([k, v]) => (
            <label key={k} className="text-xs flex items-center justify-between gap-2 border border-[#eef2f7] rounded-lg px-2 py-1">{k}
              <input type="number" step="0.05" value={v} onChange={(e) => set({ weights: { ...s.weights, [k]: e.target.value } })} className={inp + " w-16"} />
            </label>
          ))}
        </div>
      </details>
      <button onClick={save} disabled={saving} className="mt-4 inline-flex items-center gap-2 bg-[#1a1a1a] text-white font-extrabold rounded-full px-5 py-2 text-sm disabled:opacity-50">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save delivery
      </button>
    </div>
  );
}

function PrintPricesCard() {
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    adminGetPrintPrices().then((d) => setRows(d.placements || [])).catch(() => toast.error("Couldn't load print prices"));
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      const d = await adminSetPrintPrices(Object.fromEntries(rows.map((r) => [r.id, Number(r.price) || 0])));
      setRows(d.placements);
      toast.success("Print prices saved - live now");
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5 mb-6" data-testid="acs-print-prices">
      <h2 className="font-black text-lg">Print prices</h2>
      <p className="text-xs text-[#4b5563] mb-3">Price per item for each print position, including VAT. Used on every product page and at checkout.
        Bulk bundles include one chest print per item at the price below - bundles already created keep the price they were made with.</p>
      {!rows ? <Loader2 className="animate-spin text-[#7bc67e]" /> : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {rows.map((r) => (
              <label key={r.id} className="block">
                <span className="text-xs font-extrabold text-[#4b5563]">{r.label}</span>
                <div className="mt-1 flex items-center gap-1 bg-white border-2 border-[#e5e7eb] rounded-xl px-3 py-2 focus-within:border-[#7bc67e]">
                  <span className="text-sm text-[#4b5563]">£</span>
                  <input type="number" step="0.01" min="0" value={r.price} onChange={(e) => setRows(rows.map((x) => x.id === r.id ? { ...x, price: e.target.value } : x))} className="w-full text-sm font-bold focus:outline-none" data-testid={`acs-print-${r.id}`} />
                  <span className="text-[10px] text-[#9ca3af] whitespace-nowrap">£{((Number(r.price) || 0) / 1.2).toFixed(2)} ex VAT</span>
                </div>
              </label>
            ))}
          </div>
          <button onClick={save} disabled={saving} className="mt-4 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 text-[#1a1a1a] font-extrabold text-sm rounded-full px-5 py-2.5" data-testid="acs-print-save">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save print prices
          </button>
        </>
      )}
    </div>
  );
}
