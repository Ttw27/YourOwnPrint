import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Upload, RotateCcw, Check, ExternalLink } from "lucide-react";
import { fetchPageCopy, adminUpdatePageCopy, uploadAdminImage, fetchAllPortfolio, mediaUrl } from "../lib/api";
import { SITE_IMAGES_SLUG } from "../hooks/usePageCopy";
import { KIT_BUILDERS, builderImage, useBuilderPhotos } from "../components/bold/KitBuilders";

// Where each "related" photo was uploaded, in plain English.
const FROM_LABEL = (k) => {
  if (k === "picked") return "Your chosen photo";
  if (k === "garment") return "Garment photo (automatic)";
  if (k.startsWith("ts-tile:")) return "Teams, Schools & Clubs page tile";
  if (k.startsWith("sportsteam:")) return "Sports page header photo";
  if (k.startsWith("tool:")) return "Tools tile";
  if (k.startsWith("school-trip:")) return "School Trips page tile";
  return "Site photo";
};

/**
 * Admin > Kit builder photos - one place for the photo on each "build your kit"
 * promo (homepage row, banner under sport-page products). Saved as site image
 * builder:<key> (page copy "site-images"); empty = automatic (a photo already
 * uploaded for the same thing elsewhere, else the garment photo).
 */
export default function AdminBuilderPhotos() {
  const [images, setImages] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [busy, setBusy] = useState("");
  const photos = useBuilderPhotos();

  const load = () => fetchPageCopy(SITE_IMAGES_SLUG).then((c) => setImages(c.images || {}));
  useEffect(() => {
    load();
    fetchAllPortfolio().then((d) => setGallery(d.items || [])).catch(() => setGallery([]));
  }, []);

  const save = async (key, url) => {
    setBusy(key);
    try {
      // re-read first so a photo changed elsewhere in the meantime isn't overwritten
      const fresh = (await fetchPageCopy(SITE_IMAGES_SLUG)).images || {};
      const next = { ...fresh, [`builder:${key}`]: url };
      await adminUpdatePageCopy(SITE_IMAGES_SLUG, { images: next });
      setImages(next);
      toast.success(url ? "Photo saved - it's live on the site" : "Back to the automatic photo");
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't save"); }
    finally { setBusy(""); }
  };
  const upload = async (key, file) => {
    if (!file) return;
    setBusy(key);
    try { const { url } = await uploadAdminImage(file, "page-images"); await save(key, url); }
    catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); setBusy(""); }
  };

  const galleryPicks = useMemo(() => {
    const out = {};
    Object.entries(KIT_BUILDERS).forEach(([k, b]) => {
      const cats = b.portfolio || [];
      out[k] = gallery.filter((it) => cats.includes(it.category)).flatMap((it) =>
        (it.image_meta || []).map((m) => ({ id: `${it.id}-${m.url}`, title: it.title, thumb: m.thumb || m.web || m.url, value: m.web || m.url })));
    });
    return out;
  }, [gallery]);

  if (!images) return <div className="p-10"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  return (
    <div className="p-6 max-w-6xl" data-testid="admin-builder-photos">
      <h1 className="font-black text-3xl">Kit builder photos</h1>
      <p className="text-sm text-zinc-500 mt-1 max-w-3xl">
        The photo on each &ldquo;build your whole kit&rdquo; promo - the tiles on the homepage and the banner under the products on the sports pages
        (football, rugby, gyms, boxing, dance...). Pick one of your photos below, or upload a new one. Real photos of people in your kit work best.
        Left on automatic, it uses a photo you've already uploaded for the same thing elsewhere, otherwise the plain garment photo.
      </p>

      <div className="mt-6 space-y-5">
        {Object.entries(KIT_BUILDERS).map(([key, b]) => {
          const cur = builderImage(key, images, photos);
          const chosen = (images[`builder:${key}`] || "").trim();
          const related = (b.related || []).map((k) => ({ k, v: (images[k] || "").trim() })).filter((x) => x.v);
          const picks = [...related.map((r) => ({ id: r.k, title: FROM_LABEL(r.k), thumb: r.v, value: r.v })), ...(galleryPicks[key] || [])];
          return (
            <section key={key} className="bg-white border-2 border-[#dcfce7] rounded-2xl p-5" data-testid={`abp-${key}`}>
              <div className="grid md:grid-cols-[220px_1fr] gap-5">
                <div>
                  <div className="aspect-square rounded-xl overflow-hidden border border-zinc-200 bg-[#f0fdf4]">
                    {cur.src && <img src={cur.src} alt="" className={`w-full h-full ${cur.photo ? "object-cover" : "object-contain p-3"}`} />}
                  </div>
                  <div className="text-[11px] font-bold text-zinc-500 mt-1.5">Showing: {FROM_LABEL(cur.from)}</div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="font-black text-xl">{b.title}</h2>
                      <div className="text-xs text-zinc-500">{b.who} · <Link to={b.to} target="_blank" className="text-[#166534] font-bold inline-flex items-center gap-0.5">opens {b.to} <ExternalLink size={10} /></Link></div>
                    </div>
                    <div className="flex gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-[#7bc67e] rounded-full px-3.5 py-2 cursor-pointer">
                        {busy === key ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload a photo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(key, e.target.files?.[0])} data-testid={`abp-${key}-upload`} />
                      </label>
                      {chosen && (
                        <button type="button" onClick={() => save(key, "")} className="inline-flex items-center gap-1.5 text-xs font-extrabold border-2 border-zinc-200 rounded-full px-3.5 py-2">
                          <RotateCcw size={13} /> Back to automatic
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-extrabold mt-4 mb-2">Or pick one of your photos</div>
                  {picks.length ? (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {picks.map((p) => {
                        const on = chosen && chosen === p.value;
                        return (
                          <button key={p.id} type="button" title={p.title} onClick={() => save(key, p.value)} disabled={busy === key}
                            className={`relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 ${on ? "border-[#16a34a]" : "border-transparent hover:border-[#7bc67e]"}`}>
                            <img src={mediaUrl(p.thumb)} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
                            {on && <span className="absolute top-1 right-1 bg-[#16a34a] text-white rounded-full p-0.5"><Check size={11} /></span>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">No matching photos yet - upload one, or add some in <Link to="/admin/portfolio" className="underline">Portfolio</Link> ({(b.portfolio || []).join(", ")}).</p>
                  )}
                  <p className="text-[10px] text-zinc-400 mt-1">From: {["Teams & Schools tiles, sports page headers", `Portfolio (${(b.portfolio || []).join(", ")})`].join(" · ")}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
