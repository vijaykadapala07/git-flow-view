"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles, Square } from "lucide-react";

import { GuideLines, parseGuide } from "./guide-text";

interface Turn {
  role: "user" | "assistant";
  text: string;
}

const STARTERS = [
  "What should I read first in this view?",
  "Explain this diagram in simple words.",
  "Where would I add a new test?",
];

function Answer({ text }: { text: string }) {
  const { sections, evidence } = parseGuide(text);
  return (
    <div className="space-y-3">
      {[...sections, ...evidence].map((section, index) => (
        <div key={index}>
          {section.title && (
            <p className="mb-1 text-sm font-semibold">{section.title}</p>
          )}
          <GuideLines lines={section.lines} />
        </div>
      ))}
    </div>
  );
}

export function AskPanel({
  username,
  repo,
  view,
  selectedNodeId,
  selectedLabel,
}: {
  username: string;
  repo: string;
  view?: string;
  selectedNodeId?: string;
  selectedLabel?: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns]);
  useEffect(() => () => abort.current?.abort(), []);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = turns.slice(-12);
    setTurns([
      ...turns,
      { role: "user", text },
      { role: "assistant", text: "" },
    ]);
    setDraft("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    const append = (chunk: string) =>
      setTurns((current) => {
        const next = [...current];
        const last = next[next.length - 1]!;
        next[next.length - 1] = { ...last, text: last.text + chunk };
        return next;
      });
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          repo,
          view,
          question: text,
          selectedNodeId,
          history,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        append(body?.error ?? "Could not get an answer.");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        append(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if (!controller.signal.aborted)
        append(error instanceof Error ? error.message : "Request failed.");
      else append("\n\n[Stopped]");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Ask anything about this repo. Vijay (Claude, really) reads the
              code on the same branch as this view and cites the files it used.
            </p>
            <div className="flex flex-col gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void ask(starter)}
                  className="glass hover:border-primary/40 hover:text-foreground text-muted-foreground rounded-xl border px-3 py-2.5 text-left text-sm transition-all hover:-translate-y-px"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <div
              key={index}
              className="fade-up ml-8 rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-500 px-3.5 py-2 text-sm text-white shadow-md shadow-indigo-500/20"
            >
              {turn.text}
            </div>
          ) : (
            <div key={index} className="fade-up flex gap-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-md shadow-orange-500/30">
                <Sparkles className="size-3.5" />
              </span>
              <div className="glass min-w-0 flex-1 rounded-2xl rounded-tl-md border p-3">
                <p className="text-muted-foreground mb-2 text-xs">
                  Vijay · really Claude, AI answer, not proof-checked
                </p>
                {turn.text.trim() ? (
                  <Answer text={turn.text} />
                ) : (
                  <div className="space-y-2 py-1" aria-label="Reading the code">
                    <p className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Loader2 className="size-3.5 animate-spin" /> Reading the
                      code
                    </p>
                    <div className="shimmer h-2.5 w-11/12 rounded-full" />
                    <div className="shimmer h-2.5 w-4/5 rounded-full" />
                    <div className="shimmer h-2.5 w-2/3 rounded-full" />
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      <form
        className="border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        {selectedLabel && (
          <p className="text-muted-foreground mb-2 truncate text-xs">
            About: <span className="text-foreground">{selectedLabel}</span>
          </p>
        )}
        <div className="glass focus-within:border-primary/50 focus-within:shadow-primary/20 flex items-end gap-2 rounded-2xl border p-1.5 transition-all focus-within:shadow-lg">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(draft);
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="Ask a question"
            aria-label="Question"
            className="min-h-[2.5rem] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              aria-label="Stop"
              className="hover:bg-accent flex size-8 items-center justify-center rounded-md border"
            >
              <Square className="size-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim()}
              className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30 disabled:opacity-40 disabled:shadow-none"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
