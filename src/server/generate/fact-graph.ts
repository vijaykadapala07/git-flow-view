// Fact-checked views: every node and arrow is written by hand in
// flowviews.json, and every arrow names the file and the exact text that
// proves it. Each generation re-reads those files from git and drops any
// arrow whose proof is gone, so the diagram never shows an unverified link.
import type { GenerationTokenUsage } from "~/features/diagram/cost";
import type { GithubData } from "~/server/generate/github";
import { readLocalFile } from "~/server/generate/local-repo";

export interface FactGraphConfig {
  explanation: string;
  groups?: { id: string; label: string }[];
  nodes: {
    id: string;
    label: string;
    caption?: string;
    path?: string;
    group?: string;
    shape?: "box" | "database" | "circle" | "hexagon" | "queue" | "document";
  }[];
  edges: {
    from: string;
    to: string;
    label?: string;
    dashed?: boolean;
    /** Files and text that must all appear for this arrow to be drawn. */
    proof: Proof | Proof[];
  }[];
}

interface Proof {
  path: string;
  match: string;
}

const proofs = (edge: { proof: Proof | Proof[] }) =>
  Array.isArray(edge.proof) ? edge.proof : [edge.proof];

/** One-line evidence for an arrow, shown when a box is selected. */
export function proofText(edge: { proof: Proof | Proof[] }): string {
  return proofs(edge)
    .map((proof) => `${proof.path}: ${squash(proof.match)}`)
    .join(" | ")
    .slice(0, 240);
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

type FactEdge = FactGraphConfig["edges"][number];

/** Re-reads every proof from git; returns the arrows that still hold. */
export async function verifyEdges<T extends FactEdge>(
  data: GithubData,
  edges: T[],
): Promise<{ verified: T[]; unverified: string[] }> {
  const files = new Map<string, string | null>();
  const read = async (path: string) => {
    if (!files.has(path)) {
      files.set(
        path,
        data.localPath
          ? await readLocalFile(data.localPath, data.defaultBranch, path)
          : null,
      );
    }
    return files.get(path) ?? null;
  };
  const verified: T[] = [];
  const unverified: string[] = [];
  for (const edge of edges) {
    const missing: string[] = [];
    for (const proof of proofs(edge)) {
      const content = await read(proof.path);
      if (!content || !squash(content).includes(squash(proof.match)))
        missing.push(proof.path);
    }
    if (missing.length === 0) verified.push(edge);
    else unverified.push(`${edge.from} -> ${edge.to} (${missing.join(", ")})`);
  }
  return { verified, unverified };
}

/** The "proof" part of the Info panel, in the notes' Markdown subset. */
export function proofSection(params: {
  branch: string;
  verified: FactEdge[];
  unverified: string[];
  names: Map<string, string>;
}): string {
  const name = (id: string) => params.names.get(id) ?? id;
  const lines = [
    "## Proof for every arrow",
    `Each arrow was checked against the \`${params.branch}\` branch when this diagram was made. If the file changes and the text below is gone, the arrow is left out.`,
    ...params.verified.map(
      (edge) =>
        `- **${name(edge.from)} → ${name(edge.to)}**${edge.label ? ` (${edge.label})` : ""}: ${proofs(
          edge,
        )
          .map(
            (proof) => `\`${proof.path}\` contains \`${squash(proof.match)}\``,
          )
          .join(" and ")}`,
    ),
  ];
  if (params.unverified.length) {
    lines.push(
      "## Left out: proof not found",
      "The repo changed since these arrows were written. Update flowviews.json.",
      ...params.unverified.map((item) => `- ${item}`),
    );
  }
  return lines.join("\n");
}

export async function streamFactGraph(params: {
  data: GithubData;
  facts: FactGraphConfig;
}): Promise<{
  stream: AsyncGenerator<string, void, void>;
  usagePromise: Promise<GenerationTokenUsage | null>;
}> {
  const { data, facts } = params;
  const { verified, unverified } = await verifyEdges(data, facts.edges);
  const explanation = [
    facts.explanation.trim(),
    proofSection({
      branch: data.defaultBranch,
      verified,
      unverified,
      names: new Map(facts.nodes.map((node) => [node.id, node.label])),
    }),
  ].join("\n\n");

  const graph = {
    groups: facts.groups ?? [],
    nodes: facts.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      ...(node.caption ? { caption: node.caption } : {}),
      groupId: node.group ?? null,
      path: node.path && data.pathTypes.has(node.path) ? node.path : null,
      shape: node.shape ?? null,
    })),
    edges: verified.map((edge) => ({
      from: edge.from,
      to: edge.to,
      label: edge.label ?? null,
      style: edge.dashed ? ("dashed" as const) : ("solid" as const),
      proof: proofText(edge),
    })),
  };

  const text = JSON.stringify({ explanation, graph });
  return {
    stream: (async function* () {
      yield text;
    })(),
    usagePromise: Promise.resolve(null),
  };
}
