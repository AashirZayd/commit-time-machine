# commit-time-machine

> A human-friendly Git history explorer that interprets repository evolution over time.

---

## Overview

Most Git tools dump raw commits and require developers to manually decode history:

```bash
git-wtf               →  "What's happening in my repository RIGHT NOW?"
commit-time-machine   →  "What happened in my repository BEFORE?"
```

`commit-time-machine` collects Git history, analyzes file modifications and directory clusters, detects commit patterns, and renders a clear, human-readable timeline. It lets you travel through a repository's history, view snapshots at any commit, compare historical points in time, and search commits by message or author.

---

## Quick Start

Install globally via npm or run directly with `npx`:

```bash
# Global install
npm install -g commit-time-machine

# Run in any Git repository
cd your-project
commit-time-machine

# Launch interactive timeline
commit-time-machine --interactive
```

### Useful Commands

```bash
# Show 20 recent commits
commit-time-machine --limit 20

# View mainline / merge history only
commit-time-machine --first-parent

# Inspect repository snapshot structure at a historical commit
commit-time-machine --at HEAD~5

# Compare two historical commits
commit-time-machine --compare HEAD~5 HEAD

# Track file history across renames and deletions
commit-time-machine --file README.md

# Search commit messages
commit-time-machine --search "authentication"

# Filter by author
commit-time-machine --author "Aashir"
```

---

## Key Features

- **Full Reachable History Traversal**: Default timeline traverses the complete commit DAG, ensuring commits from merged feature branches are not silently omitted.
- **Mainline Filter (`--first-parent`)**: View release/integration mainline history by following first parents upon merges.
- **Time Travel Snapshot (`--at <commit>`)**: Inspect what the repository looked like at any historical point in time (structure, total files, top-level directories, changes relative to parent) with zero working-tree modifications.
- **Historical Range Comparison (`--compare <commit1> <commit2>`)**: Compare differences between two arbitrary points in history without checking out either commit.
- **Commit Message Search (`--search "<term>"`)**: Fast, case-insensitive message search across the repository or a specific branch.
- **Author History (`--author "<name>"`)**: Filter commits by author or email pattern, displaying activity counts and recent work.
- **Branch Inspection (`--branch <branch>`)**: Explore history reachable from any local branch without switching branches or altering HEAD.
- **High-Churn Detection**: Deterministic classification of commit change volume (`Small`, `Medium`, `Large` relative to repository baseline).
- **Single Commit Deep-Dive (`--commit <hash>`)**: Detailed inspection with file status badges (`M`, `A`, `D`, `R`), line churn, and observable explanations.
- **File History Across Renames & Deletions (`--file <path>`)**: Follows file evolution even if the file was later renamed or deleted in the working tree.
- **Structured JSON Mode (`--json`)**: Emits pure, validated JSON with unified `"mode"` discriminators (`timeline`, `snapshot`, `compare`, `search`, `author`, `commit`, `file`).
- **Strictly Observer / Non-Destructive**: 100% read-only Git plumbing. Never executes checkout, switch, reset, merge, rebase, or clean.
- **100% Offline & Private**: Zero telemetry, zero analytics, zero external network requests.

---

## Command Reference

### Primary Query Modes

| Command / Flag | Action |
|---|---|
| `commit-time-machine` | Show recent repository timeline (full reachable commit DAG) |
| `commit-time-machine -i, --interactive` | Browse repository history interactively in terminal |
| `commit-time-machine --first-parent` | Show mainline / integration history only |
| `commit-time-machine --at <commit>` | Inspect historical repository snapshot at that commit |
| `commit-time-machine --compare <c1> <c2>` | Compare differences between two points in history |
| `commit-time-machine --search "<term>"` | Search commit messages for matching query |
| `commit-time-machine --author "<name>"` | Show commits authored by `<name>` |
| `commit-time-machine --commit <hash>` | Deep-dive into a specific commit |
| `commit-time-machine --file <path>` | Show evolutionary history of a specific file |

---

### Interactive Time Machine (`--interactive` / `-i`)

Explore commits backward and forward in an interactive terminal timeline with detail inspection and bounded diff previews:

