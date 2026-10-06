import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Download, Loader2, Copy, Lock } from "lucide-react";

/** /club/:code/manage/:token - the organiser's private page: every paid order, totals, CSV, close the shop. */
export default function ClubShopManage() {
  const { code, token } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api.get(`/club-shops/${code}/manage/${token}`).then((r) => setD(r.data)).catch(() => setErr("This organiser link isn't valid."));
  useEffect(() => { load(); }, [code, token]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = useMemo(() => {
    const m = {};
    (d?.orders || []).forEach((o) => { const k = `${o.item} · ${o.colour}`; m[k] = m[k] || {}; m[k][o.size] = (m[k][o.size] || 0) + Number(o.qty); });
    return m;
  }, [d]);
  const csv = async () => {
    const r = await api.get(`/club-shops/${code}/manage/${token}`, { params: { format: "csv" }, responseType: "blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(r.data); a.download = `${code}-orders.csv`; a.click();
  };
  const close = async () => { if (!window.confirm("Close the shop? Parents won't be able to order any more.")) return; await api.post(`/club-shops/${code}/manage/${token}/close`); toast.success("Shop closed - we'll be in touch about printing"); load(); };

  if (err) return <div className="min-h-screen grid place-items-center font-nunito"><p className="font-extrabold">{err}</p></div>;
  if (!d) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="club-manage">
      <BoldNavbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Organiser page</div>
            <h1 className="font-black text-3xl">{d.name}</h1>
            <p className="text-sm text-[#4b5563]">{d.open ? `Open${d.closes_on ? ` until ${d.closes_on}` : ""}` : "Closed"} · {d.orders.length} item line(s) paid</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard?.writeText(d.shop_url); toast.success("Shop link copied"); }} className="border-2 border-[#1a1a1a] rounded-full px-4 py-2 text-sm font-extrabold inline-flex items-center gap-1.5"><Copy size={14} /> Copy shop link</button>
            <button onClick={csv} className="bg-[#7bc67e] rounded-full px-4 py-2 text-sm font-extrabold inline-flex items-center gap-1.5"><Download size={14} /> Download list</button>
            {d.open && <button onClick={close} className="bg-[#1a1a1a] text-white rounded-full px-4 py-2 text-sm font-extrabold inline-flex items-center gap-1.5"><Lock size={14} /> Close shop</button>}
          </div>
        </div>
        <section className="bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-4">
          <h2 className="font-black text-lg">Totals</h2>
          {Object.keys(totals).length ? Object.entries(totals).map(([k, sizes]) => (
            <div key={k} className="text-sm mt-1"><strong>{k}:</strong> {Object.entries(sizes).map(([s, q]) => `${q} × ${s}`).join(", ")}</div>
          )) : <div className="text-sm text-[#4b5563] mt-1">No paid orders yet - share your shop link!</div>}
        </section>
        <div className="overflow-x-auto border rounded-2xl">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500"><tr>{["Date", "Parent", "Item", "Size", "Qty", "Name on back", "Paid"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{d.orders.map((o, i) => (
              <tr key={i} className="border-t"><td className="p-3">{o.date}</td><td className="p-3">{o.parent}<div className="text-xs text-zinc-500">{o.email}</div></td><td className="p-3">{o.item}<div className="text-xs text-zinc-500">{o.colour}</div></td><td className="p-3">{o.size}</td><td className="p-3">{o.qty}</td><td className="p-3">{o.name_on_back}</td><td className="p-3">£{Number(o.paid || 0).toFixed(2)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <BoldFooter />
    </div>
  );
}
