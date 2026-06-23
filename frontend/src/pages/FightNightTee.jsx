import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import WhatsAppFAB, { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import { submitQuoteRequest } from "../lib/api";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Loader2, Sparkles, Zap, Send, ArrowRight, BadgeCheck, Camera } from "lucide-react";

const SIZES = ["S", "M", "L", "XL", "XXL", "3XL"];

export default function FightNightTee() {
  const [contact, setContact] = useState({ name: "", email: "", phone: "", company: "" });
  const [eventDate, setEventDate] = useState("");
  const [logos, setLogos] = useState([]); // base64
  const [layoutNote, setLayoutNote] = useState(""); // "main sponsor centre, others around"
  const [sizeQtys, setSizeQtys] = useState({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  const totalQty = Object.values(sizeQtys).reduce((a, b) => a + (Number(b) || 0), 0);

  const onPickImages = (e) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, 30 - logos.length).forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 800;
          const sc = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          setLogos(prev => [...prev, c.toDataURL("image/png")]);
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
    });
    e.target.value = "";
  };
  const removeLogo = (i) => setLogos(prev => prev.filter((_, idx) => idx !== i));
  const setSizeQty = (sz, q) => {
    const n = Math.max(0, Math.min(2000, Number(q) || 0));
    setSizeQtys(prev => { const next = { ...prev }; if (n === 0) delete next[sz]; else next[sz] = n; return next; });
  };
  const bump = (sz, d) => setSizeQty(sz, (sizeQtys[sz] || 0) + d);

  const submit = async () => {
    if (!contact.name.trim() || !contact.email.trim()) { toast.error("Name and email are required."); return; }
    if (logos.length === 0) { toast.error("Upload at least one sponsor logo."); return; }
    if (totalQty < 1) { toast.error("Pick at least 1 tee size & quantity."); return; }
    setSubmitting(true);
    try {
      const sizesStr = Object.entries(sizeQtys).map(([s, q]) => `${s}×${q}`).join(", ");
      const message = `Fight night tee — let-us-do-it-for-you flow.\nEvent date: ${eventDate || "TBC"}\nLogos uploaded: ${logos.length}\nLayout note: ${layoutNote || "(not specified — we'll arrange)"}\nSizes: ${sizesStr}\nTotal tees: ${totalQty}\nNotes:\n${notes}`;
      await submitQuoteRequest({
        kind: "fight_night",
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        sport: "boxing",
        kit_type: "fight-night-tee",
        quantity: totalQty,
        deadline: eventDate,
        message,
        artwork: logos,
        product_id: "boxing-fight-tee",
      });
      toast.success("Sent! Free proof on the way within 1 working day.");
      setDone(true);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
        <BoldNavbar />
        <WhatsAppFAB preset="Hi! I just submitted a fight-night tee request." />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div className="mx-auto w-20 h-20 bg-[#7bc67e] rounded-full grid place-items-center"><BadgeCheck className="text-[#1a1a1a]" size={36} /></div>
          <h2 className="mt-5 font-nunito font-black text-3xl">Sent! Free proof incoming 🥊</h2>
          <p className="mt-3 text-[#4b5563]">We'll arrange your sponsors and email back a free proof within 1 working day. Pay only when you're happy.</p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            <WhatsAppInline preset="Hi! I just submitted a fight-night tee request — anything you need from me?" label="WhatsApp us" />
            <Link to="/" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white font-nunito font-extrabold px-6 py-3 rounded-full transition-colors">Back to home</Link>
          </div>
        </div>
        <BoldFooter />
      </div>
    );
  }

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <WhatsAppFAB preset="Hi! I'd like a fight-night tee with multiple sponsors." />

      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-16 -left-16 w-[400px] h-[400px] rounded-full bg-[#fde68a]/35 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 w-[400px] h-[400px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1a1a1a] text-[#7bc67e] font-nunito font-extrabold rounded-full text-xs">
              <Zap size={14} /> Fight Night · Boxing · MMA · Muay Thai
            </div>
            <h1 className="mt-3 font-nunito font-black text-4xl lg:text-6xl leading-[1.05]">
              Fight Night <span className="text-[#7bc67e]">Sponsor Tees</span>
            </h1>
            <p className="text-[#4b5563] mt-3 text-lg">
              Two ways to do it: design it yourself with the Designer, or upload all your sponsor logos and <strong>let us arrange them for you — free proof included</strong> before you pay a penny.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/design?product=boxing-fight-tee" data-testid="fight-design-yourself" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white font-nunito font-extrabold px-5 py-3 rounded-full transition-colors">
                Design it yourself <ArrowRight size={14} />
              </Link>
              <a href="#let-us" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-5 py-3 rounded-full transition-colors">
                Let us do it for you ↓
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl">
              <img src="https://images.pexels.com/photos/9311461/pexels-photo-9311461.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      <div id="let-us" className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-[#f0fdf4] border-2 border-[#7bc67e] rounded-3xl p-5 flex items-start gap-3">
          <Sparkles className="text-[#7bc67e] flex-shrink-0 mt-1" size={20} />
          <div>
            <div className="font-nunito font-extrabold">Let us do it for you — free artwork proof</div>
            <p className="text-sm text-[#4b5563] mt-1">Upload as many logos as you'd like. The more logos, the smaller they'll be on the tee — but our designers will arrange them in the cleanest way possible. We'll email you a free proof to approve before you pay.</p>
          </div>
        </div>

        <Block title="1. Your details">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Your name *" v={contact.name} onV={(v) => setContact({ ...contact, name: v })} testId="fn-name" />
            <Field label="Email *" type="email" v={contact.email} onV={(v) => setContact({ ...contact, email: v })} testId="fn-email" />
            <Field label="Phone" v={contact.phone} onV={(v) => setContact({ ...contact, phone: v })} testId="fn-phone" />
            <Field label="Gym / promotion / fighter" v={contact.company} onV={(v) => setContact({ ...contact, company: v })} testId="fn-company" />
            <Field label="Event date" type="date" v={eventDate} onV={setEventDate} testId="fn-event-date" />
          </div>
        </Block>

        <Block title="2. Upload all your sponsor logos">
          <div className="flex flex-wrap items-center gap-3" data-testid="fn-logos">
            {logos.map((src, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl bg-white border border-[#dcfce7] overflow-hidden">
                <img src={src} alt="" className="w-full h-full object-contain p-1" />
                <button onClick={() => removeLogo(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center">×</button>
              </div>
            ))}
            <button data-testid="fn-upload-logos" onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-[#7bc67e] grid place-items-center text-[#7bc67e] hover:bg-[#f0fdf4]">
              <Plus size={20} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickImages} />
          </div>
          <div className="text-xs text-[#4b5563] mt-2">{logos.length}/30 logos uploaded · PNG with transparent background works best.</div>
          <textarea data-testid="fn-layout-note" value={layoutNote} onChange={(e) => setLayoutNote(e.target.value)} placeholder="Layout preference (optional) — e.g. 'main sponsor centre, others around it', or 'list-style on back'" rows={2} className="mt-3 w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm" />
        </Block>

        <Block title="3. Sizes & quantity">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SIZES.map((sz) => {
              const qty = sizeQtys[sz] || 0;
              const active = qty > 0;
              return (
                <div key={sz} data-testid={`fn-size-${sz}`} className={`rounded-xl border-2 p-2 ${active ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#e5e7eb] bg-white"}`}>
                  <div className="text-center font-nunito font-extrabold text-sm">{sz}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <button data-testid={`fn-size-${sz}-minus`} onClick={() => bump(sz, -1)} className="w-6 h-6 grid place-items-center rounded-full bg-white border disabled:opacity-40" disabled={qty === 0}>−</button>
                    <input data-testid={`fn-size-${sz}-qty`} type="number" min={0} value={qty} onChange={(e) => setSizeQty(sz, e.target.value)} className="w-full text-center bg-transparent text-xs font-bold focus:outline-none" />
                    <button data-testid={`fn-size-${sz}-plus`} onClick={() => bump(sz, 1)} className="w-6 h-6 grid place-items-center rounded-full bg-white border">+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-[#4b5563]">Total: <strong data-testid="fn-total-qty">{totalQty}</strong> tees</div>
        </Block>

        <Block title="4. Anything else?">
          <textarea data-testid="fn-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Tee colour preference, deadline, special requests…" className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm" />
        </Block>

        <div className="bg-[#1a1a1a] text-white rounded-3xl p-6">
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Free proof, then pay</div>
              <div className="font-nunito font-black text-2xl mt-1">{totalQty} tees · {logos.length} logos</div>
              <div className="text-xs text-neutral-400 mt-1">From £11.99/tee — final price confirmed in the proof email.</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button data-testid="fn-submit" onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5">
                {submitting ? <><Loader2 className="animate-spin" size={16} /> Sending…</> : <><Send size={16} /> Send for free proof</>}
              </button>
              <WhatsAppInline preset="Hi! Quick question about fight night tees…" label="WhatsApp" />
            </div>
          </div>
        </div>
      </div>

      <BoldFooter />
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-5">
      <h3 className="font-nunito font-extrabold text-[#1a1a1a] mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, v, onV, type = "text", testId }) {
  return (
    <div>
      <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-1">{label}</label>
      <input data-testid={testId} type={type} value={v} onChange={(e) => onV(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5 text-sm" />
    </div>
  );
}