```bash
$ commit-time-machine --interactive
# or with filters:
$ commit-time-machine -i --branch main --limit 20
```

#### Keyboard Controls

| Key | Action |
|---|---|
| `↑` / `↓` or `k` / `j` | Navigate commits |
| `Enter` | Inspect commit detail |
| `d` | Diff preview (from detail view) |
| `Esc` / `Backspace` | Back to previous view |
| `q` | Quit interactive mode |

- **Requires a TTY**: Non-interactive environments exit cleanly with actionable advice.
- **Strictly Read-Only**: Observes history without touching HEAD, branches, or working-tree files.
- **Filter-Friendly**: Combines naturally with `--branch`, `--first-parent`, `--limit`, `--since`, `--search`, and `--author`.

### Filters & Modifiers

| Flag / Option | Description |
|---|---|
| `--branch <branch>` | Inspect history reachable from specified local branch |
| `--limit <n>` | Number of commits to display (default: `10`, validated positive integer) |
| `--since <expr>` | Filter commits by Git date expression (e.g. `"14 days ago"`, `"2026-09-01"`) |
| `--verbose` | Detailed per-commit author, file list, and churn metrics |
| `--json` | Output pure structured JSON without banners or ANSI escape codes |
| `-h, --help` | Display usage instructions and examples |
| `-v, --version` | Display version number (`0.1.0`) |

---

## Example Outputs

### 1. Default Timeline vs. Mainline (`--first-parent`)

#### Default (Full Reachable History)
```
COMMIT TIME MACHINE

Repository
  my-project

Branch
  main

Timeline
  ● 2026-09-07  Merge branch 'feature' [merge]
  │
  ● 2026-09-07  feat(feature): implement authentication
  │
  ● 2026-09-07  feat(feature): add user schema
  │
  ● 2026-09-06  docs: update readme

What's going on
  This repository has 4 recent commits.

Latest commit
  a77b9f5 (merge commit)
  Merge branch 'feature'
```

#### Mainline Only (`--first-parent`)
```
$ commit-time-machine --first-parent

COMMIT TIME MACHINE

Repository
  my-project

History View
  First-parent / Mainline only

Timeline
  ● 2026-09-07  Merge branch 'feature' [merge]
  │
  ● 2026-09-06  docs: update readme

What's going on
  This repository has 2 recent commits.
```

---

### 2. Time Travel Snapshot (`--at <commit>`)

```
$ commit-time-machine --at 3853e59

COMMIT TIME MACHINE

Time
  3853e59
  fix(site): polish mobile layout

Repository at this point
  Branch context: main
  Commit date: 2026-09-06
  Author: Aashir Zayd <aashir@example.com>
  Total files: 42 files

Snapshot structure
  src/
  site/
  tests/
  README.md
  package.json

Files touched
  M  site/index.html
  M  site/styles/main.css

What's going on
  This snapshot represents the repository at commit 3853e59, containing 42 files across 5 root items.
  → Total repository size at this commit: 42 files
  → 2 files modified in this commit (+18 / -4 lines)
  → Reachable from branch: main
```

---

### 3. Historical Comparison (`--compare <c1> <c2>`)

```
$ commit-time-machine --compare 2a8cc2f 3853e59

COMPARISON

2a8cc2f
  feat: initial open-source release

        ↓

3853e59
  fix(site): polish mobile layout

Changes
  5 files changed
  +142
  -27

Areas
  site/
  README.md

What's going on
  Between 2a8cc2f and 3853e59, 5 files changed (+142 / -27 lines). The repository evolved primarily through website and documentation changes during this period.

Files
  M README.md
  M site/index.html
  M site/styles/main.css
  A site/scripts/app.js
```

---

### 4. Commit Message Search (`--search "<term>"`)

```
$ commit-time-machine --search "landing page"

SEARCH RESULTS

"landing page"
2 commits found

● 3853e59  2026-09-06
  fix(site): polish mobile layout

● 381d0c5  2026-09-05
  feat(site): redesign landing page
```

---

### 5. Author History (`--author "<name>"`)

