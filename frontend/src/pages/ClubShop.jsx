import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { api, mediaUrl, createCartCheckout } from "../lib/api";
import usePageTitle from "../hooks/usePageTitle";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ShoppingCart, CalendarClock, Check, Send } from "lucide-react";
import { ExVat } from "../components/bold/PriceTag";

/** /club/:code - a club's pre-order shop: parents pick sizes (+ names) and pay for their own order. */
export default function ClubShop() {
  const { code } = useParams();
  const [shop, setShop] = useState(null);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState({});      // product_id -> {size, name}
  const [basket, setBasket] = useState([]);  // {item, size, name, qty, price}
  const [busy, setBusy] = useState(false);
  usePageTitle(shop ? `${shop.name} shop` : "Club shop");

  useEffect(() => { api.get(`/club-shops/${code}`).then((r) => setShop(r.data)).catch(() => setErr("Sorry - we can't find that shop.")); }, [code]);
  const total = useMemo(() => basket.reduce((a, b) => a + b.price * b.qty, 0), [basket]);

  if (err) return <div className="min-h-screen grid place-items-center font-nunito"><p className="font-extrabold">{err}</p></div>;
  if (!shop) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  if (shop.mode === "company") return <StaffPicker shop={shop} />;

  const unit = (it, size, name) => (it.sizes.find((s) => s.size === size)?.price || 0) + (it.names && name.trim() ? shop.prices.name : 0);
  const add = (it) => {
    const p = pick[it.product_id] || {};
    if (!p.size) { toast.error("Pick a size"); return; }
    const name = (p.name || "").trim();
    setBasket((b) => {
      const i = b.findIndex((x) => x.item.product_id === it.product_id && x.size === p.size && x.name === name);
      if (i >= 0) { const c = [...b]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c; }
      return [...b, { item: it, size: p.size, name, qty: 1, price: unit(it, p.size, name) }];
    });
    setPick((x) => ({ ...x, [it.product_id]: { size: "", name: "" } }));
  };
  const checkout = async () => {
    if (!basket.length) return;
    setBusy(true);
    try {
      const items = basket.map((b) => ({
        product_id: b.item.product_id, size_qtys: { [b.size]: b.qty }, color: b.item.colour,
        placements: ["logo", ...(b.name ? ["name"] : [])], blank: false,
        design_meta: { flow: "club_shop", club_code: shop.code, club_name: shop.name, child_name: b.name },
      }));
      const { url } = await createCartCheckout(items, null);
      window.location.href = url;
    } catch (e) { toast.error(e?.response?.data?.detail || "Checkout failed"); setBusy(false); }
  };

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="club-shop">
      <BoldNavbar />
      <header className="bg-[#f0fdf4] border-b border-[#dcfce7]">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          {shop.logo && <img src={mediaUrl(shop.logo)} alt="" className="w-24 h-24 object-contain bg-white rounded-2xl border border-[#dcfce7] p-2" />}
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Official kit</div>
            <h1 className="font-black text-3xl lg:text-5xl">{shop.name}</h1>
            {shop.message && <p className="text-[#4b5563] mt-2 max-w-2xl">{shop.message}</p>}
            <div className="mt-2 text-sm font-bold inline-flex items-center gap-1.5">
              <CalendarClock size={15} className="text-[#7bc67e]" />
              {shop.open ? (shop.closes_on ? `Order by ${new Date(shop.closes_on).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : "Open for orders") : "This shop has closed"}
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
          {shop.items.map((it) => {
            const p = pick[it.product_id] || {};
            return (
              <div key={it.product_id + it.colour} className="border-2 border-[#dcfce7] rounded-3xl overflow-hidden" data-testid={`club-item-${it.product_id}`}>
                <div className="aspect-square bg-[#f9fafb]"><img src={it.image} alt={it.name} className="w-full h-full object-contain" /></div>
                <div className="p-4 space-y-2">
                  <div className="font-extrabold">{it.name}</div>
                  <div className="text-xs text-[#4b5563]">{it.colour} · {shop.name} logo on the front{it.names ? " · name on the back optional" : ""}</div>
                  <div className="font-black text-lg">£{(p.size ? unit(it, p.size, p.name || "") : Math.min(...it.sizes.map((s) => s.price))).toFixed(2)}</div>
                  {shop.open && (
                    <>
                      <select value={p.size || ""} onChange={(e) => setPick((x) => ({ ...x, [it.product_id]: { ...p, size: e.target.value } }))} className="w-full border-2 border-[#dcfce7] rounded-xl px-2 py-2 text-sm bg-white" data-testid={`club-size-${it.product_id}`}>
                        <option value="">Choose size…</option>
                        {it.sizes.map((s) => <option key={s.size} value={s.size}>{s.size} - £{s.price.toFixed(2)}</option>)}
                      </select>
                      {it.names && <input value={p.name || ""} onChange={(e) => setPick((x) => ({ ...x, [it.product_id]: { ...p, name: e.target.value } }))} placeholder={`Name on the back (+£${shop.prices.name.toFixed(2)}, optional)`} maxLength={20} className="w-full border-2 border-[#dcfce7] rounded-xl px-3 py-2 text-sm" data-testid={`club-name-${it.product_id}`} />}
                      <button onClick={() => add(it)} className="w-full bg-[#1a1a1a] text-white font-extrabold py-2.5 rounded-full inline-flex items-center justify-center gap-1.5 text-sm" data-testid={`club-add-${it.product_id}`}><Plus size={14} /> Add</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </section>
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="club-summary">
            <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Your order</div>
            <div className="font-black text-4xl mt-2">£{total.toFixed(2)}</div>
            <ExVat amount={total} className="text-[11px] text-neutral-400" />
            <div className="mt-4 space-y-2 text-sm">
              {basket.map((b, i) => (
                <div key={i} className="flex justify-between gap-2 border-b border-white/10 pb-2">
                  <span><strong>{b.qty} × {b.item.name}</strong><br /><span className="text-xs text-neutral-400">{b.size}{b.name ? ` · "${b.name}"` : ""}</span></span>
                  <span className="flex items-center gap-2 font-extrabold">£{(b.price * b.qty).toFixed(2)}<button onClick={() => setBasket((x) => x.filter((_, j) => j !== i))} aria-label="Remove" className="text-rose-300"><Trash2 size={14} /></button></span>
                </div>
              ))}
              {!basket.length && <div className="text-xs text-neutral-400">Choose a size and tap Add.</div>}
            </div>
            <button onClick={checkout} disabled={busy || !basket.length || !shop.open} className="mt-5 w-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-40 text-[#1a1a1a] font-extrabold py-3.5 rounded-full inline-flex items-center justify-center gap-2" data-testid="club-checkout">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />} Pay £{total.toFixed(2)}
            </button>
            <p className="text-[11px] text-neutral-400 mt-3">Printed with the rest of the {shop.name} order once the shop closes. Delivery or collection is chosen at checkout.</p>
          </div>
        </aside>
      </div>
      <BoldFooter />
    </div>
  );
}


/** Staff order link (company pays): staff pick garments + sizes and send them - no prices, no payment. */
function StaffPicker({ shop }) {
  const [pick, setPick] = useState({});      // product_id -> {size, name}
  const [list, setList] = useState([]);      // {item, size, name, qty}
  const [who, setWho] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const count = (pid) => list.filter((b) => b.item.product_id === pid).reduce((a, b) => a + b.qty, 0);
  const add = (it) => {
    const p = pick[it.product_id] || {};
    if (!p.size) { toast.error("Pick a size"); return; }
    if (it.max_each && count(it.product_id) >= it.max_each) { toast.error(`You can choose up to ${it.max_each} × ${it.name}`); return; }
    const name = (p.name || "").trim();
    setList((b) => {
      const i = b.findIndex((x) => x.item.product_id === it.product_id && x.size === p.size && x.name === name);
      if (i >= 0) { const c = [...b]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c; }
      return [...b, { item: it, size: p.size, name, qty: 1 }];
    });
  };
  const send = async () => {
    if (!who.name.trim()) { toast.error("Add your name"); return; }
    if (!list.length) { toast.error("Choose at least one item"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/club-shops/${shop.code}/staff`, { name: who.name, email: who.email,
        picks: list.map((b) => ({ product_id: b.item.product_id, colour: b.item.colour, size: b.size, qty: b.qty, name_on_back: b.name })) });
      setDone({ name: who.name.trim(), replaced: data.replaced });
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't save - please try again"); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="staff-link">
      <BoldNavbar />
      <header className="bg-[#f0fdf4] border-b border-[#dcfce7]">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          {shop.logo && <img src={mediaUrl(shop.logo)} alt="" className="w-24 h-24 object-contain bg-white rounded-2xl border border-[#dcfce7] p-2" />}
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Staff uniform</div>
            <h1 className="font-black text-3xl lg:text-5xl">{shop.name}</h1>
            <p className="text-[#4b5563] mt-2 max-w-2xl">{shop.message || "Choose your uniform and sizes below, add your name and send - that's it. Nothing to pay."}</p>
            <div className="mt-2 text-sm font-bold inline-flex items-center gap-1.5">
              <CalendarClock size={15} className="text-[#7bc67e]" />
              {shop.open ? (shop.closes_on ? `Please choose by ${new Date(shop.closes_on).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : "Open") : "This has now closed"}
            </div>
          </div>
        </div>
      </header>
      {done ? (
        <div className="max-w-xl mx-auto px-6 py-16 text-center" data-testid="staff-done">
          <Check size={40} className="mx-auto text-[#7bc67e]" />
          <h2 className="font-black text-3xl mt-3">Thanks {done.name}!</h2>
          <p className="text-[#4b5563] mt-2">{done.replaced ? "Your choices have been updated." : "Your choices have been saved."} Need to change something? Come back to this link and send again using the same name.</p>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-12 gap-6">
          <section className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
            {shop.items.map((it) => {
              const p = pick[it.product_id] || {};
              return (
                <div key={it.product_id + it.colour} className="border-2 border-[#dcfce7] rounded-3xl overflow-hidden" data-testid={`staff-item-${it.product_id}`}>
                  <div className="aspect-square bg-[#f9fafb]"><img src={it.image} alt={it.name} className="w-full h-full object-contain" /></div>
                  <div className="p-4 space-y-2">
                    <div className="font-extrabold">{it.name}</div>
                    <div className="text-xs text-[#4b5563]">{it.colour} · {shop.name} logo{it.max_each ? ` · up to ${it.max_each} each` : ""}</div>
                    {shop.open && (
                      <>
                        <select value={p.size || ""} onChange={(e) => setPick((x) => ({ ...x, [it.product_id]: { ...p, size: e.target.value } }))} className="w-full border-2 border-[#dcfce7] rounded-xl px-2 py-2 text-sm bg-white" data-testid={`staff-size-${it.product_id}`}>
                          <option value="">Choose size…</option>
                          {it.sizes.map((s) => <option key={s.size} value={s.size}>{s.size}</option>)}
                        </select>
                        {it.names && <input value={p.name || ""} onChange={(e) => setPick((x) => ({ ...x, [it.product_id]: { ...p, name: e.target.value } }))} placeholder="Name on the back (optional)" maxLength={20} className="w-full border-2 border-[#dcfce7] rounded-xl px-3 py-2 text-sm" />}
                        <button onClick={() => add(it)} className="w-full bg-[#1a1a1a] text-white font-extrabold py-2.5 rounded-full inline-flex items-center justify-center gap-1.5 text-sm" data-testid={`staff-add-${it.product_id}`}><Plus size={14} /> Add</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 bg-[#1a1a1a] text-white rounded-3xl p-6" data-testid="staff-summary">
              <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Your choices</div>
              <div className="mt-3 space-y-2 text-sm">
                {list.map((b, i) => (
                  <div key={i} className="flex justify-between gap-2 border-b border-white/10 pb-2">
                    <span><strong>{b.qty} × {b.item.name}</strong><br /><span className="text-xs text-neutral-400">{b.size}{b.name ? ` · "${b.name}"` : ""}</span></span>
                    <button onClick={() => setList((x) => x.filter((_, j) => j !== i))} aria-label="Remove" className="text-rose-300"><Trash2 size={14} /></button>
                  </div>
                ))}
                {!list.length && <div className="text-xs text-neutral-400">Choose a size and tap Add.</div>}
              </div>
              <input value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} placeholder="Your name *" className="mt-4 w-full rounded-xl px-3 py-2.5 text-sm text-[#1a1a1a]" data-testid="staff-name" />
              <input value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} placeholder="Your email (optional)" className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm text-[#1a1a1a]" />
              <button onClick={send} disabled={busy || !list.length || !shop.open} className="mt-4 w-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-40 text-[#1a1a1a] font-extrabold py-3.5 rounded-full inline-flex items-center justify-center gap-2" data-testid="staff-send">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send my choices
              </button>
              <p className="text-[11px] text-neutral-400 mt-3">Nothing to pay - {shop.name} is ordering for everyone.</p>
            </div>
          </aside>
        </div>
      )}
      <BoldFooter />
    </div>
  );
}
