import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { api, createCartCheckout } from "../lib/api";
import { toast } from "sonner";
import { Download, Loader2, Copy, Lock, Trash2, CreditCard, FileText, Check } from "lucide-react";

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
  if (d.mode === "company") return <StaffManage d={d} code={code} token={token} reload={load} csv={csv} />;
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


/** Organiser page for a staff order link (company pays): everyone's choices, then ONE order - card or invoice. */
function StaffManage({ d, code, token, reload, csv }) {
  const [inv, setInv] = useState({ company: d.name, po_number: "", address: "", notes: "" });
  const [busy, setBusy] = useState("");
  const price = useMemo(() => {
    const m = {};
    (d.items || []).forEach((it) => { m[`${it.product_id}|${it.colour}`] = it; });
    return m;
  }, [d]);
  const lines = useMemo(() => (d.staff || []).flatMap((p) => (p.picks || []).map((k) => ({ ...k, who: p.name }))), [d]);
  const unit = (k) => {
    const it = price[`${k.product_id}|${k.colour}`];
    return (it?.sizes.find((s) => s.size === k.size)?.price || 0) + (k.name_on_back ? d.prices.name : 0);
  };
  const total = lines.reduce((a, k) => a + unit(k) * k.qty, 0);
  const garments = lines.reduce((a, k) => a + k.qty, 0);
  const totals = useMemo(() => {
    const m = {};
    lines.forEach((k) => { const key = `${k.item} · ${k.colour}`; m[key] = m[key] || {}; m[key][k.size] = (m[key][k.size] || 0) + k.qty; });
    return m;
  }, [lines]);
  const remove = async (p) => {
    if (!window.confirm(`Remove ${p.name}'s choices?`)) return;
    await api.delete(`/club-shops/${code}/manage/${token}/staff/${p.id}`); reload();
  };
  const payCard = async () => {
    setBusy("card");
    try {
      const g = {};
      lines.forEach((k) => {
        const key = `${k.product_id}|${k.colour}|${k.name_on_back}`;
        g[key] = g[key] || { product_id: k.product_id, color: k.colour, size_qtys: {}, placements: ["logo", ...(k.name_on_back ? ["name"] : [])], blank: false,
          design_meta: { flow: "club_shop", club_code: code, club_name: d.name, child_name: k.name_on_back, staff: [] } };
        g[key].size_qtys[k.size] = (g[key].size_qtys[k.size] || 0) + k.qty;
        g[key].design_meta.staff.push(`${k.who} (${k.size}${k.qty > 1 ? ` x${k.qty}` : ""})`);
      });
      const items = Object.values(g).map((x) => ({ ...x, design_meta: { ...x.design_meta, staff: x.design_meta.staff.join(", ").slice(0, 480) } }));
      await api.post(`/club-shops/${code}/manage/${token}/paid-by-card`);
      const { url } = await createCartCheckout(items, null);
      window.location.href = url;
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't start the card payment"); setBusy(""); }
  };
  const invoice = async () => {
    if (!window.confirm("Send the whole order to Your Own Print for an invoice? Staff won't be able to change their choices after this.")) return;
    setBusy("invoice");
    try { await api.post(`/club-shops/${code}/manage/${token}/send`, { method: "invoice", ...inv }); toast.success("Sent - we'll be in touch with a proof and invoice"); reload(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Couldn't send - please try again"); }
    finally { setBusy(""); }
  };

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="staff-manage">
      <BoldNavbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Staff order link · your page</div>
            <h1 className="font-black text-3xl">{d.name}</h1>
            <p className="text-sm text-[#4b5563]">{(d.staff || []).length} people · {garments} garments · about £{total.toFixed(2)} at website prices (inc VAT)</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { navigator.clipboard?.writeText(d.shop_url); toast.success("Staff link copied"); }} className="border-2 border-[#1a1a1a] rounded-full px-4 py-2 text-sm font-extrabold inline-flex items-center gap-1.5"><Copy size={14} /> Copy staff link</button>
            <button onClick={csv} className="bg-[#7bc67e] rounded-full px-4 py-2 text-sm font-extrabold inline-flex items-center gap-1.5"><Download size={14} /> Download list</button>
          </div>
        </div>

        <section className="bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-4">
          <h2 className="font-black text-lg">Totals</h2>
          {Object.keys(totals).length ? Object.entries(totals).map(([k, sizes]) => (
            <div key={k} className="text-sm mt-1"><strong>{k}:</strong> {Object.entries(sizes).map(([sz, q]) => `${q} × ${sz}`).join(", ")}</div>
          )) : <div className="text-sm text-[#4b5563] mt-1">Nobody has chosen yet - share your staff link!</div>}
        </section>

        <div className="overflow-x-auto border rounded-2xl">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500"><tr>{["Staff member", "Choices", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{(d.staff || []).map((p) => (
              <tr key={p.id} className="border-t align-top" data-testid={`staff-row-${p.id}`}>
                <td className="p-3 font-bold">{p.name}<div className="text-xs text-zinc-500 font-normal">{p.email}</div></td>
                <td className="p-3">{(p.picks || []).map((k, i) => <div key={i}>{k.qty} × {k.item} ({k.colour}) - {k.size}{k.name_on_back ? ` · "${k.name_on_back}"` : ""}</div>)}</td>
                <td className="p-3 text-right">{!d.sent && <button onClick={() => remove(p)} className="text-rose-500" aria-label="Remove"><Trash2 size={15} /></button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {d.sent ? (
          <div className="bg-[#f0fdf4] border-2 border-[#7bc67e] rounded-3xl p-6" data-testid="staff-sent">
            <h2 className="font-black text-xl flex items-center gap-2"><Check className="text-[#7bc67e]" /> Order sent</h2>
            <p className="text-sm text-[#4b5563] mt-1">{d.sent.method === "invoice"
              ? "We'll send you a proof and an invoice - pay by BACS once you've approved the proof, then we print."
              : "Card payment started - if it didn't go through, you can pay again below or ask us for an invoice."}</p>
          </div>
        ) : null}
        {(!d.sent || d.sent.method === "card") && (
          <section className="border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="staff-send-order">
            <h2 className="font-black text-2xl">Send the order</h2>
            <p className="text-sm text-[#4b5563] mt-1">When everyone&apos;s chosen, send it as one order. We send a free proof before anything prints.</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl bg-[#1a1a1a] text-white p-5">
                <div className="font-black text-lg flex items-center gap-2"><CreditCard size={18} className="text-[#7bc67e]" /> Pay by card</div>
                <p className="text-sm text-neutral-300 mt-1">Pay for everything now - about £{total.toFixed(2)} plus delivery, chosen at checkout.</p>
                <button onClick={payCard} disabled={!garments || busy} className="mt-4 w-full bg-[#7bc67e] text-[#1a1a1a] font-extrabold py-3 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-40" data-testid="staff-pay-card">
                  {busy === "card" ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} Pay by card
                </button>
              </div>
              <div className="rounded-2xl border-2 border-[#dcfce7] p-5">
                <div className="font-black text-lg flex items-center gap-2"><FileText size={18} className="text-[#16a34a]" /> Request an invoice</div>
                <p className="text-sm text-[#4b5563] mt-1">We send a proof and invoice - pay by BACS once you&apos;ve approved it.</p>
                <div className="space-y-2 mt-3">
                  {[["company", "Company name for the invoice"], ["po_number", "PO number (optional)"]].map(([k, ph]) => (
                    <input key={k} value={inv[k]} onChange={(e) => setInv({ ...inv, [k]: e.target.value })} placeholder={ph} className="w-full border-2 border-[#dcfce7] rounded-xl px-3 py-2 text-sm" />
                  ))}
                  <textarea value={inv.address} onChange={(e) => setInv({ ...inv, address: e.target.value })} rows={2} placeholder="Delivery address - or several, one per site" className="w-full border-2 border-[#dcfce7] rounded-xl px-3 py-2 text-sm" />
                  <textarea value={inv.notes} onChange={(e) => setInv({ ...inv, notes: e.target.value })} rows={2} placeholder="Anything else (deadline, bag each person's uniform separately...)" className="w-full border-2 border-[#dcfce7] rounded-xl px-3 py-2 text-sm" />
                </div>
                <button onClick={invoice} disabled={!garments || busy} className="mt-3 w-full bg-[#1a1a1a] text-white font-extrabold py-3 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-40" data-testid="staff-request-invoice">
                  {busy === "invoice" ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Request an invoice
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
      <BoldFooter />
    </div>
  );
}
