import React, { useState } from "react";
import { Link } from "react-router-dom";
import { User, LogOut, Package, MapPin, Bookmark } from "lucide-react";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import AuthModal from "./AuthModal";

/**
 * Navbar avatar button — opens AuthModal when logged out, opens a small
 * dropdown when logged in. Persists login across page reloads via
 * CustomerAuthContext (localStorage-backed).
 */
export default function AccountButton({ className = "" }) {
  const { isAuthenticated, customer, logout, loading } = useCustomerAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => {
            if (isAuthenticated) setShowMenu((v) => !v);
            else { setAuthMode("login"); setShowAuth(true); }
          }}
          className="relative w-10 h-10 rounded-full bg-white hover:bg-[#f0fdf4] border-2 border-[#dcfce7] grid place-items-center transition-colors"
          aria-label={isAuthenticated ? "Account menu" : "Sign in"}
          data-testid="account-button"
        >
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 border-[#7bc67e] border-t-transparent animate-spin" />
          ) : isAuthenticated ? (
            <span className="w-6 h-6 rounded-full bg-[#7bc67e] text-[#1a1a1a] grid place-items-center text-[10px] font-black" data-testid="account-avatar">
              {(customer?.name || customer?.email || "?").slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <User size={16} className="text-[#1a1a1a]" />
          )}
        </button>

        {isAuthenticated && showMenu && (
          <>
            <button aria-label="Close" className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-12 z-50 w-56 bg-white rounded-2xl border-2 border-[#dcfce7] shadow-2xl overflow-hidden animate-fade-in-menu" data-testid="account-menu">
              <div className="p-3 border-b-2 border-[#dcfce7] bg-[#f0fdf4]">
                <p className="font-black text-sm truncate">{customer?.name}</p>
                <p className="text-[11px] text-[#4b5563] truncate">{customer?.email}</p>
              </div>
              <MenuLink to="/account" icon={Package} onClick={() => setShowMenu(false)} testid="account-menu-orders">Orders</MenuLink>
              <MenuLink to="/account/addresses" icon={MapPin} onClick={() => setShowMenu(false)} testid="account-menu-addresses">Addresses</MenuLink>
              <MenuLink to="/account/designs" icon={Bookmark} onClick={() => setShowMenu(false)} testid="account-menu-designs">Saved designs</MenuLink>
              <button
                onClick={async () => { setShowMenu(false); await logout(); }}
                className="w-full text-left inline-flex items-center gap-2 px-4 py-3 hover:bg-rose-50 text-rose-600 text-sm font-extrabold border-t-2 border-[#dcfce7]"
                data-testid="account-menu-logout"
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
            <style>{`@keyframes fade-in-menu { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-menu { animation: fade-in-menu 160ms ease-out; }`}</style>
          </>
        )}
      </div>

      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} initialMode={authMode} />
    </>
  );
}

function MenuLink({ to, icon: Icon, children, onClick, testid }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="w-full inline-flex items-center gap-2 px-4 py-3 hover:bg-[#f0fdf4] text-sm font-extrabold"
      data-testid={testid}
    >
      <Icon size={13} className="text-[#7bc67e]" />
      {children}
    </Link>
  );
}
