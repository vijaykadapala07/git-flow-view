import { notFound } from "next/navigation";

import {
  getFlowViewSummaries,
  getFlowViews,
  getViewStorageRepo,
} from "~/server/generate/flow-views";
import { getStoredDiagramState } from "~/server/storage/artifact-store";
import RepoPageClient from "../repo-page-client";

type ViewPageProps = {
  params: Promise<{ username: string; repo: string; view: string }>;
};

export const dynamic = "force-dynamic";

export default async function ViewPage({ params }: ViewPageProps) {
  const { username, repo, view } = await params;
  const views = getFlowViews(username, repo);
  if (!views.some((item) => item.id === view)) notFound();

  const initialState = await getStoredDiagramState({
    username,
    repo: getViewStorageRepo(username, repo, view),
  }).catch(() => null);

  return (
    <RepoPageClient
      key={`${username.toLowerCase()}/${repo.toLowerCase()}/${view}`}
      username={username}
      repo={repo}
      view={view}
      initialState={initialState?.diagram ? initialState : null}
      initialStateIsAuthoritative={Boolean(initialState?.diagram)}
      views={await getFlowViewSummaries(username, repo)}
    />
  );
}
