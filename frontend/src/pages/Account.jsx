import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, MapPin, Bookmark, LogOut, ArrowRight, Loader2, Trash2, Plus, ShoppingBag } from "lucide-react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import {
  customerOrders,
  customerAddresses, customerAddAddress, customerDeleteAddress,
  customerDesigns, customerDeleteDesign,
} from "../lib/api";
import { toast } from "sonner";

const TABS = [
  { key: "orders", label: "Orders", icon: Package },
  { key: "addresses", label: "Addresses", icon: MapPin },
  { key: "designs", label: "Saved designs", icon: Bookmark },
];

export default function Account() {
  const { customer, isAuthenticated, logout, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("orders");

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [loading, isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-white font-nunito">
      <BoldNavbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-widest font-extrabold text-[#7bc67e]">Your account</p>
          <h1 className="font-black text-4xl sm:text-5xl mt-2" data-testid="account-hello">Hi, {customer?.name?.split(" ")[0] || "there"} 👋</h1>
          <p className="text-[#4b5563] mt-2">Manage your orders, delivery addresses and saved designs.</p>
        </header>

        <div className="grid md:grid-cols-[220px,1fr] gap-6">
          <aside className="md:sticky md:top-24 md:self-start">
            <nav className="flex md:flex-col gap-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-extrabold text-left transition-colors ${active ? "bg-[#7bc67e] text-[#1a1a1a]" : "bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a]"}`}
                    data-testid={`account-tab-${t.key}`}
                  >
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
              <button
                onClick={async () => { await logout(); navigate("/"); }}
                className="mt-2 inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-extrabold text-left bg-white border-2 border-rose-200 text-rose-600 hover:bg-rose-50"
                data-testid="account-signout"
              ><LogOut size={14} /> Sign out</button>
            </nav>
          </aside>

          <section>
            {tab === "orders" && <OrdersTab token={token} />}
            {tab === "addresses" && <AddressesTab token={token} />}
            {tab === "designs" && <DesignsTab token={token} />}
          </section>
        </div>
      </main>
      <BoldFooter />
    </div>
  );
}

function OrdersTab({ token }) {
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    customerOrders(token).then((res) => setOrders(res.orders || [])).catch(() => setOrders([]));
  }, [token]);
  if (orders === null) return <Loading />;
  if (orders.length === 0) return <Empty icon={ShoppingBag} title="No orders yet" body="When you check out, your order history and status updates will appear here." ctaTo="/" ctaLabel="Start shopping" />;
  return (
    <ul className="space-y-3" data-testid="account-orders-list">
      {orders.map((o, i) => (
        <li key={o.session_id || i} className="border-2 border-[#dcfce7] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-[#4b5563] font-extrabold">{o.kind}</p>
            <p className="font-black text-sm mt-0.5">
              {o.items && o.items.length > 0
                ? o.items.map((it) => it.product_name).join(" · ")
                : (o.product_name || "Order")}
            </p>
            <p className="text-[11px] text-[#4b5563] mt-1">
              {o.created_at?.slice(0, 10)} · {o.payment_status === "paid" ? "Paid ✓" : (o.payment_status || o.status)}
            </p>
          </div>
          <p className="font-black text-lg">£{Number(o.amount).toFixed(2)}</p>
        </li>
      ))}
    </ul>
  );
}

function AddressesTab({ token }) {
  const [addrs, setAddrs] = useState(null);
  const [form, setForm] = useState({ label: "Home", line1: "", line2: "", city: "", postcode: "", country: "United Kingdom", phone: "", is_default: false });
  const [busy, setBusy] = useState(false);
  const reload = () => customerAddresses(token).then((r) => setAddrs(r.addresses || [])).catch(() => setAddrs([]));
  useEffect(() => { reload(); }, [token]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (addrs === null) return <Loading />;
  return (
    <div className="space-y-4">
      {addrs.length === 0 ? (
        <Empty icon={MapPin} title="No addresses saved" body="Add a delivery address to skip re-entering it at checkout." />
      ) : (
        <ul className="space-y-2" data-testid="account-addresses-list">
          {addrs.map((a) => (
            <li key={a.id} className="border-2 border-[#dcfce7] rounded-2xl p-3 flex items-start gap-3">
              <MapPin size={14} className="text-[#7bc67e] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-sm">{a.label} {a.is_default && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#7bc67e] text-[10px] text-[#1a1a1a]">Default</span>}</p>
                <p className="text-xs text-[#4b5563]">{a.line1}{a.line2 ? ", " + a.line2 : ""}, {a.city} {a.postcode}, {a.country}</p>
              </div>
              <button onClick={async () => { await customerDeleteAddress(token, a.id); toast.success("Address removed"); reload(); }} className="text-rose-500 hover:bg-rose-50 rounded p-1" title="Remove" data-testid={`account-address-remove-${a.id}`}>
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await customerAddAddress(token, { ...form });
            toast.success("Address added");
            setForm({ ...form, line1: "", line2: "", city: "", postcode: "" });
            reload();
          } catch (e2) { toast.error(e2?.response?.data?.detail || "Failed"); }
          finally { setBusy(false); }
        }}
        className="border-2 border-[#dcfce7] rounded-2xl p-4 space-y-2"
      >
        <h3 className="font-black text-sm inline-flex items-center gap-1"><Plus size={13} /> Add new address</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input label="Label" value={form.label} onChange={(v) => setForm({ ...form, label: v })} testid="addr-label" required />
          <Input label="Phone (optional)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="addr-phone" />
          <Input label="Line 1" value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} testid="addr-line1" required />
          <Input label="Line 2 (optional)" value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} testid="addr-line2" />
          <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} testid="addr-city" required />
          <Input label="Postcode" value={form.postcode} onChange={(v) => setForm({ ...form, postcode: v })} testid="addr-postcode" required />
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-extrabold cursor-pointer">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="w-4 h-4 accent-[#7bc67e]" data-testid="addr-default" />
          Make this my default address
        </label>
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold text-xs px-4 py-2 rounded-full disabled:opacity-50" data-testid="addr-submit">
          {busy ? <Loader2 className="animate-spin" size={11} /> : <Plus size={11} />} Save address
        </button>
      </form>
    </div>
  );
}

function DesignsTab({ token }) {
  const [designs, setDesigns] = useState(null);
  const reload = () => customerDesigns(token).then((r) => setDesigns(r.designs || [])).catch(() => setDesigns([]));
  useEffect(() => { reload(); }, [token]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (designs === null) return <Loading />;
  if (designs.length === 0) return <Empty icon={Bookmark} title="No saved designs" body="Save any design you're working on in the DYO canvas and pick up where you left off." ctaTo="/design" ctaLabel="Open designer" />;
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="account-designs-list">
      {designs.map((d) => (
        <li key={d.id} className="border-2 border-[#dcfce7] rounded-2xl overflow-hidden">
          {d.thumbnail_data_url ? (
            <img src={d.thumbnail_data_url} alt={d.name} className="w-full aspect-square object-contain bg-[#f0fdf4]" />
          ) : (
            <div className="w-full aspect-square bg-[#f0fdf4] grid place-items-center text-[#7bc67e]"><Bookmark size={28} /></div>
          )}
          <div className="p-2">
            <p className="font-extrabold text-xs truncate">{d.name}</p>
            <div className="flex items-center gap-1 mt-1">
              <Link to={`/design?product=${d.product_id}&design=${d.id}`} className="flex-1 text-center text-[10px] font-extrabold py-1.5 rounded-full bg-[#7bc67e] hover:bg-[#5eb062]" data-testid={`design-load-${d.id}`}>Open</Link>
              <button onClick={async () => { await customerDeleteDesign(token, d.id); toast.success("Removed"); reload(); }} className="text-rose-500 hover:bg-rose-50 rounded p-1" title="Delete" data-testid={`design-remove-${d.id}`}>
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Input({ label, value, onChange, testid, required = false }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#4b5563]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full mt-0.5 px-3 py-2 rounded-xl border-2 border-[#dcfce7] focus:border-[#7bc67e] outline-none text-sm" data-testid={testid} />
    </label>
  );
}

function Loading() { return <div className="grid place-items-center py-12"><Loader2 className="animate-spin text-[#7bc67e]" /></div>; }

function Empty({ icon: Icon, title, body, ctaTo, ctaLabel }) {
  return (
    <div className="border-2 border-dashed border-[#dcfce7] rounded-3xl p-8 text-center">
      <Icon size={44} className="mx-auto text-[#7bc67e] opacity-60" />
      <p className="font-black text-lg mt-3">{title}</p>
      <p className="text-sm text-[#4b5563] mt-1">{body}</p>
      {ctaTo && <Link to={ctaTo} className="inline-flex items-center gap-2 mt-4 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold text-sm px-5 py-2.5 rounded-full">{ctaLabel} <ArrowRight size={14} /></Link>}
    </div>
  );
}
