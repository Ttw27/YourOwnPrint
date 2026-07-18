import { useEffect } from "react";

const SUFFIX = "Your Own Print";

/**
 * Sets the browser/tab title for a page, restoring the previous one on unmount.
 *
 * Every route previously shared the single <title> baked into index.html, so
 * every tab, bookmark and search result looked identical. Pass a title and it
 * becomes "<title> | Your Own Print"; pass nothing (e.g. while data is still
 * loading) and the title is left alone rather than flashing a wrong one.
 *
 *   usePageTitle(product?.name);
 *   usePageTitle("Workwear");
 */
export default function usePageTitle(title, { description } = {}) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} | ${SUFFIX}`;

    let metaEl = null;
    let previousDescription = null;
    if (description) {
      metaEl = document.querySelector('meta[name="description"]');
      if (metaEl) {
        previousDescription = metaEl.getAttribute("content");
        metaEl.setAttribute("content", description);
      }
    }

    return () => {
      document.title = previous;
      if (metaEl && previousDescription !== null) {
        metaEl.setAttribute("content", previousDescription);
      }
    };
  }, [title, description]);
}
