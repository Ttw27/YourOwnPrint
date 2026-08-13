import React, { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";

/**
 * SiteImage — a plain <img> that fails quietly and fades in.
 *
 * Pages paint a code default immediately, then swap to the admin image once it's
 * fetched from the database a moment later. A hard swap makes that visible as a
 * "flash" of the old picture. So each image starts transparent and fades to full
 * opacity once the browser has actually loaded it — the swap becomes a gentle
 * cross-fade instead of a pop. On a load error we show a muted placeholder in
 * the same box so the layout holds and nothing ugly renders.
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
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    // Cached images may be complete before onLoad attaches — show straightaway.
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

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
      ref={imgRef}
      src={src}
      alt={alt}
      className={`${className} transition-opacity duration-500 ease-out ${loaded ? "opacity-100" : "opacity-0"}`}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      data-testid={testid}
      {...rest}
    />
  );
}
