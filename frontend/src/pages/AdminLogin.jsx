import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { adminLogin, fetchAdminMe } from "../lib/api";
import { toast } from "sonner";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const redirectTo = state?.from || "/admin/product-settings";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await fetchAdminMe();
        if (alive) navigate(redirectTo, { replace: true });
      } catch {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [navigate, redirectTo]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminLogin(email.trim().toLowerCase(), password);
      toast.success("Signed in");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Sign-in failed. Check your email & password.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100" data-testid="admin-login-checking">
        Checking session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4" data-testid="admin-login-page">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl"
        data-testid="admin-login-form"
      >
        <div className="text-xs uppercase tracking-[0.3em] text-amber-400 mb-2">Your Own Print</div>
        <h1 className="text-2xl font-extrabold mb-1">Admin sign-in</h1>
        <p className="text-sm text-zinc-400 mb-6">Restricted access. Authorised staff only.</p>

        <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Email</label>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-400 mb-4"
          data-testid="admin-login-email"
        />

        <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-400 mb-6"
          data-testid="admin-login-password"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-zinc-950 font-bold py-2.5 rounded-lg transition"
          data-testid="admin-login-submit"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <a
          href="/"
          className="block text-center text-xs text-zinc-500 hover:text-zinc-300 mt-6"
          data-testid="admin-login-back-home"
        >
          ← Back to site
        </a>
      </form>
    </div>
  );
}
