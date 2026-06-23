import React, { useEffect, useState, useRef } from "react";
import { StarRating } from "./BoldLayout";
import { fetchProductReviews, submitReview } from "../../lib/api";
import { toast } from "sonner";
import { Star, Camera, Loader2, ShieldCheck, X } from "lucide-react";

const MAX_PHOTOS = 4;

export default function ProductReviews({ productId, productName }) {
  const [data, setData] = useState({ average: 0, count: 0, reviews: [] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const reload = async () => {
    setLoading(true);
    try { setData(await fetchProductReviews(productId)); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [productId]);

  const distribution = computeDistribution(data.reviews);

  return (
    <div className="bg-white rounded-3xl border-2 border-[#dcfce7] p-6 lg:p-8" data-testid="product-reviews-block">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="font-nunito font-extrabold text-4xl text-[#1a1a1a]" data-testid="reviews-average">{data.average.toFixed(1)}</div>
          <StarRating value={data.average} size={18} />
          <div className="text-sm text-[#4b5563] mt-1">from <span data-testid="reviews-count">{data.count}</span> {data.count === 1 ? "review" : "reviews"}</div>
          <div className="mt-4 space-y-1">
            {[5, 4, 3, 2, 1].map((r) => {
              const total = Math.max(data.count, 1);
              const pct = Math.round((distribution[r] / total) * 100);
              return (
                <div key={r} className="flex items-center gap-2 text-xs">
                  <span className="w-6 font-nunito font-bold text-[#1a1a1a]">{r}★</span>
                  <div className="flex-1 h-2 bg-[#f0fdf4] rounded-full overflow-hidden">
                    <div className="h-full bg-[#7bc67e]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-[#4b5563]">{distribution[r]}</span>
                </div>
              );
            })}
          </div>
          <button data-testid="leave-review-btn" onClick={() => setShowForm(s => !s)} className="mt-6 w-full bg-[#1a1a1a] hover:bg-[#333] text-white font-nunito font-extrabold rounded-full py-3 transition-colors">
            {showForm ? "Cancel" : "Leave a Review"}
          </button>
        </div>

        <div className="lg:col-span-2">
          {showForm && (
            <ReviewForm productId={productId} productName={productName} onDone={() => { setShowForm(false); reload(); }} />
          )}

          {loading ? (
            <div className="text-[#4b5563] py-12 text-center">Loading reviews…</div>
          ) : data.reviews.length === 0 ? (
            <div className="text-[#4b5563] py-12 text-center bg-[#f0fdf4] rounded-2xl border border-[#dcfce7]">
              <Star className="mx-auto mb-2 text-[#7bc67e]" size={24} />
              No reviews yet — be the first!
            </div>
          ) : (
            <ul className="space-y-4" data-testid="reviews-list">
              {data.reviews.map((r) => <ReviewCard key={r.id} r={r} />)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ r }) {
  return (
    <li className="bg-[#f0fdf4] rounded-2xl p-5 border border-[#dcfce7]" data-testid={`review-card-${r.id}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <StarRating value={r.rating} />
          {r.verified && <span className="inline-flex items-center gap-1 text-[10px] font-nunito font-bold uppercase tracking-wider bg-[#7bc67e] text-[#1a1a1a] px-2 py-0.5 rounded-full"><ShieldCheck size={10} /> Verified</span>}
          {r.source === "judgeme" && <span className="text-[10px] font-nunito font-bold uppercase tracking-wider text-neutral-500">Imported</span>}
        </div>
        <span className="text-xs text-[#4b5563]">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
      <h4 className="font-nunito font-extrabold text-lg text-[#1a1a1a] mt-2">{r.title}</h4>
      <p className="text-[#4b5563] mt-1 text-sm leading-relaxed">{r.body}</p>
      {r.photos && r.photos.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {r.photos.map((src, i) => (
            <img key={i} src={src} alt="review" className="w-20 h-20 object-cover rounded-xl border border-[#dcfce7]" />
          ))}
        </div>
      )}
      <div className="mt-3 text-xs font-nunito font-bold text-[#1a1a1a]">— {r.reviewer_name}</div>
    </li>
  );
}

function ReviewForm({ productId, productName, onDone }) {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const onFile = (e) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, MAX_PHOTOS - photos.length).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Downscale to ~1000px on long side to keep <500KB-ish
        const img = new Image();
        img.onload = () => {
          const max = 1000;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          setPhotos((p) => [...p, dataUrl]);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removePhoto = (idx) => setPhotos((p) => p.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!name.trim() || !title.trim() || !body.trim()) {
      toast.error("Name, title and review body are required.");
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({
        product_id: productId,
        reviewer_name: name.trim(),
        reviewer_email: email.trim() || null,
        rating,
        title: title.trim(),
        body: body.trim(),
        photos,
      });
      toast.success("Thanks for your review! ⭐");
      onDone?.();
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message;
      toast.error(`Could not submit: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border-2 border-[#7bc67e] mb-5" data-testid="review-form">
      <div className="font-nunito font-extrabold text-lg text-[#1a1a1a]">Review {productName}</div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm font-nunito font-bold text-[#4b5563]">Your rating:</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} data-testid={`review-rating-${n}`} onClick={() => setRating(n)} type="button">
            <Star size={22} className={n <= rating ? "text-amber-500 fill-amber-500" : "text-neutral-300"} />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <input data-testid="review-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name *" className="bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm" />
        <input data-testid="review-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (not shown)" className="bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm" />
      </div>
      <input data-testid="review-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" className="mt-3 w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm" />
      <textarea data-testid="review-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tell us how it went — quality, print, delivery… *" rows={4} className="mt-3 w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-sm" />

      <div className="mt-3">
        <div className="flex items-center gap-2 flex-wrap">
          {photos.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt="" className="w-16 h-16 object-cover rounded-xl border border-[#dcfce7]" />
              <button type="button" onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#1a1a1a] text-white rounded-full text-xs grid place-items-center">×</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button data-testid="review-add-photo" type="button" onClick={() => fileRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-[#7bc67e] grid place-items-center text-[#7bc67e] hover:bg-[#f0fdf4] transition-colors">
              <Camera size={18} />
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFile} />
        <div className="text-xs text-[#4b5563] mt-1">Up to {MAX_PHOTOS} photos · auto-resized for upload</div>
      </div>

      <button data-testid="review-submit" disabled={submitting} onClick={submit} className="mt-4 w-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold rounded-full py-3 transition-colors flex items-center justify-center gap-2">
        {submitting ? <><Loader2 className="animate-spin" size={16} /> Submitting…</> : "Submit Review"}
      </button>
    </div>
  );
}

function computeDistribution(reviews) {
  const d = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => { if (d[r.rating] !== undefined) d[r.rating] += 1; });
  return d;
}
