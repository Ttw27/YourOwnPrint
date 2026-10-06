import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { X, Gift, Loader2 } from "lucide-react";

/**
 * "10% off your first order" - email sign-up (routers/signup_offer.py).
 * Shows once per visitor: after 25 seconds, or when the mouse leaves the top
 * of the window on desktop. Never on checkout, admin, the designer or builders
 * mid-order pages.
 */
const KEY = "yop_signup_offer";
const QUIET = /^\/(admin|checkout|design\b|basket|review|full-squad|sports-outfit|dance-studio-kit|leavers-hoodies\/start)/;

export default function SignupOffer() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState("form"); // form | busy | done
  const [err, setErr] = useState("");

  useEffect(() => {
    let seen = null;
    try { seen = localStorage.getItem(KEY); } catch { /* ignore */ }
    if (seen || QUIET.test(loc.pathname)) return undefined;
    const show = () => { if (!QUIET.test(window.location.pathname)) setOpen(true); };
    const t = setTimeout(show, 25000);
    const exit = (e) => { if (e.clientY <= 0) show(); };
    document.addEventListener("mouseleave", exit);
    return () => { clearTimeout(t); document.removeEventListener("mouseleave", exit); };
  }, [loc.pathname]);

  const close = () => { setOpen(false); try { localStorage.setItem(KEY, "seen"); } catch { /* ignore */ } };
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setState("busy");
    try { await api.post("/signup-offer", { email, source: loc.pathname.slice(0, 40) }); setState("done"); try { localStorage.setItem(KEY, "done"); } catch { /* ignore */ } }
    catch (x) { setErr(x?.response?.data?.detail || "Something went wrong - please try again"); setState("form"); }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 grid place-items-center p-4 font-nunito" role="dialog" aria-label="10% off your first order" data-testid="signup-offer">
      <div className="relative bg-white rounded-3xl max-w-md w-full p-6 text-[#1a1a1a] shadow-2xl">
        <button onClick={close} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-[#f0fdf4]" aria-label="Close" data-testid="signup-close"><X size={18} /></button>
        <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] grid place-items-center"><Gift className="text-[#7bc67e]" /></div>
        {state === "done" ? (
          <>
            <h2 className="font-black text-2xl mt-3">Check your inbox!</h2>
            <p className="text-sm text-[#4b5563] mt-2">Your 10% off code is on its way to <strong>{email}</strong>. Enter it on the payment page.</p>
            <button onClick={close} className="mt-5 w-full bg-[#7bc67e] font-extrabold py-3 rounded-full">Keep shopping</button>
          </>
        ) : (
          <>
            <h2 className="font-black text-2xl mt-3">10% off your first order</h2>
            <p className="text-sm text-[#4b5563] mt-1">Custom printed tees, hoodies, workwear and kit - pop your email in and we&apos;ll send your code.</p>
            <form onSubmit={submit} className="mt-4 space-y-2">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email"
                className="w-full border-2 border-[#dcfce7] focus:border-[#7bc67e] rounded-xl px-3 py-3 text-sm outline-none" data-testid="signup-email" />
              {err && <div className="text-xs text-rose-600 font-bold">{err}</div>}
              <button type="submit" disabled={state === "busy"} className="w-full bg-[#7bc67e] hover:bg-[#5eb062] font-extrabold py-3 rounded-full inline-flex justify-center items-center gap-2 disabled:opacity-60" data-testid="signup-submit">
                {state === "busy" && <Loader2 size={16} className="animate-spin" />} Send my code
              </button>
            </form>
            <p className="text-[11px] text-[#9ca3af] mt-3">One code per person, first order only. We&apos;ll also send the odd offer - unsubscribe any time.</p>
            <button onClick={close} className="mt-1 text-xs text-[#4b5563] underline">No thanks</button>
          </>
        )}
      </div>
    </div>
  );
}
