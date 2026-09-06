import type {
  RepositoryTimeline,
  CommitDetail,
  FileTimeline,
  SnapshotDetail,
  ComparisonDetail,
  SearchResult,
  AuthorHistory
} from '../types/index.js';

export function renderTimelineJson(timeline: RepositoryTimeline): string {
  const data = {
    mode: 'timeline',
    repository: timeline.repo.repoName,
    rootPath: timeline.repo.rootPath,
    branch: timeline.repo.branch || null,
    isDetached: timeline.repo.isDetached,
    head: timeline.repo.headHash || null,
    isFirstParentOnly: timeline.isFirstParentOnly,
    branchFilter: timeline.branchFilter || null,
    totalCommits: timeline.commits.length,
    commits: timeline.commits.map((c) => ({
      hash: c.hash,
      shortHash: c.shortHash,
      author: c.author,
      email: c.email,
      date: c.date,
      subject: c.subject,
      parents: c.parents,
      isMerge: c.isMerge,
      churnMagnitude: c.churnMagnitude || 'Medium',
      filesChanged: c.files.length,
      additions: c.additions,
      deletions: c.deletions,
      files: c.files.map((f) => ({
        path: f.path,
        oldPath: f.oldPath || null,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        isBinary: f.isBinary
      }))
    })),
    interpretation: timeline.interpretation
  };

  return JSON.stringify(data, null, 2);
}

export function renderCommitDetailJson(detail: CommitDetail): string {
  const { repo, commit, interpretation } = detail;
  const data = {
    mode: 'commit',
    repository: repo.repoName,
    rootPath: repo.rootPath,
    commit: {
      hash: commit.hash,
      shortHash: commit.shortHash,
      author: commit.author,
      email: commit.email,
      date: commit.date,
      subject: commit.subject,
      body: commit.body,
      parents: commit.parents,
      isMerge: commit.isMerge,
      churnMagnitude: commit.churnMagnitude || interpretation.churnMagnitude,
      filesChanged: commit.files.length,
      additions: commit.additions,
      deletions: commit.deletions,
      files: commit.files.map((f) => ({
        path: f.path,
        oldPath: f.oldPath || null,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        isBinary: f.isBinary
      }))
    },
    interpretation
  };

  return JSON.stringify(data, null, 2);
}

export function renderFileTimelineJson(fileTimeline: FileTimeline): string {
  const data = {
    mode: 'file',
    repository: fileTimeline.repo.repoName,
    filePath: fileTimeline.filePath,
    totalModifications: fileTimeline.interpretation.totalModifications,
    entries: fileTimeline.entries.map((e) => ({
      hash: e.hash,
      shortHash: e.shortHash,
      date: e.date,
      author: e.author,
      subject: e.subject,
      status: e.status,
      path: e.path,
      oldPath: e.oldPath || null
    })),
    interpretation: fileTimeline.interpretation
  };

  return JSON.stringify(data, null, 2);
}

export function renderSnapshotJson(snapshot: SnapshotDetail): string {
  const { repo, commit, totalFiles, topLevelEntries, branchContext, interpretation } = snapshot;
  const data = {
    mode: 'snapshot',
    repository: repo.repoName,
    rootPath: repo.rootPath,
    time: {
      hash: commit.hash,
      shortHash: commit.shortHash,
      subject: commit.subject,
      author: commit.author,
      date: commit.date
    },
    branchContext: branchContext || null,
    totalFiles,
    topLevelEntries,
    filesTouched: commit.files.map((f) => ({
      path: f.path,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      isBinary: f.isBinary
    })),
    interpretation
  };

  return JSON.stringify(data, null, 2);
}

export function renderComparisonJson(comparison: ComparisonDetail): string {
  const { repo, baseCommit, targetCommit, files, additions, deletions, affectedAreas, interpretation } = comparison;
  const data = {
    mode: 'compare',
    repository: repo.repoName,
    rootPath: repo.rootPath,
    base: {
      hash: baseCommit.hash,
      shortHash: baseCommit.shortHash,
      subject: baseCommit.subject,
      author: baseCommit.author,
      date: baseCommit.date
    },
    target: {
      hash: targetCommit.hash,
      shortHash: targetCommit.shortHash,
      subject: targetCommit.subject,
      author: targetCommit.author,
      date: targetCommit.date
    },
    totalFilesChanged: files.length,
    additions,
    deletions,
    affectedAreas,
    files: files.map((f) => ({
      path: f.path,
      oldPath: f.oldPath || null,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      isBinary: f.isBinary
    })),
    interpretation
  };

  return JSON.stringify(data, null, 2);
}

export function renderSearchJson(search: SearchResult): string {
  const data = {
    mode: 'search',
    repository: search.repo.repoName,
    searchTerm: search.searchTerm,
    totalMatches: search.matches.length,
    matches: search.matches.map((c) => ({
      hash: c.hash,
      shortHash: c.shortHash,
      author: c.author,
      date: c.date,
      subject: c.subject
    })),
    interpretation: search.interpretation
  };

  return JSON.stringify(data, null, 2);
}

export function renderAuthorJson(authorHistory: AuthorHistory): string {
  const data = {
    mode: 'author',
    repository: authorHistory.repo.repoName,
    authorName: authorHistory.authorName,
    totalCommits: authorHistory.totalCommits,
    latestCommit: authorHistory.latestCommit
      ? {
          hash: authorHistory.latestCommit.hash,
          shortHash: authorHistory.latestCommit.shortHash,
          subject: authorHistory.latestCommit.subject,
          date: authorHistory.latestCommit.date
        }
      : null,
    commits: authorHistory.commits.map((c) => ({
      hash: c.hash,
      shortHash: c.shortHash,
      date: c.date,
      subject: c.subject,
      additions: c.additions,
      deletions: c.deletions
    })),
    interpretation: authorHistory.interpretation
  };

  return JSON.stringify(data, null, 2);
}
