"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { useTheme } from "next-themes";

import { applyDiagramPalette } from "~/components/diagram-palette";
import { MermaidDiagramToolbar } from "~/components/mermaid-diagram-toolbar";
import {
  createHiddenRenderTarget,
  withDomNodesSerializingSafely,
} from "~/components/mermaid-diagram-helpers";
import {
  enforceSafeMermaidLinks,
  sanitizeMermaidSourceForRender,
} from "~/features/diagram/mermaid-security";
import { useMermaidViewport } from "~/hooks/use-mermaid-viewport";
import { cn } from "~/lib/utils";

interface MermaidChartProps {
  chart: string;
  zoomingEnabled?: boolean;
  onRenderError?: (message: string) => void;
  onRenderComplete?: () => void;
  containerClassName?: string;
  diagramClassName?: string;
  backgroundColor?: string;
  fitToContainer?: boolean;
  /** When set, clicking a box selects it instead of following its link. */
  onNodeSelect?: (nodeId: string | null, href: string | null) => void;
  selectedNodeId?: string | null;
  /** Arrows as graph ids, so the selected box's neighbours stay lit. */
  edges?: { from: string; to: string }[];
}

// Mermaid ids end in "...node_<graph id>-<n>" for boxes.
const NODE_ID = /node_([a-z][a-z0-9_]*)-\d+$/;
const nodeIdOf = (element: Element | null) => {
  const group = element?.closest("g.node");
  return group ? (NODE_ID.exec(group.id)?.[1] ?? null) : null;
};

const INTERACTIVE_FIT_PADDING = 24;
const PREVIEW_FIT_PADDING = 16;
const INTERACTIVE_VIEWER_PROPS = {
  "aria-label": "Interactive diagram viewer",
  role: "region",
  tabIndex: 0,
};

