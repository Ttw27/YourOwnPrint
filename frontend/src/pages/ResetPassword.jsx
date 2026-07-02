import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Loader2, Lock, Check } from "lucide-react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { customerResetPassword } from "../lib/api";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await customerResetPassword({ token, new_password: password });
      if (res?.token) localStorage.setItem("yop_customer_token", res.token);
      setDone(true);
      toast.success("Password updated! You're signed in.");
      setTimeout(() => navigate("/account"), 1500);
    } catch (e2) {
      setErr(formatErr(e2?.response?.data?.detail) || e2?.message || "Reset failed");
    } finally { setBusy(false); }
  }

  function formatErr(detail) {
    if (detail == null) return "";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
    if (detail?.msg) return detail.msg;
    return String(detail);
  }

  return (
    <div className="min-h-screen bg-white font-nunito">
      <BoldNavbar />
      <main className="max-w-md mx-auto px-4 py-16">
        {!token ? (
          <div className="border-2 border-rose-200 bg-rose-50 rounded-2xl p-6 text-center">
            <p className="font-black text-rose-700">This link is missing a reset token.</p>
            <p className="text-sm text-rose-600 mt-1">Please use the exact link from the email we sent you.</p>
          </div>
        ) : done ? (
          <div className="border-2 border-[#dcfce7] bg-[#f0fdf4] rounded-2xl p-6 text-center" data-testid="reset-done">
            <Check className="mx-auto text-[#7bc67e]" size={40} />
            <p className="font-black text-lg mt-3">Password updated ✓</p>
            <p className="text-sm text-[#4b5563] mt-1">Taking you to your account…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="border-2 border-[#dcfce7] rounded-3xl p-6 space-y-3" data-testid="reset-form">
            <h1 className="font-black text-2xl">Set a new password</h1>
            <p className="text-sm text-[#4b5563]">Choose a password with at least 8 characters, containing letters and numbers.</p>
            <label className="block">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#4b5563]">
                <Lock size={11} /> New password
              </span>
              <input type="password" required autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-xl border-2 border-[#dcfce7] focus:border-[#7bc67e] outline-none text-sm bg-white" data-testid="reset-password" />
            </label>
            {err && <p className="text-xs text-rose-600" data-testid="reset-error">{err}</p>}
            <button type="submit" disabled={busy} className="w-full py-3 rounded-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 text-[#1a1a1a] font-extrabold inline-flex items-center justify-center gap-2" data-testid="reset-submit">
              {busy ? <Loader2 className="animate-spin" size={16} /> : null} Update password
            </button>
            <Link to="/" className="text-xs text-[#4b5563] hover:text-[#7bc67e] block text-center">Back to home</Link>
          </form>
        )}
      </main>
      <BoldFooter />
    </div>
  );
}
