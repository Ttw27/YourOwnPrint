import { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { fetchAdminMe, getAdminToken, adminLogout } from "../lib/api";

export default function RequireAdmin({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(getAdminToken() ? "checking" : "unauth");
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    let alive = true;
    if (status !== "checking") return;
    (async () => {
      try {
        const me = await fetchAdminMe();
        if (alive) { setAdmin(me); setStatus("ok"); }
      } catch {
        if (alive) setStatus("unauth");
      }
    })();
    return () => { alive = false; };
  }, [status]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100" data-testid="require-admin-checking">
        Verifying access…
      </div>
    );
  }
  if (status === "unauth") {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return (
    <div data-testid="admin-shell">
      <AdminTopBar email={admin?.email} />
      {children}
    </div>
  );
}

function AdminTopBar({ email }) {
  const onLogout = async () => {
    await adminLogout();
    window.location.href = "/admin/login";
  };
  return (
    <div className="w-full bg-zinc-900 border-b border-zinc-800 text-zinc-100 px-4 py-2 flex items-center justify-between text-sm" data-testid="admin-topbar">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-amber-400 font-bold tracking-wider text-xs uppercase">YOP Admin</span>
        <a href="/admin/product-settings" className="hover:text-amber-300" data-testid="admin-nav-products">Products</a>
        <a href="/admin/portfolio" className="hover:text-amber-300" data-testid="admin-nav-portfolio">Portfolio</a>
        <a href="/admin/navigation" className="hover:text-amber-300" data-testid="admin-nav-navigation">Navigation</a>
        <a href="/admin/integrations" className="hover:text-amber-300" data-testid="admin-nav-integrations">Integrations</a>
        <a href="/admin/designer-products" className="hover:text-amber-300" data-testid="admin-nav-designer">Designer</a>
        <a href="/admin/team-kits" className="hover:text-amber-300" data-testid="admin-nav-team-kits">Team kits</a>
        <a href="/admin/qa" className="hover:text-amber-300" data-testid="admin-nav-qa">Q&amp;A</a>
        <a href="/admin/leavers-templates" className="hover:text-amber-300" data-testid="admin-nav-leavers-templates">Leavers</a>
        <a href="/admin/import-reviews" className="hover:text-amber-300" data-testid="admin-nav-import">Reviews import</a>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-zinc-500 hidden sm:inline" data-testid="admin-current-email">{email}</span>
        <button onClick={onLogout} className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs" data-testid="admin-logout">
          Sign out
        </button>
      </div>
    </div>
  );
}