const MermaidChart = ({
  chart,
  zoomingEnabled = true,
  onRenderError,
  onRenderComplete,
  containerClassName,
  diagramClassName,
  backgroundColor,
  fitToContainer = false,
  onNodeSelect,
  selectedNodeId = null,
  edges = [],
}: MermaidChartProps) => {
  const reportedRenderErrorRef = useRef<string | null>(null);
  const [renderMessage, setRenderMessage] = useState<string | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const fitPadding = zoomingEnabled
    ? INTERACTIVE_FIT_PADDING
    : fitToContainer
      ? PREVIEW_FIT_PADDING
      : 0;
  const {
    containerRef,
    diagramRef,
    disconnectResizeObserver,
    fitDiagram,
    formattedZoom,
    handleClickCapture,
    handleDragStart,
    handleKeyDown,
    handleLostPointerCapture,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    interactionLayerRef,
    isPanZoomReady,
    prepareForRender,
    stepZoom,
  } = useMermaidViewport({
    fitPadding,
    fitToContainer,
    onRenderComplete,
    renderVersion,
    zoomingEnabled,
  });

  const reportRenderError = useEffectEvent((message: string) => {
    onRenderError?.(message);
  });

  useEffect(() => {
    let cancelled = false;

    const baseConfig = {
      startOnLoad: false,
      suppressErrorRendering: true,
      securityLevel: "antiscript" as const,
      secure: ["securityLevel", "startOnLoad", "maxTextSize"],
      theme: "base" as const,
      // Pure SVG labels survive strict sanitization without relying on
      // foreignObject HTML, which is both harder to secure and less portable.
      htmlLabels: false,
      layout: "elk",
      // Mermaid 12 defaults to the "neo" look and a 120px wrap, which splits
      // file paths mid-name; keep the classic look and the old 200px wrap.
      look: "classic" as const,
      flowchart: {
        wrappingWidth: 200,
        curve: "linear" as const,
        nodeSpacing: 50,
        rankSpacing: 50,
        padding: 15,
      },
      themeVariables: isDark
        ? {
            background: backgroundColor ?? "transparent",
            primaryColor: "#1c1c22",
            primaryBorderColor: "#3f3f46",
            primaryTextColor: "#f4f4f5",
            lineColor: "#71717a",
            secondaryColor: "#18181b",
            tertiaryColor: "#141418",
            clusterBkg: "rgba(255,255,255,0.025)",
            clusterBorder: "#2e2e3a",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }
        : {
            background: backgroundColor ?? "transparent",
            primaryColor: "#ffffff",
            primaryBorderColor: "#d4d4d8",
            primaryTextColor: "#18181b",
            lineColor: "#a1a1aa",
            secondaryColor: "#fafafa",
            tertiaryColor: "#f4f4f5",
            clusterBkg: "rgba(99,102,241,0.035)",
            clusterBorder: "#e0e0ea",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          },
      themeCSS: `
        .clickable > * {
          scale: 1;
          transform-box: fill-box;
          transform-origin: center;
          transition: scale 160ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        .clickable {
          cursor: pointer;
        }
        @media (hover: hover) and (pointer: fine) {
          .clickable:hover > * {
            scale: 1.05;
            filter: brightness(0.85);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .clickable > * {
            transition: none;
          }
          .clickable:hover > * {
            scale: 1;
          }
        }
      `,
    };

    const renderDiagram = async () => {
      const mermaidElement = diagramRef.current;
      if (!(mermaidElement instanceof HTMLDivElement)) return;

      setRenderMessage(null);
      prepareForRender();
      mermaid.initialize(baseConfig);
      mermaidElement.removeAttribute("data-processed");
      const renderTarget = createHiddenRenderTarget(
        Math.round(
          mermaidElement.getBoundingClientRect().width ||
            containerRef.current?.getBoundingClientRect().width ||
            window.innerWidth,
        ),
      );

      try {
        const renderId = `gitflowview-${Math.random().toString(36).slice(2)}`;
        const safeChart = sanitizeMermaidSourceForRender(
          applyDiagramPalette(chart, isDark),
        );
        const { svg, bindFunctions } = await withDomNodesSerializingSafely(() =>
          mermaid.render(renderId, safeChart, renderTarget),
        );
        if (cancelled) return;

        mermaidElement.textContent = "";
        mermaidElement.innerHTML = DOMPurify.sanitize(svg, {
          USE_PROFILES: { html: true, svg: true, svgFilters: true },
          FORBID_TAGS: ["script"],
        });
        enforceSafeMermaidLinks(mermaidElement);
        bindFunctions?.(mermaidElement);
        setRenderVersion((currentVersion) => currentVersion + 1);
      } catch (error) {
        if (cancelled) return;
        console.error("Mermaid render failed:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Mermaid render error.";
        setRenderMessage(`Mermaid render failed: ${message}`);
        const reportKey = `${chart}::${message}`;
        if (reportedRenderErrorRef.current !== reportKey) {
          reportedRenderErrorRef.current = reportKey;
          reportRenderError(message);
        }
      } finally {
        renderTarget.remove();
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
      disconnectResizeObserver();
    };
  }, [
    backgroundColor,
    chart,
    containerRef,
    diagramRef,
    disconnectResizeObserver,
    isDark,
    prepareForRender,
  ]);

  // Highlight the selected box, its arrows and the boxes on their other end.
  useEffect(() => {
    const root = diagramRef.current;
    if (!root) return;
    root.querySelectorAll("[data-lit],[data-selected]").forEach((element) => {
      element.removeAttribute("data-lit");
      element.removeAttribute("data-selected");
    });
    const svg = root.querySelector("svg");
    if (!selectedNodeId || !svg) {
      svg?.removeAttribute("data-focus");
      return;
    }
    svg.setAttribute("data-focus", "true");
    const lit = new Set([selectedNodeId]);
    const edgeKeys: string[] = [];
    for (const edge of edges) {
      if (edge.from === selectedNodeId || edge.to === selectedNodeId) {
        lit.add(edge.from);
        lit.add(edge.to);
        edgeKeys.push(`L_node_${edge.from}_node_${edge.to}_`);
      }
    }
    root.querySelectorAll("g.node").forEach((group) => {
      const id = NODE_ID.exec(group.id)?.[1];
      if (id && lit.has(id)) group.setAttribute("data-lit", "true");
      if (id === selectedNodeId) group.setAttribute("data-selected", "true");
    });
    root.querySelectorAll(".edgePaths path").forEach((path) => {
      if (edgeKeys.some((key) => path.id.includes(key)))
        path.setAttribute("data-lit", "true");
    });
    root.querySelectorAll(".edgeLabels .edgeLabel").forEach((label) => {
      const key = label.querySelector("[data-id]")?.getAttribute("data-id");
      if (key && edgeKeys.some((edgeKey) => key.startsWith(edgeKey)))
        label.setAttribute("data-lit", "true");
    });
  }, [diagramRef, edges, renderVersion, selectedNodeId]);

  const handleNodeClick = (event: React.MouseEvent) => {
    if (!onNodeSelect) return;
    const target = event.target as Element;
    const id = nodeIdOf(target);
    const anchor = target.closest("a");
    const href =
      anchor?.getAttribute("href") ??
      anchor?.getAttribute("xlink:href") ??
      null;
    event.preventDefault();
    onNodeSelect(id, id ? href : null);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full p-4",
        zoomingEnabled && "h-[70vh] max-h-[52rem] min-h-[22rem]",
        containerClassName,
      )}
    >
      {renderMessage && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {renderMessage}
        </div>
      )}
      <div
        ref={interactionLayerRef}
        {...(zoomingEnabled ? INTERACTIVE_VIEWER_PROPS : {})}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative h-full",
          zoomingEnabled
            ? "touch-none"
            : "touch-pan-x touch-pan-y touch-pinch-zoom",
          (zoomingEnabled || fitToContainer) && "overflow-hidden",
          zoomingEnabled &&
            "cursor-grab select-none data-[dragging=true]:cursor-grabbing [&_*]:select-none",
        )}
        onClickCapture={handleClickCapture}
        onDragStart={handleDragStart}
        onLostPointerCapture={handleLostPointerCapture}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {zoomingEnabled && (
          <MermaidDiagramToolbar
            formattedZoom={formattedZoom}
            isPanZoomReady={isPanZoomReady}
            onFit={() => fitDiagram(true)}
            onZoomIn={() => stepZoom(1.18)}
            onZoomOut={() => stepZoom(1 / 1.18)}
          />
        )}
        <div
          ref={diagramRef}
          onClick={handleNodeClick}
          className={cn(
            "mermaid text-foreground [&_svg]:mx-auto [&_svg]:block [&_svg]:max-w-full [&_svg]:overflow-visible",
            !isPanZoomReady && "invisible",
            zoomingEnabled && "[&_svg]:h-auto [&_svg]:w-auto",
            !zoomingEnabled && "[&_svg]:h-auto",
            diagramClassName,
          )}
        />
      </div>
    </div>
  );
};

export default MermaidChart;
