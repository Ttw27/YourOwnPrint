import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { api, uploadOrderArtwork } from "../lib/api";
import { ImageSlot } from "./FullSquadConfigurator";
import usePageTitle from "../hooks/usePageTitle";
import { toast } from "sonner";
import { Search, Trash2, Loader2, Check, Copy, Users, CreditCard, Package, Building2, FileText } from "lucide-react";

/** /club-shop/new - an organiser sets up a parent / member pre-order shop (routers/club_shops.py).
 *  /staff-order-link (defaultMode="company") - same tool, but staff only pick sizes and the company pays once. */
const MAX = 8;
const SUGGEST = ["jh001", "jh001b", "gd01", "gd01b", "jc001", "jh072", "sk236", "sk64", "bg140", "w110"];

export default function ClubShopCreate({ defaultMode = "pay_each" }) {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "company" ? "company" : defaultMode);
  const company = mode === "company";
  usePageTitle(company ? "Staff order link" : "Set up a club shop", { description: company
    ? "Share one link - staff choose their own garments and sizes, the company gets one order and one invoice."
    : "A link for parents and members to order and pay for their own kit with your logo." });
  const [form, setForm] = useState({ name: "", organiser: "", email: "", phone: "", closes_on: "", message: "" });
  const [logo, setLogo] = useState(null);
  const [items, setItems] = useState([]);          // {product, colour, names, label}
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [suggest, setSuggest] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    Promise.all(SUGGEST.map((id) => api.get(`/products/${id}`).then((r) => r.data).catch(() => null)))
      .then((l) => setSuggest(l.filter((p) => p && p.active !== false)));
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => api.get("/search", { params: { q, limit: 12 } }).then((r) => setResults(r.data.items || [])).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);

  const add = async (p) => {
    if (items.length >= MAX) { toast.error(`Up to ${MAX} items per shop`); return; }
    const full = (await api.get(`/products/${p.id}`).catch(() => ({ data: p }))).data;
    const black = (full.colors || []).find((c) => /black/i.test(c.name)) || (full.colors || [])[0];
    setItems((it) => [...it, { product: full, colour: black?.name || "", names: false, label: "", max_each: 0 }]);
    setQ(""); setResults([]);
  };
  const patch = (i, p) => setItems((it) => it.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error("Add your club / school name and email"); return; }
    if (!logo) { toast.error("Upload your logo"); return; }
    if (!items.length) { toast.error("Add at least one item"); return; }
    setBusy(true);
    try {
      const art = await uploadOrderArtwork({ logo }, "club-shop");
      const { data } = await api.post("/club-shops", { ...form, logo: art.art_logo, mode,
        items: items.map((x) => ({ product_id: x.product.id, colour: x.colour, names: x.names, label: x.label, max_each: Number(x.max_each) || 0 })) });
      setDone(data);
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't set up the shop - please try again"); }
    finally { setBusy(false); }
  };
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success("Copied"); };

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]" data-testid="club-shop-create">
      <BoldNavbar />
      <header className="bg-[#1a1a1a] text-white">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">{company ? "Staff order links" : "Club shops"}</span>
          <h1 className="font-black text-4xl lg:text-5xl mt-2">{company ? "No more chasing staff for sizes." : "One link. Every parent orders and pays for their own."}</h1>
          <p className="text-zinc-300 mt-3 max-w-2xl">{company
            ? "Pick the uniform, share one link - every member of staff chooses their own garments and sizes. You see everyone's choices, then send one order: pay by card or ask us for an invoice. Free to set up."
            : "For dance studios, clubs, schools and PTAs. Pick the kit, share the link - parents choose sizes and names and pay online. We print it all together when the shop closes. Free to set up, no money handling for you."}</p>
          <div className="mt-5 grid sm:grid-cols-3 gap-3 text-sm">
            {(company ? [[Package, "Pick the uniform with your logo"], [Users, "Staff choose their own sizes"], [FileText, "One order - card or invoice"]]
              : [[Package, "Pick up to 8 items with your logo"], [Users, "Share the link with parents"], [CreditCard, "They pay - we print it all together"]]).map(([I, t]) => (
              <div key={t} className="flex items-center gap-2 bg-white/10 rounded-2xl px-3 py-2.5"><I size={16} className="text-[#7bc67e]" /> {t}</div>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {done ? (
          <div className="bg-[#f0fdf4] border-2 border-[#7bc67e] rounded-3xl p-6" data-testid="club-shop-done">
            <h2 className="font-black text-2xl flex items-center gap-2"><Check className="text-[#7bc67e]" /> {company ? "Your staff order link is ready!" : "Your shop is ready!"}</h2>
            <p className="text-sm text-[#4b5563] mt-1">We&apos;ve emailed you both links too.</p>
            {[[company ? "Share this with your staff" : "Share this with parents / members", done.shop_url],
              [company ? "Your private page (everyone's choices, download the list, send the order)" : "Your private organiser page (orders, download, close the shop)", done.manage_url]].map(([l, u]) => (
              <div key={u} className="mt-4">
                <div className="text-xs font-extrabold">{l}</div>
                <div className="flex gap-2 mt-1">
                  <input readOnly value={u} className="flex-1 min-w-0 border-2 border-[#dcfce7] rounded-xl px-3 py-2 text-sm bg-white" />
                  <button onClick={() => copy(u)} className="bg-[#7bc67e] font-extrabold px-4 rounded-xl inline-flex items-center gap-1 text-sm"><Copy size={14} /> Copy</button>
                </div>
              </div>
            ))}
            <a href={done.shop_url} className="inline-block mt-5 font-extrabold underline">{company ? "View your staff link →" : "View your shop →"}</a>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="cs-mode">
              <h2 className="font-black text-xl mb-3">Who pays?</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[["pay_each", Users, "Each person pays", "Clubs, studios, schools & PTAs - parents and members pay for their own."],
                  ["company", Building2, "The company pays", "Staff just pick their sizes. You get one order - pay by card or ask for an invoice."]].map(([k, I, t, d]) => (
                  <button key={k} type="button" onClick={() => setMode(k)} data-testid={`cs-mode-${k}`}
                    className={`text-left rounded-2xl p-4 border-2 ${mode === k ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] hover:border-[#7bc67e]"}`}>
                    <div className="font-black flex items-center gap-2"><I size={18} className="text-[#16a34a]" /> {t}</div>
                    <div className="text-xs text-[#4b5563] mt-1">{d}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5">
              <h2 className="font-black text-2xl mb-3"><span className="text-[#7bc67e]">1.</span> {company ? "About your company" : "About your club"}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[["name", company ? "Company name *" : "Club / school / studio name *"], ["organiser", "Your name"], ["email", "Your email *"], ["phone", "Phone (optional)"]].map(([k, ph]) => (
                  <input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={ph}
                    className="w-full border-2 border-[#dcfce7] focus:border-[#7bc67e] rounded-xl px-3 py-2.5 text-sm outline-none" data-testid={`cs-${k}`} />
                ))}
                <label className="text-sm"><span className="text-xs font-extrabold">{company ? "Staff choose by" : "Shop closes on"}</span>
                  <input type="date" value={form.closes_on} onChange={(e) => setForm({ ...form, closes_on: e.target.value })} className="w-full border-2 border-[#dcfce7] rounded-xl px-3 py-2 text-sm mt-1" data-testid="cs-closes" />
                </label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={company ? "Message for staff (optional) - e.g. 'Please choose by Friday - 2 polos and a fleece each'" : "Message for parents (optional) - e.g. 'Orders close Friday, kit handed out at class'"}
                  rows={2} className="border-2 border-[#dcfce7] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#7bc67e]" />
              </div>
              <div className="mt-4"><ImageSlot label="Your logo *" hint="Printed on every item" value={logo} onChange={setLogo} testid="cs-logo" /></div>
            </section>

            <section className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5">
              <h2 className="font-black text-2xl mb-1"><span className="text-[#7bc67e]">2.</span> {company ? "What can staff choose?" : "What can they order?"}</h2>
              <p className="text-sm text-[#4b5563] mb-3">{company
                ? <>Up to {MAX} items, each in one colour, with your logo on the front. Set &quot;up to&quot; to limit how many of each item one person can choose (e.g. 2 polos), or leave it at 0 for no limit.</>
                : <>Up to {MAX} items, each in one colour. Your logo is on the front of everything (£3 included in the price parents see); tick &quot;names&quot; to let them add a name on the back (+£3).</>}</p>
              <div className="space-y-2">
                {items.map((x, i) => {
                  const col = (x.product.colors || []).find((c) => c.name === x.colour);
                  return (
                    <div key={i} className="border-2 border-[#dcfce7] rounded-2xl p-3 grid sm:grid-cols-[72px_1fr_auto] gap-3 items-start" data-testid={`cs-item-${i}`}>
                      <img src={col?.image || x.product.image} alt="" className="w-[72px] h-[72px] object-contain bg-[#f9fafb] rounded-xl" />
                      <div className="min-w-0 space-y-2">
                        <div className="font-extrabold text-sm">{x.product.name} <span className="text-[#4b5563] font-bold">· {x.colour}</span></div>
                        <div className="flex flex-wrap gap-1">
                          {(x.product.colors || []).slice(0, 60).map((c) => (
                            <button key={c.name} type="button" title={c.name} onClick={() => patch(i, { colour: c.name })}
                              className={`w-6 h-6 rounded-full border-2 ${x.colour === c.name ? "border-[#1a1a1a] ring-2 ring-[#7bc67e]" : "border-[#e5e7eb]"}`} style={{ background: c.hex || "#ccc" }} />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3 items-center text-xs">
                          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={x.names} onChange={(e) => patch(i, { names: e.target.checked })} className="accent-[#7bc67e]" /> Name on the back (+£3)</label>
                          {company && (
                            <label className="inline-flex items-center gap-1.5">Up to
                              <input type="number" min={0} max={50} value={x.max_each} onChange={(e) => patch(i, { max_each: e.target.value })} className="w-14 border border-[#dcfce7] rounded-lg px-2 py-1" data-testid={`cs-max-${i}`} /> each
                            </label>
                          )}
                          <input value={x.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder={company ? "Show it as (optional) e.g. 'Office polo'" : "Show it as (optional) e.g. 'Studio hoodie'"} className="border border-[#dcfce7] rounded-lg px-2 py-1 min-w-0 flex-1" />
                        </div>
                      </div>
                      <button onClick={() => setItems((it) => it.filter((_, j) => j !== i))} className="text-rose-500 p-1" aria-label="Remove"><Trash2 size={16} /></button>
                    </div>
                  );
                })}
              </div>
              {items.length < MAX && (
                <div className="mt-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-3 text-[#9ca3af]" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search garments - hoodie, leggings, polo, bag..." className="w-full border-2 border-[#dcfce7] focus:border-[#7bc67e] rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none" data-testid="cs-search" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 mt-2">
                    {(results.length ? results : suggest).filter((p) => !items.some((x) => x.product.id === p.id) && !(p.bundle_items || []).length && !["team-kits", "leavers"].includes(p.category) && !p.design_shop).slice(0, 10).map((p) => (
                      <button key={p.id} type="button" onClick={() => add(p)} className="text-left border-2 border-[#e5e7eb] hover:border-[#7bc67e] rounded-xl p-2" data-testid={`cs-add-${p.id}`}>
                        <img src={p.image} alt="" className="w-full aspect-square object-contain bg-[#f9fafb] rounded-lg" />
                        <div className="text-[11px] font-extrabold mt-1 line-clamp-2">{p.name}</div>
                        <div className="text-[11px] text-[#4b5563]">from £{(Number(p.price) + 3).toFixed(2)} with logo</div>
                      </button>
                    ))}
                  </div>
                  {!results.length && <div className="text-[11px] text-[#4b5563] mt-1">Popular picks - or search for anything in our range.</div>}
                </div>
              )}
            </section>

            <button onClick={submit} disabled={busy} className="w-full sm:w-auto bg-[#7bc67e] hover:bg-[#5eb062] font-extrabold px-8 py-3.5 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-60" data-testid="cs-submit">
              {busy && <Loader2 size={16} className="animate-spin" />} {company ? "Create my staff link" : "Create my shop link"}
            </button>
          </div>
        )}
      </div>
      <BoldFooter />
    </div>
  );
}
