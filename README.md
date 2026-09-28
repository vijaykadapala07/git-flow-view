# Git Flow View

Clickable diagrams that explain a repository to people who are new to it.

- **A reading path per repo.** A few short diagrams, read in order: what the repo holds, how its main flows work, how to add to it.
- **Every box opens its file.** Click a box to see what it is, its file, and every arrow that touches it.
- **Every arrow can be proven.** Views you write by hand name the file and line that proves each arrow. Each regenerate re-checks them against git and drops any arrow whose proof has gone.
- **Ask Vijay 😉.** A chat panel where Claude answers questions by reading the repo's code, read-only, and cites `path:line`.

Everything runs on your own machine. Private repos are read from git clones on disk, and the AI runs through your own Claude Code login, so no API key is needed and no code is sent anywhere except to Claude.

Based on [GitDiagram](https://github.com/ahmedkhaleel2004/gitdiagram) by Ahmed Khaleel (MIT licence, see `LICENSE`).

## What you need

| Tool | Why | Check |
|---|---|---|
| [Bun](https://bun.sh) | Runs the app | `bun --version` |
| [Docker](https://www.docker.com/products/docker-desktop/) | Local stand-ins for Redis and S3 storage | `docker info` |
| [Claude Code](https://claude.com/claude-code) CLI, signed in | Writes the diagrams and answers questions | `claude --version`, then run `claude` once to sign in |
| [GitHub CLI](https://cli.github.com), signed in | Clones private repos you have access to | `gh auth status` |
| git | Reads the clones | `git --version` |

## Set up

```bash
git clone <this repo> gitFlowView
cd gitFlowView
bun install
cp .env.example .env
```

Open `.env` and set:

1. `CACHE_KEY_SECRET`: any long random string, for example the output of `openssl rand -hex 32`.
2. How the app finds repos. Use one or both:
   - `GH_AUTO_CLONE=1` (the default): any repo your GitHub account can see is cloned the first time you open it, with your `gh` login.
   - `LOCAL_REPOS`: clones you already have, as `owner/repo=/absolute/path`, comma-separated. These are used as they are and never fetched.
3. Optional: `NEXT_PUBLIC_DEFAULT_OWNER`, so the search box accepts a bare repo name for that owner.

Everything else in `.env.example` already matches the local storage below.

**Using an API key instead of Claude Code:** set `LOCAL_CLAUDE_CLI=0` and put a real key in `OPENAI_API_KEY`. The Ask panel needs the Claude CLI and is not available in that mode.

## Start it

```bash
docker compose -f docker-compose.local.yml up -d   # Redis + S3 stand-ins, data kept in Docker volumes
bun run dev                                        # http://localhost:3000
```

Open http://localhost:3000, type `owner/repo` or paste a GitHub URL, and press Open. The first open of a repo clones it and draws the diagram, which takes a minute or two. After that it loads straight away.

To stop: press `Ctrl+C` for the app, and run `docker compose -f docker-compose.local.yml down` for storage. Diagrams are kept in the Docker volumes; `down -v` deletes them.

## Views for a repo

Without any setup, a repo gets the default views in `flowviews.json`. Claude draws these, so their arrows are not proof-checked.

To give a repo its own views, create `flowviews.local.json` in the app folder. It is git-ignored, so your repos' names and details stay on your machine. When it exists it is used instead of `flowviews.json`, so start by copying that file:

```bash
cp flowviews.json flowviews.local.json
```

Then add your repo under `repos`. Each view is one question, read in the order listed. There are three kinds:

```jsonc
{
  "default": [ /* copied from flowviews.json */ ],
  "repos": {
    "owner/repo": [
      // 1. Folder tree: the exact folders from git, with your captions.
      {
        "id": "overview",
        "title": "What's in this repo",
        "tree": {
          "root": ".", "depth": 1,
          "captions": { "src": "The application code" },
          "links": [
            { "from": ".github", "to": "src", "label": "tests",
              "proof": { "path": ".github/workflows/ci.yml", "match": "run: make test" } }
          ],
          "explanation": "## What this shows\n..."
        }
      },
      // 2. Fact-checked flow: boxes and arrows you write, each arrow proven.
      {
        "id": "ci",
        "title": "When CI runs",
        "ref": "main",
        "facts": {
          "explanation": "## What this shows\n...",
          "groups": [{ "id": "g1", "label": "1. Trigger" }],
          "nodes": [
            { "id": "push", "label": "Push to main", "shape": "circle", "group": "g1" },
            { "id": "wf", "label": "CI workflow", "caption": "builds and tests",
              "path": ".github/workflows/ci.yml", "group": "g1" }
          ],
          "edges": [
            { "from": "push", "to": "wf", "label": "starts",
              "proof": { "path": ".github/workflows/ci.yml", "match": "branches: [main]" } }
          ]
        }
      },
      // 3. Claude-drawn: give it a question and the files to read.
      {
        "id": "api",
        "title": "How a request is handled",
        "focus": "Follow one HTTP request from the router to the database.",
        "sources": ["src/server/", "README.md"]
      }
    ]
  }
}
```

- `proof.match` must appear in the file on the view's branch. Whitespace is ignored. Use a list of proofs when an arrow needs more than one.
- `ref` makes a view read a branch other than the default one.
- The `explanation` text fills the Guide panel. It supports `## ` headings, `- ` bullets, `**bold**` and `` `code` ``.
- Keep labels and captions short, and without brackets or quotes, which the diagram renderer shows as junk.
- Edits apply without a restart. Press **Regenerate** on a view to rebuild it.

## Where things live

| What | Where |
|---|---|
| Your settings | `.env` (git-ignored) |
| Your repos' views | `flowviews.local.json` (git-ignored) |
| Auto-cloned repos | `~/.gitflowview/repos/<owner>/<repo>` (bare clones) |
| Generated diagrams | Docker volumes `redis-data` and `s3-data` |
| Your Claude and GitHub logins | Managed by the `claude` and `gh` CLIs; never read or stored by this app |

## Safety

- Clones are bare: no files are checked out, and nothing from the repo is run. The token is not written into them; `gh` supplies credentials to git for each call.
- Ask runs `claude` with only `git show`, `git grep`, `git ls-tree` and `git log` allowed, against the view's branch. It cannot write, delete or run anything else. Your Claude connectors and settings are switched off for these calls.
- The app only accepts requests from its own pages.

## Troubleshooting

| You see | Do this |
|---|---|
| "Couldn't generate the diagram", and the health check fails | Docker has stopped. Start Docker Desktop, then run `docker compose -f docker-compose.local.yml up -d`. Check with `curl localhost:3000/api/healthz`. |
| "Repository not found" | For a private repo, set `GH_AUTO_CLONE=1` or add it to `LOCAL_REPOS`, and check `gh auth status`. |
| "Couldn't clone owner/repo with your gh login" | Your GitHub account can't see that repo, or `gh` is signed out. |
| A view shows old code | Views read `origin/<branch>`. Auto-clones fetch every 5 minutes; for a `LOCAL_REPOS` clone, run `git fetch` in it, then Regenerate. |
| Arrows are missing, or listed under "Left out" in the Guide | The proof text is no longer in the file. Update the view in `flowviews.local.json`. |

## Development

```bash
bun run typecheck
bun run lint
bun run test      # some storage tests need Redis: REDIS_TEST_URL=redis://127.0.0.1:6390
```
