import { useEffect, useMemo, useState } from "react";
import { adminListOrders, mediaUrl } from "../lib/api";
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
  const customerEmail = (o) => o.customer_email || o.contact_email || (o.metadata && o.metadata.contact_email) || "-";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" data-testid="admin-orders-page">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-2">Orders</h1>
        <p className="text-zinc-400 mb-6">Every checkout attempt across the site - single products, cart, leavers hoodies and workforce orders.</p>

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
              <OrderDetails o={o} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Every other detail the customer gave (names, players list, wording, notes...) -
// mirrors server._dm_extra so nothing on an order line is hidden from the shop.
const DM_OWN_ROWS = ["pack_sizes_text", "pack_sizes", "garment_name", "design_image", "print_size", "bespoke", "design_notes",
  "club_code", "club_name", "child_name", "logo_position", "print_notes", "mode", "flow", "group_id", "artwork_id", "design_id",
  "garment", "group_qty", "image_count", "text_count", "placements_uploaded"];
const DM_LABELS = { notes: "Customer notes", art_pending: "Artwork", team_name: "Team", set: "Kit", roster: "Players",
  kit_socks: "Socks", kit_names: "Names & numbers", kit_type: "Kit", front_text: "Front wording", back_text: "Back wording",
  print_colour: "Name & number colour", names: "Names", staff: "Staff", event_date: "Event date", front_sponsor: "Front sponsor",
  names_numbers: "Names & numbers" };
const isArtKey = (k) => k.startsWith("art_") && k !== "art_pending";
function dmExtra(dm) {
  const out = [];
  Object.entries(dm || {}).forEach(([k, v]) => {
    if (DM_OWN_ROWS.includes(k) || isArtKey(k) || k.endsWith("_id") || v == null || v === "" || (Array.isArray(v) && !v.length)) return;
    const label = DM_LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");
    if (k === "art_pending") v = v === true ? "Customer will email their artwork" : String(v);
    else if (typeof v === "boolean") v = v ? "yes" : "no";
    else if (Array.isArray(v) && v.every((x) => x && typeof x === "object")) v = v.slice(0, 200);
    else if (Array.isArray(v)) v = v.join(", ");
    else if (typeof v === "object") v = Object.entries(v).filter(([, b]) => b != null && b !== "").map(([a, b]) => `${a}: ${b}`).join(", ");
    else v = String(v);
    out.push([label, v]);
  });
  return out.sort((a, b) => (b[0] === "Customer notes") - (a[0] === "Customer notes"));
}

function DmExtraRows({ dm }) {
  return dmExtra(dm).map(([label, v]) => {
    if (Array.isArray(v)) {
      const cols = [...new Set(v.flatMap((r) => Object.keys(r)))];
      return (
        <div key={label} className="pt-1">
          <div className="font-bold">{label} ({v.length})</div>
          <div className="overflow-x-auto"><table className="text-[11px] mt-0.5">
            <thead><tr>{cols.map((c) => <th key={c} className="text-left pr-3 text-zinc-500 font-bold">{c.replace(/_/g, " ")}</th>)}</tr></thead>
            <tbody>{v.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="pr-3">{String(r[c] ?? "")}</td>)}</tr>)}</tbody>
          </table></div>
        </div>
      );
    }
    if (v.includes(" | ")) return <div key={label}><span className="font-bold">{label}:</span>{v.split(" | ").map((x, i) => <div key={i} className="pl-2">{x}</div>)}</div>;
    const loud = label === "Customer notes" || label === "Artwork";
    return <div key={label} className={loud ? "text-amber-300 font-bold" : ""}>{label}: {v}</div>;
  });
}

