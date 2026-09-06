import pc from 'picocolors';
import type {
  RepositoryTimeline,
  CommitDetail,
  FileTimeline,
  SnapshotDetail,
  ComparisonDetail,
  SearchResult,
  AuthorHistory
} from '../types/index.js';
import { formatStatus, formatAdditions, formatDeletions, indent } from './formatters.js';

export function renderHeader(title: string = 'COMMIT TIME MACHINE'): string {
  return pc.bold(title);
}

export function renderNotInsideGit(): string {
  return [
    renderHeader(),
    '',
    `${pc.red('✗')} Not inside a Git repository.`,
    '',
    'Run this command from a Git repository.'
  ].join('\n');
}

export function renderError(message: string): string {
  return [
    renderHeader(),
    '',
    `${pc.red('✗')} ${message}`
  ].join('\n');
}

export function renderTimeline(timeline: RepositoryTimeline, options: { verbose?: boolean } = {}): string {
  const lines: string[] = [renderHeader(), ''];

  // Repository section
  lines.push(pc.bold('Repository'));
  lines.push(`  ${timeline.repo.repoName}`);
  lines.push('');

  // Branch or detached HEAD
  if (timeline.branchFilter) {
    lines.push(pc.bold('Branch (Filter)'));
    lines.push(`  ${timeline.branchFilter}`);
    lines.push('');
  } else if (timeline.repo.isDetached && timeline.repo.shortHeadHash) {
    lines.push(pc.bold('HEAD'));
    lines.push(`  detached at ${timeline.repo.shortHeadHash}`);
    lines.push('');
  } else if (timeline.repo.branch) {
    lines.push(pc.bold('Branch'));
    lines.push(`  ${timeline.repo.branch}`);
    lines.push('');
  }

  // First-parent indicator
  if (timeline.isFirstParentOnly) {
    lines.push(pc.bold('History View'));
    lines.push(`  First-parent / Mainline only`);
    lines.push('');
  }

  // Timeline section
  lines.push(pc.bold('Timeline'));

  if (!timeline.repo.hasCommits || timeline.commits.length === 0) {
    lines.push('  No commits yet.');
    lines.push('');
    lines.push(pc.bold("What's going on"));
    lines.push(`  ${timeline.interpretation.summary}`);
    return lines.join('\n');
  }

  // Render commits list with timeline glyphs
  const commitLines: string[] = [];
  for (let i = 0; i < timeline.commits.length; i++) {
    const commit = timeline.commits[i];
    const isLast = i === timeline.commits.length - 1;
    const bullet = pc.cyan('●');
    const pipe = pc.dim('│');

    const mergeLabel = commit.isMerge ? pc.magenta(' [merge]') : '';
    commitLines.push(`  ${bullet} ${pc.dim(commit.date)}  ${commit.subject}${mergeLabel}`);

    if (options.verbose) {
      commitLines.push(`    ${pc.dim('commit')} ${pc.yellow(commit.shortHash)} ${pc.dim('by')} ${commit.author}`);
      const fileWord = commit.files.length === 1 ? 'file' : 'files';
      commitLines.push(
        `    ${commit.files.length} ${fileWord} changed (${formatAdditions(commit.additions)}, ${formatDeletions(commit.deletions)})`
      );
      for (const file of commit.files.slice(0, 5)) {
        const statusBadge = formatStatus(file.status);
        if (file.status === 'R' && file.oldPath) {
          commitLines.push(`    ${statusBadge} ${file.oldPath} → ${file.path}`);
        } else if (file.isBinary) {
          commitLines.push(`    ${statusBadge} ${file.path} ${pc.dim('(Binary file changed)')}`);
        } else {
          commitLines.push(`    ${statusBadge} ${file.path}`);
        }
      }
      if (commit.files.length > 5) {
        commitLines.push(`    ${pc.dim(`... and ${commit.files.length - 5} more files`)}`);
      }
    }

    if (!isLast) {
      commitLines.push(`  ${pipe}`);
    }
  }

  lines.push(commitLines.join('\n'));
  lines.push('');

  // What's going on section
  lines.push(pc.bold("What's going on"));
  lines.push(indent(timeline.interpretation.summary, 2));
  lines.push('');

  // Latest commit section
  const latest = timeline.commits[0];
  if (latest) {
    lines.push(pc.bold('Latest commit'));
    const mergeSuffix = latest.isMerge ? pc.magenta(' (merge commit)') : '';
    lines.push(`  ${pc.yellow(latest.shortHash)}${mergeSuffix}`);
    lines.push(`  ${latest.subject}`);
  }

  return lines.join('\n');
}

