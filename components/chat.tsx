"use client";
import {
  ArrowRight,
  Bot,
  FolderKanban,
  Menu,
  Plus,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import type { EvidenceItem } from "@/lib/evidence";

const HISTORY_KEY = "gani-chat-history";
const CONVERSATION_KEY = "gani-conversation-id";
const suggestions = [
  "What projects are in Bida?",
  "How much was allocated to healthcare?",
  "Which ministry received the highest allocation?",
  "What is capital expenditure?",
];
type Provider = "cloudflare" | "ollama";
type Answer = {
  title: string;
  body: string;
  model?: string;
  evidence: EvidenceItem[];
  suggestedFollowups: string[];
  summary: string;
  facts: Array<{ title: string; detail: string }>;
  calculations: Array<{
    operation: string;
    inputs: Record<string, unknown>;
    result: unknown;
  }>;
  projects: Array<{
    id?: string;
    title: string;
    approved_amount?: number;
    sector?: string;
    mda?: string;
    location?: string;
    href?: string;
  }>;
  confidence: string;
  limitations: string[];
};
type StreamEvent =
  | { type: "status"; message: string }
  | { type: "answer_delta"; delta: string }
  | {
      type: "complete";
      data: {
        summary?: string;
        facts?: Answer["facts"];
        calculations?: Answer["calculations"];
        projects?: Answer["projects"];
        sources?: EvidenceItem[];
        confidence?: string;
        limitations?: string[];
        suggested_followups?: string[];
      };
    }
  | { type: "error"; error: string };

const formatNaira = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);

