// Vercel serverless function — NOTE: this "api" folder is Vercel's own
// convention for serverless functions, unrelated to the backend's /api/
// REST routes on Railway. This function only ever runs for known social
// media crawlers (Facebook, Twitter, WhatsApp, etc.) — see the `has`
// condition in vercel.json that routes only those requests here. Real
// visitors never touch this file; they go straight to the normal SPA.

const BACKEND_URL = "https://yourownprint-production.up.railway.app";
const SITE_URL = "https://your-own-print.vercel.app";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  const productId = req.query.id;
  const fallback = () => {
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(
      `<!DOCTYPE html><html><head><meta charset="utf-8" />` +
      `<title>Your Own Print — UK Custom Print &amp; Workwear</title>` +
      `<meta property="og:title" content="Your Own Print" />` +
      `<meta property="og:image" content="${SITE_URL}/logo.png" /></head><body></body></html>`
    );
  };

  if (!productId) return fallback();

  try {
    const r = await fetch(`${BACKEND_URL}/api/products/${encodeURIComponent(productId)}`);
    if (!r.ok) return fallback();
    const product = await r.json();

    const title = `${product.name} | Your Own Print`;
    const description = (product.description || "").slice(0, 200) ||
      "UK custom print, workwear & branded apparel — no minimums, fast UK dispatch.";
    const image = product.image || `${SITE_URL}/logo.png`;
    const url = `${SITE_URL}/product/${productId}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="Your Own Print" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body></body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(html);
  } catch (e) {
    fallback();
  }
}
