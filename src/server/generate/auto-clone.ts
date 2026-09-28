// Opt-in (GH_AUTO_CLONE=1): repos without a LOCAL_REPOS entry are cloned once
// with the user's `gh` login into ~/.gitflowview/repos/<owner>/<repo>, then
// fetched before use. The clone has no working tree, and the token is never
// written to it: gh hands credentials to git per call.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
const CLONE_TIMEOUT_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 2 * 60_000;
const FETCH_EVERY_MS = 5 * 60_000;
// gh as the only credential helper, for this call only.
const GH_CREDENTIALS = [
  "-c",
  "credential.helper=",
  "-c",
  "credential.helper=!gh auth git-credential",
];

const inFlight = new Map<string, Promise<string>>();
const lastFetch = new Map<string, number>();

export function isAutoCloneEnabled(): boolean {
  return process.env.GH_AUTO_CLONE?.trim() === "1";
}

export class AutoCloneError extends Error {}

function validName(value: string): boolean {
  return NAME.test(value) && !value.includes("..") && !value.endsWith(".git");
}

export function autoCloneRoot(): string {
  return join(homedir(), ".gitflowview", "repos");
}

/** Existing auto-clone path, without cloning or fetching. */
export function existingAutoClone(
  username: string,
  repo: string,
): string | undefined {
  if (!isAutoCloneEnabled() || !validName(username) || !validName(repo))
    return undefined;
  const path = join(
    autoCloneRoot(),
    username.toLowerCase(),
    repo.toLowerCase(),
  );
  return existsSync(join(path, "HEAD")) ? path : undefined;
}

async function cloneOrFetch(
  username: string,
  repo: string,
  path: string,
): Promise<string> {
  const key = `${username}/${repo}`;
  if (existsSync(join(path, "HEAD"))) {
    if (Date.now() - (lastFetch.get(key) ?? 0) > FETCH_EVERY_MS) {
      await run("git", [...GH_CREDENTIALS, "fetch", "--prune", "origin"], {
        cwd: path,
        timeout: FETCH_TIMEOUT_MS,
      }).catch((error: unknown) => {
        // A failed refresh keeps the last fetched state; say why in the log.
        console.warn(`gitflowview: fetch ${key} failed`, error);
      });
      lastFetch.set(key, Date.now());
    }
    return path;
  }

  await mkdir(join(autoCloneRoot(), username.toLowerCase()), {
    recursive: true,
  });
  try {
    // --bare: no working tree, so nothing from the repo is unpacked or run.
    // origin/<branch> refs are kept so reads match a normal clone.
    await run(
      "gh",
      [
        "repo",
        "clone",
        `${username}/${repo}`,
        path,
        "--",
        "--bare",
        "--config",
        "remote.origin.fetch=+refs/heads/*:refs/remotes/origin/*",
      ],
      { timeout: CLONE_TIMEOUT_MS },
    );
    await run("git", [...GH_CREDENTIALS, "fetch", "origin"], {
      cwd: path,
      timeout: FETCH_TIMEOUT_MS,
    });
    await run("git", ["remote", "set-head", "origin", "--auto"], {
      cwd: path,
      timeout: FETCH_TIMEOUT_MS,
    });
  } catch (error) {
    await rm(path, { recursive: true, force: true });
    const detail =
      error instanceof Error && "stderr" in error
        ? String((error as { stderr: unknown }).stderr).trim()
        : error instanceof Error
          ? error.message
          : "";
    throw new AutoCloneError(
      `Couldn't clone ${username}/${repo} with your gh login${detail ? `: ${detail.split("\n").pop()}` : "."}`,
    );
  }
  lastFetch.set(key, Date.now());
  return path;
}

/** Clones (first time) or refreshes the repo; undefined when disabled. */
export async function ensureAutoClone(
  username: string,
  repo: string,
): Promise<string | undefined> {
  if (!isAutoCloneEnabled()) return undefined;
  if (!validName(username) || !validName(repo))
    throw new AutoCloneError(
      `"${username}/${repo}" is not a valid repository name.`,
    );
  const key = `${username.toLowerCase()}/${repo.toLowerCase()}`;
  const path = join(
    autoCloneRoot(),
    username.toLowerCase(),
    repo.toLowerCase(),
  );
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = cloneOrFetch(username, repo, path).finally(() =>
    inFlight.delete(key),
  );
  inFlight.set(key, task);
  return task;
}
