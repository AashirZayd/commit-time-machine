import type { RawCommit, FileChange, CommitInterpretation, TimelineInterpretation } from '../types/index.js';
import { computeDirectoryStats, computeCommitChurn, categorizeDirectory, detectActivityBursts, classifyCommitChurn } from './stats.js';

interface ConventionalCommit {
  type: string;
  scope?: string;
  isBreaking: boolean;
  description: string;
}

export function parseConventionalCommit(subject: string): ConventionalCommit | null {
  const match = subject.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/);
  if (!match) return null;

  return {
    type: match[1].toLowerCase(),
    scope: match[2]?.trim(),
    isBreaking: Boolean(match[3]),
    description: match[4].trim()
  };
}

export function interpretCommit(commit: RawCommit, baselineAvgLines?: number): CommitInterpretation {
  const churn = computeCommitChurn(commit, baselineAvgLines);
  const dirStats = computeDirectoryStats(commit.files);
  const conv = parseConventionalCommit(commit.subject);
  const observableFacts: string[] = [];

  // Observable facts
  const fileWord = commit.files.length === 1 ? 'file' : 'files';
  observableFacts.push(
    `${commit.files.length} ${fileWord} changed (+${commit.additions} / -${commit.deletions} lines)`
  );

  observableFacts.push(`Change volume: ${churn.magnitude}`);

  if (commit.isMerge) {
    const parentShorts = commit.parents.map((p) => p.substring(0, 7)).join(', ');
    observableFacts.push(`Merge commit combining ${commit.parents.length} parents: ${parentShorts}`);
  }

  if (churn.hasBinary) {
    observableFacts.push('Contains binary file modifications');
  }

  const renamedFiles = commit.files.filter((f) => f.status === 'R' || f.oldPath);
  if (renamedFiles.length > 0) {
    const renameSummary = renamedFiles
      .slice(0, 2)
      .map((f) => `${f.oldPath || 'original'} → ${f.path}`)
      .join(', ');
    observableFacts.push(
      renamedFiles.length > 2
        ? `Renamed ${renamedFiles.length} files (${renameSummary}, ...)`
        : `Renamed file: ${renameSummary}`
    );
  }

  let focusArea: string | undefined;
  if (dirStats.length > 0) {
    const topDir = dirStats[0];
    const percentage = Math.round((topDir.filesChanged / Math.max(commit.files.length, 1)) * 100);
    if (percentage >= 40 && topDir.directory !== 'root') {
      focusArea = categorizeDirectory(topDir.directory);
      observableFacts.push(`Primary changes located in ${topDir.directory}/ (${percentage}% of files)`);
    }
  }

  // Derive human-readable summary
  let summary = '';
  if (commit.isMerge) {
    summary = `This is a merge commit combining history from multiple branches.`;
  } else if (conv) {
    const scopeStr = conv.scope ? ` (${conv.scope})` : '';
    switch (conv.type) {
      case 'feat':
        summary = `This commit introduced new functionality${scopeStr}: ${conv.description}.`;
        break;
      case 'fix':
        summary = `This commit fixed an issue${scopeStr}: ${conv.description}.`;
        break;
      case 'docs':
        summary = `This commit updated documentation${scopeStr}: ${conv.description}.`;
        break;
      case 'refactor':
        summary = `This commit refactored code${scopeStr}: ${conv.description}.`;
        break;
      case 'test':
        summary = `This commit updated automated tests${scopeStr}: ${conv.description}.`;
        break;
      case 'chore':
        summary = `This commit performed routine maintenance${scopeStr}: ${conv.description}.`;
        break;
      case 'perf':
        summary = `This commit improved performance${scopeStr}: ${conv.description}.`;
        break;
      case 'style':
        summary = `This commit formatted or cleaned code style${scopeStr}: ${conv.description}.`;
        break;
      case 'build':
      case 'ci':
        summary = `This commit updated build or CI configuration${scopeStr}: ${conv.description}.`;
        break;
      default:
        summary = `This commit made changes${scopeStr}: ${conv.description}.`;
    }
  } else {
    // Observable summary based on subject and directory
    if (focusArea) {
      summary = `This commit modified ${commit.files.length} ${fileWord}, primarily focused on the ${focusArea}.`;
    } else {
      summary = `This commit modified ${commit.files.length} ${fileWord}: "${commit.subject}".`;
    }
  }

  // If there is additional context from the commit body (observable notes)
  if (commit.body && commit.body !== commit.subject) {
    const firstBodyLine = commit.body.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
    if (firstBodyLine && firstBodyLine !== commit.subject && !summary.includes(firstBodyLine)) {
      summary += ` ${firstBodyLine}`;
    }
  }

  return {
    summary: summary.trim(),
    focusArea,
    observableFacts,
    conventionalType: conv?.type,
    conventionalScope: conv?.scope,
    churnMagnitude: churn.magnitude
  };
}

