import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Upload, Trash2, Check } from "lucide-react";
import { uploadDesignImage, createDesign, listDesigns, deleteDesign } from "../lib/api";

const GARMENTS = [
  { slug: "t-shirt", title: "T-Shirt", price: "£14.99" },
  { slug: "sweater", title: "Sweater", price: "£26.99" },
  { slug: "hoodie", title: "Hoodie", price: "£29.99" },
  { slug: "tote-bag", title: "Tote Bag", price: "£12.99" },
  { slug: "tank-top", title: "Tank Top", price: "£14.99" },
  { slug: "long-sleeve", title: "Long Sleeve T-Shirt", price: "£17.99" },
];

/**
 * Admin upload tool for The Design Shop. Upload one print artwork, name it, tick
 * garments + collections, and it creates a ready-to-buy design. Categories are
 * auto-guessed from the name if you leave them blank.
 */
export default function AdminDesignShop() {
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [garments, setGarments] = useState(["t-shirt", "hoodie"]);
  const [cats, setCats] = useState([]);
  const [allCats, setAllCats] = useState([]);
  const [saving, setSaving] = useState(false);
  const [designs, setDesigns] = useState([]);
  const fileRef = useRef(null);

  const load = () => listDesigns().then((d) => { setDesigns(d?.items || []); setAllCats(d?.all_categories || []); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadDesignImage(file);
      setImageUrl(res.url);
      toast.success("Artwork uploaded.");
    } catch { toast.error("Upload failed — try a PNG under 8MB."); }
    finally { setUploading(false); }
  };

  const toggle = (arr, set, val) => set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const save = async () => {
    if (!imageUrl) return toast.error("Upload the print artwork first.");
    if (!name.trim()) return toast.error("Give the design a name.");
    if (garments.length === 0) return toast.error("Pick at least one garment.");
    setSaving(true);
    try {
      const res = await createDesign({ name: name.trim(), design_image: imageUrl, garments, categories: cats.length ? cats : undefined });
      if (res?.ok) {
        toast.success(`"${name}" added to the Design Shop.`);
        setName(""); setImageUrl(""); setCats([]); setGarments(["t-shirt", "hoodie"]);
        if (fileRef.current) fileRef.current.value = "";
        load();
      } else toast.error(res?.error || "Couldn't create the design.");
    } catch { toast.error("Something went wrong."); }
    finally { setSaving(false); }
  };

  const remove = async (id, nm) => {
    if (!window.confirm(`Remove "${nm}" from the Design Shop?`)) return;
    try { await deleteDesign(id); toast.success("Removed."); load(); }
    catch { toast.error("Couldn't remove."); }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 font-nunito text-[#1a1a1a]">
      <div className="text-xs uppercase tracking-[0.3em] text-[#a855f7] font-extrabold">Admin</div>
      <h1 className="font-black text-4xl mt-2 flex items-center gap-3"><Sparkles className="text-[#a855f7]" size={30} /> The Design Shop</h1>
      <p className="text-[#4b5563] mt-2 max-w-2xl">Upload one print artwork, name it, choose garments and collections. It goes straight into the shop, ready to buy. Leave collections blank and we'll guess them from the name.</p>

      {/* Upload + form */}
      <div className="mt-8 grid md:grid-cols-[260px_1fr] gap-6">
        {/* Artwork upload */}
        <div>
          <div className="aspect-square rounded-2xl border-2 border-dashed border-[#e9d5ff] bg-[#faf5ff] grid place-items-center overflow-hidden relative">
            {imageUrl ? (
              <img src={imageUrl} alt="Design preview" className="w-full h-full object-contain p-3" />
            ) : (
              <div className="text-center text-[#a855f7] p-4">
                <Upload size={28} className="mx-auto" />
                <div className="text-sm font-bold mt-2">Upload print artwork</div>
                <div className="text-[11px] text-[#4b5563] mt-1">PNG with transparent background works best</div>
              </div>
            )}
            {uploading && <div className="absolute inset-0 bg-white/70 grid place-items-center"><Loader2 className="animate-spin text-[#a855f7]" /></div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" id="design-file" data-testid="design-file-input" />
          <label htmlFor="design-file" className="mt-3 block text-center cursor-pointer bg-[#a855f7] hover:bg-[#9333ea] text-white font-extrabold rounded-full px-4 py-2.5 text-sm">
            {imageUrl ? "Replace artwork" : "Choose file"}
          </label>
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-[#4b5563]">Design name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gym Now Wine Later" className="mt-1 w-full border-2 border-[#e9d5ff] rounded-xl px-3 py-2.5 text-sm" data-testid="design-name" />
            <p className="text-[11px] text-[#4b5563] mt-1">Collections are auto-guessed from this name if you leave them blank.</p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-[#4b5563]">Available on</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {GARMENTS.map((g) => (
                <button key={g.slug} type="button" onClick={() => toggle(garments, setGarments, g.slug)} className={`flex items-center justify-between gap-2 border-2 rounded-xl px-3 py-2 text-sm font-bold transition ${garments.includes(g.slug) ? "border-[#a855f7] bg-[#faf5ff]" : "border-[#eee] text-[#4b5563]"}`} data-testid={`design-garment-${g.slug}`}>
                  <span>{g.title}</span>
                  <span className="text-[11px] opacity-70">{garments.includes(g.slug) ? <Check size={14} className="text-[#a855f7]" /> : g.price}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-[#4b5563]">Collections <span className="text-[#a855f7] normal-case">(optional — auto-guessed if blank)</span></label>
            <div className="flex flex-wrap gap-2 mt-1">
              {allCats.map((c) => (
                <button key={c.slug} type="button" onClick={() => toggle(cats, setCats, c.slug)} className={`border-2 rounded-full px-3 py-1.5 text-xs font-bold transition ${cats.includes(c.slug) ? "border-[#a855f7] bg-[#a855f7] text-white" : "border-[#e9d5ff] text-[#4b5563]"}`} data-testid={`design-cat-${c.slug}`}>
                  {c.title}{c.adult && " 18+"}
                </button>
              ))}
            </div>
          </div>

          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold rounded-full px-6 py-3 disabled:opacity-50" data-testid="design-save">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Adding…</> : <><Sparkles size={16} /> Add to Design Shop</>}
          </button>
        </div>
      </div>

      {/* Existing designs */}
      <div className="mt-12">
        <h2 className="font-black text-xl mb-4">Designs in the shop ({designs.length})</h2>
        {designs.length === 0 ? (
          <p className="text-sm text-[#4b5563]">No designs yet — upload your first above.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="design-list">
            {designs.map((d) => (
              <div key={d.id} className="border-2 border-[#f0e6ff] rounded-2xl overflow-hidden group relative">
                <div className="aspect-square bg-[#faf5ff] grid place-items-center p-3">
                  <img src={d.image} alt={d.name} className="w-full h-full object-contain" loading="lazy" />
                </div>
                <div className="p-3">
                  <div className="font-extrabold text-sm truncate">{d.name}</div>
                  <div className="text-xs text-[#4b5563] mt-0.5">from £{Number(d.price).toFixed(2)} · {d.garments.length} garment{d.garments.length === 1 ? "" : "s"}</div>
                  <div className="text-[10px] text-[#a855f7] mt-1 truncate">{d.categories.join(", ")}</div>
                </div>
                <button onClick={() => remove(d.id, d.name)} className="absolute top-2 right-2 bg-white/90 hover:bg-rose-500 hover:text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition" title="Remove" data-testid={`design-remove-${d.id}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
