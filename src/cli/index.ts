import { parseArgs, getHelpText, ArgumentError } from './args.js';
import { getRepoInfo, hasBranch } from '../git/repository.js';
import { getCommits } from '../git/history.js';
import {
  buildRepositoryTimeline,
  buildCommitDetail,
  buildFileTimeline,
  buildSnapshotDetail,
  buildComparisonDetail,
  buildSearchResult,
  buildAuthorHistory
} from '../analysis/timeline.js';
import {
  renderTimeline,
  renderCommitDetail,
  renderFileTimeline,
  renderSnapshot,
  renderComparison,
  renderSearchResults,
  renderAuthorHistory,
  renderNotInsideGit,
  renderError
} from '../render/terminal.js';
import {
  renderTimelineJson,
  renderCommitDetailJson,
  renderFileTimelineJson,
  renderSnapshotJson,
  renderComparisonJson,
  renderSearchJson,
  renderAuthorJson
} from '../render/json.js';
import { startInteractiveSession, isTTYAvailable } from '../interactive/app.js';

export const VERSION = '0.1.0';

export async function runCli(argv: string[], defaultCwd?: string): Promise<number> {
  let options;
  try {
    options = parseArgs(argv);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    return 1;
  }

  const cwd = options.cwd || defaultCwd || process.cwd();

  if (options.help) {
    process.stdout.write(`${getHelpText()}\n`);
    return 0;
  }

  if (options.version) {
    process.stdout.write(`commit-time-machine v${VERSION}\n`);
    return 0;
  }

  // Repository detection
  const repo = await getRepoInfo(cwd);

  if (!repo.isGitRepo) {
    if (options.json) {
      process.stderr.write(JSON.stringify({ error: 'Not inside a Git repository.' }, null, 2) + '\n');
    } else {
      process.stderr.write(`${renderNotInsideGit()}\n`);
    }
    return 1;
  }

  try {
    // Mode: Interactive (-i / --interactive)
    if (options.interactive) {
      if (!isTTYAvailable()) {
        process.stderr.write('Interactive mode requires a TTY.\nUse the normal CLI output or --json instead.\n');
        return 1;
      }

      if (options.branch) {
        const branchExists = await hasBranch(options.branch, cwd);
        if (!branchExists) {
          throw new Error(`Branch "${options.branch}" was not found.`);
        }
      }

      if (!repo.hasCommits) {
        process.stdout.write('This repository has no history to travel through.\n');
        return 0;
      }

      const commits = await getCommits({
        cwd,
        limit: options.limit,
        since: options.since,
        firstParent: options.firstParent,
        branch: options.branch,
        search: options.search,
        author: options.author
      });

      if (commits.length === 0) {
        process.stdout.write('No commits matched the current filters.\n');
        return 0;
      }

      return await startInteractiveSession(repo, commits, cwd);
    }

    // Mode: Snapshot (--at)
    if (options.at) {
      const snapshot = await buildSnapshotDetail(options.at, cwd);
      if (options.json) {
        process.stdout.write(renderSnapshotJson(snapshot) + '\n');
      } else {
        process.stdout.write(renderSnapshot(snapshot) + '\n');
      }
      return 0;
    }

    // Mode: Comparison (--compare)
    if (options.compare) {
      const [c1, c2] = options.compare;
      const comparison = await buildComparisonDetail(c1, c2, cwd);
      if (options.json) {
        process.stdout.write(renderComparisonJson(comparison) + '\n');
      } else {
        process.stdout.write(renderComparison(comparison) + '\n');
      }
      return 0;
    }

    // Mode: Search (--search)
    if (options.search !== undefined) {
      const searchResult = await buildSearchResult(options.search, {
        cwd,
        limit: options.limit,
        branch: options.branch,
        firstParent: options.firstParent,
        since: options.since
      });
      if (options.json) {
        process.stdout.write(renderSearchJson(searchResult) + '\n');
      } else {
        process.stdout.write(renderSearchResults(searchResult) + '\n');
      }
      return 0;
    }

    // Mode: Author history (--author)
    if (options.author !== undefined) {
      const authorHistory = await buildAuthorHistory(options.author, {
        cwd,
        limit: options.limit,
        branch: options.branch,
        firstParent: options.firstParent,
        since: options.since
      });
      if (options.json) {
        process.stdout.write(renderAuthorJson(authorHistory) + '\n');
      } else {
        process.stdout.write(renderAuthorHistory(authorHistory, { verbose: options.verbose }) + '\n');
      }
      return 0;
    }

    // Mode: Single commit (--commit)
    if (options.commit) {
      const detail = await buildCommitDetail(options.commit, cwd);
      if (options.json) {
        process.stdout.write(renderCommitDetailJson(detail) + '\n');
      } else {
        process.stdout.write(renderCommitDetail(detail) + '\n');
      }
      return 0;
    }

    // Mode: File history (--file)
    if (options.file) {
      const fileTimeline = await buildFileTimeline(options.file, cwd, options.limit);
      if (options.json) {
        process.stdout.write(renderFileTimelineJson(fileTimeline) + '\n');
      } else {
        process.stdout.write(renderFileTimeline(fileTimeline, { verbose: options.verbose }) + '\n');
      }
      return 0;
    }

    // Mode: Default / Filtered timeline
    const timeline = await buildRepositoryTimeline({
      cwd,
      limit: options.limit,
      since: options.since,
      firstParent: options.firstParent,
      branch: options.branch
    });

    if (options.json) {
      process.stdout.write(renderTimelineJson(timeline) + '\n');
    } else {
      process.stdout.write(renderTimeline(timeline, { verbose: options.verbose }) + '\n');
    }
    return 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      process.stderr.write(JSON.stringify({ error: message }, null, 2) + '\n');
    } else {
      process.stderr.write(`${renderError(message)}\n`);
    }
    return 1;
  }
}
