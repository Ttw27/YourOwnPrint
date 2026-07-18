import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * FontPicker — a dropdown where every option is rendered IN its own font,
 * so you can see what each one actually looks like before picking it.
 *
 * A plain <select> can't do this reliably (browsers largely ignore
 * font-family on <option>), which meant the only way to preview a font was
 * to pick it, type something, look, delete, and try the next one.
 *
 * Props: value, onChange(value), fonts [{label, value}], className
 */
export default function FontPicker({ value, onChange, fonts, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = fonts.find(f => f.value === value) || fonts[0];

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`} data-testid="font-picker">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm hover:border-[#7bc67e] transition-colors"
        data-testid="font-picker-trigger"
      >
        {/* The trigger itself previews the current font too */}
        <span className="truncate" style={{ fontFamily: selected?.value }}>{selected?.label}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-[#e5e7eb] rounded-xl shadow-lg py-1"
          data-testid="font-picker-menu"
        >
          {fonts.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => { onChange(f.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#f0fdf4] transition-colors ${f.value === value ? "bg-[#f0fdf4]" : ""}`}
              data-testid={`font-picker-option-${f.label}`}
            >
              {/* Each option rendered in its own font — the whole point */}
              <span className="text-base truncate" style={{ fontFamily: f.value }}>{f.label}</span>
              {f.value === value && <Check size={13} className="text-[#7bc67e] flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
