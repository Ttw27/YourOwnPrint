import React, { useState } from "react";
import { X, Loader2, User, Mail, Lock, AlertCircle } from "lucide-react";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { customerForgotPassword } from "../lib/api";
import { toast } from "sonner";

/**
 * Slide-in login/register/forgot-password modal. Opens from the navbar
 * account icon. On success, closes itself + the calling code decides what
 * to do next (usually: refresh the page or navigate to /account).
 */
export default function AuthModal({ open, onClose, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);    // login | register | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { login, register } = useCustomerAuth();

  React.useEffect(() => { if (open) { setMode(initialMode); setErr(""); } }, [open, initialMode]);

  if (!open) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "login") {
        await login({ email: email.trim(), password });
        toast.success("Welcome back!");
        onClose();
      } else if (mode === "register") {
        await register({ email: email.trim(), password, name: name.trim() });
        toast.success(`Welcome, ${name.trim().split(" ")[0]}!`);
        onClose();
      } else if (mode === "forgot") {
        await customerForgotPassword(email.trim());
        toast.success("If that email exists, we've sent a reset link. Check your inbox.");
        setMode("login");
      }
    } catch (e2) {
      const msg = formatApiErr(e2?.response?.data?.detail) || e2?.message || "Something went wrong";
      setErr(msg);
    } finally { setBusy(false); }
  }

  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Create an account" : "Forgot password?";
  const cta   = mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link";

  return (
    <div className="fixed inset-0 z-[90] font-nunito" data-testid="auth-modal">
      <button aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 border-[#dcfce7] overflow-hidden animate-fade-in">
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7]" data-testid="auth-modal-close">
            <X size={16} />
          </button>
          <div className="p-6 sm:p-8">
            <h2 className="font-black text-2xl">{title}</h2>
            <p className="text-sm text-[#4b5563] mt-1">
              {mode === "login" && "Sign in for faster checkout, saved designs and order history."}
              {mode === "register" && "Save your cart, track orders and skip re-entering delivery details."}
              {mode === "forgot" && "Enter your email and we'll send a reset link (valid for 1 hour)."}
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              {mode === "register" && (
                <Field icon={User} label="Your name">
                  <input required autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} data-testid="auth-name" />
                </Field>
              )}
              <Field icon={Mail} label="Email">
                <input type="email" required autoFocus={mode !== "register"} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} data-testid="auth-email" />
              </Field>
              {mode !== "forgot" && (
                <Field icon={Lock} label="Password">
                  <input type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} data-testid="auth-password" />
                </Field>
              )}
              {mode === "register" && <p className="text-[11px] text-[#4b5563]">Password: min 8 chars, letters + numbers</p>}
              {err && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 inline-flex items-start gap-2" data-testid="auth-error">
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /><span>{err}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 text-[#1a1a1a] font-extrabold inline-flex items-center justify-center gap-2"
                data-testid="auth-submit"
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : null} {cta}
              </button>
            </form>

            <div className="mt-5 flex flex-col gap-1.5 text-xs text-[#4b5563] text-center">
              {mode === "login" && (
                <>
                  <button onClick={() => { setMode("register"); setErr(""); }} className="hover:text-[#7bc67e] font-extrabold" data-testid="auth-switch-register">
                    No account yet? Create one — takes 30 seconds
                  </button>
                  <button onClick={() => { setMode("forgot"); setErr(""); }} className="hover:text-[#7bc67e]" data-testid="auth-switch-forgot">
                    Forgot your password?
                  </button>
                </>
              )}
              {mode === "register" && (
                <button onClick={() => { setMode("login"); setErr(""); }} className="hover:text-[#7bc67e] font-extrabold" data-testid="auth-switch-login">
                  Already have an account? Sign in
                </button>
              )}
              {mode === "forgot" && (
                <button onClick={() => { setMode("login"); setErr(""); }} className="hover:text-[#7bc67e] font-extrabold" data-testid="auth-switch-back">
                  Back to sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 220ms ease-out; }`}</style>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border-2 border-[#dcfce7] focus:border-[#7bc67e] outline-none text-sm bg-white";

function Field({ icon: Icon, label, children }) {
  return (
    <label className="block">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#4b5563]">
        {Icon && <Icon size={11} />}
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function formatApiErr(detail) {
  if (detail == null) return null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).filter(Boolean).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}
