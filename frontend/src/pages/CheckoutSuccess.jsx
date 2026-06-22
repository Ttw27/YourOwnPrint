import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { IndustrialNavbar, IndustrialFooter } from "../components/IndustrialLayout";
import { fetchCheckoutStatus } from "../lib/api";
import { CheckCircle2, Loader2, XCircle, ArrowRight } from "lucide-react";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState({ loading: true, paid: false, expired: false, info: null, error: null });

  useEffect(() => {
    if (!sessionId) {
      setState({ loading: false, paid: false, expired: false, info: null, error: "Missing session_id" });
      return;
    }
    let attempts = 0;
    const maxAttempts = 6;
    const poll = async () => {
      try {
        const data = await fetchCheckoutStatus(sessionId);
        if (data.payment_status === "paid") {
          setState({ loading: false, paid: true, expired: false, info: data, error: null });
          return;
        }
        if (data.status === "expired") {
          setState({ loading: false, paid: false, expired: true, info: data, error: null });
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          setState({ loading: false, paid: false, expired: false, info: data, error: "Still processing — check your email shortly." });
          return;
        }
        setTimeout(poll, 2000);
      } catch (e) {
        setState({ loading: false, paid: false, expired: false, info: null, error: e?.response?.data?.detail || e.message });
      }
    };
    poll();
  }, [sessionId]);

  return (
    <div className="bg-[#0d0d0d] min-h-screen text-white font-ibm">
      <IndustrialNavbar />
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        {state.loading ? (
          <>
            <Loader2 className="mx-auto animate-spin text-[#ff6b35]" size={48} />
            <h1 className="mt-6 font-oswald uppercase text-3xl font-bold">Confirming payment…</h1>
            <p className="text-neutral-400 mt-2">Hang tight — this only takes a moment.</p>
          </>
        ) : state.paid ? (
          <>
            <CheckCircle2 className="mx-auto text-[#ff6b35]" size={56} />
            <h1 data-testid="checkout-success-heading" className="mt-6 font-oswald uppercase text-4xl font-bold">Order Confirmed</h1>
            <p className="text-neutral-300 mt-3">Total paid: <span className="text-[#ff6b35] font-bold">£{state.info?.amount_total?.toFixed(2)} {state.info?.currency?.toUpperCase()}</span></p>
            <p className="text-neutral-500 mt-2 text-sm">A receipt is on its way to your inbox.</p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/design" className="inline-flex items-center gap-2 border border-white hover:border-[#ff6b35] hover:text-[#ff6b35] font-oswald uppercase tracking-wider px-6 py-3 transition-colors">Design another</Link>
              <Link to="/" className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#e55a2b] text-white font-oswald uppercase tracking-wider px-6 py-3 transition-colors">Back to home <ArrowRight size={14} /></Link>
            </div>
          </>
        ) : state.expired ? (
          <>
            <XCircle className="mx-auto text-red-500" size={48} />
            <h1 className="mt-6 font-oswald uppercase text-3xl font-bold">Session Expired</h1>
            <p className="text-neutral-400 mt-2">Your checkout session expired. Please try again.</p>
            <Link to="/design" className="mt-6 inline-flex items-center gap-2 bg-[#ff6b35] text-white font-oswald uppercase tracking-wider px-6 py-3">Back to designer</Link>
          </>
        ) : (
          <>
            <XCircle className="mx-auto text-yellow-500" size={48} />
            <h1 className="mt-6 font-oswald uppercase text-3xl font-bold">Payment Pending</h1>
            <p className="text-neutral-400 mt-2">{state.error || "We couldn't confirm the payment yet."}</p>
            <Link to="/design" className="mt-6 inline-flex items-center gap-2 bg-[#ff6b35] text-white font-oswald uppercase tracking-wider px-6 py-3">Back to designer</Link>
          </>
        )}
      </div>
      <IndustrialFooter />
    </div>
  );
}
