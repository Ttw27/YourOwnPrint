import { useEffect, useRef, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { fetchAdminMe, getAdminToken, adminLogout } from "../lib/api";
import { ChevronDown } from "lucide-react";

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

const ADMIN_NAV_GROUPS = [
  {
    label: "Catalog",
    links: [
      ["Products", "/admin/product-settings"],
      ["Portfolio", "/admin/portfolio"],
      ["Import", "/admin/products-import"],
      ["Bundle variants", "/admin/bundle-variants"],
      ["SEO copy", "/admin/collection-seo"],
    ],
  },
  {
    label: "Orders",
    links: [
      ["Orders", "/admin/orders"],
      ["Enquiries", "/admin/enquiries"],
      ["Q&A", "/admin/qa"],
    ],
  },
  {
    label: "Content",
    links: [
      ["Navigation menu", "/admin/navigation"],
      ["Pages — text, images & video", "/admin/page-copy"],
      ["Configurator £", "/admin/configurator-settings"],
    ],
  },
  {
    label: "Setup",
    links: [
      ["Designer", "/admin/designer-products"],
      ["Team kits", "/admin/team-kits"],
      ["Leavers", "/admin/leavers-templates"],
      ["Reviews import", "/admin/import-reviews"],
      ["Integrations", "/admin/integrations"],
    ],
  },
];

function AdminTopBar({ email }) {
  const [openKey, setOpenKey] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpenKey(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onLogout = async () => {
    await adminLogout();
    window.location.href = "/admin/login";
  };

  return (
    <div ref={rootRef} className="w-full bg-zinc-900 border-b border-zinc-800 text-zinc-100 px-4 py-2.5 flex items-center justify-between text-sm sticky top-0 z-50" data-testid="admin-topbar">
      <div className="flex items-center gap-1">
        <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mr-3">YOP Admin</span>
        {ADMIN_NAV_GROUPS.map((group) => {
          const isOpen = openKey === group.label;
          return (
            <div key={group.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : group.label)}
                className={`px-3 py-1.5 rounded-full inline-flex items-center gap-1 transition-colors ${isOpen ? "bg-zinc-800 text-amber-300" : "hover:text-amber-300"}`}
                data-testid={`admin-nav-group-${group.label.toLowerCase()}`}
              >
                {group.label} <ChevronDown size={13} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="absolute left-0 top-full mt-2 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl py-2 min-w-[180px] z-50">
                  {group.links.map(([label, href]) => (
                    <a key={href} href={href} onClick={() => setOpenKey(null)} className="block px-4 py-2 text-sm hover:bg-zinc-800 hover:text-amber-300" data-testid={`admin-nav-link-${href.replace(/\W+/g, "-")}`}>
                      {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
