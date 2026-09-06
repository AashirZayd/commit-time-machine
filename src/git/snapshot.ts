import { runGit } from './runner.js';
import { getRepoInfo } from './repository.js';
import { getSingleCommit } from './history.js';
import type { SnapshotDetail, SnapshotStructureItem } from '../types/index.js';

export async function getSnapshot(commitHash: string, cwd: string = process.cwd()): Promise<SnapshotDetail> {
  const repo = await getRepoInfo(cwd);

  // 1. Verify commit exists
  try {
    await runGit(['rev-parse', '--verify', `${commitHash}^{commit}`], cwd);
  } catch {
    throw new Error(`Commit "${commitHash}" was not found in this repository.`);
  }

  // 2. Fetch commit details
  const commit = await getSingleCommit(commitHash, cwd);

  // 3. Read top-level entries with git ls-tree -z <commit>
  const lsRes = await runGit(['ls-tree', '-z', commitHash], cwd);
  const topLevelEntries: SnapshotStructureItem[] = [];

  const rawEntries = lsRes.stdout.split('\0').filter(Boolean);
  for (const raw of rawEntries) {
    // Format: <mode> <type> <object>\t<name>
    const tabIndex = raw.indexOf('\t');
    if (tabIndex === -1) continue;
    const meta = raw.substring(0, tabIndex).trim();
    const name = raw.substring(tabIndex + 1);
    const parts = meta.split(/\s+/);
    const type = parts[1] === 'tree' ? 'tree' : 'blob';
    topLevelEntries.push({ name, type });
  }

  // Sort directories first, then files alphabetically
  topLevelEntries.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'tree' ? -1 : 1;
  });

  // 4. Count total files recursively
  const lsRecRes = await runGit(['ls-tree', '-r', '--name-only', '-z', commitHash], cwd);
  const totalFiles = lsRecRes.stdout.split('\0').filter(Boolean).length;

  // 5. Determine branch context
  let branchContext: string | undefined;
  try {
    const branchRes = await runGit(['branch', '--contains', commitHash], cwd);
    const branches = branchRes.stdout
      .split('\n')
      .map((b) => b.replace(/^\*?\s+/, '').trim())
      .filter(Boolean);
    if (branches.length > 0) {
      if (repo.branch && branches.includes(repo.branch)) {
        branchContext = repo.branch;
      } else {
        branchContext = branches[0];
      }
    }
  } catch {
    // Branch context is optional
  }

  const fileWord = commit.files.length === 1 ? 'file' : 'files';
  const totalFileWord = totalFiles === 1 ? 'file' : 'files';
  const summary = `This snapshot represents the repository at commit ${commit.shortHash}, containing ${totalFiles} ${totalFileWord} across ${topLevelEntries.length} root items.`;

  const observableFacts: string[] = [
    `Total repository size at this commit: ${totalFiles} ${totalFileWord}`,
    `${commit.files.length} ${fileWord} modified in this commit (+${commit.additions} / -${commit.deletions} lines)`
  ];

  if (branchContext) {
    observableFacts.push(`Reachable from branch: ${branchContext}`);
  }

  return {
    repo,
    commit,
    totalFiles,
    topLevelEntries,
    branchContext,
    interpretation: {
      summary,
      observableFacts
    }
  };
}
