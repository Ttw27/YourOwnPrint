import React, { useEffect, useState } from "react";
import { adminListLeaversTemplates, adminCreateLeaversTemplate, adminUpdateLeaversTemplate, adminDeleteLeaversTemplate } from "../lib/api";
import { toast } from "sonner";
import { Plus, Save, Trash2, ImagePlus } from "lucide-react";

export default function AdminLeaversTemplates() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", image: "", active: true, sort_order: 100 });

  const reload = async () => {
    setLoading(true);
    try { setItems(await adminListLeaversTemplates()); }
    catch { toast.error("Failed to load templates"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const addTemplate = async () => {
    if (!draft.title.trim() || !draft.image.trim()) { toast.error("Title and image URL are required"); return; }
    setBusy(true);
    try {
      await adminCreateLeaversTemplate({ ...draft, sort_order: Number(draft.sort_order) || 100 });
      toast.success("Template added");
      setDraft({ title: "", description: "", image: "", active: true, sort_order: 100 });
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const update = (id, patch) => setItems(items.map(t => t.id === id ? { ...t, ...patch, _dirty: true } : t));
  const save = async (t) => {
    setBusy(true);
    try {
      await adminUpdateLeaversTemplate(t.id, {
        title: t.title, description: t.description || "", image: t.image,
        active: !!t.active, sort_order: Number(t.sort_order) || 100,
      });
      toast.success("Saved");
      reload();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!confirm("Delete this design template?")) return;
    try { await adminDeleteLeaversTemplate(id); toast.success("Deleted"); reload(); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="admin-leavers-templates-page">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl">Leavers&apos; design templates</h1>
        <p className="text-sm text-[#4b5563] mt-1">Displayed on the leavers&apos; landing page and in the order flow. Reorder using <code>sort_order</code> (lower = first).</p>

        <section className="mt-6 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-4" data-testid="alt-new">
          <h2 className="font-extrabold mb-2 flex items-center gap-2"><Plus size={16} className="text-[#7bc67e]" /> New template</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <Field testid="alt-new-title" label="Title *" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
            <Field testid="alt-new-sort" label="Sort order" type="number" value={draft.sort_order} onChange={(v) => setDraft({ ...draft, sort_order: v })} />
            <Field testid="alt-new-image" label="Image URL *" value={draft.image} onChange={(v) => setDraft({ ...draft, image: v })} className="sm:col-span-2" placeholder="https://images.example.com/leavers-design.jpg" />
            <Field testid="alt-new-desc" label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} className="sm:col-span-2" />
          </div>
          <button onClick={addTemplate} disabled={busy} className="mt-3 inline-flex items-center gap-1 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold text-xs px-3 py-1.5 rounded-full" data-testid="alt-new-submit">
            <ImagePlus size={12} /> Add template
          </button>
        </section>

        <section className="mt-6 space-y-3" data-testid="alt-list">
          {loading ? <div className="text-sm text-[#4b5563]">Loading…</div> :
            items.length === 0 ? <div className="text-sm text-[#4b5563]">No templates yet — add one above.</div> :
            items.map((t) => (
              <div key={t.id} className="bg-white border-2 border-[#dcfce7] rounded-2xl p-4 flex flex-col sm:flex-row gap-4" data-testid={`alt-row-${t.id}`}>
                <img src={t.image} alt="" className="w-32 h-32 object-cover rounded-xl bg-[#f0fdf4] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Field testid={`alt-${t.id}-title`} label="Title" value={t.title} onChange={(v) => update(t.id, { title: v })} />
                    <Field testid={`alt-${t.id}-sort`} label="Sort order" type="number" value={t.sort_order} onChange={(v) => update(t.id, { sort_order: v })} />
                    <Field testid={`alt-${t.id}-image`} label="Image URL" value={t.image} onChange={(v) => update(t.id, { image: v })} className="sm:col-span-2" />
                    <Field testid={`alt-${t.id}-desc`} label="Description" value={t.description || ""} onChange={(v) => update(t.id, { description: v })} className="sm:col-span-2" />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={!!t.active} onChange={(e) => update(t.id, { active: e.target.checked })} className="w-3.5 h-3.5 accent-[#7bc67e]" data-testid={`alt-${t.id}-active`} />
                      Active
                    </label>
                    <button onClick={() => save(t)} disabled={busy} className="inline-flex items-center gap-1 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold text-xs px-3 py-1.5 rounded-full" data-testid={`alt-${t.id}-save`}>
                      <Save size={11} /> {t._dirty ? "Save *" : "Save"}
                    </button>
                    <button onClick={() => remove(t.id)} className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline" data-testid={`alt-${t.id}-delete`}>
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          }
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, className = "", testid }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-[10px] uppercase tracking-wider text-[#4b5563] font-extrabold mb-1">{label}</div>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-[#dcfce7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#7bc67e]"
        data-testid={testid}
      />
    </label>
  );
}
