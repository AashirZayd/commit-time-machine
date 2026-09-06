import pc from 'picocolors';
import type { InteractiveState } from './types.js';
import { getVisibleCommitRowsCount } from './state.js';
import { formatStatus, formatAdditions, formatDeletions } from '../render/formatters.js';
import { interpretCommit } from '../analysis/interpreter.js';

export function truncate(text: string, maxLength: number): string {
  if (maxLength <= 3) return text.substring(0, maxLength);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function drawSeparator(width: number): string {
  const lineLength = Math.max(20, Math.min(width, 80));
  return pc.dim('─'.repeat(lineLength));
}

export function renderTimelineScreen(state: InteractiveState): string {
  const { repo, commits, selectedIndex, scrollOffset, terminalWidth, terminalHeight } = state;
  const lines: string[] = [];

  // Header
  lines.push(pc.bold('COMMIT TIME MACHINE'));
  lines.push(drawSeparator(terminalWidth));

  const branchLabel = repo.branch ? repo.branch : repo.isDetached ? `detached at ${repo.shortHeadHash}` : 'HEAD';
  const commitCountLabel = commits.length === 1 ? '1 commit' : `${commits.length} commits`;
  lines.push(`${pc.cyan(branchLabel)} • ${pc.dim(commitCountLabel)}`);
  lines.push('');

  // Commit List
  const visibleRows = getVisibleCommitRowsCount(terminalHeight);
  const endIndex = Math.min(commits.length, scrollOffset + visibleRows);

  if (commits.length === 0) {
    lines.push(pc.dim('  No commits in this view.'));
  } else {
    for (let i = scrollOffset; i < endIndex; i++) {
      const commit = commits[i];
      const isSelected = i === selectedIndex;
      const selector = isSelected ? pc.cyan(pc.bold('> ')) : '  ';

      // Fixed width components:
      // Selector: 2 chars
      // Date: 10 chars
      // Gap: 2
      // Hash: 7 chars
      // Gap: 2
      // Total fixed before subject: 23 chars
      const dateStr = pc.dim(commit.date);
      const hashStr = isSelected ? pc.bold(pc.yellow(commit.shortHash)) : pc.yellow(commit.shortHash);

      const mergeFlag = commit.isMerge ? pc.magenta(' [merge]') : '';
      const mergeLength = commit.isMerge ? 8 : 0;

      // Available width for subject:
      const maxSubjectWidth = Math.max(15, terminalWidth - 25 - mergeLength);
      const subjectTruncated = truncate(commit.subject, maxSubjectWidth);

      const subjectFormatted = isSelected ? pc.bold(subjectTruncated) : subjectTruncated;

      lines.push(`${selector}${dateStr}  ${hashStr}  ${subjectFormatted}${mergeFlag}`);
    }
  }

  // Pad remaining rows to avoid layout jump
  const renderedRows = commits.length === 0 ? 1 : endIndex - scrollOffset;
  for (let p = renderedRows; p < visibleRows; p++) {
    lines.push('');
  }

  // Footer
  lines.push('');
  lines.push(drawSeparator(terminalWidth));
  lines.push(pc.dim('↑↓ / kj navigate   Enter inspect   q quit'));

  return lines.join('\n');
}

export function renderDetailScreen(state: InteractiveState): string {
  const { commits, selectedIndex, terminalWidth } = state;
  const commit = commits[selectedIndex];
  const lines: string[] = [];

  if (!commit) {
    lines.push(pc.bold('COMMIT DETAIL'));
    lines.push(drawSeparator(terminalWidth));
    lines.push('No commit selected.');
    lines.push('');
    lines.push(pc.dim('Enter / Backspace / Esc back   q quit'));
    return lines.join('\n');
  }

  const isMerge = commit.isMerge;
  lines.push(pc.bold(isMerge ? 'COMMIT TIME MACHINE — MERGE' : 'COMMIT TIME MACHINE — DETAIL'));
  lines.push(drawSeparator(terminalWidth));
  lines.push('');

  lines.push(pc.bold(pc.yellow(commit.hash)));
  lines.push(pc.bold(truncate(commit.subject, terminalWidth - 2)));

  // If there are extra notes
  const bodyNotes = commit.body.startsWith(commit.subject)
    ? commit.body.slice(commit.subject.length).trim()
    : commit.body !== commit.subject
      ? commit.body.trim()
      : '';
  if (bodyNotes) {
    lines.push(pc.dim(truncate(bodyNotes.replace(/\n/g, ' '), terminalWidth - 4)));
  }
  lines.push('');

  lines.push(`${pc.dim('Author:')} ${commit.author} <${commit.email}>`);
  lines.push(`${pc.dim('Date:  ')} ${commit.date}`);
  if (commit.churnMagnitude) {
    lines.push(`${pc.dim('Churn: ')} ${commit.churnMagnitude}`);
  }
  lines.push('');

  // Changes
  lines.push(pc.bold('Changes'));
  lines.push(drawSeparator(terminalWidth));
  if (commit.files.length === 0) {
    lines.push(pc.dim(isMerge ? '  Merge integration commit' : '  No direct file modifications'));
  } else {
    for (const f of commit.files.slice(0, 8)) {
      const badge = formatStatus(f.status);
      const name = truncate(f.oldPath ? `${f.oldPath} → ${f.path}` : f.path, Math.max(20, terminalWidth - 30));
      const adds = formatAdditions(f.additions);
      const dels = formatDeletions(f.deletions);
      lines.push(`  ${badge}  ${name}  ${adds}  ${dels}`);
    }
    if (commit.files.length > 8) {
      lines.push(pc.dim(`  ... and ${commit.files.length - 8} more files`));
    }
  }
  lines.push('');

  // Summary
  const interpretation = interpretCommit(commit);
  lines.push(pc.bold('Summary'));
  lines.push(drawSeparator(terminalWidth));
  lines.push(`  ${truncate(interpretation.summary, terminalWidth - 4)}`);
  for (const fact of interpretation.observableFacts.slice(0, 2)) {
    lines.push(pc.dim(`  → ${truncate(fact, terminalWidth - 6)}`));
  }
  lines.push('');

  // Parent(s)
  lines.push(pc.bold('Parents'));
  if (commit.parents.length === 0) {
    lines.push(pc.dim('  None (initial repository commit)'));
  } else if (commit.parents.length === 1) {
    lines.push(`  ${pc.yellow(commit.parents[0].substring(0, 7))}`);
  } else {
    const parentList = commit.parents.map((p) => pc.yellow(p.substring(0, 7))).join(', ');
    lines.push(`  ${parentList} ${pc.magenta('(merge commit)')}`);
  }
  lines.push('');

  // Footer
  lines.push(drawSeparator(terminalWidth));
  lines.push(pc.dim('Enter / Backspace / Esc back   d diff preview   q quit'));

  return lines.join('\n');
}

export function renderDiffScreen(state: InteractiveState): string {
  const { commits, selectedIndex, terminalWidth, terminalHeight, diffOutput } = state;
  const commit = commits[selectedIndex];
  const shortHash = commit ? commit.shortHash : '';
  const lines: string[] = [];

  lines.push(pc.bold(`DIFF PREVIEW — ${shortHash}`));
  lines.push(drawSeparator(terminalWidth));
  lines.push('');

  if (!diffOutput) {
    lines.push(pc.dim('Loading diff...'));
  } else {
    const diffLines = diffOutput.split('\n');
    const maxVisibleLines = Math.max(5, terminalHeight - 7);

    if (diffLines.length <= maxVisibleLines) {
      for (const l of diffLines) {
        const truncatedLine = truncate(l, terminalWidth - 1);
        if (l.startsWith('+') && !l.startsWith('+++')) {
          lines.push(pc.green(truncatedLine));
        } else if (l.startsWith('-') && !l.startsWith('---')) {
          lines.push(pc.red(truncatedLine));
        } else if (l.startsWith('@@')) {
          lines.push(pc.cyan(truncatedLine));
        } else {
          lines.push(truncatedLine);
        }
      }
    } else {
      const displayCount = maxVisibleLines - 1;
      for (const l of diffLines.slice(0, displayCount)) {
        const truncatedLine = truncate(l, terminalWidth - 1);
        if (l.startsWith('+') && !l.startsWith('+++')) {
          lines.push(pc.green(truncatedLine));
        } else if (l.startsWith('-') && !l.startsWith('---')) {
          lines.push(pc.red(truncatedLine));
        } else if (l.startsWith('@@')) {
          lines.push(pc.cyan(truncatedLine));
        } else {
          lines.push(truncatedLine);
        }
      }
      lines.push(pc.dim(`... (${diffLines.length - displayCount} more lines)`));
    }
  }

  lines.push('');
  lines.push(drawSeparator(terminalWidth));
  lines.push(pc.dim('Enter / Backspace / Esc back to detail   q quit'));

  return lines.join('\n');
}

export function renderNarrowTerminalScreen(state: InteractiveState): string {
  const { terminalWidth, terminalHeight } = state;
  const lines: string[] = [];
  lines.push(pc.bold('COMMIT TIME MACHINE'));
  lines.push(drawSeparator(terminalWidth));
  lines.push('');
  lines.push(pc.yellow('Terminal too small:'));
  lines.push(`  Current:  ${terminalWidth} cols × ${terminalHeight} rows`);
  lines.push(`  Required: 40 cols × 10 rows`);
  lines.push('');
  lines.push(pc.dim('Please resize terminal or press q to quit.'));
  return lines.join('\n');
}

export function renderInteractiveScreen(state: InteractiveState): string {
  if (state.terminalWidth < 40 || state.terminalHeight < 10) {
    return renderNarrowTerminalScreen(state);
  }

  switch (state.view) {
    case 'timeline':
      return renderTimelineScreen(state);
    case 'detail':
      return renderDetailScreen(state);
    case 'diff':
      return renderDiffScreen(state);
    default:
      return renderTimelineScreen(state);
  }
}