function StructuredAnswer({
  answer,
  onEvidence,
}: {
  answer: Answer;
  onEvidence: () => void;
}) {
  const projectCount =
    Number(
      answer.facts.find((fact) => fact.title === "Projects found")?.detail,
    ) || answer.projects.length;
  const allocation = answer.projects.reduce(
    (sum, project) => sum + (project.approved_amount || 0),
    0,
  );
  const sectors = Object.entries(
    answer.projects.reduce<Record<string, number>>((totals, project) => {
      const sector = project.sector || "Unclassified";
      totals[sector] = (totals[sector] || 0) + (project.approved_amount || 0);
      return totals;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const sources = answer.evidence
    .filter(
      (source, index, all) =>
        all.findIndex(
          (item) => item.title === source.title && item.href === source.href,
        ) === index,
    )
    .slice(0, 4);
  const confidenceClass = answer.confidence.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="answer-structure">
      {(projectCount > 0 || allocation > 0) && (
        <div className="answer-metrics">
          {projectCount > 0 && (
            <div>
              <strong>{projectCount.toLocaleString()}</strong>
              <span>Projects</span>
            </div>
          )}
          {allocation > 0 && (
            <div>
              <strong>{formatNaira(allocation)}</strong>
              <span>Shown allocation</span>
            </div>
          )}
        </div>
      )}
      {sectors.length > 1 && (
        <section className="answer-section">
          <h3>Largest sectors in these results</h3>
          <div className="sector-breakdown">
            {sectors.map(([sector, total]) => (
              <div key={sector}>
                <span>{sector}</span>
                <i>
                  <b
                    style={{
                      width: `${Math.max(8, (total / sectors[0][1]) * 100)}%`,
                    }}
                  />
                </i>
                <strong>{formatNaira(total)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      {answer.projects.length > 0 && (
        <section className="answer-section">
          <div className="answer-section-head">
            <h3>Projects</h3>
            <Link href="/budget/explore">
              Explore all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="answer-projects">
            {answer.projects.slice(0, 3).map((project) => (
              <Link
                href={project.href || "/budget/explore"}
                key={project.id || project.title}
              >
                <FolderKanban size={16} />
                <span>
                  <b>{project.title}</b>
                  <small>
                    {[
                      project.sector,
                      project.approved_amount
                        ? formatNaira(project.approved_amount)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="answer-verification">
        <div>
          <h3>Sources</h3>
          {sources.length ? (
            sources.map((source) => (
              <div className="answer-source" key={source.key}>
                <ShieldCheck size={15} />
                <span>{source.documentTitle || source.title}</span>
              </div>
            ))
          ) : (
            <p className="meta">No matching source record.</p>
          )}
        </div>
        <div className="confidence-card">
          <small>Evidence confidence</small>
          <strong className={confidenceClass}>
            {answer.confidence || "Unable to Verify"}
          </strong>
          <span>
            {sources.length} linked source{sources.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>
      {answer.limitations.length > 0 && (
        <div className="answer-limitations">
          <b>Limitations</b>
          {answer.limitations.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      )}
      <div className="answer-actions">
        {answer.evidence.length > 0 && (
          <button className="button" onClick={onEvidence}>
            <ShieldCheck size={15} /> View evidence
          </button>
        )}
        <Link className="outline-button" href="/budget/explore">
          <FolderKanban size={15} /> Explore projects
        </Link>
      </div>
    </div>
  );
}

export function Chat() {
  const params = useSearchParams();
  const initial = params.get("q") || "";
  const conversationId = useRef("");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [provider, setProvider] = useState<Provider>("cloudflare");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, []);
  const pushHistory = (q: string) => {
    setHistory((prev) => {
      const next = [q, ...prev.filter((h) => h !== q)].slice(0, 8);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const activeConversation = () => {
    if (conversationId.current) return conversationId.current;
    try {
      conversationId.current =
        localStorage.getItem(CONVERSATION_KEY) || crypto.randomUUID();
      localStorage.setItem(CONVERSATION_KEY, conversationId.current);
    } catch {
      conversationId.current = crypto.randomUUID();
    }
    return conversationId.current;
  };
  const newConversation = () => {
    conversationId.current = crypto.randomUUID();
    try {
      localStorage.setItem(CONVERSATION_KEY, conversationId.current);
    } catch {}
    setQuery("");
    setAnswer(null);
    setError("");
    setSidebarOpen(false);
  };
  const ask = async (q: string) => {
    setQuery(q);
    setAnswer(null);
    setInput("");
    setLoading(true);
    setStatus("Understanding your question...");
    setError("");
    setSidebarOpen(false);
    pushHistory(q);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: q,
          provider,
          conversationId: activeConversation(),
          stream: true,
        }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "AI is unavailable");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as StreamEvent;
        if (event.type === "status") setStatus(event.message);
        if (event.type === "answer_delta")
          setAnswer((previous) => ({
            title: q,
            body: (previous?.body || "") + event.delta,
            model: previous?.model,
            evidence: previous?.evidence || [],
            suggestedFollowups: previous?.suggestedFollowups || [],
            summary: previous?.summary || "",
            facts: previous?.facts || [],
            calculations: previous?.calculations || [],
            projects: previous?.projects || [],
            confidence: previous?.confidence || "",
            limitations: previous?.limitations || [],
          }));
        if (event.type === "complete") {
          completed = true;
          setAnswer((previous) => ({
            title: q,
            body: previous?.body || "",
            evidence: event.data.sources || [],
            suggestedFollowups: event.data.suggested_followups || [],
            summary: event.data.summary || previous?.body || "",
            facts: event.data.facts || [],
            calculations: event.data.calculations || [],
            projects: event.data.projects || [],
            confidence: event.data.confidence || "low",
            limitations: event.data.limitations || [],
          }));
        }
        if (event.type === "error") throw new Error(event.error);
      };
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) consume(line);
        if (done) break;
      }
      if (buffer.trim()) consume(buffer);
      if (!completed)
        throw new Error("The response stream ended before completion");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI is unavailable");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (initial) void ask(initial);
  }, [initial]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) void ask(input);
  };
  const sidebar = (
    <aside
      className={sidebarOpen ? "chat-sidebar mobile-open" : "chat-sidebar"}
    >
      <button
        className="icon-button chat-sidebar-close"
        onClick={() => setSidebarOpen(false)}
        aria-label="Close conversations"
      >
        <X color="#fff" />
      </button>
      <button onClick={newConversation}>
        <Plus size={15} /> New Chat
      </button>
      <small>AI provider</small>
      <div className="provider-switch">
        <button
          className={provider === "cloudflare" ? "active" : ""}
          onClick={() => setProvider("cloudflare")}
        >
          Cloudflare GPT‑OSS
        </button>
        <button
          className={provider === "ollama" ? "active" : ""}
          onClick={() => setProvider("ollama")}
        >
          Ollama
        </button>
      </div>
      <small>Recent</small>
      <div className="recent-list">
        {history.length ? (
          history.map((h) => (
            <button key={h} onClick={() => void ask(h)}>
              {h}
            </button>
          ))
        ) : (
          <p className="meta" style={{ color: "#95b8a5", fontSize: 11 }}>
            Your recent questions will appear here.
          </p>
        )}
      </div>
      <small>Boundary</small>
      <p style={{ fontSize: 11, color: "#b8d1c2" }}>
        No project claims are made without verified records.
      </p>
    </aside>
  );
  return (
    <div className="ask-layout">
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {sidebar}
      <section className="chat-main">
        <div className="chat-head">
          <span className="brand-mark" style={{ width: 35, height: 35 }}>
            G
          </span>
          <div>
            <b>GANI Copilot</b>
            <span>
              {provider === "cloudflare"
                ? "Cloudflare-hosted GPT‑OSS 20B"
                : "Private Ollama endpoint"}{" "}
              · live records
            </span>
          </div>
          <button
            className="chat-sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open conversations"
          >
            <Menu size={17} />
          </button>
        </div>
        <div className="chat-body">
          {!query ? (
            <div className="welcome">
              <div className="welcome-icon">
                <Bot />
              </div>
              <h1>What would you like to understand?</h1>
              <p className="meta">
                Ask about budgets, projects, ministries or public documents.
              </p>
              <div className="suggestions">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => void ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="message user">{query}</div>
              {loading && !answer ? (
                <div className="answer">
                  <span className="verified">
                    <Bot size={14} /> {status}
                  </span>
                  <div
                    className="panel"
                    style={{ padding: 15, color: "var(--muted)", fontSize: 13 }}
                  >
                    This status reflects the current processing stage.
                  </div>
                </div>
              ) : (
                answer && (
                  <div className="answer civic-answer">
                    <div className="answer-identity">
                      <span className="mini-gani">G</span>
                      <div>
                        <strong>GANI</strong>
                        <small>Evidence-backed civic answer</small>
                      </div>
                    </div>
                    <h2>{answer.title}</h2>
                    <p className="answer-summary">{answer.body}</p>
                    {loading && (
                      <div
                        className="panel"
                        style={{
                          padding: 12,
                          color: "var(--muted)",
                          fontSize: 13,
                        }}
                      >
                        {status}
                      </div>
                    )}
                    {error && <p className="notice">{error}.</p>}
                    {!loading && (
                      <StructuredAnswer
                        answer={answer}
                        onEvidence={() => setDrawer(true)}
                      />
                    )}
                    {!loading && answer.suggestedFollowups.length > 0 && (
                      <div className="suggestions">
                        {answer.suggestedFollowups.map((item) => (
                          <button
                            key={item}
                            onClick={() =>
                              /show the evidence/i.test(item)
                                ? setDrawer(true)
                                : void ask(item)
                            }
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
              {error && !loading && !answer && (
                <p className="notice">{error}.</p>
              )}
            </>
          )}
        </div>
        <form className="chat-form" onSubmit={submit}>
          <input
            className="field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder="Ask a follow-up…"
          />
          <button disabled={loading} aria-label="Send">
            <Send size={18} />
          </button>
        </form>
      </section>
      <EvidenceDrawer
        open={drawer}
        items={answer?.evidence || []}
        onClose={() => setDrawer(false)}
      />
    </div>
  );
}
