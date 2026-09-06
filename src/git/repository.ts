import path from 'node:path';
import { runGit, GitError } from './runner.js';
import type { RepoInfo } from '../types/index.js';

export async function getRepoInfo(cwd: string = process.cwd()): Promise<RepoInfo> {
  // Check if inside git repository
  let isGitRepo = false;
  let rootPath = '';

  try {
    const insideRes = await runGit(['rev-parse', '--is-inside-work-tree'], cwd);
    isGitRepo = insideRes.stdout.trim() === 'true';
  } catch {
    return {
      isGitRepo: false,
      rootPath: '',
      repoName: '',
      isDetached: false,
      hasCommits: false
    };
  }

  if (!isGitRepo) {
    return {
      isGitRepo: false,
      rootPath: '',
      repoName: '',
      isDetached: false,
      hasCommits: false
    };
  }

  try {
    const toplevelRes = await runGit(['rev-parse', '--show-toplevel'], cwd);
    rootPath = toplevelRes.stdout.trim();
  } catch {
    rootPath = cwd;
  }

  const repoName = path.basename(rootPath) || 'repository';

  // Check if repo has any commits
  let hasCommits = false;
  let headHash: string | undefined;
  let shortHeadHash: string | undefined;

  try {
    const headRes = await runGit(['rev-parse', 'HEAD'], cwd);
    headHash = headRes.stdout.trim();
    const shortHeadRes = await runGit(['rev-parse', '--short', 'HEAD'], cwd);
    shortHeadHash = shortHeadRes.stdout.trim();
    hasCommits = true;
  } catch {
    hasCommits = false;
  }

  if (!hasCommits) {
    return {
      isGitRepo: true,
      rootPath,
      repoName,
      isDetached: false,
      hasCommits: false
    };
  }

  // Check branch vs detached HEAD
  let branch: string | undefined;
  let isDetached = false;

  try {
    const branchRes = await runGit(['symbolic-ref', '--short', '-q', 'HEAD'], cwd);
    const branchName = branchRes.stdout.trim();
    if (branchName) {
      branch = branchName;
    } else {
      isDetached = true;
    }
  } catch {
    // symbolic-ref returns non-zero when HEAD is detached
    isDetached = true;
  }

  return {
    isGitRepo: true,
    rootPath,
    repoName,
    branch: isDetached ? undefined : branch,
    isDetached,
    headHash,
    shortHeadHash,
    hasCommits
  };
}

export async function hasBranch(branchName: string, cwd: string = process.cwd()): Promise<boolean> {
  try {
    // Check if ref exists under refs/heads/
    await runGit(['rev-parse', '--verify', `refs/heads/${branchName}`], cwd);
    return true;
  } catch {
    try {
      // Fallback check in case full ref or custom ref was provided
      await runGit(['rev-parse', '--verify', `${branchName}^{commit}`], cwd);
      return true;
    } catch {
      return false;
    }
  }
}
