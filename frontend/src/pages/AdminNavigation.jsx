import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchNavigation, adminUpdateNavigation, adminResetNavigation, adminNavigationMissingDefaults, adminNavigationAddMissingDefaults } from "../lib/api";
import { ArrowUp, ArrowDown, Plus, Trash2, Save, RotateCcw, Loader2, Sparkles } from "lucide-react";

const blankItem = () => ({ key: `nav-${Date.now()}`, label: "New menu", to: "/", cta: false, columns: [] });
const blankCol = () => ({ heading: "Column", links: [] });
const blankLink = () => ({ label: "New link", to: "/", badge: "" });

export default function AdminNavigation() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Links the site has added since this menu was last saved. The saved menu
  // overrides the built-in one (so admin edits survive deploys), which means
  // new sections wouldn't otherwise appear here.
  const [missingDefaults, setMissingDefaults] = useState([]);
  const [addingMissing, setAddingMissing] = useState(false);

  async function checkMissing() {
    try {
      const res = await adminNavigationMissingDefaults();
      setMissingDefaults(res?.missing || []);
    } catch { /* non-critical — just don't show the banner */ }
  }

  async function addMissing() {
    setAddingMissing(true);
    try {
      const res = await adminNavigationAddMissingDefaults();
      toast.success(`Added ${res.added} new link${res.added === 1 ? "" : "s"} — your existing menu is untouched`);
      setMissingDefaults([]);
      load();
    } catch { toast.error("Couldn't add the new links"); }
    finally { setAddingMissing(false); }
  }

  async function load() {
    setLoading(true);
    try {
      const cfg = await fetchNavigation();
      setMenu(cfg?.menu || []);
    } catch { toast.error("Failed to load navigation"); }
    finally { setLoading(false); checkMissing(); }
  }
  useEffect(() => { load(); }, []);

  function update(setter) { setMenu((prev) => setter([...prev])); }

  function moveItem(idx, dir) {
    update((arr) => {
      const ni = idx + dir;
      if (ni < 0 || ni >= arr.length) return arr;
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      return arr;
    });
  }
  function moveLink(itemIdx, colIdx, linkIdx, dir) {
    update((arr) => {
      const links = arr[itemIdx].columns[colIdx].links;
      const ni = linkIdx + dir;
      if (ni < 0 || ni >= links.length) return arr;
      [links[linkIdx], links[ni]] = [links[ni], links[linkIdx]];
      return arr;
    });
  }
  function addItem() { update((arr) => { arr.push(blankItem()); return arr; }); }
  function removeItem(idx) { update((arr) => { arr.splice(idx, 1); return arr; }); }
  function addColumn(itemIdx) { update((arr) => { (arr[itemIdx].columns = arr[itemIdx].columns || []).push(blankCol()); return arr; }); }
  function removeColumn(itemIdx, colIdx) { update((arr) => { arr[itemIdx].columns.splice(colIdx, 1); return arr; }); }
  function addLink(itemIdx, colIdx) { update((arr) => { arr[itemIdx].columns[colIdx].links.push(blankLink()); return arr; }); }
  function removeLink(itemIdx, colIdx, linkIdx) { update((arr) => { arr[itemIdx].columns[colIdx].links.splice(linkIdx, 1); return arr; }); }

  async function save() {
    setSaving(true);
    try {
      // Clean: items with columns get to=null
      const cleaned = menu.map((m) => {
        if ((m.columns || []).length > 0) return { ...m, to: null };
        return m;
      });
      await adminUpdateNavigation({ menu: cleaned, version: 1 });
      toast.success("Navigation saved — visible site-wide instantly");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  }
  async function reset() {
    if (!window.confirm("Reset navigation to defaults? Your edits will be lost.")) return;
    try { await adminResetNavigation(); toast.success("Reset to defaults"); load(); }
    catch { toast.error("Reset failed"); }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-navigation">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-black text-3xl">Navigation</h1>
            <p className="text-sm text-[#4b5563]">Edit the top nav. Items with columns become mega-menus. Items without columns become direct links.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="px-3 py-2 bg-white border-2 border-[#fee2e2] text-xs rounded-full font-extrabold inline-flex items-center gap-1 hover:bg-[#fee2e2]" data-testid="admin-nav-reset">
              <RotateCcw size={14} /> Reset
            </button>
            <button onClick={save} disabled={saving} className="px-5 py-2 bg-[#7bc67e] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-[#5eb062] disabled:opacity-50" data-testid="admin-nav-save">
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>

        {missingDefaults.length > 0 && (
          <div className="mt-4 bg-[#f0fdf4] border-2 border-[#7bc67e] rounded-2xl p-4" data-testid="admin-nav-missing-defaults">
            <div className="flex items-start gap-2">
              <Sparkles size={16} className="text-[#166534] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-extrabold text-sm text-[#166534]">
                  {missingDefaults.length} new section{missingDefaults.length === 1 ? "" : "s"} available
                </div>
                <p className="text-[11px] text-[#4b5563] mt-0.5">
                  These pages exist on the site but aren&rsquo;t in your saved menu yet. Adding them leaves everything
                  you&rsquo;ve customised exactly as it is &mdash; unlike Reset, which discards your changes.
                </p>
                <ul className="mt-2 space-y-0.5">
                  {missingDefaults.map((m) => (
                    <li key={m.to} className="text-[11px] font-bold">
                      {m.label} <span className="text-[#9ca3af] font-normal">&rarr; {m.menu_label} / {m.column_heading}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={addMissing}
                  disabled={addingMissing}
                  className="mt-3 px-4 py-2 bg-[#7bc67e] hover:bg-[#5eb062] rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
                  data-testid="admin-nav-add-missing"
                >
                  {addingMissing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add to my menu
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
        ) : (
          <div className="space-y-5 mt-6">
            {menu.map((item, i) => (
              <div key={item.key + i} className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid={`admin-nav-item-${i}`}>
                <div className="flex items-center gap-2">
                  <button onClick={() => moveItem(i, -1)} className="p-1 bg-[#f0fdf4] rounded" title="Move up" data-testid={`admin-nav-up-${i}`}><ArrowUp size={14} /></button>
                  <button onClick={() => moveItem(i, 1)} className="p-1 bg-[#f0fdf4] rounded" title="Move down" data-testid={`admin-nav-down-${i}`}><ArrowDown size={14} /></button>
                  <input value={item.label} onChange={(e) => update((arr) => { arr[i].label = e.target.value; return arr; })} className="input font-extrabold" placeholder="Label" />
                  <input value={item.key} onChange={(e) => update((arr) => { arr[i].key = e.target.value.replace(/[^a-z0-9-]/g, "-"); return arr; })} className="input w-32 text-xs" placeholder="key (unique)" />
                  <label className="text-xs inline-flex items-center gap-1 font-extrabold">
                    <input type="checkbox" checked={!!item.cta} onChange={(e) => update((arr) => { arr[i].cta = e.target.checked; return arr; })} /> CTA
                  </label>
                  <button onClick={() => removeItem(i)} className="p-1 bg-[#fee2e2] rounded text-red-700" title="Delete" data-testid={`admin-nav-del-${i}`}><Trash2 size={14} /></button>
                </div>

                {(item.columns || []).length === 0 ? (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-[#4b5563]">Link to:</span>
                    <input value={item.to || ""} onChange={(e) => update((arr) => { arr[i].to = e.target.value; return arr; })} className="input flex-1" placeholder="/specials" />
                    <button onClick={() => update((arr) => { arr[i].columns = [blankCol()]; arr[i].to = null; return arr; })} className="text-xs underline text-[#7bc67e]">Convert to mega-menu</button>
                  </div>
                ) : (
                  <div className="mt-4 grid md:grid-cols-3 gap-4">
                    {item.columns.map((col, ci) => (
                      <div key={ci} className="bg-[#f8fafc] border border-[#dcfce7] rounded-2xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <input value={col.heading} onChange={(e) => update((arr) => { arr[i].columns[ci].heading = e.target.value; return arr; })} className="input text-xs font-extrabold" placeholder="Column heading" />
                          <button onClick={() => removeColumn(i, ci)} className="p-1 bg-[#fee2e2] rounded text-red-700"><Trash2 size={12} /></button>
                        </div>
                        <div className="space-y-2">
                          {/* Stacked, not side-by-side: three inputs on one row inside a narrow
                              mega-menu column squeezed Label and URL to a few pixels each, so
                              existing links looked blank. */}
                          {col.links.map((lnk, li) => (
                            <div key={li} className="bg-white rounded-xl p-2 border border-[#dcfce7] space-y-1.5" data-testid={`admin-nav-link-${i}-${ci}-${li}`}>
                              <div className="flex items-center gap-1">
                                <button onClick={() => moveLink(i, ci, li, -1)} className="p-0.5 flex-shrink-0" title="Move up"><ArrowUp size={11} /></button>
                                <button onClick={() => moveLink(i, ci, li, 1)} className="p-0.5 flex-shrink-0" title="Move down"><ArrowDown size={11} /></button>
                                <input
                                  value={lnk.label}
                                  onChange={(e) => update((arr) => { arr[i].columns[ci].links[li].label = e.target.value; return arr; })}
                                  className="input text-xs flex-1 min-w-0 font-bold"
                                  placeholder="Menu text (e.g. Hoodies)"
                                />
                                <button onClick={() => removeLink(i, ci, li)} className="p-0.5 text-red-700 flex-shrink-0" title="Delete link"><Trash2 size={12} /></button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  value={lnk.to}
                                  onChange={(e) => update((arr) => { arr[i].columns[ci].links[li].to = e.target.value; return arr; })}
                                  className="input text-xs flex-1 min-w-0"
                                  placeholder="/shop/hoodies"
                                />
                                <input
                                  value={lnk.badge || ""}
                                  onChange={(e) => update((arr) => { arr[i].columns[ci].links[li].badge = e.target.value; return arr; })}
                                  className="input text-xs w-16 flex-shrink-0"
                                  placeholder="Badge"
                                  title="Optional little label, e.g. New"
                                />
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addLink(i, ci)} className="w-full px-2 py-1 bg-[#f0fdf4] hover:bg-[#dcfce7] text-xs rounded-full font-extrabold inline-flex items-center justify-center gap-1"><Plus size={12} /> Add link</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => addColumn(i)} className="border-2 border-dashed border-[#dcfce7] rounded-2xl p-6 text-xs font-extrabold text-[#4b5563] hover:border-[#7bc67e] hover:text-[#7bc67e] inline-flex items-center justify-center gap-1"><Plus size={14} /> Add column</button>
                  </div>
                )}
              </div>
            ))}

            <button onClick={addItem} className="w-full bg-white border-2 border-dashed border-[#dcfce7] rounded-3xl p-6 text-sm font-extrabold text-[#4b5563] hover:border-[#7bc67e] hover:text-[#7bc67e] inline-flex items-center justify-center gap-2" data-testid="admin-nav-add">
              <Plus size={16} /> Add top-level menu item
            </button>
          </div>
        )}
      </div>
      <style>{`
        .input { width: 100%; padding: 0.4rem 0.6rem; border-radius: 0.5rem; border: 1px solid #dcfce7; background: white; font-size: 0.8rem; }
        .input:focus { outline: none; border-color: #7bc67e; }
      `}</style>
    </div>
  );
}