export function renderCommitDetail(detail: CommitDetail): string {
  const { commit, interpretation } = detail;
  const isMerge = commit.isMerge;
  const lines: string[] = [pc.bold(isMerge ? 'MERGE' : 'COMMIT'), ''];

  // Hash and subject
  lines.push(pc.yellow(commit.hash));
  if (isMerge) {
    lines.push(pc.magenta('merge commit'));
  }
  lines.push(pc.bold(commit.subject));

  const bodyNotes = commit.body.startsWith(commit.subject)
    ? commit.body.slice(commit.subject.length).trim()
    : commit.body !== commit.subject
      ? commit.body.trim()
      : '';

  if (bodyNotes) {
    lines.push('');
    lines.push(indent(bodyNotes, 2));
  }
  lines.push('');

  // Parents for merge
  if (isMerge && commit.parents.length > 0) {
    lines.push(pc.bold('Parents'));
    for (const parent of commit.parents) {
      lines.push(`  ${pc.yellow(parent.substring(0, 7))} (${parent})`);
    }
    lines.push('');
  }

  // Author
  lines.push(pc.bold('Author'));
  lines.push(`  ${commit.author} <${commit.email}>`);
  lines.push('');

  // Date
  lines.push(pc.bold('Date'));
  lines.push(`  ${commit.date}`);
  lines.push('');

  // Changes
  lines.push(pc.bold('Changes'));
  const fileWord = commit.files.length === 1 ? 'file' : 'files';
  lines.push(`  ${commit.files.length} ${fileWord} changed`);
  lines.push(`  ${formatAdditions(commit.additions)}`);
  lines.push(`  ${formatDeletions(commit.deletions)}`);
  lines.push('');

  // Files
  lines.push(pc.bold('Files'));
  if (commit.files.length === 0) {
    if (isMerge) {
      lines.push('  Merge resolution with no direct file conflicts');
    } else {
      lines.push('  No files changed');
    }
  } else {
    for (const file of commit.files) {
      const badge = formatStatus(file.status);
      if (file.status === 'R' && file.oldPath) {
        lines.push(`  ${badge}  ${file.oldPath} → ${file.path}`);
      } else if (file.isBinary) {
        lines.push(`  ${badge}  ${file.path} ${pc.dim('(Binary file changed)')}`);
      } else {
        lines.push(`  ${badge}  ${file.path}`);
      }
    }
  }
  lines.push('');

  // What's going on
  lines.push(pc.bold("What's going on"));
  lines.push(indent(interpretation.summary, 2));
  if (interpretation.observableFacts.length > 0) {
    for (const fact of interpretation.observableFacts) {
      lines.push(pc.dim(`  → ${fact}`));
    }
  }

  return lines.join('\n');
}

export function renderSnapshot(snapshot: SnapshotDetail): string {
  const lines: string[] = [renderHeader(), ''];
  const { commit, topLevelEntries, branchContext, totalFiles, interpretation } = snapshot;

  lines.push(pc.bold('Time'));
  lines.push(`  ${pc.yellow(commit.shortHash)}`);
  lines.push(`  ${commit.subject}`);
  lines.push('');

  lines.push(pc.bold('Repository at this point'));
  if (branchContext) {
    lines.push(`  Branch context: ${branchContext}`);
  }
  lines.push(`  Commit date: ${commit.date}`);
  lines.push(`  Author: ${commit.author}`);
  const totalFileWord = totalFiles === 1 ? 'file' : 'files';
  lines.push(`  Total files: ${totalFiles} ${totalFileWord}`);
  lines.push('');

  lines.push(pc.bold('Snapshot structure'));
  for (const item of topLevelEntries.slice(0, 15)) {
    if (item.type === 'tree') {
      lines.push(`  ${pc.blue(`${item.name}/`)}`);
    } else {
      lines.push(`  ${item.name}`);
    }
  }
  if (topLevelEntries.length > 15) {
    lines.push(`  ${pc.dim(`... and ${topLevelEntries.length - 15} more root items`)}`);
  }
  lines.push('');

  // Files touched in this commit
  lines.push(pc.bold('Files touched'));
  if (commit.files.length === 0) {
    lines.push('  No files directly changed');
  } else {
    for (const file of commit.files.slice(0, 10)) {
      const badge = formatStatus(file.status);
      if (file.status === 'R' && file.oldPath) {
        lines.push(`  ${badge} ${file.oldPath} → ${file.path}`);
      } else if (file.isBinary) {
        lines.push(`  ${badge} ${file.path} ${pc.dim('(Binary file changed)')}`);
      } else {
        lines.push(`  ${badge} ${file.path}`);
      }
    }
    if (commit.files.length > 10) {
      lines.push(`  ${pc.dim(`... and ${commit.files.length - 10} more files`)}`);
    }
  }
  lines.push('');

  lines.push(pc.bold("What's going on"));
  lines.push(indent(interpretation.summary, 2));
  for (const fact of interpretation.observableFacts) {
    lines.push(pc.dim(`  → ${fact}`));
  }

  return lines.join('\n');
}

