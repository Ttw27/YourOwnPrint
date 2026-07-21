import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * One block in a filter sidebar — a heading, its options, and a "Show all"
 * toggle once the list gets long.
 *
 * Extracted because an identical copy of this had been pasted into
 * IndustryDetail, ShopByType and Workwear, and the sports landing pages
 * needed a fourth. Four copies of the same component is four places to fix
 * anything that turns out to be wrong with it.
 *
 * `children` may be a render function receiving the visible slice, which is
 * how callers avoid rendering options that are collapsed out of view.
 */
export default function FacetBlock({ title, testid, children, collapsibleThreshold, items }) {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = collapsibleThreshold && items && items.length > collapsibleThreshold;
  const shown = canCollapse && !expanded ? items.slice(0, collapsibleThreshold) : (items || null);
  return (
    <div className="bg-white border-2 border-[#dcfce7] rounded-2xl p-3" data-testid={testid}>
      <div className="text-xs font-extrabold mb-2">{title}</div>
      <div className="space-y-1.5">
        {typeof children === "function" ? children(shown) : children}
      </div>
      {canCollapse && (
        <button type="button" onClick={() => setExpanded((x) => !x)} className="mt-2 text-[11px] font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1" data-testid={`${testid}-toggle`}>
          {expanded ? "Show less" : `Show all ${items.length}`} <ChevronDown size={11} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
