import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Loader2, Star, PartyPopper } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

/** /review/:token - from the "how did we do?" email (routers/followups.py).
 *  Star rating + comment for each product ordered and for the shop overall. */
export default function ReviewOrder() {
  usePageTitle("Review your order");
  const { token } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [rows, setRows] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api.get(`/review-request/${token}`).then(({ data: d }) => {
      setData(d); setName(d.name || "");
      const s = Number(params.get("stars")) || 0;
      setRows(Object.fromEntries([...d.products.map((p) => p.id), "store"].map((id) => [id, { rating: s, body: "" }])));
    }).catch(() => setErr("Sorry - this review link has expired."));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (id, p) => setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));
  const submit = async () => {
    const reviews = Object.entries(rows).filter(([, v]) => v.rating > 0).map(([product_id, v]) => ({ product_id, rating: v.rating, body: v.body }));
    if (!reviews.length) { toast.error("Tap the stars to rate first"); return; }
    setBusy(true);
    try { await api.post(`/review-request/${token}`, { reviewer_name: name, reviews }); setSent(true); }
    catch (e) { toast.error(e?.response?.data?.detail || "Couldn't send - please try again"); }
    finally { setBusy(false); }
  };

  // plain functions (not components) so the comment box keeps focus while typing
  const stars = (id) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => set(id, { rating: n })} aria-label={`${n} stars`} data-testid={`rv-${id}-${n}`}>
          <Star size={28} className={n <= (rows[id]?.rating || 0) ? "text-[#f59e0b] fill-[#f59e0b]" : "text-[#d1d5db]"} />
        </button>
      ))}
    </div>
  );
  const row = (id, title, image) => (
    <div key={id} className="bg-white border-2 border-[#dcfce7] rounded-2xl p-4 flex gap-4" data-testid={`rv-row-${id}`}>
      {image && <img src={image} alt="" className="w-20 h-20 object-contain rounded-xl bg-[#f9fafb] flex-shrink-0" />}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="font-extrabold">{title}</div>
        {stars(id)}
        <textarea value={rows[id]?.body || ""} onChange={(e) => set(id, { body: e.target.value })} rows={2} placeholder="Anything you'd tell a friend? (optional)"
          className="w-full border border-[#dcfce7] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#7bc67e]" />
      </div>
    </div>
  );

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]">
      <BoldNavbar />
      <div className="max-w-2xl mx-auto px-4 py-12">
        {err ? <p className="text-center font-extrabold">{err}</p> : !data ? <div className="grid place-items-center py-20"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
          : sent || data.done ? (
            <div className="text-center py-10">
              <PartyPopper className="mx-auto text-[#7bc67e]" size={40} />
              <h1 className="font-black text-3xl mt-3">Thank you!</h1>
              <p className="text-[#4b5563] mt-2">Your review means a lot to a small Leicester print shop.</p>
              <Link to="/" className="inline-block mt-6 bg-[#7bc67e] font-extrabold px-6 py-3 rounded-full">Back to the shop</Link>
            </div>
          ) : (
            <>
              <h1 className="font-black text-3xl lg:text-4xl">How did we do{data.name ? `, ${data.name}` : ""}?</h1>
              <p className="text-[#4b5563] mt-2">Tap the stars - it only takes a few seconds.</p>
              <div className="space-y-3 mt-6">
                {data.products.map((p) => row(p.id, p.name, p.image))}
                {row("store", "Your Own Print overall (service, delivery, print quality)")}
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name as shown on the review (e.g. Sarah K.)"
                className="mt-4 w-full border-2 border-[#dcfce7] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#7bc67e]" />
              <button onClick={submit} disabled={busy} className="mt-4 w-full bg-[#7bc67e] hover:bg-[#5eb062] font-extrabold py-3.5 rounded-full disabled:opacity-60" data-testid="rv-submit">
                {busy ? "Sending…" : "Send my review"}
              </button>
            </>
          )}
      </div>
      <BoldFooter />
    </div>
  );
}
