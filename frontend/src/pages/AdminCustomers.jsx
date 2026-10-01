import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, BadgePercent } from "lucide-react";
import { adminListCustomers, adminSetCustomerDiscount } from "../lib/api";

/**
 * Customers - everyone with an account, and the regular-customer discount.
 * A discount here is taken off GARMENT prices (printing stays full price) for
 * that customer whenever they're signed in: on product cards, the product
 * page, the designer, the basket and at checkout. Not applied to bundles.
 * Worked out by the server, so the checkout always charges the right amount.
 */
const QUICK = [0, 5, 10, 15];

export default function AdminCustomers() {
  const [q, setQ] = useState("");
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [drafts, setDrafts] = useState({});   // customer id -> typed % (not yet saved)

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      adminListCustomers({ q, discounted: onlyDiscounted || undefined, limit: 100 })
        .then((d) => { if (alive) { setItems(d.items || []); setTotal(d.total || 0); } })
        .catch(() => toast.error("Couldn't load customers"))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, onlyDiscounted]);

  const save = async (c, pct) => {
    const n = Math.max(0, Math.min(50, Number(pct) || 0));
    setSaving(c.id);
    try {
      const r = await adminSetCustomerDiscount(c.id, n);
      setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, discount_pct: r.discount_pct } : x)));
      setDrafts((d) => { const nd = { ...d }; delete nd[c.id]; return nd; });
      toast.success(r.discount_pct ? `${c.name || c.email} now gets ${r.discount_pct}% off` : `Discount removed for ${c.name || c.email}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || "Save failed");
    } finally { setSaving(""); }
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-xs uppercase tracking-[0.2em] text-[#7bc67e] font-extrabold">Admin</div>
        <h1 className="font-nunito font-black text-4xl mt-1">Customers</h1>
        <p className="text-[#4b5563] mt-2 max-w-3xl">
          Everyone with an account on the site. Give your regulars a discount and it comes off <strong>garment prices</strong> whenever
          they&rsquo;re signed in - on every product, in the designer, in the basket and at checkout. Printing stays full price, bundles keep
          their own price, and it&rsquo;s on top of bulk-quantity savings. They need to be signed in to their account to get it.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or company" className="w-full bg-white border-2 border-[#e5e7eb] rounded-full pl-9 pr-4 py-2 text-sm" data-testid="customers-search" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={onlyDiscounted} onChange={(e) => setOnlyDiscounted(e.target.checked)} data-testid="customers-only-discounted" />
            Only customers with a discount
          </label>
          <span className="text-xs text-[#4b5563] ml-auto">{total} customer{total === 1 ? "" : "s"}</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={16} />Loading customers…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-[#4b5563]">{q || onlyDiscounted ? "No customers match." : "No customer accounts yet."}</div>
        ) : (
          <div className="mt-6 border-2 border-[#eef2f7] rounded-3xl overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#4b5563] border-b-2 border-[#eef2f7]">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Paid orders</th>
                  <th className="py-3 px-4">Discount on garments</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const draft = drafts[c.id];
                  const busy = saving === c.id;
                  return (
                    <tr key={c.id} className="border-b border-[#eef2f7] last:border-0" data-testid={`customer-row-${c.id}`}>
                      <td className="py-3 px-4">
                        <div className="font-extrabold">{c.name || "-"}</div>
                        <div className="text-xs text-[#4b5563]">{c.email}</div>
                      </td>
                      <td className="py-3 px-4 text-[#4b5563]">{c.company_name || "-"}</td>
                      <td className="py-3 px-4">{c.paid_orders}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.discount_pct > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-[#dcfce7] text-[#166534] rounded-full px-2 py-0.5 mr-1"><BadgePercent size={12} /> {c.discount_pct}% off</span>}
                          {QUICK.map((p) => (
                            <button key={p} type="button" disabled={busy} onClick={() => save(c, p)}
                              className={`px-2.5 py-1 rounded-full text-xs font-extrabold border-2 ${Number(c.discount_pct) === p ? "bg-[#7bc67e] border-[#7bc67e]" : "bg-white border-[#e5e7eb] hover:border-[#7bc67e]"}`}
                              data-testid={`customer-discount-${c.id}-${p}`}>{p === 0 ? "None" : `${p}%`}</button>
                          ))}
                          <span className="inline-flex items-center gap-1 ml-1">
                            <input type="number" min={0} max={50} step={0.5} value={draft ?? ""} placeholder="Other"
                              onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                              className="w-16 bg-white border-2 border-[#e5e7eb] rounded-full px-2 py-1 text-xs" />
                            {draft !== undefined && draft !== "" && (
                              <button type="button" disabled={busy} onClick={() => save(c, draft)} className="text-xs font-extrabold text-[#166534] hover:underline">Save</button>
                            )}
                          </span>
                          {busy && <Loader2 size={12} className="animate-spin" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
