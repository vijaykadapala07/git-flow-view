// Local-only LLM backend: runs the logged-in `claude` CLI instead of an API.
// Enabled with LOCAL_CLAUDE_CLI=1. Model via CLAUDE_CLI_MODEL (default: CLI default).
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { z, type ZodType } from "zod";

import type { GenerationTokenUsage } from "~/features/diagram/cost";

export function isClaudeCliEnabled(): boolean {
  return process.env.LOCAL_CLAUDE_CLI?.trim() === "1";
}

function baseArgs(systemPrompt: string): string[] {
  const model = process.env.CLAUDE_CLI_MODEL?.trim();
  return [
    "-p",
    "--tools",
    "",
    "--setting-sources",
    "",
    "--system-prompt",
    systemPrompt,
    ...(model ? ["--model", model] : []),
  ];
}

function runClaude(
  args: string[],
  userPrompt: string,
  signal?: AbortSignal,
  cwd = tmpdir(),
) {
  // Default tmpdir cwd so no repo CLAUDE.md gets loaded into the prompt.
  const child = spawn("claude", args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    signal,
  });
  child.stdin.end(userPrompt);
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  const exited = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`claude CLI exited ${code}: ${stderr.trim()}`)),
    );
  });
  return { child, exited };
}

function toUsage(usage: unknown): GenerationTokenUsage | null {
  const u = usage as
    { input_tokens?: number; output_tokens?: number } | undefined;
  if (!u) return null;
  const inputTokens = u.input_tokens ?? 0;
  const outputTokens = u.output_tokens ?? 0;
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

export async function claudeStructuredOutput<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  signal?: AbortSignal;
}): Promise<{
  output: T;
  rawText: string;
  usage: GenerationTokenUsage | null;
}> {
  // The CLI's validator rejects the draft-2020-12 $schema URI that zod adds.
  const schema: Record<string, unknown> = z.toJSONSchema(params.schema);
  delete schema.$schema;
  const jsonSchema = JSON.stringify(schema);
  const { child, exited } = runClaude(
    [
      ...baseArgs(params.systemPrompt),
      "--output-format",
      "json",
      "--json-schema",
      jsonSchema,
    ],
    params.userPrompt,
    params.signal,
  );
  let stdout = "";
  child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
  await exited;

  const result = JSON.parse(stdout) as {
    is_error?: boolean;
    result?: string;
    structured_output?: unknown;
    usage?: unknown;
  };
  if (result.is_error || result.structured_output === undefined) {
    throw new Error(
      `claude CLI returned no structured output: ${result.result}`,
    );
  }
  const output = params.schema.parse(result.structured_output);
  return {
    output,
    rawText: JSON.stringify(result.structured_output, null, 2),
    usage: toUsage(result.usage),
  };
}

/**
 * Streams an answer that may read a local clone, but only through the
 * read-only git commands in READ_ONLY_GIT; anything else is refused.
 */
const READ_ONLY_GIT = [
  "Bash(git show:*)",
  "Bash(git grep:*)",
  "Bash(git ls-tree:*)",
  "Bash(git log:*)",
];

export async function* claudeRepoAnswer(params: {
  systemPrompt: string;
  userPrompt: string;
  repoPath: string;
  signal?: AbortSignal;
}): AsyncGenerator<string, void, void> {
  const model = process.env.CLAUDE_CLI_MODEL?.trim();
  const { child, exited } = runClaude(
    [
      "-p",
      "--setting-sources",
      "",
      "--strict-mcp-config",
      "--tools",
      "Bash",
      "--allowedTools",
      ...READ_ONLY_GIT,
      "--system-prompt",
      params.systemPrompt,
      ...(model ? ["--model", model] : []),
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
    ],
    params.userPrompt,
    params.signal,
    params.repoPath,
  );
  let buffer = "";
  for await (const chunk of child.stdout as AsyncIterable<Buffer>) {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as {
        type?: string;
        is_error?: boolean;
        result?: string;
        event?: {
          type?: string;
          delta?: { type?: string; text?: string };
          content_block?: { type?: string; input?: unknown };
        };
      };
      const inner = event.event;
      if (
        event.type === "stream_event" &&
        inner?.delta?.type === "text_delta"
      ) {
        if (inner.delta.text) yield inner.delta.text;
      } else if (
        event.type === "stream_event" &&
        inner?.type === "content_block_start" &&
        inner.content_block?.type === "tool_use"
      ) {
        // Keeps separate answer paragraphs apart once a tool call finishes.
        yield "\n\n";
      } else if (event.type === "result" && event.is_error) {
        throw new Error(`claude CLI failed: ${event.result}`);
      }
    }
  }
  await exited;
}

export async function claudeStreamCompletion(params: {
  systemPrompt: string;
  userPrompt: string;
  outputSchema?: ZodType;
  signal?: AbortSignal;
}): Promise<{
  stream: AsyncGenerator<string, void, void>;
  usagePromise: Promise<GenerationTokenUsage | null>;
}> {
  if (params.outputSchema) {
    const structured = await claudeStructuredOutput({
      ...params,
      schema: params.outputSchema,
    });
    return {
      stream: (async function* () {
        yield structured.rawText;
      })(),
      usagePromise: Promise.resolve(structured.usage),
    };
  }

  let resolveUsage!: (usage: GenerationTokenUsage | null) => void;
  const usagePromise = new Promise<GenerationTokenUsage | null>(
    (resolve) => (resolveUsage = resolve),
  );

  async function* stream(): AsyncGenerator<string, void, void> {
    const { child, exited } = runClaude(
      [
        ...baseArgs(params.systemPrompt),
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
      ],
      params.userPrompt,
      params.signal,
    );
    let usage: GenerationTokenUsage | null = null;
    let buffer = "";
    try {
      for await (const chunk of child.stdout as AsyncIterable<Buffer>) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type?: string;
            is_error?: boolean;
            result?: string;
            usage?: unknown;
            event?: { delta?: { type?: string; text?: string } };
          };
          const delta = event.event?.delta;
          if (event.type === "stream_event" && delta?.type === "text_delta") {
            if (delta.text) yield delta.text;
          } else if (event.type === "result") {
            if (event.is_error) {
              throw new Error(`claude CLI failed: ${event.result}`);
            }
            usage = toUsage(event.usage);
          }
        }
      }
      await exited;
    } finally {
      resolveUsage(usage);
    }
  }

  return { stream: stream(), usagePromise };
}
