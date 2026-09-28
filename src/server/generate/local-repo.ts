// Local-only ingestion: reads a repo from a git clone on disk instead of the
// GitHub API, so private repos work without a token.
// LOCAL_REPOS="owner/repo=/abs/path,owner2/repo2=/abs/path2"
// The tree is read from origin/<branch> (the default branch unless a view
// names one), not the working copy, so node links to
// github.com/<owner>/<repo>/blob/<branch>/... resolve.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  GithubData,
  RepositoryPathType,
  SourceBlob,
} from "~/server/generate/github";

const run = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;
const README_NAMES = /^readme(\.(md|markdown|rst|txt))?$/i;

export function getLocalRepoPath(
  username: string,
  repo: string,
): string | undefined {
  const key = `${username}/${repo}`.toLowerCase();
  for (const entry of (process.env.LOCAL_REPOS ?? "").split(",")) {
    const [name, path] = entry.split("=").map((part) => part.trim());
    if (name?.toLowerCase() === key && path) return path;
  }
  return undefined;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd, maxBuffer: MAX_BUFFER });
  return stdout;
}

export async function defaultBranch(cwd: string): Promise<string> {
  const ref = (await git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD"]))
    .trim()
    .replace("refs/remotes/origin/", "");
  return ref || "main";
}

export async function getLocalRepoData(
  path: string,
  includeFile: (path: string) => boolean,
  ref?: string,
): Promise<GithubData> {
  const branch = ref ?? (await defaultBranch(path));
  const listing = await git(path, [
    "ls-tree",
    "-r",
    "-t",
    "-l",
    `origin/${branch}`,
  ]);

  const paths: string[] = [];
  const pathTypes = new Map<string, RepositoryPathType>();
  const sourceBlobs = new Map<string, SourceBlob>();
  let readmePath: string | undefined;

  for (const line of listing.split("\n")) {
    // "<mode> <type> <sha> <size>\t<path>"
    const [meta, filePath] = line.split("\t");
    if (!meta || !filePath || !includeFile(filePath)) continue;
    const [mode, type, sha, size] = meta.trim().split(/\s+/);
    if (type !== "blob" && type !== "tree") continue;
    paths.push(filePath);
    pathTypes.set(filePath, type);
    if (type === "blob" && (mode === "100644" || mode === "100755") && sha) {
      sourceBlobs.set(filePath, { sha, size: Number(size) || 0 });
      if (!filePath.includes("/") && README_NAMES.test(filePath)) {
        readmePath = filePath;
      }
    }
  }

  const readme = readmePath
    ? await git(path, ["show", `origin/${branch}:${readmePath}`])
    : "";

  return {
    defaultBranch: branch,
    fileTree: paths.join("\n"),
    readme,
    // Treated as public so the token checks downstream do not fire;
    // source bodies are read from disk in readLocalBlob instead.
    isPrivate: false,
    stargazerCount: null,
    pathTypes,
    sourceBlobs,
    localPath: path,
  };
}

export async function readLocalBlob(
  path: string,
  sha: string,
): Promise<string> {
  return git(path, ["cat-file", "blob", sha]);
}

export async function readLocalFile(
  path: string,
  branch: string,
  filePath: string,
): Promise<string | null> {
  try {
    return await git(path, ["show", `origin/${branch}:${filePath}`]);
  } catch {
    return null;
  }
}
