import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, Loader2, Check, RotateCcw, ArrowRight, AlertTriangle } from "lucide-react";
import {
  aiClassifyStatus, aiClassifyPreview, aiClassifyProposals, aiClassifyApply, aiClassifyClear,
} from "../lib/api";

/**
 * Smart Re-classify — admin tool that sends every product name to the AI, gets a
 * per-item decision (collection + industries + fit), previews the proposed
 * changes, and only writes them back once the admin approves. Nothing changes on
 * the site until "Apply" is pressed.
 */
export default function AdminReclassify() {
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [proposals, setProposals] = useState([]);
  const [changedTotal, setChangedTotal] = useState(0);
  const [applying, setApplying] = useState(false);

  const refreshStatus = useCallback(async () => {
    try { setStatus(await aiClassifyStatus()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const loadProposals = useCallback(async () => {
    try {
      const res = await aiClassifyProposals({ offset: 0, limit: 500, changed_only: true });
      setProposals(res.proposals || []);
      setChangedTotal(res.changed_total || 0);
    } catch { /* ignore */ }
  }, []);

  // Run the whole catalogue in batches, updating the progress bar as we go.
  const runAll = async () => {
    setRunning(true);
    let offset = 0;
    let done = false;
    let grandTotal = 0;
    let seen = 0;
    try {
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const res = await aiClassifyPreview({ offset, limit: 25 });
        grandTotal = res.total || grandTotal;
        seen += res.processed || 0;
        setTotal(grandTotal);
        setProcessed(seen);
        if (res.next_offset === null || res.done) { done = true; break; }
        offset = res.next_offset;
      }
      await loadProposals();
      toast.success("Classification finished — review the proposed changes below.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Something went wrong during classification.");
    } finally {
      setRunning(false);
      refreshStatus();
    }
  };

  const applyAll = async () => {
    setApplying(true);
    try {
      const res = await aiClassifyApply({});
      toast.success(`Applied ${res.applied} product${res.applied === 1 ? "" : "s"}${res.skipped_manual ? ` · skipped ${res.skipped_manual} you'd hand-edited` : ""}.`);
      await refreshStatus();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't apply changes.");
    } finally {
      setApplying(false);
    }
  };

  const clearRun = async () => {
    try {
      await aiClassifyClear();
      setProposals([]); setChangedTotal(0); setProcessed(0); setTotal(0);
      await refreshStatus();
      toast.success("Cleared. You can start a fresh run.");
    } catch { toast.error("Couldn't clear."); }
  };

  const pct = total ? Math.round((processed / total) * 100) : 0;
  const noKey = status && !status.has_key;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 font-nunito text-[#1a1a1a]">
      <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Admin</div>
      <h1 className="font-black text-4xl lg:text-5xl mt-2 flex items-center gap-3">
        <Sparkles className="text-[#7bc67e]" size={34} /> Smart Re-classify
      </h1>
      <p className="text-[#4b5563] mt-3 max-w-2xl">
        Reads every product name and sorts it into the right collection, industries and fit — the accurate,
        per-item alternative to keyword rules. <strong>Nothing changes until you approve.</strong>
      </p>

      {noKey && (
        <div className="mt-6 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3" data-testid="reclassify-nokey">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <p className="font-extrabold">No Anthropic API key set yet.</p>
            <p className="text-[#4b5563] mt-1">
              Add your key in <Link to="/admin/integrations" className="text-[#166534] font-bold underline">Integrations</Link> first
              (field: “Anthropic API Key”). Get one from console.anthropic.com → Settings → API Keys.
            </p>
          </div>
        </div>
      )}

      {/* Status + run controls */}
      <div className="mt-6 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-3xl p-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div><span className="text-[#4b5563]">Products:</span> <strong>{status?.total_products ?? "—"}</strong></div>
          <div><span className="text-[#4b5563]">Proposals ready:</span> <strong>{status?.proposals_stored ?? 0}</strong></div>
          <div><span className="text-[#4b5563]">Batch size:</span> <strong>{status?.batch_size ?? 25}</strong></div>
        </div>

        {running && (
          <div className="mt-5" data-testid="reclassify-progress">
            <div className="flex justify-between text-xs font-bold mb-1">
              <span>Classifying… {processed} / {total}</span><span>{pct}%</span>
            </div>
            <div className="h-2.5 bg-white rounded-full overflow-hidden border border-[#dcfce7]">
              <div className="h-full bg-[#7bc67e] transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-[#4b5563] mt-2">
              This runs through the whole catalogue in batches — keep this tab open. ~{status?.total_products || 2800} products
              takes a few minutes.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={runAll}
            disabled={running || noKey}
            className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 text-[#1a1a1a] font-extrabold rounded-full px-5 py-2.5"
            data-testid="reclassify-run"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {running ? "Classifying…" : (status?.proposals_stored ? "Re-run classification" : "Start classification")}
          </button>
          {status?.proposals_stored > 0 && !running && (
            <>
              <button onClick={loadProposals} className="inline-flex items-center gap-2 border-2 border-[#7bc67e] text-[#166534] hover:bg-[#f0fdf4] font-extrabold rounded-full px-5 py-2.5" data-testid="reclassify-review">
                Review {changedTotal || "changes"} <ArrowRight size={15} />
              </button>
              <button onClick={clearRun} className="inline-flex items-center gap-2 text-rose-500 hover:underline text-sm font-bold px-2" data-testid="reclassify-clear">
                <RotateCcw size={14} /> Clear & start over
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preview of proposed changes */}
      {proposals.length > 0 && (
        <div className="mt-8" data-testid="reclassify-preview">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-black text-2xl">Proposed changes <span className="text-[#4b5563] font-bold text-lg">({changedTotal})</span></h2>
            <button
              onClick={applyAll}
              disabled={applying}
              className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black disabled:opacity-50 text-white font-extrabold rounded-full px-5 py-2.5"
              data-testid="reclassify-apply"
            >
              {applying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Approve &amp; apply all {changedTotal ? `(${changedTotal})` : ""}
            </button>
          </div>
          <p className="text-sm text-[#4b5563] mt-1">Only products that would change are shown. Applying writes these to your catalogue.</p>

          <div className="mt-5 space-y-2">
            {proposals.map((p) => (
              <div key={p.id} className="border-2 border-[#dcfce7] rounded-2xl p-4" data-testid="reclassify-row">
                <div className="font-extrabold text-sm">{p.name}</div>
                <div className="grid sm:grid-cols-3 gap-3 mt-2 text-xs">
                  <ChangeCell label="Collection" from={p.current?.category} to={p.proposed?.category} />
                  <ChangeCell label="Industries" from={(p.current?.industries || []).join(", ") || "none"} to={(p.proposed?.industries || []).join(", ") || "none"} />
                  <ChangeCell label="Fit" from={p.current?.fit} to={p.proposed?.fit} />
                </div>
              </div>
            ))}
          </div>
          {changedTotal > proposals.length && (
            <p className="text-xs text-[#4b5563] mt-3">Showing the first {proposals.length} of {changedTotal} changes. All {changedTotal} will be applied.</p>
          )}
        </div>
      )}

      <div className="mt-10">
        <Link to="/admin/products-import" className="text-sm text-[#166534] font-bold underline">← Back to Product import</Link>
      </div>
    </div>
  );
}

function ChangeCell({ label, from, to }) {
  const changed = (from || "") !== (to || "");
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[#4b5563] font-extrabold">{label}</div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={`${changed ? "text-rose-400 line-through" : "text-[#1a1a1a]"}`}>{from || "—"}</span>
        {changed && <><ArrowRight size={11} className="text-[#7bc67e]" /><span className="text-[#166534] font-extrabold">{to || "—"}</span></>}
      </div>
    </div>
  );
}
