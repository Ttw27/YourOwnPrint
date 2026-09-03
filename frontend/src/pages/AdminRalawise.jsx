import React, { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { ralawisePreview, ralawiseImport, ralawiseStatus } from "../lib/api";

/**
 * Admin — Ralawise importer. Upload the Ralawise spreadsheet (.xlsm/.xlsx) to
 * import/update products with their images, colours (real RGB swatches) and
 * sizes. Images are mirrored to our own R2 so nothing hotlinks to the supplier.
 */
export default function AdminRalawise() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);  // live job status (stays on screen)
  const [mirror, setMirror] = useState(true);
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(null);
    setResult(null);
    setProgress(null);
  };

  const doPreview = async () => {
    if (!file) return toast.error("Choose the Ralawise file first.");
    setBusy(true);
    try {
      const r = await ralawisePreview(file);
      setPreview(r);
      toast.success(`Found ${r.products} products in the file.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't read that file — is it the Ralawise export?");
    } finally { setBusy(false); }
  };

  const doImport = async () => {
    if (!file) return toast.error("Choose the Ralawise file first.");
    if (!window.confirm("Import/update all products from this file? Existing Ralawise products will be updated with images, colours and sizes. Progress will show below.")) return;
    setBusy(true);
    setResult(null);
    setProgress({ phase: "uploading file", finished: false });
    try {
      const start = await ralawiseImport(file, mirror);
      const jobId = start.job_id;
      if (!jobId) throw new Error("No job id returned");
      setProgress({ phase: "starting", total: start.products, finished: false });
      // Poll the status every 1.5s — this keeps a live view AND leaves errors on screen.
      pollRef.current = setInterval(async () => {
        try {
          const st = await ralawiseStatus(jobId);
          setProgress(st);
          if (st.finished) {
            clearInterval(pollRef.current); pollRef.current = null;
            setBusy(false);
            if (st.error) {
              setResult({ failed: true, ...st });
            } else {
              setResult({ failed: false, ...st });
              toast.success(`Done — ${st.updated} updated, ${st.imported} new.`);
            }
          }
        } catch (err) {
          // status fetch failed — keep the last progress on screen, note it
          clearInterval(pollRef.current); pollRef.current = null;
          setBusy(false);
          setProgress((p) => ({ ...(p || {}), phase: "lost connection to job — it may still be running; re-scan Image Health in a few minutes", finished: true, error: "Couldn't reach the job status. The import may still be finishing in the background." }));
        }
      }, 1500);
    } catch (e) {
      setBusy(false);
      const msg = e?.response?.data?.detail || e?.message || "Import failed to start.";
      setProgress({ phase: "failed", finished: true, error: msg });
      toast.error(msg);
    }
  };

  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 font-nunito text-[#1a1a1a]">
      <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Admin</div>
      <h1 className="font-black text-4xl mt-2">Ralawise Import</h1>
      <p className="text-[#4b5563] mt-2 max-w-2xl">
        Upload the Ralawise spreadsheet (<code>.xlsm</code> or <code>.xlsx</code>). It fills in product
        images, colours and sizes, and copies every image to our own storage so nothing breaks if Ralawise
        changes their links. Re-uploading updates existing products — it won't create duplicates.
      </p>

      {/* Upload */}
      <div className="mt-8 bg-white border-2 border-[#dcfce7] rounded-3xl p-6">
        <input ref={fileRef} type="file" accept=".xlsm,.xlsx,.xls" onChange={onFile} className="hidden" id="ralawise-file" data-testid="ralawise-file" />
        <div className="flex items-center gap-4 flex-wrap">
          <label htmlFor="ralawise-file" className="cursor-pointer inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold rounded-full px-5 py-3">
            <Upload size={16} /> {file ? "Change file" : "Choose Ralawise file"}
          </label>
          {file && <span className="text-sm text-[#4b5563]" data-testid="ralawise-filename">{file.name}</span>}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="w-4 h-4 accent-[#7bc67e]" />
          <span className="inline-flex items-center gap-1"><ImageIcon size={13} /> Copy images to our storage (recommended)</span>
        </label>

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button onClick={doPreview} disabled={busy || !file} className="inline-flex items-center gap-2 bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] font-extrabold rounded-full px-5 py-2.5 text-sm disabled:opacity-50" data-testid="ralawise-preview-btn">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Preview file
          </button>
          <button onClick={doImport} disabled={busy || !file} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#6bb56e] text-[#1a1a1a] font-extrabold rounded-full px-6 py-2.5 text-sm disabled:opacity-50" data-testid="ralawise-import-btn">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Import / update products
          </button>
        </div>
      </div>

      {/* Preview summary */}
      {preview && (
        <div className="mt-6 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-3xl p-6" data-testid="ralawise-preview">
          <h2 className="font-black text-lg">File preview</h2>
          <div className="flex gap-6 mt-3 flex-wrap">
            <Stat label="Products in file" value={preview.products} />
            <Stat label="With an image" value={preview.with_images} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[#4b5563] text-xs uppercase">
                <th className="py-1 pr-4">Style</th><th className="pr-4">Name</th><th className="pr-4">Category</th><th className="pr-4">£</th><th className="pr-4">Colours</th><th className="pr-4">Sizes</th><th>Img</th>
              </tr></thead>
              <tbody>
                {preview.sample.map((s) => (
                  <tr key={s.style_code} className="border-t border-[#dcfce7]">
                    <td className="py-1.5 pr-4 font-mono text-xs">{s.style_code}</td>
                    <td className="pr-4">{s.name}</td>
                    <td className="pr-4">{s.category}</td>
                    <td className="pr-4">{s.price?.toFixed?.(2)}</td>
                    <td className="pr-4">{s.colours}</td>
                    <td className="pr-4">{s.sizes}</td>
                    <td>{s.has_image ? <CheckCircle2 size={14} className="text-[#7bc67e]" /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-[#4b5563] mt-2">Showing first {preview.sample.length} of {preview.products}. Import to apply all.</p>
          </div>
        </div>
      )}

      {/* Live progress — stays on screen through the whole job */}
      {progress && !progress.error && !(result && !result.failed) && (
        <div className="mt-6 bg-white border-2 border-[#dcfce7] rounded-3xl p-6" data-testid="ralawise-progress">
          <h2 className="font-black text-lg flex items-center gap-2">
            {progress.finished ? <CheckCircle2 className="text-[#7bc67e]" size={20} /> : <Loader2 className="animate-spin text-[#7bc67e]" size={20} />}
            {progress.phase === "done" ? "Finishing up…" : `In progress — ${progress.phase || "starting"}`}
          </h2>

          {/* products bar */}
          {typeof progress.total === "number" && progress.total > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-[#4b5563] mb-1">
                <span>Products imported</span>
                <span>{progress.products_done || 0} / {progress.total} ({pct(progress.products_done || 0, progress.total)}%)</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#f0fdf4] overflow-hidden">
                <div className="h-full bg-[#7bc67e] transition-all" style={{ width: `${pct(progress.products_done || 0, progress.total)}%` }} />
              </div>
            </div>
          )}

          {/* images bar */}
          {progress.images_total > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-[#4b5563] mb-1">
                <span>Images copied to storage</span>
                <span>{progress.images_done || 0} / {progress.images_total} ({pct(progress.images_done || 0, progress.images_total)}%){progress.images_failed ? ` · ${progress.images_failed} skipped` : ""}</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#f0fdf4] overflow-hidden">
                <div className="h-full bg-[#7bc67e] transition-all" style={{ width: `${pct(progress.images_done || 0, progress.images_total)}%` }} />
              </div>
            </div>
          )}

          <p className="text-xs text-[#4b5563] mt-4">You can leave this page — the import keeps running. This panel updates live while it's open.</p>
        </div>
      )}

      {/* Persistent error — stays until you start again */}
      {((progress && progress.error) || (result && result.failed)) && (
        <div className="mt-6 bg-rose-50 border-2 border-rose-200 rounded-3xl p-6" data-testid="ralawise-error">
          <h2 className="font-black text-lg flex items-center gap-2 text-rose-700"><AlertTriangle size={20} /> Import failed</h2>
          <p className="text-sm text-rose-700 mt-2">{(result && result.error) || (progress && progress.error)}</p>
          <p className="text-xs text-[#4b5563] mt-3">
            {(progress && progress.products_done)
              ? `${progress.products_done} products were imported before this stopped. It's safe to try again — re-running updates, it won't duplicate.`
              : "Nothing was imported. Check the file and try again."}
          </p>
        </div>
      )}

      {/* Success result */}
      {result && !result.failed && (
        <div className="mt-6 bg-white border-2 border-[#7bc67e] rounded-3xl p-6" data-testid="ralawise-result">
          <h2 className="font-black text-lg flex items-center gap-2"><CheckCircle2 className="text-[#7bc67e]" size={20} /> Import complete</h2>
          <div className="flex gap-6 mt-3 flex-wrap">
            <Stat label="Products" value={result.total} />
            <Stat label="Updated" value={result.updated} />
            <Stat label="New" value={result.imported} />
            {result.images_total > 0 && <Stat label="Images copied" value={result.images_done} />}
            {result.images_failed > 0 && <Stat label="Images skipped" value={result.images_failed} warn />}
          </div>
          <p className="text-sm text-[#4b5563] mt-3">Products are live now with their images and colour swatches. Re-run an Image Health scan to confirm.</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn }) {
  return (
    <div>
      <div className={`font-black text-2xl ${warn ? "text-rose-500" : "text-[#1a1a1a]"}`}>{value}</div>
      <div className="text-xs text-[#4b5563]">{label}</div>
    </div>
  );
}
