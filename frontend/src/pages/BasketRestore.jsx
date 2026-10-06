import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";
import { Loader2 } from "lucide-react";

/** /basket/restore/:token - from the "you left something in your basket" email:
 *  puts the saved lines back in the basket and opens it. */
export default function BasketRestore() {
  const { token } = useParams();
  const { items, addLine, openDrawer } = useCart();
  const navigate = useNavigate();
  const [err, setErr] = useState("");
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    api.get(`/basket/restore/${token}`).then(({ data }) => {
      const have = new Set(items.map((l) => `${l.product_id}|${l.color}|${JSON.stringify(l.size_qtys)}`));
      (data.items || []).forEach((l) => { if (!have.has(`${l.product_id}|${l.color}|${JSON.stringify(l.size_qtys)}`)) addLine(l); });
      navigate("/", { replace: true });
      setTimeout(openDrawer, 300);
    }).catch(() => setErr("Sorry - that basket link has expired."));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="min-h-screen grid place-items-center bg-white font-nunito text-[#1a1a1a]">
      {err ? <div className="text-center"><p className="font-extrabold">{err}</p><a href="/" className="text-[#7bc67e] underline text-sm">Go to the shop</a></div>
        : <div className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin text-[#7bc67e]" /> Restoring your basket…</div>}
    </div>
  );
}
