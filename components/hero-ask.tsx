"use client";
import { ArrowRight, Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function HeroAsk({ prompts }: { prompts: string[] }) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const ask = (e?: FormEvent) => { e?.preventDefault(); if (query.trim()) router.push(`/ask?q=${encodeURIComponent(query.trim())}`); };
  return <>
    <form className="ask-box" onSubmit={ask}><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Ask GANI" placeholder="Ask about Niger State budgets…" /><button>Ask <ArrowRight size={18} /></button></form>
    <div className="prompt-label">Try asking</div>
    <div className="prompt-row">{prompts.map((p) => <button key={p} onClick={() => router.push(`/ask?q=${encodeURIComponent(p)}`)}>{p}</button>)}</div>
  </>;
}
