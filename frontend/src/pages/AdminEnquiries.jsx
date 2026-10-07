import { useEffect, useState } from "react";
import { adminListEnquiries, mediaUrl } from "../lib/api";
import { toast } from "sonner";

export default function AdminEnquiries() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminListEnquiries();
      setItems(data.enquiries || []);
    } catch {
      toast.error("Failed to load enquiries");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" data-testid="admin-enquiries-page">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-2">Enquiries</h1>
        <p className="text-zinc-400 mb-8">Every contact form submission and quote request from across the site - newest first.</p>

        {loading && <div className="text-zinc-500">Loading…</div>}
        {!loading && items.length === 0 && <div className="text-zinc-500">No enquiries yet.</div>}

        <div className="space-y-4">
          {items.map((it) => (
            <div key={`${it.source}-${it.id}`} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" data-testid={`admin-enquiry-${it.id}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-amber-900 text-amber-300">
                      {it.source === "quote" ? (it.kind || "quote") : "contact form"}
                    </span>
                    <span className="font-bold text-sm">{it.name}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {it.email} {it.phone ? `· ${it.phone}` : ""} {it.company ? `· ${it.company}` : ""}
                  </div>
                  <p className="text-sm text-zinc-300 mt-2 whitespace-pre-wrap">{it.message}</p>
                  {it.quantity ? <div className="text-xs text-zinc-500 mt-1">Qty: {it.quantity}</div> : null}
                  {/* the customer's files (logos, artwork) - old requests kept them inline */}
                  {(() => {
                    const files = [
                      ...(it.artwork || []).map((u, i) => ({ url: u, label: `File ${i + 1}` })),
                      ...(it.attachments || []).filter((a) => a && a.url).map((a) => ({ url: a.url, label: a.filename || a.purpose || "file" })),
                    ];
                    return files.length ? (
                      <div className="flex flex-wrap gap-2 mt-3" data-testid="enquiry-files">
                        {files.map((f, i) => {
                          const href = f.url.startsWith("data:") ? f.url : mediaUrl(f.url);
                          const isImg = f.url.startsWith("data:image") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(f.url);
                          return (
                            <a key={i} href={href} target="_blank" rel="noreferrer" className="block text-center" title="Open the customer's file">
                              {isImg ? <img src={href} alt="" className="w-16 h-16 object-contain bg-white rounded-lg border border-zinc-700" />
                                : <span className="w-16 h-16 grid place-items-center bg-zinc-800 rounded-lg text-[10px] text-zinc-300">FILE</span>}
                              <span className="block text-[10px] text-zinc-400 mt-0.5 max-w-[64px] truncate">{f.label}</span>
                            </a>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}
                  {(it.roster || []).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs font-bold text-emerald-400 cursor-pointer">Roster ({it.roster.length})</summary>
                      <table className="text-xs text-zinc-300 mt-1">
                        <tbody>{it.roster.map((r, i) => (
                          <tr key={i}><td className="pr-3">{r.name}</td><td className="pr-3">{r.number}</td><td className="pr-3">{r.size}</td><td>{r.tracksuit}</td></tr>
                        ))}</tbody>
                      </table>
                    </details>
                  )}
                </div>
                <div className="text-xs text-zinc-500 whitespace-nowrap">
                  {it.created_at ? new Date(it.created_at).toLocaleString("en-GB") : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
