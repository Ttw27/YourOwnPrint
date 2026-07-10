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
    <div className="w-full bg-zinc-900 border-b border-zinc-800 text-zinc-100 px-4 py-2.5 flex items-center justify-between text-sm sticky top-0 z-50" data-testid="admin-topbar">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mr-1">YOP Admin</span>

        <a href="/admin/product-settings" className="hover:text-amber-300" data-testid="admin-nav-products">Products</a>
        <a href="/admin/portfolio" className="hover:text-amber-300" data-testid="admin-nav-portfolio">Portfolio</a>
        <a href="/admin/products-import" className="hover:text-amber-300" data-testid="admin-nav-products-import">Import</a>
        <a href="/admin/bundle-variants" className="hover:text-amber-300" data-testid="admin-nav-bundle-variants">Bundle variants</a>
        <a href="/admin/collection-seo" className="hover:text-amber-300" data-testid="admin-nav-collection-seo">SEO copy</a>

        <span className="w-px h-4 bg-zinc-700" />
        <a href="/admin/orders" className="hover:text-amber-300" data-testid="admin-nav-orders">Orders</a>
        <a href="/admin/enquiries" className="hover:text-amber-300" data-testid="admin-nav-enquiries">Enquiries</a>
        <a href="/admin/qa" className="hover:text-amber-300" data-testid="admin-nav-qa">Q&amp;A</a>

        <span className="w-px h-4 bg-zinc-700" />
        <a href="/admin/navigation" className="hover:text-amber-300" data-testid="admin-nav-navigation">Navigation</a>
        <a href="/admin/page-copy" className="hover:text-amber-300" data-testid="admin-nav-page-copy">Page copy</a>
        <a href="/admin/configurator-settings" className="hover:text-amber-300" data-testid="admin-nav-configurator-settings">Configurator £</a>

        <span className="w-px h-4 bg-zinc-700" />
        <a href="/admin/designer-products" className="hover:text-amber-300" data-testid="admin-nav-designer">Designer</a>
        <a href="/admin/team-kits" className="hover:text-amber-300" data-testid="admin-nav-team-kits">Team kits</a>
        <a href="/admin/leavers-templates" className="hover:text-amber-300" data-testid="admin-nav-leavers-templates">Leavers</a>
        <a href="/admin/import-reviews" className="hover:text-amber-300" data-testid="admin-nav-import">Reviews import</a>
        <a href="/admin/integrations" className="hover:text-amber-300" data-testid="admin-nav-integrations">Integrations</a>
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
