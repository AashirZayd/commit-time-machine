import type {
  RepoInfo,
  RawCommit,
  RepositoryTimeline,
  CommitDetail,
  FileTimeline,
  SnapshotDetail,
  ComparisonDetail,
  SearchResult,
  AuthorHistory
} from '../types/index.js';
import { interpretTimeline, interpretCommit } from './interpreter.js';
import { getCommits, getSingleCommit, getFileHistory } from '../git/history.js';
import { getRepoInfo, hasBranch } from '../git/repository.js';
import { getSnapshot } from '../git/snapshot.js';
import { compareCommits } from '../git/compare.js';

export async function buildRepositoryTimeline(options: {
  cwd?: string;
  limit?: number;
  since?: string;
  firstParent?: boolean;
  branch?: string;
}): Promise<RepositoryTimeline> {
  const cwd = options.cwd || process.cwd();
  const repo = await getRepoInfo(cwd);

  if (options.branch) {
    const branchExists = await hasBranch(options.branch, cwd);
    if (!branchExists) {
      throw new Error(`Branch "${options.branch}" was not found.`);
    }
  }

  if (!repo.isGitRepo || !repo.hasCommits) {
    return {
      repo,
      commits: [],
      totalCommitsInspected: 0,
      isFirstParentOnly: Boolean(options.firstParent),
      branchFilter: options.branch,
      interpretation: interpretTimeline([])
    };
  }

  const commits = await getCommits({
    cwd,
    limit: options.limit ?? 10,
    since: options.since,
    firstParent: options.firstParent,
    branch: options.branch
  });

  const interpretation = interpretTimeline(commits);

  return {
    repo,
    commits,
    totalCommitsInspected: commits.length,
    isFirstParentOnly: Boolean(options.firstParent),
    branchFilter: options.branch,
    interpretation
  };
}

export async function buildCommitDetail(commitHash: string, cwd: string = process.cwd()): Promise<CommitDetail> {
  const repo = await getRepoInfo(cwd);
  const commit = await getSingleCommit(commitHash, cwd);
  const interpretation = interpretCommit(commit);

  return {
    repo,
    commit,
    interpretation
  };
}

export async function buildFileTimeline(
  filePath: string,
  cwd: string = process.cwd(),
  limit?: number
): Promise<FileTimeline> {
  const repo = await getRepoInfo(cwd);
  const entries = await getFileHistory(filePath, cwd, limit);

  const totalModifications = entries.length;
  let summary = '';
  if (totalModifications === 0) {
    summary = `File "${filePath}" has no recorded commit history or does not exist.`;
  } else if (totalModifications === 1) {
    summary = `File "${filePath}" was created in 1 commit.`;
  } else {
    summary = `File "${filePath}" has evolved across ${totalModifications} commits.`;
  }

  return {
    repo,
    filePath,
    entries,
    interpretation: {
      summary,
      totalModifications
    }
  };
}

export async function buildSnapshotDetail(commitHash: string, cwd: string = process.cwd()): Promise<SnapshotDetail> {
  return getSnapshot(commitHash, cwd);
}

export async function buildComparisonDetail(
  commit1: string,
  commit2: string,
  cwd: string = process.cwd()
): Promise<ComparisonDetail> {
  return compareCommits(commit1, commit2, cwd);
}

export async function buildSearchResult(
  searchTerm: string,
  options: { cwd?: string; limit?: number; branch?: string; firstParent?: boolean; since?: string } = {}
): Promise<SearchResult> {
  const cwd = options.cwd || process.cwd();
  const repo = await getRepoInfo(cwd);

  if (options.branch) {
    const branchExists = await hasBranch(options.branch, cwd);
    if (!branchExists) {
      throw new Error(`Branch "${options.branch}" was not found.`);
    }
  }

  const matches = await getCommits({
    cwd,
    search: searchTerm,
    limit: options.limit ?? 20,
    branch: options.branch,
    firstParent: options.firstParent,
    since: options.since
  });

  const matchWord = matches.length === 1 ? 'commit' : 'commits';
  const summary = matches.length > 0
    ? `Found ${matches.length} ${matchWord} matching "${searchTerm}".`
    : `No commits found matching "${searchTerm}".`;

  const observableFacts: string[] = [
    `Search term: "${searchTerm}"`,
    `Total matches: ${matches.length}`
  ];

  return {
    repo,
    searchTerm,
    matches,
    interpretation: {
      summary,
      observableFacts
    }
  };
}

export async function buildAuthorHistory(
  authorName: string,
  options: { cwd?: string; limit?: number; branch?: string; firstParent?: boolean; since?: string } = {}
): Promise<AuthorHistory> {
  const cwd = options.cwd || process.cwd();
  const repo = await getRepoInfo(cwd);

  if (options.branch) {
    const branchExists = await hasBranch(options.branch, cwd);
    if (!branchExists) {
      throw new Error(`Branch "${options.branch}" was not found.`);
    }
  }

  const commits = await getCommits({
    cwd,
    author: authorName,
    limit: options.limit ?? 20,
    branch: options.branch,
    firstParent: options.firstParent,
    since: options.since
  });

  const commitWord = commits.length === 1 ? 'commit' : 'commits';
  const summary = commits.length > 0
    ? `Author "${authorName}" has ${commits.length} recorded ${commitWord} in this range.`
    : `No commits found for author "${authorName}".`;

  const observableFacts: string[] = [
    `Author filter: "${authorName}"`,
    `Matching commits: ${commits.length}`
  ];

  return {
    repo,
    authorName,
    totalCommits: commits.length,
    commits,
    latestCommit: commits[0],
    interpretation: {
      summary,
      observableFacts
    }
  };
}
