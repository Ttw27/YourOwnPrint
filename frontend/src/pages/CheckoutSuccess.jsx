import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchCheckoutStatus } from "../lib/api";
import { CheckCircle2, Loader2, XCircle, ArrowRight, PartyPopper } from "lucide-react";

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
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        {state.loading ? (
          <>
            <Loader2 className="mx-auto animate-spin text-[#7bc67e]" size={48} />
            <h1 className="mt-6 font-nunito font-black text-3xl">Confirming payment…</h1>
            <p className="text-[#4b5563] mt-2">Hang tight — this only takes a moment.</p>
          </>
        ) : state.paid ? (
          <>
            <div className="mx-auto w-20 h-20 bg-[#7bc67e] rounded-full grid place-items-center">
              <PartyPopper className="text-[#1a1a1a]" size={36} />
            </div>
            <h1 data-testid="checkout-success-heading" className="mt-6 font-nunito font-black text-4xl">Order Confirmed! 🎉</h1>
            <p className="text-[#4b5563] mt-3">Total paid: <span className="text-[#7bc67e] font-extrabold">£{state.info?.amount_total?.toFixed(2)} {state.info?.currency?.toUpperCase()}</span></p>
            <p className="text-[#4b5563] mt-2 text-sm">A receipt is on its way to your inbox.</p>
            <div className="mt-8 flex justify-center gap-3 flex-wrap">
              <Link to="/design" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white font-nunito font-extrabold px-6 py-3 rounded-full transition-colors">Design another</Link>
              <Link to="/" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-6 py-3 rounded-full transition-colors">Back to home <ArrowRight size={14} /></Link>
            </div>
            <div className="mt-10 bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-5">
              <div className="font-nunito font-extrabold">Loved it? Leave a review!</div>
              <p className="text-sm text-[#4b5563] mt-1">Once your order arrives, share your photos & rating to help others.</p>
              <Link to="/reviews" className="mt-3 inline-flex text-sm text-[#7bc67e] font-nunito font-extrabold hover:underline">Go to reviews →</Link>
            </div>
          </>
        ) : state.expired ? (
          <>
            <XCircle className="mx-auto text-rose-500" size={48} />
            <h1 className="mt-6 font-nunito font-black text-3xl">Session Expired</h1>
            <p className="text-[#4b5563] mt-2">Your checkout session expired. Please try again.</p>
            <Link to="/design" className="mt-6 inline-flex items-center gap-2 bg-[#7bc67e] text-[#1a1a1a] font-nunito font-extrabold px-6 py-3 rounded-full">Back to designer</Link>
          </>
        ) : (
          <>
            <XCircle className="mx-auto text-amber-500" size={48} />
            <h1 className="mt-6 font-nunito font-black text-3xl">Payment Pending</h1>
            <p className="text-[#4b5563] mt-2">{state.error || "We couldn't confirm the payment yet."}</p>
            <Link to="/design" className="mt-6 inline-flex items-center gap-2 bg-[#7bc67e] text-[#1a1a1a] font-nunito font-extrabold px-6 py-3 rounded-full">Back to designer</Link>
          </>
        )}
      </div>
      <BoldFooter />
    </div>
  );
}
