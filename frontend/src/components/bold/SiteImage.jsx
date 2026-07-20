import React, { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

/**
 * SiteImage — a plain <img> that fails quietly.
 *
 * Every marketing photo on the site has a code default behind it, and those
 * defaults point at third-party stock URLs. When one of those links dies, a
 * normal <img> renders the browser's broken-image icon plus the alt text as
 * literal words on the page — which on the dark Price Promise band read as
 * body copy rather than a missing picture.
 *
 * So: on a load error this swaps to a muted placeholder in the same box. The
 * layout holds its shape, nothing ugly renders, and it's obvious at a glance
 * that a picture needs setting in the admin.
 *
 * `className` is applied either way, so callers can keep passing the same
 * "w-full h-full object-cover" they used on the <img>.
 */
export default function SiteImage({
  src,
  alt = "",
  className = "",
  placeholderClassName = "bg-[#f0fdf4]",
  testid = "site-image",
  ...rest
}) {
  const [failed, setFailed] = useState(false);

  // A changed src deserves a fresh attempt — otherwise setting a working photo
  // in the admin would keep showing the placeholder from the previous dead one.
  useEffect(() => { setFailed(false); }, [src]);

  const missing = !src || !String(src).trim() || failed;

  if (missing) {
    return (
      <div
        className={`${className} ${placeholderClassName} grid place-items-center`}
        data-testid={`${testid}-placeholder`}
        aria-hidden="true"
      >
        <ImageIcon size={22} className="text-[#7bc67e] opacity-40" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      data-testid={testid}
      {...rest}
    />
  );
}