export function interpretTimeline(commits: RawCommit[]): TimelineInterpretation {
  if (commits.length === 0) {
    return {
      summary: 'This repository has no history to travel through.',
      observableFacts: ['No commits found']
    };
  }

  const observableFacts: string[] = [];
  const allFiles: FileChange[] = [];
  const authors = new Set<string>();
  let totalAdditions = 0;
  let totalDeletions = 0;
  let mergeCount = 0;

  for (const c of commits) {
    authors.add(c.author);
    totalAdditions += c.additions;
    totalDeletions += c.deletions;
    if (c.isMerge) mergeCount++;
    for (const f of c.files) {
      allFiles.push(f);
    }
  }

  // Compute average churn baseline
  const avgLines = (totalAdditions + totalDeletions) / Math.max(commits.length, 1);
  let largeCommitCount = 0;
  for (const c of commits) {
    c.churnMagnitude = classifyCommitChurn(c, avgLines);
    if (c.churnMagnitude === 'Large') {
      largeCommitCount++;
    }
  }

  const dirStats = computeDirectoryStats(allFiles);
  let focusArea: string | undefined;

  // Check top 2 directories
  const topDirs = dirStats.filter((d) => d.directory !== 'root').slice(0, 2);
  if (topDirs.length > 0) {
    const totalDirFiles = allFiles.length;
    const topPercentage = Math.round((topDirs[0].filesChanged / Math.max(totalDirFiles, 1)) * 100);
    if (topPercentage >= 30) {
      if (topDirs.length > 1 && Math.round((topDirs[1].filesChanged / Math.max(totalDirFiles, 1)) * 100) >= 20) {
        focusArea = `${categorizeDirectory(topDirs[0].directory)} and ${categorizeDirectory(topDirs[1].directory)}`;
      } else {
        focusArea = categorizeDirectory(topDirs[0].directory);
      }
    }
  }

  // Date range
  const newestDate = commits[0].date;
  const oldestDate = commits[commits.length - 1].date;
  if (newestDate === oldestDate) {
    observableFacts.push(`All recent activity occurred on ${newestDate}`);
  } else {
    observableFacts.push(`Activity spans from ${oldestDate} to ${newestDate}`);
  }

  const authorWord = authors.size === 1 ? 'contributor' : 'contributors';
  observableFacts.push(`${authors.size} active ${authorWord}`);

  if (mergeCount > 0) {
    observableFacts.push(`${mergeCount} merge ${mergeCount === 1 ? 'commit' : 'commits'}`);
  }

  if (largeCommitCount > 0) {
    observableFacts.push(`${largeCommitCount} high-churn ${largeCommitCount === 1 ? 'commit' : 'commits'}`);
  }

  const bursts = detectActivityBursts(commits);
  for (const burst of bursts) {
    observableFacts.push(burst);
  }

  const commitWord = commits.length === 1 ? 'recent commit' : 'recent commits';
  let summary = `This repository has ${commits.length} ${commitWord}.`;

  if (focusArea) {
    summary += `\nMost recent activity is focused on the ${focusArea}.`;
  } else if (dirStats.length > 0 && dirStats[0].directory !== 'root') {
    summary += `\nMost recent activity is concentrated in ${dirStats[0].directory}/.`;
  }

  return {
    summary,
    focusArea,
    observableFacts,
    bursts
  };
}
