"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  GitBranch,
  ExternalLink,
  FileCode2,
  ImageDown,
  Loader2,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { FlowViewSummary } from "~/features/diagram/flow-views";
import type { DiagramGraph } from "~/features/diagram/graph";
import { exportMermaidSvgAsPng } from "~/features/diagram/export";
import { cn } from "~/lib/utils";
import { AskPanel } from "./ask-panel";
import { GuideLines, parseGuide } from "./guide-text";

const MermaidChart = dynamic(() => import("~/components/mermaid-diagram"), {
  ssr: false,
});

interface FlowWorkspaceProps {
  username: string;
  repo: string;
  views: FlowViewSummary[];
  activeView?: string;
  diagram?: string;
  graph?: DiagramGraph;
  explanation?: string;
  busy: boolean;
  statusMessage?: string;
  error?: string;
  lastGenerated?: Date;
  onRegenerate: () => void;
  onCancel: () => void;
  onRenderError: (message: string) => void;
}

function timeAgo(date?: Date): string {
  if (!date) return "Not generated yet";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (minutes < 60) return `Generated ${format.format(-minutes, "minute")}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Generated ${format.format(-hours, "hour")}`;
  return `Generated ${format.format(-Math.round(hours / 24), "day")}`;
}

export function FlowWorkspace(props: FlowWorkspaceProps) {
  const { username, repo, views, graph } = props;
  const activeId = props.activeView ?? views[0]?.id;
  const activeIndex = Math.max(
    0,
    views.findIndex((view) => view.id === activeId),
  );
  const activeView = views[activeIndex];
  const hrefFor = (index: number) =>
    `/${username}/${repo}${index === 0 ? "" : `/${views[index]!.id}`}`;

  const [tab, setTab] = useState<"guide" | "ask">("guide");
  // Views this reader has opened, remembered per repo in this browser.
  const visitedKey = `gfv-visited:${username}/${repo}`;
  const [visited, setVisited] = useState<string[]>([]);
  useEffect(() => {
    if (!activeView) return;
    try {
      const seen = new Set<string>(
        JSON.parse(localStorage.getItem(visitedKey) ?? "[]") as string[],
      );
      seen.add(activeView.id);
      localStorage.setItem(visitedKey, JSON.stringify([...seen]));
      setVisited([...seen]);
    } catch {
      setVisited([activeView.id]);
    }
  }, [activeView, visitedKey]);
  const [selected, setSelected] = useState<{
    id: string;
    href: string | null;
  } | null>(null);
  const guide = useMemo(
    () => parseGuide(props.explanation ?? ""),
    [props.explanation],
  );
  const edges = useMemo(
    () => (graph?.edges ?? []).map(({ from, to }) => ({ from, to })),
    [graph],
  );
  const nodeById = useMemo(
    () => new Map((graph?.nodes ?? []).map((node) => [node.id, node])),
    [graph],
  );
  const selectedNode = selected ? nodeById.get(selected.id) : undefined;
  const connections = selectedNode
    ? (graph?.edges ?? []).filter(
        (edge) => edge.from === selectedNode.id || edge.to === selectedNode.id,
      )
    : [];

  const svg = () =>
    document.querySelector<SVGSVGElement>("[data-flow-canvas] .mermaid > svg");

  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[15rem_minmax(0,1fr)_22rem]">
      {/* Reading path */}
      <aside className="bg-surface border-b lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="px-5 pt-5 pb-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {username}
          </p>
          <h1 className="mt-0.5 text-lg font-semibold">{repo}</h1>
          <div className="bg-border mt-3 h-1 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-500"
              style={{
                width: `${Math.round((Math.max(visited.length, 1) / Math.max(views.length, 1)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {Math.max(visited.length, 1)} of {views.length} viewed
          </p>
        </div>
        <nav aria-label="Views" className="px-3 pb-4">
          <p className="text-muted-foreground px-2 pb-2 text-xs font-medium">
            Read in order
          </p>
          <ol className="relative space-y-1">
            <span
              aria-hidden="true"
              className="bg-border absolute top-4 bottom-4 left-[1.3rem] w-px"
            />
            {views.map((view, index) => {
              const active = index === activeIndex;
              const done = !active && visited.includes(view.id);
              return (
                <li key={view.id} className="relative">
                  <Link
                    href={hrefFor(index)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-all duration-200",
                      active
                        ? "glass text-foreground ring-primary/30 font-medium shadow-md ring-1"
                        : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        active
                          ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/40"
                          : done
                            ? "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/40 dark:text-emerald-400"
                            : "bg-surface text-muted-foreground ring-border ring-1",
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : index + 1}
                    </span>
                    {view.title}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
      </aside>

      {/* Diagram */}
      <section className="relative flex min-h-[70dvh] min-w-0 flex-col lg:min-h-0">
        <header className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <div className="mr-auto min-w-0">
            <p className="text-muted-foreground text-xs">
              Step {activeIndex + 1} of {views.length}
            </p>
            <h2
              className="fade-up flex items-center gap-2 truncate text-base font-semibold"
              key={activeView?.id}
            >
              {activeView?.title}
              {activeView?.branch && (
                <span className="text-muted-foreground bg-surface inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.7rem] font-normal">
                  <GitBranch className="size-3" />
                  {activeView.branch}
                </span>
              )}
            </h2>
          </div>
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {timeAgo(props.lastGenerated)}
          </span>
          <ToolbarButton
            label="Copy Mermaid"
            icon={Copy}
            disabled={!props.diagram}
            onClick={() => {
              void navigator.clipboard.writeText(props.diagram ?? "");
              toast.success("Mermaid source copied");
            }}
          />
          <ToolbarButton
            label="PNG"
            icon={ImageDown}
            disabled={!props.diagram}
            onClick={() => {
              const element = svg();
              if (element) void exportMermaidSvgAsPng(element);
            }}
          />
          {props.busy ? (
            <ToolbarButton label="Cancel" icon={X} onClick={props.onCancel} />
          ) : (
            <ToolbarButton
              label="Regenerate"
              icon={RefreshCw}
              primary
              onClick={props.onRegenerate}
            />
          )}
        </header>

        <div
          className="relative min-h-0 flex-1"
          data-flow-canvas
          key={activeView?.id}
        >
          {props.diagram ? (
            <MermaidChart
              chart={props.diagram}
              onRenderError={props.onRenderError}
              containerClassName="h-full! max-h-none! min-h-[60dvh] p-3 lg:min-h-0"
              onNodeSelect={(id, href) => setSelected(id ? { id, href } : null)}
              selectedNodeId={selected?.id ?? null}
              edges={edges}
            />
          ) : (
            <EmptyCanvas
              busy={props.busy}
              message={props.statusMessage}
              error={props.error}
              onRegenerate={props.onRegenerate}
            />
          )}
          {props.busy && props.diagram && (
            <div className="bg-background absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm">
              <Loader2 className="size-3.5 animate-spin" />
              {props.statusMessage ?? "Regenerating"}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t px-5 py-2.5 text-sm">
          {activeIndex > 0 ? (
            <Link
              href={hrefFor(activeIndex - 1)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="size-4" />
              {views[activeIndex - 1]!.title}
            </Link>
          ) : (
            <span />
          )}
          {activeIndex < views.length - 1 && (
            <Link
              href={hrefFor(activeIndex + 1)}
              className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline"
            >
              Next: {views[activeIndex + 1]!.title}
              <ArrowRight className="size-4" />
            </Link>
          )}
        </footer>
      </section>

      {/* Guide / selected box */}
      <aside className="bg-background flex min-h-0 flex-col border-t lg:border-t-0 lg:border-l">
        <div role="tablist" className="flex gap-1 border-b px-3 pt-2">
          {(
            [
              ["guide", "Guide", FileCode2],
              ["ask", "Ask Vijay 😉", MessageSquare],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === id
                  ? "text-foreground border-violet-500"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
        {/* Kept mounted so the conversation survives switching tabs. */}
        <div className={cn("min-h-0 flex-1", tab !== "ask" && "hidden")}>
          <AskPanel
            username={username}
            repo={repo}
            view={props.activeView}
            selectedNodeId={selectedNode?.id}
            selectedLabel={selectedNode?.label}
          />
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 lg:overflow-y-auto",
            tab !== "guide" && "hidden",
          )}
        >
          {selectedNode ? (
            <div className="p-5">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-xs"
              >
                <ArrowLeft className="size-3.5" /> Back to the guide
              </button>
              <h3 className="text-base font-semibold">{selectedNode.label}</h3>
              {selectedNode.type && selectedNode.type !== "component" && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {selectedNode.type}
                </p>
              )}
              {selectedNode.path && (
                <div className="bg-surface mt-4 flex items-center gap-2 rounded-lg border px-3 py-2">
                  <FileCode2 className="text-muted-foreground size-4 shrink-0" />
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">
                    {selectedNode.path}
                  </code>
                  {selected?.href && (
                    <a
                      href={selected.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
                    >
                      Open <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              )}
              <h4 className="text-muted-foreground mt-6 mb-2 text-xs font-medium tracking-wide uppercase">
                Connections ({connections.length})
              </h4>
              {connections.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No arrows touch this box.
                </p>
              )}
              <ul className="space-y-2">
                {connections.map((edge, index) => {
                  const outgoing = edge.from === selectedNode.id;
                  const other = nodeById.get(outgoing ? edge.to : edge.from);
                  return (
                    <li key={index} className="rounded-lg border p-3 text-sm">
                      <button
                        type="button"
                        className="hover:text-primary text-left font-medium"
                        onClick={() =>
                          other && setSelected({ id: other.id, href: null })
                        }
                      >
                        {outgoing ? "→ " : "← "}
                        {other?.label ?? "?"}
                      </button>
                      {edge.label && (
                        <p className="text-muted-foreground mt-0.5">
                          {edge.label}
                        </p>
                      )}
                      {edge.description && (
                        <p className="text-muted-foreground mt-2 flex gap-1.5 text-xs">
                          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <code className="font-mono break-all">
                            {edge.description}
                          </code>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="space-y-6 p-5">
              <div className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
                Click any box in the diagram to see what it is, its file, and
                the proof for each of its arrows.
              </div>
              {guide.sections.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  The guide appears here once the diagram is generated.
                </p>
              )}
              {guide.sections.map((section, index) => (
                <section key={index}>
                  {section.title && (
                    <h3 className="mb-2 text-sm font-semibold">
                      {section.title}
                    </h3>
                  )}
                  <GuideLines lines={section.lines} />
                </section>
              ))}
              {guide.evidence.length > 0 && (
                <details className="rounded-lg border">
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    Evidence for every arrow
                  </summary>
                  <div className="space-y-4 border-t px-3 py-3">
                    {guide.evidence.map((section, index) => (
                      <section key={index}>
                        <h4 className="mb-1 text-xs font-semibold">
                          {section.title}
                        </h4>
                        <GuideLines lines={section.lines} />
                      </section>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  icon: typeof Copy;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-all duration-200 disabled:opacity-50",
        primary
          ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30 hover:brightness-110"
          : "bg-background/60 hover:bg-accent hover:border-primary/30 border",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function EmptyCanvas({
  busy,
  message,
  error,
  onRegenerate,
}: {
  busy: boolean;
  message?: string;
  error?: string;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex h-full min-h-[60dvh] items-center justify-center p-8 lg:min-h-0">
      <div className="max-w-sm text-center">
        {busy ? (
          <>
            <Loader2 className="text-primary mx-auto size-6 animate-spin" />
            <p className="mt-3 text-sm font-medium">Building this diagram</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {message ?? "Reading the repository"}
            </p>
          </>
        ) : error ? (
          <>
            <p className="text-sm font-medium">Could not build the diagram</p>
            <p className="text-muted-foreground mt-1 text-sm">{error}</p>
            <button
              type="button"
              onClick={onRegenerate}
              className="bg-primary text-primary-foreground mt-4 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium"
            >
              <RefreshCw className="size-4" /> Try again
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">No diagram yet</p>
            <button
              type="button"
              onClick={onRegenerate}
              className="bg-primary text-primary-foreground mt-4 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium"
            >
              <RefreshCw className="size-4" /> Generate
            </button>
          </>
        )}
      </div>
    </div>
  );
}
