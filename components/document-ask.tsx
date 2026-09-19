"use client";
import { Bot, Send, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import { documentEvidenceItems, type DocumentEvidence } from "@/lib/document-rag";

const suggestions = [
  "Summarise this document.",
  "How much is allocated to health?",
  "Find all ICT projects.",
  "Which ministry has the highest capital allocation?",
  "Find youth programmes.",
  "Find projects targeting women.",
  "Explain the capital expenditure section.",
];

export function DocumentAsk({ documentId, documentTitle }: { documentId: string; documentTitle: string }) {
  const [input, setInput] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<DocumentEvidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(false);

  async function ask(q: string) {
    setQuestion(q); setLoading(true); setError(""); setAnswer(null);
    try {
      const response = await fetch("/api/ai/document", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, documentId }) });
      const data = await response.json() as { answer?: string; evidence?: DocumentEvidence[]; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "Unable to answer from this document.");
      setAnswer(data.answer); setEvidence(data.evidence || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to answer from this document.");
    } finally {
      setLoading(false);
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); if (input.trim()) void ask(input); setInput(""); };
  const items = documentEvidenceItems(evidence);

  return <div className="panel" style={{ marginTop: 20 }}>
    <span className="kicker">Ask this document</span>
    <h2 style={{ fontSize: 20, margin: "8px 0 14px" }}>Ask a question about "{documentTitle}"</h2>
    <p className="verified" style={{ marginBottom: 12 }}><ShieldCheck size={14} /> GANI is answering from this document.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }} aria-label="Suggested questions">
      {suggestions.map((suggestion) => <button key={suggestion} type="button" className="outline-button" disabled={loading} onClick={() => void ask(suggestion)}>{suggestion}</button>)}
    </div>
    {answer && <div style={{ marginBottom: 16 }}>
      <div className="message user" style={{ maxWidth: "100%" }}>{question}</div>
      <div className="answer" style={{ marginTop: 12 }}>
        <span className="verified"><Bot size={14} /> Evidence-backed answer</span>
        <p>{answer}</p>
        <div className="source-line">
          <span className="verified"><ShieldCheck size={13} /> {evidence.length} excerpt{evidence.length === 1 ? "" : "s"}</span>
          <button className="outline-button" onClick={() => setDrawer(true)}>View evidence</button>
        </div>
      </div>
    </div>}
    {error && <p className="notice">{error}</p>}
    <form className="chat-form" onSubmit={submit}>
      <input className="field" value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Ask about this document…" />
      <button disabled={loading} aria-label="Send"><Send size={18} /></button>
    </form>
    <p style={{ marginTop: 12, fontSize: 13 }}>Want to search all public records? <Link href="/ask">Switch to broader search</Link>.</p>
    <EvidenceDrawer open={drawer} items={items} onClose={() => setDrawer(false)} title="Passages used" />
  </div>;
}
