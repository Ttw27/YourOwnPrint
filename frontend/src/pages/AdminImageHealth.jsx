import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ImageOff, Loader2, AlertTriangle, EyeOff, Eye, ExternalLink, ScanLine } from "lucide-react";
import { imageHealthScan, imageHealthHide, imageHealthUnhide } from "../lib/api";

/**
 * Image Health — scans the catalogue for products whose main image is broken or
 * missing, counts how many are still live (visible to customers), and lets you
 * jump to each to fix it or bulk-hide the broken ones so nothing broken shows on
 * the site. Read-only scan; hiding is an explicit action.
 */
export default function AdminImageHealth() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const scan = async () => {
    setScanning(true);
    setResult(null);
    setSelected(new Set());
    try {
      const res = await imageHealthScan({ check_urls: true });
      setResult(res);
      if ((res?.broken_count || 0) === 0) toast.success("No broken images found — your catalogue is clean.");
    } catch (e) {
      toast.error("Scan failed — please try again in a moment.");
    } finally {
      setScanning(false);
    }
  };

  const toggle = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAllLive = () => {
    if (!result) return;
    setSelected(new Set(result.items.filter((i) => i.active).map((i) => i.id)));
  };

  const hideSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await imageHealthHide([...selected]);
      toast.success(`Hidden ${res.hidden} product${res.hidden === 1 ? "" : "s"} from the site.`);
      await scan();
    } catch { toast.error("Couldn't hide those."); }
    finally { setBusy(false); }
  };

  const unhide = async (id) => {
    setBusy(true);
    try {
      await imageHealthUnhide([id]);
      toast.success("Product is visible again.");
      await scan();
    } catch { toast.error("Couldn't un-hide."); }
    finally { setBusy(false); }
  };

  const liveBroken = result?.live_broken_count || 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 font-nunito text-[#1a1a1a]">
      <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Admin</div>
      <h1 className="font-black text-4xl lg:text-5xl mt-2 flex items-center gap-3">
        <ImageOff className="text-[#7bc67e]" size={32} /> Image Health
      </h1>
      <p className="text-[#4b5563] mt-3 max-w-2xl">
        Finds products whose main photo is broken or missing. Jump to any product to fix it, or hide the broken
        ones so customers never see a broken card. Nothing is changed until you choose to hide.
      </p>

      <div className="mt-6">
        <button
          onClick={scan}
          disabled={scanning}
          className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-extrabold rounded-full px-5 py-2.5"
          data-testid="ih-scan"
        >
          {scanning ? <><Loader2 size={16} className="animate-spin" /> Scanning…</> : <><ScanLine size={16} /> Scan catalogue</>}
        </button>
        {scanning && <p className="text-xs text-[#4b5563] mt-2">Checking every product image loads — this can take a minute across a big catalogue.</p>}
      </div>

      {result && (
        <>
          {/* Summary */}
          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            <div className="bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-4">
              <div className="text-3xl font-black">{result.total_products}</div>
              <div className="text-xs text-[#4b5563] font-bold mt-1">products scanned</div>
            </div>
            <div className={`rounded-2xl p-4 border-2 ${liveBroken ? "bg-rose-50 border-rose-200" : "bg-[#f0fdf4] border-[#dcfce7]"}`}>
              <div className={`text-3xl font-black ${liveBroken ? "text-rose-600" : ""}`}>{liveBroken}</div>
              <div className="text-xs text-[#4b5563] font-bold mt-1">broken &amp; still live</div>
            </div>
            <div className="bg-white border-2 border-[#eef2f7] rounded-2xl p-4">
              <div className="text-3xl font-black text-[#4b5563]">{result.hidden_broken_count}</div>
              <div className="text-xs text-[#4b5563] font-bold mt-1">broken but already hidden</div>
            </div>
          </div>

          {liveBroken > 0 && (
            <div className="mt-4 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm flex-1">
                <p className="font-extrabold">{liveBroken} broken product{liveBroken === 1 ? "" : "s"} {liveBroken === 1 ? "is" : "are"} still showing on your site.</p>
                <p className="text-[#4b5563] mt-1">Fix them individually, or hide them all so customers don't see broken cards while you sort the images.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={selectAllLive} className="text-xs font-extrabold border-2 border-amber-300 text-amber-700 rounded-full px-3 py-1.5 hover:bg-amber-100">Select all live</button>
                  <button onClick={hideSelected} disabled={busy || selected.size === 0} className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-[#1a1a1a] text-white rounded-full px-3 py-1.5 disabled:opacity-50">
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={13} />} Hide selected ({selected.size})
                  </button>
                </div>
              </div>
            </div>
          )}

          {result.broken_count === 0 && (
            <div className="mt-6 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-6 text-center font-bold">
              🎉 No broken images — every product has a working main photo.
            </div>
          )}

          {/* Broken list */}
          {result.items.length > 0 && (
            <div className="mt-6 space-y-2" data-testid="ih-list">
              {result.items.map((it) => (
                <div key={it.id} className={`flex items-center gap-3 border-2 rounded-2xl p-3 ${it.active ? "border-rose-100 bg-white" : "border-[#eef2f7] bg-[#f9fafb]"}`} data-testid={`ih-row-${it.id}`}>
                  {it.active && (
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} className="w-4 h-4 accent-[#7bc67e] flex-shrink-0" />
                  )}
                  <div className="w-11 h-11 rounded-lg bg-[#f1f5f9] grid place-items-center flex-shrink-0 text-[#cbd5e1]">
                    <ImageOff size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm truncate">{it.name}</div>
                    <div className="text-[11px] text-[#4b5563]">
                      {it.category || "—"} · {it.source} · <span className={it.reason === "missing" ? "text-rose-500" : "text-amber-600"}>{it.reason === "missing" ? "no image set" : "image won't load"}</span>
                      {!it.active && <span className="ml-1 text-[#9ca3af]">· hidden</span>}
                    </div>
                  </div>
                  <Link to={`/admin/product-settings?q=${encodeURIComponent(it.name)}`} className="text-xs font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1 flex-shrink-0">
                    Fix <ExternalLink size={12} />
                  </Link>
                  {it.active
                    ? <button onClick={() => { toggle(it.id); }} className="hidden" aria-hidden />
                    : <button onClick={() => unhide(it.id)} disabled={busy} className="text-xs font-bold text-[#4b5563] hover:text-[#1a1a1a] inline-flex items-center gap-1 flex-shrink-0"><Eye size={13} /> Unhide</button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
