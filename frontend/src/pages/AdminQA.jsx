import { useEffect, useState } from "react";
import { fetchAllAdminQA, answerProductQuestion, deleteProductQuestion } from "../lib/api";
import { toast } from "sonner";

export default function AdminQA() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({}); // id -> draft answer

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAllAdminQA();
      setItems(data);
    } catch (e) {
      toast.error("Failed to load Q&A");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onAnswer = async (id) => {
    const text = (drafts[id] || "").trim();
    if (!text) { toast.error("Write an answer first"); return; }
    try {
      await answerProductQuestion(id, text);
      toast.success("Answer published");
      setDrafts((d) => ({ ...d, [id]: "" }));
      load();
    } catch {
      toast.error("Failed to save answer");
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    try {
      await deleteProductQuestion(id);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const unanswered = items.filter((q) => !q.answer);
  const answered = items.filter((q) => q.answer);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" data-testid="admin-qa-page">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-2">Customer Q&amp;A</h1>
        <p className="text-zinc-400 mb-8">Answer or delete questions submitted on product detail pages.</p>

        <Section title={`Awaiting answer (${unanswered.length})`} testid="qa-section-unanswered" highlight>
          {loading && <div className="text-zinc-500">Loading…</div>}
          {!loading && unanswered.length === 0 && <div className="text-zinc-500">Nothing pending — nice work.</div>}
          {unanswered.map((q) => (
            <QACard
              key={q.id}
              q={q}
              draft={drafts[q.id] || ""}
              onDraftChange={(v) => setDrafts((d) => ({ ...d, [q.id]: v }))}
              onAnswer={() => onAnswer(q.id)}
              onDelete={() => onDelete(q.id)}
            />
          ))}
        </Section>

        <Section title={`Answered (${answered.length})`} testid="qa-section-answered">
          {!loading && answered.length === 0 && <div className="text-zinc-500">No answered questions yet.</div>}
          {answered.map((q) => (
            <QACard
              key={q.id}
              q={q}
              draft={drafts[q.id] || ""}
              onDraftChange={(v) => setDrafts((d) => ({ ...d, [q.id]: v }))}
              onAnswer={() => onAnswer(q.id)}
              onDelete={() => onDelete(q.id)}
              compact
            />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children, testid, highlight }) {
  return (
    <section className={`mb-10 ${highlight ? "border-l-2 border-amber-400 pl-4" : ""}`} data-testid={testid}>
      <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function QACard({ q, draft, onDraftChange, onAnswer, onDelete, compact }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" data-testid={`admin-qa-card-${q.id}`}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1">
          <div className="text-xs text-amber-400 mb-1">{q.product_name || q.product_id}</div>
          <div className="text-sm font-semibold">{q.question}</div>
          <div className="text-xs text-zinc-500 mt-1">{q.asker_name} · {new Date(q.asked_at).toLocaleString("en-GB")}</div>
        </div>
        <button onClick={onDelete} className="text-xs text-zinc-400 hover:text-red-400" data-testid={`admin-qa-delete-${q.id}`}>Delete</button>
      </div>

      {q.answer ? (
        <div className="mt-2 text-sm text-zinc-200 bg-zinc-800 border-l-2 border-amber-400 pl-3 py-2 rounded-r">
          <span className="text-amber-400 text-xs font-bold tracking-wider uppercase mr-2">Answer</span>
          {q.answer}
        </div>
      ) : (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Write a clear, helpful answer…"
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm focus:outline-none focus:border-amber-400"
            data-testid={`admin-qa-answer-input-${q.id}`}
          />
          <button
            onClick={onAnswer}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded text-sm"
            data-testid={`admin-qa-publish-${q.id}`}
          >
            Publish
          </button>
        </div>
      )}
    </div>
  );
}
