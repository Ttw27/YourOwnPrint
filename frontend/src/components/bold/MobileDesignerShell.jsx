import React, { useEffect } from "react";

/**
 * Mobile designer shell — a canvas that stays put while the tools live in a
 * bottom bar and slide up over it in a sheet when tapped.
 *
 * The old mobile layout stacked every panel in a column, so adding text meant
 * scrolling down to the text panel, then back up to see the garment. Here the
 * garment never moves: you tap a tab, a sheet rises over the lower part of the
 * screen with that tool, you make your change, you close it. Same interaction
 * the customer already knows from every other app on their phone.
 *
 * Desktop is untouched — these render nothing above the `lg` breakpoint, where
 * the existing three-column layout is already good.
 */

// A single tab in the bottom bar.
function Tab({ icon: Icon, label, active, badge, onClick, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={`relative flex-1 flex flex-col items-center gap-1 py-2 ${active ? "text-[#166534]" : "text-[#4b5563]"}`}
    >
      <span className={`grid place-items-center w-9 h-9 rounded-full ${active ? "bg-[#dcfce7]" : ""}`}>
        <Icon size={18} />
        {badge > 0 && (
          <span className="absolute top-1 right-[22%] min-w-[16px] h-4 px-1 bg-[#7bc67e] text-[#1a1a1a] text-[10px] font-black rounded-full grid place-items-center">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-nunito font-bold leading-none">{label}</span>
    </button>
  );
}

/**
 * MobileToolBar — the fixed bar of tabs at the bottom of the screen.
 * `tabs` is an array of { key, label, icon, badge }.
 */
export function MobileToolBar({ tabs, activeKey, onSelect, testid = "designer-toolbar" }) {
  // Tell the rest of the page a designer bar owns the bottom of the screen, so
  // the WhatsApp / Help FABs can hide rather than stack on top of it. Cleared
  // on unmount and only ever set on mobile (this whole component is lg:hidden).
  useEffect(() => {
    document.body.classList.add("designer-bar-open");
    return () => document.body.classList.remove("designer-bar-open");
  }, []);

  return (
    <div
      className="lg:hidden fixed bottom-0 inset-x-0 z-[60] bg-white border-t border-[#e5e7eb] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex items-stretch pb-[env(safe-area-inset-bottom)]"
      data-testid={testid}
    >
      {tabs.map((t) => (
        <Tab
          key={t.key}
          icon={t.icon}
          label={t.label}
          badge={t.badge}
          active={activeKey === t.key}
          onClick={() => onSelect(activeKey === t.key ? null : t.key)}
          testid={`${testid}-tab-${t.key}`}
        />
      ))}
    </div>
  );
}

/**
 * MobileSheet — the panel that slides up over the canvas when a tab is active.
 * Capped at 62vh so the garment above stays visible; the point of the whole
 * exercise is that you can see what you're editing while you edit it.
 */
export function MobileSheet({ open, title, onClose, children, testid = "designer-sheet" }) {
  // Close on Escape, and lock body scroll so the page behind doesn't move while
  // a sheet is open — otherwise a drag inside the sheet can scroll the canvas away.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div className="lg:hidden" data-testid={testid}>
      {/* Backdrop only over the area the sheet doesn't cover, so a tap above the
          sheet (on the canvas) dismisses it. */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[65] bg-black/25 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        data-testid={`${testid}-backdrop`}
      />
      <div
        className={`fixed inset-x-0 z-[70] bg-white rounded-t-3xl shadow-2xl border-t border-[#e5e7eb] transition-transform duration-200 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}
        // Sits just above the tab bar; height capped so the canvas stays in view.
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))", maxHeight: "60vh" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0fdf4]">
          <div className="font-nunito font-extrabold text-sm">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-[#f0fdf4] text-[#4b5563]"
            aria-label="Close"
            data-testid={`${testid}-close`}
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4" style={{ maxHeight: "calc(60vh - 52px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * useIsMobile — true below Tailwind's lg breakpoint (1024px).
 *
 * Drives which layout renders. Kept as a hook rather than pure CSS because the
 * two layouts differ structurally (a sheet vs a column), not just in styling,
 * so the components themselves need to know which they're in.
 */
export function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}
