import React from "react";
import FacetBlock from "./FacetBlock";

/** Sidebar "Brand" filter (facets.brand from the server - brand groups, e.g. all Result lines = "Result"). */
export default function BrandFacet({ facets, checked, toggle }) {
  if (!facets?.brand || facets.brand.length < 2) return null;
  return (
    <FacetBlock title="Brand" testid="facet-brand" collapsibleThreshold={8} items={facets.brand}>
      {(shown) => shown.map((f) => (
        <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer" data-testid={`facet-brand-${f.value}`}>
          <input type="checkbox" checked={checked(f.value)} onChange={() => toggle(f.value)} className="accent-[#7bc67e]" />
          <span className="flex-1">{f.value}</span>
          <span className="text-[10px] text-[#4b5563]">{f.count}</span>
        </label>
      ))}
    </FacetBlock>
  );
}