```
$ commit-time-machine --author "Aashir Zayd"

AUTHOR HISTORY

Aashir Zayd

12 commits

Latest
  3853e59
  fix(site): polish mobile layout

Timeline
  ● 2026-09-06  fix(site): polish mobile layout
  │
  ● 2026-09-05  feat(site): redesign landing page
```

---

## JSON Output Mode

When `--json` is supplied, stdout contains strictly valid, machine-readable JSON with a top-level `"mode"` discriminator:

```json
{
  "mode": "timeline",
  "repository": "my-project",
  "rootPath": "/projects/my-project",
  "branch": "main",
  "isDetached": false,
  "head": "3853e59...",
  "isFirstParentOnly": false,
  "totalCommits": 5,
  "commits": [
    {
      "hash": "3853e59...",
      "shortHash": "3853e59",
      "author": "Aashir Zayd",
      "email": "aashir@example.com",
      "date": "2026-09-06",
      "subject": "fix(site): polish mobile layout",
      "parents": ["a1b2c3d..."],
      "isMerge": false,
      "churnMagnitude": "Small",
      "filesChanged": 2,
      "additions": 18,
      "deletions": 4,
      "files": [
        {
          "path": "site/index.html",
          "oldPath": null,
          "status": "M",
          "additions": 10,
          "deletions": 2,
          "isBinary": false
        }
      ]
    }
  ],
  "interpretation": {
    "summary": "This repository has 5 recent commits.\nMost recent activity is focused on the website.",
    "focusArea": "website",
    "observableFacts": [
      "Activity spans from 2026-09-04 to 2026-09-06",
      "1 active contributor"
    ]
  }
}
```

---

## Architecture

`commit-time-machine` enforces strict separation across layers:

```
Git Process Layer (git/runner.ts)
  ↓ Direct execFile argument vectors (no shell interpolation, buffer protection, LC_ALL: C)
Git Plumbing & Extraction
  ├─ git/repository.ts   (repo detection, branch vs. detached HEAD, hasBranch validation)
  ├─ git/history.ts      (null-delimited log/show parser, search, author, branch, follow renames)
  ├─ git/snapshot.ts     (read-only git ls-tree snapshot structure & file counts)
  └─ git/compare.ts      (read-only git diff-tree range comparator)
Analysis & Churn Engine (analysis/stats.ts, analysis/timeline.ts)
  ↓ Churn magnitude classification (Small / Medium / Large), directory clustering, bursts
Interpretation Engine (analysis/interpreter.ts)
  ↓ Deterministic, fact-based synthesis (no AI hallucination)
Rendering Layer (render/terminal.ts, render/json.ts)
  ↓ High-hierarchy terminal presentation or pure JSON serializer
CLI Dispatcher (cli/index.ts, cli/args.ts)
```

---

## Safety Guarantees

- **Read-Only Observer**: `commit-time-machine` never modifies repository state. It will never run `git checkout`, `git switch`, `git reset`, `git restore`, `git commit`, `git merge`, `git rebase`, `git pull`, `git push`, `git clean`, or `git stash`.
- **Working Tree & HEAD Untouched**: Inspection of past commits (`--at`, `--compare`, `--branch`) uses read-only object inspection (`git ls-tree`, `git diff-tree`, `git show`). Working tree files and current branch pointers remain 100% untouched.
- **100% Offline**: No network access, telemetry, or remote repository requests.

---

## Development & Testing

```bash
# Build TypeScript to dist/
npm run build

# Run Vitest test suite
npm test

# Typecheck without emitting
npm run lint

# Package validation
npm pack --dry-run
```

---

## Limitations

- **Interactive Mode Requires a TTY**: Non-interactive shells (pipes, redirect operators, CI scripts) cannot enter interactive mode. Use standard terminal output or `--json` instead.
- **Bounded Diff Previews**: The interactive diff preview is intentionally bounded to preserve responsive terminal performance. To inspect full multi-thousand-line patches, use standard `git show <hash>`.
- **Local Scope**: All operations inspect history present in your local repository clone. It does not perform network fetches from remotes.
- **In-Memory Limits**: Very large history queries (`--limit 50000`) load commits into memory for clustering and churn calculation.

---

## License

MIT License. Copyright (c) 2026 Aashir Zayd.
