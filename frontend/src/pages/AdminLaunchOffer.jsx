import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Loader2, Gift } from "lucide-react";

/** Admin > Launch offer - the site-wide LAUNCH10 code + banner (routers/launch_offer.py). */
export default function AdminLaunchOffer() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/admin/launch-offer").then((r) => setD(r.data)).catch(() => toast.error("Couldn't load the launch offer")); }, []);

  const toggle = async () => {
    const turnOn = !d.on;
    if (turnOn && !window.confirm(`Switch on ${d.code}? This creates the code in Stripe (${d.stripe_mode === "live" ? "LIVE - real customers can use it" : "test mode"}) and shows the banner on every page.`)) return;
    setBusy(true);
    try {
      const r = await api.put("/admin/launch-offer", { on: turnOn });
      setD(r.data);
      toast.success(turnOn ? `${d.code} is on - banner showing, code works at checkout` : `${d.code} switched off`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't save"); }
    finally { setBusy(false); }
  };

  if (!d) return <div className="p-10"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  const ends = new Date(`${d.ends}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="p-6 max-w-3xl font-nunito" data-testid="admin-launch-offer">
      <h1 className="font-black text-3xl">Launch offer</h1>
      <p className="text-sm text-zinc-500 mt-1">One code for everyone, for the new website launch. While it&apos;s on, a thin bar at the top of every page shows the code,
        and the &quot;10% off your first order&quot; sign-up popup is paused so customers don&apos;t get two offers.</p>

      <div className="mt-5 bg-white border-2 border-[#dcfce7] rounded-3xl p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] grid place-items-center"><Gift className="text-[#7bc67e]" /></div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-black text-2xl tracking-wider">{d.code}</div>
            <div className="text-sm text-[#4b5563]">{d.pct}% off the whole order · ends {ends}</div>
            <div className="mt-2 text-sm">
              {d.running ? <span className="font-extrabold text-[#166534]">● On - showing on the site</span>
                : d.on ? <span className="font-extrabold text-[#9ca3af]">Ended ({ends})</span>
                  : <span className="font-extrabold text-[#9ca3af]">● Off</span>}
            </div>
            {d.stripe?.times_redeemed != null && (
              <div className="text-sm mt-1" data-testid="launch-used">Used on <strong>{d.stripe.times_redeemed}</strong> order{d.stripe.times_redeemed === 1 ? "" : "s"} so far</div>
            )}
            {d.error && <div className="text-xs text-red-600 mt-1">Stripe: {d.error}</div>}
          </div>
          <button onClick={toggle} disabled={busy} data-testid="launch-toggle"
            className={`inline-flex items-center gap-2 font-extrabold text-sm rounded-full px-5 py-2.5 disabled:opacity-50 ${d.on ? "bg-zinc-200 hover:bg-zinc-300" : "bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a]"}`}>
            {busy && <Loader2 size={14} className="animate-spin" />} {d.on ? "Switch off" : "Switch on"}
          </button>
        </div>
      </div>

      <div className="mt-5 text-sm text-[#4b5563] space-y-2">
        <p><strong>How customers use it:</strong> they type {d.code} on the payment page (&quot;Add promotion code&quot;).</p>
        <p><strong>Not with bulk discounts:</strong> on orders already 15% or more off (about 25+ items, or big customer discounts) the payment page
          has no code box, so it can&apos;t stack.</p>
        <p><strong>After {ends}</strong> the code stops working in Stripe and the banner disappears by itself.</p>
      </div>
    </div>
  );
}
