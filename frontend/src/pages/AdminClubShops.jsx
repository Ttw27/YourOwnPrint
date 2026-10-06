import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Download, Loader2, ExternalLink } from "lucide-react";

/** Admin > Club shops - every parent / member pre-order shop, how many have ordered, and the full list per shop. */
export default function AdminClubShops() {
  const [d, setD] = useState(null);
  const load = () => api.get("/admin/club-shops").then((r) => setD(r.data)).catch(() => setD({ shops: [] }));
  useEffect(() => { load(); }, []);
  const csv = async (code) => {
    const r = await api.get(`/admin/club-shops/${code}/orders`, { params: { format: "csv" }, responseType: "blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(r.data); a.download = `${code}-orders.csv`; a.click();
  };
  const setStatus = async (code, status) => { await api.post(`/admin/club-shops/${code}/status`, { status }); load(); };
  if (!d) return <div className="p-10"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  return (
    <div className="p-6 max-w-6xl">
      <h1 className="font-black text-3xl">Club shops</h1>
      <p className="text-sm text-zinc-500 mt-1">Pre-order links clubs, studios and schools set up at /club-shop/new. Parents pay for their own items; download a shop&apos;s list to print it all together once it closes.</p>
      <div className="mt-5 bg-white border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500"><tr>{["Shop", "Organiser", "Closes", "Items", "Orders", "Garments", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>
            {d.shops.map((s) => (
              <tr key={s.code} className="border-t align-top">
                <td className="p-3"><strong>{s.name}</strong><div className="text-xs text-zinc-500">{s.open ? "Open" : "Closed"}</div></td>
                <td className="p-3">{s.organiser}<div className="text-xs text-zinc-500">{s.email}{s.phone ? ` · ${s.phone}` : ""}</div></td>
                <td className="p-3">{s.closes_on || "-"}</td><td className="p-3">{s.items}</td><td className="p-3">{s.orders}</td><td className="p-3">{s.garments}</td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  <a href={`/club/${s.code}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline text-xs"><ExternalLink size={12} /> Shop</a>
                  <a href={`/club/${s.code}/manage/${s.manage_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline text-xs">Organiser page</a>
                  <button onClick={() => csv(s.code)} className="inline-flex items-center gap-1 text-xs font-extrabold"><Download size={12} /> CSV</button>
                  <button onClick={() => setStatus(s.code, s.open ? "closed" : "open")} className="text-xs underline">{s.open ? "Close" : "Reopen"}</button>
                </td>
              </tr>
            ))}
            {!d.shops.length && <tr><td colSpan={7} className="p-6 text-center text-zinc-500">No club shops yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
