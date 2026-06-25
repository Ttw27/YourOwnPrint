import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import {
  fetchLeaversProducts, fetchLeaversTiers,
  createGroupOrder, fetchGroupOrder, joinGroupOrder,
  fetchGroupOrderManage, removeGroupMember, closeGroupOrder,
  createCheckout,
} from "../lib/api";
import { toast } from "sonner";
import { Loader2, Copy, Check, Trash2, ShieldCheck, ShoppingCart, Users, CalendarDays, Mail, GraduationCap, Plus, Minus, Lock } from "lucide-react";

const STORAGE_PREFIX = "yop-manage-";   // localStorage cache for manage_token

// =================================================================================
//  START — rep creates the group order
// =================================================================================
export function LeaversStart() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    school: "", year_group: "Year 11", deadline: "",
    contact_name: "", contact_email: "", contact_phone: "",
    product_id: "leavers-pullover-hoodie",
    design_brief: searchParams.get("template") ? `Template: ${searchParams.get("template")}` : "",
    include_bag: false,
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchLeaversProducts().then((p) => setProducts(p.filter(x => x.id !== "leavers-drawstring-bag"))); }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.school.trim() || !form.year_group.trim() || !form.deadline.trim()) { toast.error("Add school, year group and deadline"); return; }
    if (!form.contact_name.trim() || !form.contact_email.trim()) { toast.error("Add your name and email"); return; }
    setBusy(true);
    try {
      const { token, manage_token } = await createGroupOrder(form);
      localStorage.setItem(`${STORAGE_PREFIX}${token}`, manage_token);
      toast.success("Group order created!");
      navigate(`/leavers/${token}/manage`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not create. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold inline-flex items-center gap-2"><GraduationCap size={12} /> Step 1 of 3 — Create</div>
        <h1 className="font-nunito font-black text-3xl lg:text-5xl mt-2">Start your group order</h1>
        <p className="text-[#4b5563] mt-2">Fill in the basics — you&apos;ll get a unique link to share with the year group.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-6 bg-white border-2 border-[#dcfce7] rounded-3xl p-6">
          <L label="School / college *"><input data-testid="ls-school" value={form.school} onChange={(e) => update("school", e.target.value)} className={inputCls} /></L>
          <L label="Year group / class *"><input data-testid="ls-year" value={form.year_group} onChange={(e) => update("year_group", e.target.value)} className={inputCls} placeholder="e.g. Year 11" /></L>
          <L label="Order deadline *"><input data-testid="ls-deadline" type="date" value={form.deadline} onChange={(e) => update("deadline", e.target.value)} className={inputCls} /></L>
          <L label="Garment *">
            <select data-testid="ls-product" value={form.product_id} onChange={(e) => update("product_id", e.target.value)} className={inputCls}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} — £{p.price.toFixed(2)}</option>)}
            </select>
          </L>
          <L label="Your name *"><input data-testid="ls-name" value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} className={inputCls} /></L>
          <L label="Your email *"><input data-testid="ls-email" type="email" value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} className={inputCls} /></L>
          <L label="Phone (optional)"><input data-testid="ls-phone" value={form.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} className={inputCls} /></L>
          <L label="Design brief / notes" full>
            <textarea data-testid="ls-design" value={form.design_brief} onChange={(e) => update("design_brief", e.target.value)} rows={3} className={inputCls + " resize-none"} placeholder="What goes on the front? What goes on the back? Any logos to upload later." />
          </L>
          <label className="sm:col-span-2 inline-flex items-start gap-2 bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-3 cursor-pointer" data-testid="ls-bag">
            <input type="checkbox" checked={form.include_bag} onChange={(e) => update("include_bag", e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#7bc67e]" />
            <div className="flex-1">
              <div className="text-sm font-nunito font-extrabold">Add matching printed drawstring bag · +£3.99/hoodie</div>
              <div className="text-xs text-[#4b5563]">Westford Mill-style carry-all printed with the same design as the hoodie.</div>
            </div>
          </label>
        </div>
        <button data-testid="ls-submit" onClick={submit} disabled={busy} className="mt-6 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
          {busy ? <><Loader2 className="animate-spin" size={16} /> Creating…</> : <>Create group order & get my link</>}
        </button>
      </div>
      <BoldFooter />
    </div>
  );
}

