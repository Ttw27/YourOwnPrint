import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Download, Loader2 } from "lucide-react";

/** Admin > Email sign-ups - people who signed up for the 10% off code. */
export default function AdminSubscribers() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/subscribers").then((r) => setData(r.data)).catch(() => setData({ items: [], total: 0 })); }, []);
  const download = async () => {
    const r = await api.get("/admin/subscribers", { params: { format: "csv" }, responseType: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(r.data); a.download = "email-signups.csv"; a.click();
  };
  if (!data) return <div className="p-10"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-black text-3xl">Email sign-ups</h1>
          <p className="text-sm text-zinc-500 mt-1">People who signed up for &quot;10% off your first order&quot; on the site. Each got a single-use code (shown here) by email. Download the list to use in your email tool.</p>
        </div>
        <button onClick={download} className="inline-flex items-center gap-2 bg-[#7bc67e] font-extrabold px-4 py-2 rounded-full text-sm"><Download size={14} /> Download CSV</button>
      </div>
      <div className="mt-5 bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500"><tr><th className="p-3">Email</th><th className="p-3">Signed up</th><th className="p-3">Code</th><th className="p-3">Signed up on</th><th className="p-3"></th></tr></thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.email} className="border-t">
                <td className="p-3">{r.email}</td><td className="p-3">{(r.created_at || "").slice(0, 10)}</td>
                <td className="p-3 font-mono text-xs">{r.code}</td><td className="p-3 text-xs text-zinc-500">{r.source}</td>
                <td className="p-3 text-xs text-rose-500">{r.unsubscribed ? "Unsubscribed" : r.email_ok === false ? "Email failed" : ""}</td>
              </tr>
            ))}
            {!data.items.length && <tr><td colSpan={5} className="p-6 text-center text-zinc-500">No sign-ups yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
