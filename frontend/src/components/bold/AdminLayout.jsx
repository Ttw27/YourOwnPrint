import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, MessageSquare, HelpCircle, Star,
  Package, Upload, Sparkles, ImageOff, Wand2, Tags, Layers,
  FileText, Menu as MenuIcon, Image, Shirt, GraduationCap,
  Plug, SlidersHorizontal, LogOut, X, Store,
} from "lucide-react";

/**
 * AdminLayout — a persistent Shopify-style sidebar wrapped around every admin
 * page. Previously the ~18 admin pages didn't link to each other at all; this
 * gives one consistent shell so you can always jump anywhere and always get
 * home. Existing pages render unchanged inside the main column.
 */
const GROUPS = [
  {
    heading: "Orders & customers",
    items: [
      { label: "Orders", to: "/admin/orders", icon: ShoppingBag },
      { label: "Enquiries", to: "/admin/enquiries", icon: MessageSquare },
      { label: "Questions (Q&A)", to: "/admin/qa", icon: HelpCircle },
      { label: "Reviews", to: "/admin/reviews", icon: Star },
    ],
  },
  {
    heading: "Products",
    items: [
      { label: "Product settings", to: "/admin/product-settings", icon: Package },
      { label: "Import products", to: "/admin/products-import", icon: Upload },
      { label: "Smart Re-classify", to: "/admin/reclassify", icon: Sparkles },
      { label: "Image Health", to: "/admin/image-health", icon: ImageOff },
      { label: "The Design Shop", to: "/admin/design-shop", icon: Sparkles },
      { label: "Ralawise Import", to: "/admin/ralawise", icon: Upload },
      { label: "Designer products", to: "/admin/designer-products", icon: Wand2 },
      { label: "Collections & SEO", to: "/admin/collection-seo", icon: Tags },
      { label: "Bundle variants", to: "/admin/bundle-variants", icon: Layers },
    ],
  },
  {
    heading: "Content",
    items: [
      { label: "Page copy", to: "/admin/page-copy", icon: FileText },
      { label: "Navigation menu", to: "/admin/navigation", icon: MenuIcon },
      { label: "Portfolio", to: "/admin/portfolio", icon: Image },
      { label: "Team kits", to: "/admin/team-kits", icon: Shirt },
      { label: "Leavers templates", to: "/admin/leavers-templates", icon: GraduationCap },
    ],
  },
  {
    heading: "Settings",
    items: [
      { label: "Integrations", to: "/admin/integrations", icon: Plug },
      { label: "Configurator settings", to: "/admin/configurator-settings", icon: SlidersHorizontal },
    ],
  },
];

function NavList({ pathname, onNavigate }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      <Link
        to="/admin"
        onClick={onNavigate}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-extrabold transition-colors ${
          pathname === "/admin" ? "bg-[#7bc67e] text-[#1a1a1a]" : "text-zinc-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <LayoutDashboard size={17} /> Dashboard
      </Link>

      {GROUPS.map((g) => (
        <div key={g.heading}>
          <div className="px-3 text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 mb-1.5">{g.heading}</div>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const active = pathname === it.to || pathname.startsWith(it.to + "/");
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                    active ? "bg-[#7bc67e] text-[#1a1a1a]" : "text-zinc-300 hover:bg-white/10 hover:text-white"
                  }`}
                  data-testid={`adminnav-${it.to.split("/").pop()}`}
                >
                  <Icon size={16} /> {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = () => {
    // Admin token is stored client-side; clear it and return to the login page.
    try {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("adminToken");
    } catch { /* ignore */ }
    navigate("/admin/login", { replace: true });
  };

  const SidebarInner = (
    <div className="flex flex-col h-full bg-zinc-900">
      <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
        <Store className="text-[#7bc67e]" size={20} />
        <span className="font-black text-white tracking-tight">YourOwnPrint</span>
        <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest ml-auto">Admin</span>
      </Link>
      <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      <div className="px-3 py-3 border-t border-white/10 space-y-1">
        <a href="/" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors">
          <Store size={16} /> View shop
        </a>
        <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors" data-testid="admin-logout">
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 bg-zinc-900 text-white px-4 py-3">
        <button onClick={() => setMobileOpen(true)} data-testid="admin-menu-open" aria-label="Open menu"><MenuIcon size={22} /></button>
        <Link to="/admin" className="font-black tracking-tight">YourOwnPrint <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Admin</span></Link>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[80%] h-full shadow-2xl relative">{SidebarInner}
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-zinc-400" aria-label="Close menu"><X size={20} /></button>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0 h-screen sticky top-0">{SidebarInner}</aside>
        {/* Main column — existing admin pages render here unchanged */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
