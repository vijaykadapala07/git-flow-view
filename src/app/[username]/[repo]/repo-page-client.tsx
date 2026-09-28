"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { FlowWorkspace } from "~/components/flow/flow-workspace";
import { Toaster } from "~/components/ui/sonner";
import type { FlowViewSummary } from "~/features/diagram/flow-views";
import type { DiagramStateResponse } from "~/features/diagram/types";
import { useDiagram } from "~/hooks/useDiagram";

type RepoPageClientProps = {
  username: string;
  repo: string;
  initialState?: DiagramStateResponse | null;
  initialStateIsAuthoritative?: boolean;
  views?: FlowViewSummary[];
  /** The view on screen; undefined means the first one. */
  view?: string;
};

export default function RepoPageClient({
  username,
  repo,
  initialState = null,
  initialStateIsAuthoritative = false,
  views = [],
  view,
}: RepoPageClientProps) {
  const normalizedUsername = username.toLowerCase();
  const normalizedRepo = repo.toLowerCase();
  const {
    diagram,
    error,
    loading,
    lastGenerated,
    handleRegenerate,
    handleCancel,
    handleDiagramRenderError,
    state,
  } = useDiagram(
    normalizedUsername,
    normalizedRepo,
    initialState,
    initialStateIsAuthoritative,
    view,
  );

  useEffect(() => {
    if (!state.persistenceWarning) return;
    toast.warning("Diagram generated, but not saved", {
      description: state.persistenceWarning,
      duration: 8_000,
    });
  }, [state.persistenceWarning]);

  return (
    <main>
      <FlowWorkspace
        username={normalizedUsername}
        repo={normalizedRepo}
        views={views}
        activeView={view}
        diagram={diagram || state.diagram}
        graph={state.graph}
        explanation={state.explanation}
        busy={loading}
        statusMessage={state.message}
        error={error || state.error}
        lastGenerated={lastGenerated}
        onRegenerate={() => void handleRegenerate()}
        onCancel={handleCancel}
        onRenderError={handleDiagramRenderError}
      />
      <Toaster />
    </main>
  );
}
