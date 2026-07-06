import { useEffect, useMemo, useState } from "react";
import { adminListOrders } from "../lib/api";
import { toast } from "sonner";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "expired", label: "Expired" },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");

  const load = async (s) => {
    setLoading(true);
    try {
      const data = await adminListOrders(s);
      setOrders(data.orders || []);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(status); }, [status]);

  const totalPaid = useMemo(
    () => orders.filter((o) => o.payment_status === "paid").reduce((sum, o) => sum + (Number(o.amount) || 0), 0),
    [orders]
  );

  const orderLabel = (o) => o.product_name || (o.flow ? `${o.flow} order` : o.kind === "cart" ? "Cart order" : "Order");
  const customerEmail = (o) => o.customer_email || o.contact_email || (o.metadata && o.metadata.contact_email) || "—";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" data-testid="admin-orders-page">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-2">Orders</h1>
        <p className="text-zinc-400 mb-6">Every checkout attempt across the site — single products, cart, leavers hoodies and workforce orders.</p>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`px-4 py-2 rounded-full text-sm font-bold ${status === t.key ? "bg-amber-400 text-zinc-950" : "bg-zinc-900 border border-zinc-800 text-zinc-300"}`}
                data-testid={`admin-orders-tab-${t.key}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {status === "paid" && !loading && (
            <div className="text-sm text-zinc-400">
              {orders.length} paid order{orders.length === 1 ? "" : "s"} shown · total <span className="text-amber-400 font-bold">£{totalPaid.toFixed(2)}</span>
            </div>
          )}
        </div>

        {loading && <div className="text-zinc-500">Loading…</div>}
        {!loading && orders.length === 0 && <div className="text-zinc-500">No orders here yet.</div>}

        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" data-testid={`admin-order-${o.id}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-bold text-sm">{orderLabel(o)}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {customerEmail(o)} · {o.total_quantity ? `${o.total_quantity} items · ` : ""}
                    {o.created_at ? new Date(o.created_at).toLocaleString("en-GB") : ""}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1 font-mono">{o.session_id}</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-amber-400">£{Number(o.amount || 0).toFixed(2)}</div>
                  <StatusBadge status={o.payment_status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    paid: "bg-emerald-900 text-emerald-300",
    pending: "bg-amber-900 text-amber-300",
    expired: "bg-red-900 text-red-300",
    unpaid: "bg-zinc-800 text-zinc-400",
  };
  return (
    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${styles[status] || "bg-zinc-800 text-zinc-400"}`}>
      {status || "unknown"}
    </span>
  );
}
