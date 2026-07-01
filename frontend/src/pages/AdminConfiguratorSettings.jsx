import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminGetConfiguratorSettings, adminUpdateFullSquadAddons, adminUpdateSportsOutfitAddons,
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
  { key: "back_print_price", label: "Back print", tip: "Centred back print — tops only, +£ per kit" },
  { key: "full_front_print_price", label: "Full front print", tip: "Large front — replaces breast option (per kit)" },
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
        <p className="text-sm text-[#4b5563] mb-6">All configurator add-on prices in one place. Changes go live the moment you save — no restart needed.</p>

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