// What was actually ordered: product, colour, sizes, print positions, and for
// bulk packs the size split per garment. Collapsed by default.
function OrderDetails({ o }) {
  const lines = (o.items && o.items.length)
    ? o.items.map((it) => ({ name: it.product_name, color: it.color, size_qtys: it.size_qtys, placements: it.placements, dm: it.design_meta }))
    : o.product_name ? [{ name: o.product_name, color: o.color || (o.metadata || {}).color, size_qtys: o.size_qtys, placements: o.placements, dm: o.design_meta }] : [];
  const extra = Object.entries(o.metadata || {}).filter(([k]) => !["product_id", "product_name", "color", "placements", "sizes", "total_qty", "blank", "print_cost_per_garment"].includes(k) && !k.startsWith("design_pack_sizes") && !(k.startsWith("design_") && lines.some((l) => l.dm && Object.keys(l.dm).length)));
  const dl = o.delivery;
  if (!lines.length && !extra.length && !dl) return null;
  const flagged = o.order_notes || lines.some((l) => l.dm && (l.dm.notes || l.dm.art_pending || l.dm.print_notes));
  return (
    <details className="mt-3 group" data-testid={`admin-order-details-${o.id}`}>
      <summary className="cursor-pointer text-xs font-bold text-emerald-400 hover:underline list-none">Show what was ordered{flagged && <span className="ml-2 text-amber-300">· has customer notes / artwork to come</span>}</summary>
      <div className="mt-2 space-y-2 text-xs text-zinc-300">
        {o.order_notes && <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-3 text-amber-200" data-testid={`admin-order-notes-${o.id}`}><strong>Customer&apos;s notes at checkout:</strong> {o.order_notes}</div>}
        {lines.map((l, i) => (
          <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-0.5">
            <div className="font-bold text-zinc-100">{l.name}</div>
            {l.color && <div>Colour: {l.color}</div>}
            {l.size_qtys && Object.keys(l.size_qtys).length > 0 && <div>Sizes: {Object.entries(l.size_qtys).map(([sz, q]) => `${q}×${sz}`).join(", ")}</div>}
            {l.dm && l.dm.pack_sizes_text && <div className="text-amber-300">Pack size split: {l.dm.pack_sizes_text}</div>}
            <div>Print: {[...(l.dm && l.dm.flow === "fight_night_tee" ? ["front (logo / sponsors - in the price)"] : []), ...(l.placements || [])].join(", ") || "blank / none"}</div>
            {l.dm && (l.dm.mode || l.dm.flow) && <div className="text-zinc-500">Artwork: {l.dm.mode || l.dm.flow}</div>}
            {l.dm && (l.dm.bespoke || l.dm.design_notes) && <div className="text-amber-300">Bespoke design{l.dm.bespoke ? ` (${l.dm.bespoke})` : ""}{l.dm.design_notes ? `: ${l.dm.design_notes}` : ""}</div>}
            {l.dm && l.dm.logo_position && <div>Logo position: <strong>{l.dm.logo_position}</strong></div>}
            {l.dm && l.dm.print_notes && <div className="text-amber-300">Print notes: {l.dm.print_notes}</div>}
            {l.dm && <DmExtraRows dm={l.dm} />}
            {l.dm && l.dm.child_name && <div>Name on back: <strong>{l.dm.child_name}</strong>{l.dm.club_name ? ` · ${l.dm.club_name} club shop` : ""}</div>}
            {l.dm && Object.keys(l.dm).some((k) => isArtKey(k) && l.dm[k]) && (
              <div className="flex flex-wrap gap-2 pt-1" data-testid="admin-order-artwork">
                {Object.entries(l.dm).filter(([k, v]) => isArtKey(k) && v).map(([k, v]) => (
                  <a key={k} href={mediaUrl(v)} target="_blank" rel="noreferrer" className="block text-center" title="Open the customer's file">
                    {/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(v) || /designer\/artwork/.test(v)
                      ? <img src={mediaUrl(v)} alt="" className="w-16 h-16 object-contain bg-white rounded-lg border border-zinc-700" />
                      : <span className="w-16 h-16 grid place-items-center bg-zinc-800 rounded-lg border border-zinc-700 text-[10px] font-bold text-zinc-300">FILE</span>}
                    <span className="block text-[10px] text-zinc-400 mt-0.5">{k.slice(4).replace(/[-_]/g, " ")}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {dl && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-0.5" data-testid={`admin-order-delivery-${o.id}`}>
            <div className="font-bold text-zinc-100">Delivery: {dl.method || "-"} {dl.cost ? `(£${Number(dl.cost).toFixed(2)})` : "(free)"}</div>
            {dl.name && <div>{dl.name}</div>}
            {dl.address && <div>{[dl.address.line1, dl.address.line2, dl.address.city, dl.address.state, dl.address.postal_code].filter(Boolean).join(", ")}</div>}
            {dl.phone && <div>Phone: {dl.phone}</div>}
            {dl.warning && <div className="text-amber-300 font-bold">{dl.warning}</div>}
          </div>
        )}
        {extra.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-0.5 text-zinc-400">
            {extra.map(([k, v]) => <div key={k}><span className="text-zinc-500">{k.replace(/_/g, " ")}:</span> {String(v)}</div>)}
          </div>
        )}
      </div>
    </details>
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