export function renderComparison(comparison: ComparisonDetail): string {
  const lines: string[] = [pc.bold('COMPARISON'), ''];
  const { baseCommit, targetCommit, files, additions, deletions, affectedAreas, interpretation } = comparison;

  lines.push(pc.yellow(baseCommit.shortHash));
  lines.push(`  ${baseCommit.subject}`);
  lines.push('');
  lines.push('        ↓');
  lines.push('');
  lines.push(pc.yellow(targetCommit.shortHash));
  lines.push(`  ${targetCommit.subject}`);
  lines.push('');

  lines.push(pc.bold('Changes'));
  const fileWord = files.length === 1 ? 'file' : 'files';
  lines.push(`  ${files.length} ${fileWord} changed`);
  lines.push(`  ${formatAdditions(additions)}`);
  lines.push(`  ${formatDeletions(deletions)}`);
  lines.push('');

  if (affectedAreas.length > 0) {
    lines.push(pc.bold('Areas'));
    for (const area of affectedAreas) {
      lines.push(`  ${area}`);
    }
    lines.push('');
  }

  lines.push(pc.bold("What's going on"));
  lines.push(indent(interpretation.summary, 2));
  lines.push('');

  lines.push(pc.bold('Files'));
  if (files.length === 0) {
    lines.push('  No differences between these two commits.');
  } else {
    for (const file of files.slice(0, 15)) {
      const badge = formatStatus(file.status);
      if (file.status === 'R' && file.oldPath) {
        lines.push(`  ${badge} ${file.oldPath} → ${file.path}`);
      } else if (file.isBinary) {
        lines.push(`  ${badge} ${file.path} ${pc.dim('(Binary file changed)')}`);
      } else {
        lines.push(`  ${badge} ${file.path}`);
      }
    }
    if (files.length > 15) {
      lines.push(`  ${pc.dim(`... and ${files.length - 15} more files`)}`);
    }
  }

  return lines.join('\n');
}

export function renderSearchResults(search: SearchResult): string {
  const lines: string[] = [pc.bold('SEARCH RESULTS'), ''];
  const count = search.matches.length;
  const commitWord = count === 1 ? 'commit' : 'commits';

  lines.push(`"${search.searchTerm}"`);
  lines.push(`${count} ${commitWord} found`);
  lines.push('');

  if (count === 0) {
    lines.push(indent(search.interpretation.summary, 2));
    return lines.join('\n');
  }

  for (let i = 0; i < search.matches.length; i++) {
    const commit = search.matches[i];
    const bullet = pc.cyan('●');
    lines.push(`${bullet} ${pc.yellow(commit.shortHash)}  ${pc.dim(commit.date)}`);
    lines.push(`  ${commit.subject}`);
    if (i < search.matches.length - 1) {
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function renderAuthorHistory(authorHistory: AuthorHistory, options: { verbose?: boolean } = {}): string {
  const lines: string[] = [pc.bold('AUTHOR HISTORY'), ''];
  const { authorName, totalCommits, commits, latestCommit } = authorHistory;
  const commitWord = totalCommits === 1 ? 'commit' : 'commits';

  lines.push(pc.bold(authorName));
  lines.push('');
  lines.push(`${totalCommits} ${commitWord}`);
  lines.push('');

  if (totalCommits === 0) {
    lines.push(indent(authorHistory.interpretation.summary, 2));
    return lines.join('\n');
  }

  if (latestCommit) {
    lines.push(pc.bold('Latest'));
    lines.push(`  ${pc.yellow(latestCommit.shortHash)}`);
    lines.push(`  ${latestCommit.subject}`);
    lines.push('');
  }

  lines.push(pc.bold('Timeline'));
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const isLast = i === commits.length - 1;
    const bullet = pc.cyan('●');
    const pipe = pc.dim('│');

    lines.push(`  ${bullet} ${pc.dim(commit.date)}  ${commit.subject}`);
    if (options.verbose) {
      lines.push(`    ${pc.dim('commit')} ${pc.yellow(commit.shortHash)} (+${commit.additions}, -${commit.deletions})`);
    }
    if (!isLast) {
      lines.push(`  ${pipe}`);
    }
  }

  return lines.join('\n');
}

export function renderFileTimeline(fileTimeline: FileTimeline, options: { verbose?: boolean } = {}): string {
  const lines: string[] = [pc.bold('FILE HISTORY'), ''];

  lines.push(pc.bold(fileTimeline.filePath));
  lines.push('');

  if (fileTimeline.entries.length === 0) {
    lines.push('  No history found for this file.');
    lines.push('');
    lines.push(pc.bold("What's going on"));
    lines.push(`  ${fileTimeline.interpretation.summary}`);
    return lines.join('\n');
  }

  for (let i = 0; i < fileTimeline.entries.length; i++) {
    const entry = fileTimeline.entries[i];
    const isLast = i === fileTimeline.entries.length - 1;
    const bullet = pc.cyan('●');

    lines.push(`${bullet} ${pc.dim(entry.date)}`);
    lines.push(`  ${entry.subject}`);

    if (options.verbose) {
      const badge = formatStatus(entry.status);
      if (entry.status === 'R' && entry.oldPath) {
        lines.push(`  ${pc.dim('at')} ${pc.yellow(entry.shortHash)} by ${entry.author} [${badge} ${entry.oldPath} → ${entry.path}]`);
      } else {
        lines.push(`  ${pc.dim('at')} ${pc.yellow(entry.shortHash)} by ${entry.author} [${badge}]`);
      }
    }

    if (!isLast) {
      lines.push('');
    }
  }

  return lines.join('\n');
}
