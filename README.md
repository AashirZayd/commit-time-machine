# commit-time-machine

[![CI](https://github.com/AashirZayd/commit-time-machine/actions/workflows/ci.yml/badge.svg)](https://github.com/AashirZayd/commit-time-machine/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/commit-time-machine.svg)](https://www.npmjs.com/package/commit-time-machine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **Explore your repository's past.**  
> A human-friendly, read-only Git history explorer CLI for understanding how your project evolved over time.

---

## Overview

`commit-time-machine` interprets Git history and presents it as a structured evolutionary timeline. Instead of dumping raw commits that require manual correlation, it synthesizes directory focus, classifies change volume, inspects historical snapshots, and traces file evolution across renames—operating **100% read-only and offline**.

```text
git-wtf               →  "What's happening in my repository RIGHT NOW?"
commit-time-machine   →  "What happened in my repository BEFORE?"
```

---

## Quick Start

Install globally via npm or run directly with `npx`:

```bash
# Install globally
npm install -g commit-time-machine

# Run inside any Git repository
cd your-project
commit-time-machine

# Launch keyboard-driven interactive mode
commit-time-machine --interactive
```

### Common Commands

```bash
# Browse 20 recent commits with change volume & focus
commit-time-machine --limit 20

# View mainline / integration history only
commit-time-machine --first-parent

# Inspect repository snapshot structure at a historical commit
commit-time-machine --at HEAD~5

# Compare differences between two historical points
commit-time-machine --compare HEAD~5 HEAD

# Track file history across moves, renames, and deletions
commit-time-machine --file README.md

# Search commit messages (case-insensitive)
commit-time-machine --search "authentication"

# Filter commits by author
commit-time-machine --author "Aashir"

# Machine-readable structured JSON output
commit-time-machine --json
```

---

## Terminal Showcase

```text
$ commit-time-machine

COMMIT TIME MACHINE

Repository
  commit-time-machine

Branch
  main

Timeline
  ● 2026-09-07  fix(ci): ensure build distribution runs before test suite
  │
  ● 2026-09-07  feat: initial release of commit-time-machine v0.1.0

What's going on
  This repository has 2 recent commits.

Latest commit
  f4e6b2b
  fix(ci): ensure build distribution runs before test suite
```

---

## Features

- **Full Reachable History Traversal**: By default, traverses the complete commit DAG so commits from merged branches are never omitted.
- **Mainline Filter (`--first-parent`)**: Follow only the first parent of merge commits to isolate release integration history.
- **Historical Snapshots (`--at <commit>`)**: Inspect what the repository looked like at any historical commit (file count, directory structure, changes relative to parent) without checking out.
- **Range Comparisons (`--compare <c1> <c2>`)**: Compare differences between two points in history without modifying the working tree.
- **File History Across Renames (`--file <path>`)**: Follow file evolution across renames and deletions, even if the file is absent in the current working tree.
- **Commit Message Search (`--search "<query>"`)**: Case-insensitive substring search across reachable commits.
- **Author Filtering (`--author "<name>"`)**: Filter commits by author name or email pattern with activity metrics.
- **Branch Inspection (`--branch <branch>`)**: Explore history reachable from any local branch without switching branches or altering HEAD.
- **Time Filtering (`--since <expr>`)**: Filter commits using natural Git date expressions (e.g. `"14 days ago"`, `"2026-09-01"`).
- **Interactive Terminal Mode (`-i, --interactive`)**: Full keyboard-driven navigation with commit detail view and bounded diff previews.
- **Deterministic Interpretation**: Classifies churn magnitude (`Small`, `Medium`, `Large`) and directory focus from observable facts—no AI hallucination.
- **Structured JSON Mode (`--json`)**: Clean, machine-readable output with mode discriminators for scripting and automation.
- **Strictly Read-Only & Safe**: Zero working-tree modifications. Never runs checkout, switch, reset, stash, or merge.
- **100% Offline & Private**: Zero external network requests, zero telemetry, zero analytics tracking.

---

## Interactive Mode (`--interactive` / `-i`)

Explore commits forward and backward in an interactive terminal timeline with detail inspection and bounded diff previews:

```bash
commit-time-machine --interactive
# or combine with branch/limit filters:
commit-time-machine -i --branch main --limit 20
```

### Keyboard Controls

| Key | Action |
|---|---|
| `↑` / `↓` or `k` / `j` | Navigate commits up / down |
| `Enter` | Inspect selected commit details & touched files |
| `d` | Open bounded diff preview (from commit detail view) |
| `Esc` / `Backspace` | Return to previous view |
| `q` | Exit cleanly and restore terminal screen |

- **TTY Required**: Interactive mode requires an interactive terminal. In non-TTY environments (CI runners, pipes, redirects), it exits gracefully with clear diagnostic guidance.
- **Bounded Diff Previews**: Diff previews are capped to 80 lines to maintain fluid terminal performance.
- **Clean Terminal Restoration**: Uses alternative screen buffers and restores cursor and raw-mode settings on exit.
- **Safe Execution**: Never mutates Git state, checks out branches, or touches repository files.

---

## Command Reference

| Command / Option | Description |
|---|---|
| `commit-time-machine` | Display recent repository timeline (full reachable DAG) |
| `-i, --interactive` | Launch interactive terminal mode |
| `--first-parent` | Mainline / integration history only |
| `--at <commit>` | Inspect historical repository snapshot at specified commit |
| `--compare <c1> <c2>` | Compare differences between two historical points |
| `--file <path>` | Track evolutionary history of a specific file |
| `--search "<query>"` | Search commit messages for matching query |
| `--author "<name>"` | Filter commits by author or email |
| `--branch <branch>` | Inspect history reachable from a specific local branch |
| `--commit <hash>` | Deep-dive into a single commit with file status badges |
| `--limit <n>` | Number of commits to display (default: `10`) |
| `--since <expr>` | Filter commits by date expression (e.g. `"2 weeks ago"`) |
| `--verbose` | Detailed per-commit author, file list, and churn metrics |
| `--json` | Output pure structured JSON without banners or ANSI escape codes |
| `-h, --help` | Display usage instructions and examples |
| `-v, --version` | Display version number |

---

## JSON / Automation

When `--json` is provided, stdout contains strictly valid, machine-readable JSON with a top-level `"mode"` discriminator (`timeline`, `snapshot`, `compare`, `search`, `author`, `commit`, `file`). Ideal for scripting, dashboards, and automated Git analysis:

```bash
commit-time-machine --json --limit 5 | jq '.interpretation.focusArea'
```

Example JSON payload:

```json
{
  "mode": "timeline",
  "repository": "commit-time-machine",
  "rootPath": "/path/to/commit-time-machine",
  "branch": "main",
  "isDetached": false,
  "head": "f4e6b2bb525526cb0eb3045e98261f1c68307b62",
  "isFirstParentOnly": false,
  "totalCommits": 2,
  "commits": [
    {
      "hash": "f4e6b2bb525526cb0eb3045e98261f1c68307b62",
      "shortHash": "f4e6b2b",
      "author": "Aashir Zayd",
      "date": "2026-09-07",
      "subject": "fix(ci): ensure build distribution runs before test suite",
      "parents": ["702113b..."],
      "isMerge": false,
      "churnMagnitude": "Small",
      "filesChanged": 2,
      "additions": 4,
      "deletions": 3,
      "files": [
        {
          "path": ".github/workflows/ci.yml",
          "oldPath": null,
          "status": "M",
          "additions": 3,
          "deletions": 2,
          "isBinary": false
        }
      ]
    }
  ],
  "interpretation": {
    "summary": "This repository has 2 recent commits.",
    "focusArea": "ci",
    "observableFacts": [
      "Activity spans 2026-09-07",
      "1 active contributor"
    ]
  }
}
```

---

## Why This Exists

`git log` is the universal standard for querying Git history, but it primarily lists raw commits. When onboarding to a new codebase, auditing a feature branch, or investigating regressions, developers need answers to higher-level questions:

- *How did this project evolve to where it is today?*
- *What was the focus of recent development?*
- *What did the project structure look like 3 months ago?*
- *What files actually changed between release A and release B?*
- *How has a specific configuration or documentation file evolved over time?*

`commit-time-machine` serves as an **interpretation and exploration layer** over Git history. It does not replace Git; it complements it by turning raw commit data into an accessible, human-readable timeline.

---

## Safety & Design Principles

- **100% Read-Only**: Never executes `git checkout`, `git switch`, `git reset`, `git restore`, `git commit`, `git merge`, `git rebase`, `git pull`, `git push`, `git clean`, or `git stash`.
- **Working Tree Untouched**: Inspection of past commits (`--at`, `--compare`, `--branch`) relies on read-only object inspection (`git ls-tree`, `git diff-tree`, `git show`). Your working directory and HEAD remain 100% untouched.
- **100% Offline & Private**: Zero network access, zero telemetry, zero analytics tracking. Operates exclusively on your local repository clone.

---

## Architecture

`commit-time-machine` is built with a strictly decoupled pipeline:

```text
Git Plumbing Collector (git/runner.ts, git/history.ts, git/snapshot.ts, git/compare.ts)
  ↓ Direct execFile argument vectors (no shell interpolation, LC_ALL: C)
Analysis & Churn Engine (analysis/stats.ts, analysis/timeline.ts)
  ↓ Churn magnitude classification, directory clustering, burst detection
Interpretation Engine (analysis/interpreter.ts)
  ↓ Deterministic, fact-based synthesis (no AI hallucination)
Rendering Layer (render/terminal.ts, render/json.ts)
  ↓ High-hierarchy terminal presentation or pure JSON serialization
CLI / Interactive UI (cli/index.ts, interactive/app.ts)
```

The interactive terminal mode consumes the exact same analysis engine rather than implementing a separate query layer.

---

## Limitations

- **Interactive Mode Requires a TTY**: Piped streams, redirect operators, and automated CI runners cannot enter interactive mode. Use standard terminal output or `--json` instead.
- **Bounded Diff Previews**: The interactive diff preview is intentionally bounded to 80 lines to ensure instantaneous terminal rendering. To inspect multi-thousand-line patches, use `git show <hash>`.
- **Local Scope**: All operations query the local repository clone. Commits must be fetched locally to be explored.
- **In-Memory Limits**: Queries requesting massive histories (`--limit 50000`) load commit metadata into memory for clustering and churn calculation.

---

## Roadmap

Planned future explorations:

- Richer terminal graphs for complex branch merge topologies
- Configurable interactive diff viewer scrolling and paging
- Extended directory cluster metrics across custom time windows
- Support for mailmap author aliasing

---

## Developer Toolkit

Part of a pair of complementary developer tools by [Aashir Zayd](https://github.com/AashirZayd):

- [git-wtf](https://github.com/AashirZayd/git-wtf): Understand what's happening in your repository **right now**.
- [commit-time-machine](https://github.com/AashirZayd/commit-time-machine): Understand what happened in your repository **before**.

---

## License

[MIT](LICENSE) © 2026 Aashir Zayd
