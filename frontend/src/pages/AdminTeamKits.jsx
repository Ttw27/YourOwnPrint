import React, { useEffect, useState } from "react";
import { fetchProducts, fetchTeamKitBrands, createTeamKitBrand, updateTeamKitBrand, deleteTeamKitBrand } from "../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Sparkles } from "lucide-react";

export default function AdminTeamKits() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState({ product_id: "", brand: "", name: "", price: "", image: "", description: "" });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [ps, bs] = await Promise.all([fetchProducts("team-kits", 500), fetchTeamKitBrands()]);
    const items = ps.items || [];
    setProducts(items);
    setBrands(bs);
    if (items.length && !form.product_id) setForm(f => ({ ...f, product_id: items[0].id }));
  };
  useEffect(() => { reload(); }, []);

  const reset = () => setForm({ product_id: products[0]?.id || "", brand: "", name: "", price: "", image: "", description: "" });

  const save = async () => {
    if (!form.product_id || !form.brand.trim() || !form.name.trim() || !form.price) { toast.error("Fill product, brand, name and price"); return; }
    setBusy(true);
    try {
      const payload = { ...form, price: Number(form.price), active: true };
      if (editing) await updateTeamKitBrand(editing, payload);
      else await createTeamKitBrand(payload);
      toast.success(editing ? "Updated" : "Added");
      setEditing(null); reset(); await reload();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };

  const onEdit = (b) => { setEditing(b.id); setForm({ product_id: b.product_id, brand: b.brand, name: b.name, price: String(b.price), image: b.image || "", description: b.description || "" }); };
  const onDelete = async (id) => {
    if (!window.confirm("Delete this brand?")) return;
    setBusy(true);
    try { await deleteTeamKitBrand(id); toast.success("Deleted"); await reload(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Delete failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white min-h-screen font-nunito">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Admin</div>
        <h1 className="font-nunito font-black text-4xl lg:text-5xl mt-2">Team Kit Brands</h1>
        <p className="text-[#4b5563] mt-3 max-w-2xl">Add the kit brands & pricing for each team-kit bundle. Customers will pick a brand on the product page before configuring their team.</p>

        <div className="grid lg:grid-cols-12 gap-6 mt-8">
          <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-[#dcfce7] p-5 h-fit">
            <div className="inline-flex items-center gap-2 text-[#1a1a1a] font-nunito font-extrabold"><Sparkles size={16} className="text-[#7bc67e]" /> {editing ? "Edit brand" : "Add a brand"}</div>
            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-nunito font-bold mb-1">Team-kit bundle</label>
                <select data-testid="admin-product" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm">
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (base £{p.price.toFixed(2)})</option>)}
                </select>
              </div>
              <Input label="Brand *" testId="admin-brand" v={form.brand} onV={(v) => setForm({ ...form, brand: v })} placeholder="Joma · Nike · Adidas · Stanno…" />
              <Input label="Kit name *" testId="admin-name" v={form.name} onV={(v) => setForm({ ...form, name: v })} placeholder="Pro Match · Vector · Stripe…" />
              <Input label="Price per player (£) *" testId="admin-price" type="number" v={form.price} onV={(v) => setForm({ ...form, price: v })} placeholder="24.99" />
              <Input label="Image URL (optional)" testId="admin-image" v={form.image} onV={(v) => setForm({ ...form, image: v })} placeholder="https://…" />
              <div>
                <label className="block text-xs font-nunito font-bold mb-1">Description</label>
                <textarea data-testid="admin-description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2">
                <button data-testid="admin-save" onClick={save} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold rounded-full py-3 text-sm transition-colors">
                  {busy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} {editing ? "Update" : "Add brand"}
                </button>
                {editing && <button onClick={() => { setEditing(null); reset(); }} className="px-4 py-3 rounded-full border border-[#e5e7eb] text-sm font-nunito font-bold hover:bg-[#f0fdf4]">Cancel</button>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
              <div className="font-nunito font-extrabold text-[#1a1a1a]">All brands ({brands.length})</div>
              {brands.length === 0 ? (
                <div className="text-sm text-[#4b5563] mt-3">No brands yet — add one on the left.</div>
              ) : (
                <ul className="mt-3 space-y-2" data-testid="admin-brand-list">
                  {brands.map((b) => {
                    const prod = products.find(p => p.id === b.product_id);
                    return (
                      <li key={b.id} data-testid={`admin-brand-${b.id}`} className="bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-3 flex items-center gap-3 justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-nunito font-extrabold text-sm">{b.brand} · {b.name}</div>
                          <div className="text-xs text-[#4b5563] mt-0.5 truncate">For {prod?.name || b.product_id} · £{b.price.toFixed(2)}/player</div>
                          {b.description && <div className="text-xs text-[#4b5563] mt-0.5">{b.description}</div>}
                        </div>
                        <div className="flex gap-1.5">
                          <button data-testid={`admin-edit-${b.id}`} onClick={() => onEdit(b)} className="text-xs font-nunito font-extrabold bg-white hover:bg-[#dcfce7] border border-[#dcfce7] rounded-full px-3 py-1.5">Edit</button>
                          <button data-testid={`admin-delete-${b.id}`} onClick={() => onDelete(b.id)} className="text-xs font-nunito font-extrabold text-rose-500 hover:bg-rose-50 rounded-full px-3 py-1.5 inline-flex items-center gap-1"><Trash2 size={10} /> Delete</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, v, onV, testId, type = "text", placeholder }) {
  return (
    <div>
      <label className="block text-xs font-nunito font-bold mb-1">{label}</label>
      <input data-testid={testId} type={type} value={v} placeholder={placeholder} onChange={(e) => onV(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm" />
    </div>
  );
}
