import type { FileChange, RawCommit, ChurnMagnitude } from '../types/index.js';

export interface DirectoryStats {
  directory: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface ChurnStats {
  filesChanged: number;
  additions: number;
  deletions: number;
  netChange: number;
  hasBinary: boolean;
  hasRenames: boolean;
  magnitude: ChurnMagnitude;
}

export function extractDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.length <= 1) {
    return 'root';
  }
  // If top-level is src, include second level if available, e.g. src/api
  if (parts[0] === 'src' && parts.length > 2) {
    return `src/${parts[1]}`;
  }
  return parts[0];
}

export function computeDirectoryStats(files: FileChange[]): DirectoryStats[] {
  const dirMap = new Map<string, DirectoryStats>();

  for (const file of files) {
    const dir = extractDirectory(file.path);
    const existing = dirMap.get(dir) || {
      directory: dir,
      filesChanged: 0,
      additions: 0,
      deletions: 0
    };

    existing.filesChanged += 1;
    existing.additions += file.additions;
    existing.deletions += file.deletions;
    dirMap.set(dir, existing);
  }

  return Array.from(dirMap.values()).sort((a, b) => b.filesChanged - a.filesChanged);
}

/**
 * Deterministic commit churn classification:
 * - Small: <= 20 lines changed and <= 3 files
 * - Large: >= 100 lines changed, or >= 10 files, or >= 2x the repository baseline average
 * - Medium: moderate changes between Small and Large
 */
export function classifyCommitChurn(commit: RawCommit, baselineAvgLines?: number): ChurnMagnitude {
  const linesChanged = commit.additions + commit.deletions;
  const filesCount = commit.files.length;

  if (baselineAvgLines !== undefined && baselineAvgLines > 0) {
    if (linesChanged >= Math.max(100, baselineAvgLines * 2) || filesCount >= 10) {
      return 'Large';
    }
  } else {
    if (linesChanged >= 100 || filesCount >= 10) {
      return 'Large';
    }
  }

  if (linesChanged <= 20 && filesCount <= 3) {
    return 'Small';
  }

  return 'Medium';
}

export function computeCommitChurn(commit: RawCommit, baselineAvgLines?: number): ChurnStats {
  let hasBinary = false;
  let hasRenames = false;

  for (const f of commit.files) {
    if (f.isBinary) hasBinary = true;
    if (f.status === 'R' || f.oldPath) hasRenames = true;
  }

  const magnitude = classifyCommitChurn(commit, baselineAvgLines);

  return {
    filesChanged: commit.files.length,
    additions: commit.additions,
    deletions: commit.deletions,
    netChange: commit.additions - commit.deletions,
    hasBinary,
    hasRenames,
    magnitude
  };
}

export function detectActivityBursts(commits: RawCommit[]): string[] {
  const observations: string[] = [];
  if (commits.length < 2) return observations;

  // Check for long periods of inactivity between consecutive commits (> 30 days)
  for (let i = 0; i < commits.length - 1; i++) {
    const current = commits[i];
    const prev = commits[i + 1];
    const diffDays = Math.round((current.timestamp - prev.timestamp) / 86400);
    if (diffDays >= 30) {
      observations.push(`Significant gap of ${diffDays} days between ${prev.date} and ${current.date}`);
      break; // Report the most recent major gap
    }
  }

  return observations;
}

export function categorizeDirectory(dir: string): string {
  const lower = dir.toLowerCase();
  if (lower === 'site' || lower === 'website' || lower === 'www' || lower === 'public' || lower === 'pages') {
    return 'website';
  }
  if (lower === 'docs' || lower === 'doc' || lower === 'documentation') {
    return 'documentation';
  }
  if (lower === 'test' || lower === 'tests' || lower === 'spec' || lower === '__tests__') {
    return 'test suite';
  }
  if (lower.startsWith('src/components') || lower.startsWith('src/ui') || lower.startsWith('components')) {
    return 'UI components';
  }
  if (lower.startsWith('src/api') || lower === 'api') {
    return 'API';
  }
  if (lower === 'src' || lower.startsWith('src/')) {
    return 'source code';
  }
  if (lower === 'root') {
    return 'project root configuration';
  }
  return `${dir}/`;
}