// =================================================================================
//  JOIN — classmate adds themselves
// =================================================================================
export function LeaversJoin() {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [form, setForm] = useState({ name: "", nickname: "", size: "M", qty: 1, note: "" });
  const [submitted, setSubmitted] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchGroupOrder(token).then(setOrder).catch(() => setOrder({ error: true }));
    fetchLeaversProducts().then(setProducts);
  }, [token]);

  const product = useMemo(() => products.find(p => p.id === order?.product_id), [products, order]);
  const sizes = product?.sizes || ["S", "M", "L", "XL", "XXL"];

  if (!order) return <Loading />;
  if (order.error) return <NotFound />;

  const onSubmit = async () => {
    if (!form.name.trim()) { toast.error("Add your name"); return; }
    try {
      await joinGroupOrder(token, form);
      toast.success("You're added! 🎉");
      setSubmitted(true);
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not add. Try again."); }
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-3xl p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold inline-flex items-center gap-2"><GraduationCap size={12} /> Group order</div>
          <h1 className="font-nunito font-black text-2xl lg:text-3xl mt-1">{order.school} · {order.year_group}</h1>
          <div className="text-xs text-[#4b5563] mt-2 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Closes {order.deadline}</span>
            <span className="inline-flex items-center gap-1"><Users size={12} /> {order.roster_count} joined</span>
            {order.include_bag && <span className="bg-white px-2 py-0.5 rounded-full text-[10px] font-extrabold">+ printed bag</span>}
            {order.status !== "open" && <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">CLOSED</span>}
          </div>
        </div>

        {submitted ? (
          <div className="mt-6 bg-white border-2 border-[#7bc67e] rounded-3xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#7bc67e] grid place-items-center mx-auto"><Check className="text-[#1a1a1a]" /></div>
            <h2 className="font-nunito font-black text-2xl mt-3">You&apos;re on the list!</h2>
            <p className="text-[#4b5563] mt-1 text-sm">Your year rep will close the order on {order.deadline} and we&apos;ll send a proof before printing.</p>
          </div>
        ) : order.status !== "open" ? (
          <div className="mt-6 bg-white border-2 border-[#dcfce7] rounded-3xl p-6 text-center text-[#4b5563]">
            This group order is closed — speak to your rep if you want to be added.
          </div>
        ) : (
          <div className="mt-6 bg-white border-2 border-[#dcfce7] rounded-3xl p-6">
            <h2 className="font-nunito font-extrabold text-xl">Add your hoodie</h2>
            <p className="text-xs text-[#4b5563] mt-1">Takes 30 seconds. You&apos;ll pay later via your year rep.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <L label="Your name *"><input data-testid="lj-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></L>
              <L label="Nickname for the back"><input data-testid="lj-nickname" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className={inputCls} placeholder="Optional" /></L>
              <L label="Size *">
                <select data-testid="lj-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className={inputCls}>
                  {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </L>
              <L label="Quantity">
                <div className="flex items-center gap-2">
                  <button data-testid="lj-qty-minus" onClick={() => setForm({ ...form, qty: Math.max(1, form.qty - 1) })} className="w-9 h-9 rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7] grid place-items-center"><Minus size={12} /></button>
                  <input data-testid="lj-qty" type="number" min={1} max={10} value={form.qty} onChange={(e) => setForm({ ...form, qty: Math.max(1, Math.min(10, parseInt(e.target.value || "1"))) })} className={inputCls + " text-center"} />
                  <button data-testid="lj-qty-plus" onClick={() => setForm({ ...form, qty: Math.min(10, form.qty + 1) })} className="w-9 h-9 rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7] grid place-items-center"><Plus size={12} /></button>
                </div>
              </L>
              <L label="Note (optional)" full><input data-testid="lj-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} placeholder="e.g. left-handed sleeve / shirt only" /></L>
            </div>
            <button data-testid="lj-submit" onClick={onSubmit} className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5">
              <Check size={16} /> Add me to the order
            </button>
          </div>
        )}
      </div>
      <BoldFooter />
    </div>
  );
}

// =================================================================================
//  MANAGE — rep dashboard
// =================================================================================
export function LeaversManage() {
  const { token } = useParams();
  const [manageToken, setManageToken] = useState(() => localStorage.getItem(`${STORAGE_PREFIX}${token}`) || "");
  const [draftToken, setDraftToken] = useState("");
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [tiers, setTiers] = useState({ tiers: [], bag_price: 3.99 });
  const [busy, setBusy] = useState(false);

  const load = async (mt) => {
    if (!mt) { setOrder({ needAuth: true }); return; }
    try {
      const data = await fetchGroupOrderManage(token, mt);
      setOrder(data);
    } catch (e) { setOrder({ needAuth: true, error: e?.response?.data?.detail }); }
  };
  useEffect(() => { fetchLeaversProducts().then(setProducts); fetchLeaversTiers().then(setTiers); load(manageToken); }, [manageToken, token]);

  if (!order) return <Loading />;
  if (order.needAuth) {
    return (
      <div className="bg-white min-h-screen font-nunito">
        <BoldNavbar />
        <div className="max-w-md mx-auto p-8">
          <Lock className="text-[#7bc67e]" size={28} />
          <h1 className="font-nunito font-black text-2xl mt-3">Manage your group order</h1>
          <p className="text-sm text-[#4b5563] mt-2">Paste the manage token you received when you created the order (we stored it in your browser, but if you&apos;re on a new device you&apos;ll need it).</p>
          <input data-testid="lm-token-input" value={draftToken} onChange={(e) => setDraftToken(e.target.value)} className={inputCls + " mt-3"} placeholder="manage token" />
          <button data-testid="lm-token-submit" onClick={() => { localStorage.setItem(`${STORAGE_PREFIX}${token}`, draftToken); setManageToken(draftToken); }} className="mt-3 w-full bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-6 py-3 rounded-full">Unlock</button>
        </div>
        <BoldFooter />
      </div>
    );
  }

  const product = products.find(p => p.id === order.product_id);
  const totalQty = order.roster.reduce((s, r) => s + (r.qty || 1), 0);
  const tier = [...(tiers.tiers || [])].sort((a, b) => b.min_qty - a.min_qty).find(t => totalQty >= t.min_qty);
  const unitPrice = tier ? tier.unit_price : (product?.price || 0);
  const bagExtra = order.include_bag ? (tiers.bag_price || 3.99) : 0;
  const total = totalQty * (unitPrice + bagExtra);
  const joinUrl = `${window.location.origin}/leavers/${token}`;

  const copyLink = () => { navigator.clipboard.writeText(joinUrl); toast.success("Link copied!"); };
  const removeMember = async (mid) => {
    if (!confirm("Remove this person from the order?")) return;
    await removeGroupMember(token, manageToken, mid);
    load(manageToken);
  };
  const close = async () => {
    if (!confirm("Close the order? Classmates won't be able to add themselves any more.")) return;
    await closeGroupOrder(token, manageToken);
    load(manageToken);
  };
  const checkout = async () => {
    if (totalQty < 1) { toast.error("Roster is empty"); return; }
    setBusy(true);
    try {
      const size_qtys = {};
      order.roster.forEach((m) => { size_qtys[m.size] = (size_qtys[m.size] || 0) + (m.qty || 1); });
      const { url } = await createCheckout({
        product_id: order.product_id,
        size_qtys,
        placements: order.include_bag ? ["drawstring-bag"] : [],
        blank: false,
        origin_url: window.location.origin,
        design_meta: { flow: "leavers_group_order", school: order.school, year_group: order.year_group, token, roster_count: String(order.roster.length) },
      });
      window.location.href = url;
    } catch (e) { toast.error(e?.response?.data?.detail || "Checkout failed"); setBusy(false); }
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold inline-flex items-center gap-2"><GraduationCap size={12} /> Rep dashboard</div>
        <h1 className="font-nunito font-black text-3xl lg:text-5xl mt-2" data-testid="lm-title">{order.school} · {order.year_group}</h1>
        <div className="text-xs text-[#4b5563] mt-2 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Closes {order.deadline}</span>
          <span className="inline-flex items-center gap-1"><Mail size={12} /> {order.contact_email}</span>
          {order.status !== "open" && <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold" data-testid="lm-closed-badge">CLOSED</span>}
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mt-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5">
              <h2 className="font-nunito font-extrabold text-xl">Share the link</h2>
              <p className="text-xs text-[#4b5563] mt-1">Drop this in the year-group WhatsApp. Everyone adds their own name &amp; size.</p>
              <div className="mt-3 flex items-center gap-2 bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-3 py-2">
                <span data-testid="lm-join-url" className="text-xs font-nunito font-bold truncate flex-1">{joinUrl}</span>
                <button data-testid="lm-copy-link" onClick={copyLink} className="inline-flex items-center gap-1 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] text-xs font-nunito font-extrabold px-3 py-1.5 rounded-full"><Copy size={11} /> Copy</button>
              </div>
            </div>

            <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="font-nunito font-extrabold text-xl">Roster · {order.roster.length} joined · {totalQty} hoodies</h2>
                {order.status === "open" && <button data-testid="lm-close" onClick={close} className="text-xs font-nunito font-extrabold text-rose-600 hover:underline">Close order</button>}
              </div>
              {order.roster.length === 0 ? (
                <div className="text-center py-8 text-sm text-[#4b5563]">No one&apos;s joined yet — share the link 👆</div>
              ) : (
                <ul className="space-y-1.5" data-testid="lm-roster">
                  {order.roster.map((m) => (
                    <li key={m.id} data-testid={`lm-member-${m.id}`} className="flex items-center gap-2 bg-[#f0fdf4] rounded-xl border border-[#dcfce7] p-2.5">
                      <div className="flex-1">
                        <div className="text-sm font-nunito font-extrabold">{m.name}{m.nickname && <span className="text-[#4b5563] font-normal italic"> · {m.nickname}</span>}</div>
                        <div className="text-[11px] text-[#4b5563]">{m.size} × {m.qty}{m.note ? ` · ${m.note}` : ""}</div>
                      </div>
                      <button data-testid={`lm-remove-${m.id}`} onClick={() => removeMember(m.id)} className="w-7 h-7 grid place-items-center rounded-full bg-white text-rose-500 hover:bg-rose-50"><Trash2 size={12} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-[#1a1a1a] text-white rounded-3xl p-6 sticky top-24">
              <div className="text-[10px] font-nunito font-extrabold uppercase tracking-[0.3em] text-[#7bc67e]">Order summary</div>
              <div className="text-2xl font-nunito font-black mt-2" data-testid="lm-product-name">{product?.name || ""}</div>
              <div className="text-xs text-neutral-300 mt-1">{totalQty} hoodie{totalQty === 1 ? "" : "s"} @ £{unitPrice.toFixed(2)}{order.include_bag && <> + £{bagExtra.toFixed(2)} bag</>}</div>
              <div className="border-t border-white/10 mt-4 pt-4 flex items-baseline justify-between">
                <span className="text-sm">Total</span>
                <span className="text-[#7bc67e] font-nunito font-black text-3xl" data-testid="lm-total">£{total.toFixed(2)}</span>
              </div>
              {tier && <div className="mt-2 text-[11px] text-[#7bc67e]" data-testid="lm-tier-applied">Bulk tier applied — saving £{((product?.price || 0) - unitPrice).toFixed(2)}/hoodie</div>}
              <button data-testid="lm-checkout" onClick={checkout} disabled={busy || totalQty < 1} className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold rounded-full px-6 py-3.5 shadow-md hover:-translate-y-0.5 transition-transform">
                {busy ? <><Loader2 className="animate-spin" size={16} /> Redirecting…</> : <><ShoppingCart size={16} /> Pay £{total.toFixed(2)}</>}
              </button>
              <div className="text-[10px] text-neutral-400 mt-3 text-center inline-flex items-center gap-1 justify-center w-full"><ShieldCheck size={10} /> Free proof before print</div>
            </div>
          </div>
        </div>
      </div>
      <BoldFooter />
    </div>
  );
}

// ---- Shared helpers ----
const inputCls = "w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7bc67e]";
function L({ label, full, children }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">{label}</label>
      {children}
    </div>
  );
}
function Loading() { return <div className="bg-white min-h-screen font-nunito"><BoldNavbar /><div className="p-12 text-center text-sm text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div></div>; }
function NotFound() {
  return (
    <div className="bg-white min-h-screen font-nunito">
      <BoldNavbar />
      <div className="max-w-md mx-auto p-10 text-center">
        <h1 className="font-nunito font-black text-3xl">Group order not found</h1>
        <p className="text-sm text-[#4b5563] mt-2">Double-check the link your year rep shared, or get them to send it again.</p>
        <Link to="/leavers-hoodies" className="mt-5 inline-flex items-center bg-[#7bc67e] text-[#1a1a1a] font-nunito font-extrabold px-5 py-2.5 rounded-full">Browse leavers&apos; hoodies</Link>
      </div>
      <BoldFooter />
    </div>
  );
}
