import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminListIntegrations, adminUpdateIntegrations } from "../lib/api";
import { Save, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

export default function AdminIntegrations() {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState({});

  async function load() {
    setLoading(true);
    try {
      const list = await adminListIntegrations();
      setItems(list);
      const init = {};
      list.forEach((it) => { init[it.key] = ""; });
      setDraft(init);
    } catch { toast.error("Failed to load integrations"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    // Only send keys with a typed value (empty means "leave as is")
    const values = {};
    Object.entries(draft).forEach(([k, v]) => { if (v && v.trim()) values[k] = v.trim(); });
    if (Object.keys(values).length === 0) { toast.info("Nothing to save — type a value into at least one field"); return; }
    setSaving(true);
    try {
      await adminUpdateIntegrations(values);
      toast.success("Integration keys saved");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  }

  async function clearOne(key) {
    if (!window.confirm("Clear this key? The site will fall back to the .env value if one exists.")) return;
    try { await adminUpdateIntegrations({ [key]: "" }); toast.success("Cleared"); load(); }
    catch { toast.error("Clear failed"); }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-integrations">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Integrations</h1>
        <p className="text-sm text-[#4b5563] mb-6">Paste API keys here once and the site is hooked up. Keys are stored encrypted-at-rest in Mongo. If a key is blank, the site falls back to the matching <code className="bg-white px-1.5 py-0.5 rounded">.env</code> value.</p>

        {loading ? (
          <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
        ) : (
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.key} className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid={`admin-integration-${it.key}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-black text-base">{it.label}</div>
                    <div className="text-xs text-[#4b5563] mt-1 leading-relaxed max-w-xl">{it.help}</div>
                  </div>
                  {it.is_set ? (
                    <span className="text-xs inline-flex items-center gap-1 text-[#7bc67e] font-extrabold whitespace-nowrap">
                      <CheckCircle2 size={14} /> Set ({it.source === "db" ? "saved" : ".env"})
                    </span>
                  ) : (
                    <span className="text-xs inline-flex items-center gap-1 text-[#f59e0b] font-extrabold whitespace-nowrap">
                      <AlertCircle size={14} /> Not set
                    </span>
                  )}
                </div>

                {it.is_set && it.kind === "secret" && (
                  <div className="text-xs text-[#4b5563] mb-2 font-mono bg-[#f8fafc] px-3 py-1.5 rounded inline-block">
                    Current: {it.masked}
                    <button onClick={() => clearOne(it.key)} className="ml-3 text-red-600 underline">clear</button>
                  </div>
                )}
                {it.is_set && it.kind === "text" && (
                  <div className="text-xs text-[#4b5563] mb-2 font-mono bg-[#f8fafc] px-3 py-1.5 rounded inline-block">
                    Current: {it.masked}
                    <button onClick={() => clearOne(it.key)} className="ml-3 text-red-600 underline">clear</button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type={it.kind === "secret" && !reveal[it.key] ? "password" : "text"}
                    value={draft[it.key] || ""}
                    onChange={(e) => setDraft({ ...draft, [it.key]: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-[#dcfce7] focus:border-[#7bc67e] outline-none text-sm font-mono"
                    placeholder={it.is_set ? "Type new value to replace…" : "Paste your key here"}
                    data-testid={`admin-integration-input-${it.key}`}
                  />
                  {it.kind === "secret" && (
                    <button onClick={() => setReveal({ ...reveal, [it.key]: !reveal[it.key] })} className="p-2 bg-[#f0fdf4] rounded-full" title="Show / hide">
                      {reveal[it.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-[#9ca3af] mt-1.5">env var: <code>{it.env_var}</code></div>
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <button onClick={save} disabled={saving} className="px-6 py-3 bg-[#7bc67e] text-[#1a1a1a] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-[#5eb062] disabled:opacity-50" data-testid="admin-integrations-save">
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Save changes
              </button>
            </div>

            <div className="mt-8 bg-[#1a1a1a] text-white rounded-3xl p-6">
              <div className="text-[#7bc67e] text-xs uppercase tracking-[0.3em] font-extrabold">Deployment-ready checklist</div>
              <ul className="mt-3 space-y-2 text-sm">
                <ChecklistRow ok={items.find((i) => i.key === "stripe_api_key")?.is_set}>Stripe — payments will fail without this</ChecklistRow>
                <ChecklistRow ok={items.find((i) => i.key === "contact_email")?.is_set}>Contact email — where quote requests are sent</ChecklistRow>
                <ChecklistRow ok={items.find((i) => i.key === "whatsapp_number")?.is_set}>WhatsApp number — used in the WhatsApp FAB and bespoke flow</ChecklistRow>
                <ChecklistRow ok={items.find((i) => i.key === "resend_api_key")?.is_set}>Resend — transactional emails (optional)</ChecklistRow>
                <ChecklistRow ok={items.find((i) => i.key === "removebg_api_key")?.is_set}>remove.bg — background removal in Designer (optional)</ChecklistRow>
                <ChecklistRow ok={items.find((i) => i.key === "cutoutpro_api_key")?.is_set}>Cutout.pro — AI image effects in Designer (optional)</ChecklistRow>
              </ul>
              <a href="https://app.emergent.sh/?utm_source=integrations" target="_blank" rel="noreferrer" className="text-xs mt-4 inline-flex items-center gap-1 text-[#7bc67e]">
                Deploy via Emergent <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({ ok, children }) {
  return (
    <li className="inline-flex items-start gap-2">
      {ok ? <CheckCircle2 size={16} className="text-[#7bc67e] mt-0.5" /> : <AlertCircle size={16} className="text-[#f59e0b] mt-0.5" />}
      <span>{children}</span>
    </li>
  );
}
