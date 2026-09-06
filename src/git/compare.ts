import { runGit } from './runner.js';
import { getRepoInfo } from './repository.js';
import { getSingleCommit, parseDiffTokens } from './history.js';
import { computeDirectoryStats, categorizeDirectory } from '../analysis/stats.js';
import type { ComparisonDetail, FileChange } from '../types/index.js';

export async function compareCommits(
  commit1: string,
  commit2: string,
  cwd: string = process.cwd()
): Promise<ComparisonDetail> {
  const repo = await getRepoInfo(cwd);

  // Validate commit1
  try {
    await runGit(['rev-parse', '--verify', `${commit1}^{commit}`], cwd);
  } catch {
    throw new Error(`Commit "${commit1}" was not found in this repository.`);
  }

  // Validate commit2
  try {
    await runGit(['rev-parse', '--verify', `${commit2}^{commit}`], cwd);
  } catch {
    throw new Error(`Commit "${commit2}" was not found in this repository.`);
  }

  // Get commit metadata
  const baseCommit = await getSingleCommit(commit1, cwd);
  const targetCommit = await getSingleCommit(commit2, cwd);

  // Run diff-tree between the two commits
  const res = await runGit(['diff-tree', '-r', '-z', '--numstat', '--raw', commit1, commit2], cwd);
  const { files, additions, deletions } = parseDiffTokens(res.stdout);

  // Compute affected directories/areas
  const dirStats = computeDirectoryStats(files);
  const affectedAreas = dirStats
    .map((d) => (d.directory === 'root' ? 'root files' : `${d.directory}/`))
    .slice(0, 5);

  let focusArea: string | undefined;
  if (dirStats.length > 0 && dirStats[0].directory !== 'root') {
    focusArea = categorizeDirectory(dirStats[0].directory);
  }

  const fileWord = files.length === 1 ? 'file' : 'files';
  let summary = `Between ${baseCommit.shortHash} and ${targetCommit.shortHash}, ${files.length} ${fileWord} changed (+${additions} / -${deletions} lines).`;
  if (focusArea) {
    summary += ` The repository evolved primarily through ${focusArea} changes during this period.`;
  }

  const observableFacts: string[] = [
    `${files.length} ${fileWord} changed (+${additions} / -${deletions} lines)`,
    `Base: ${baseCommit.shortHash} (${baseCommit.date}) - "${baseCommit.subject}"`,
    `Target: ${targetCommit.shortHash} (${targetCommit.date}) - "${targetCommit.subject}"`
  ];

  if (affectedAreas.length > 0) {
    observableFacts.push(`Key areas modified: ${affectedAreas.join(', ')}`);
  }

  return {
    repo,
    baseCommit,
    targetCommit,
    files,
    totalFilesChanged: files.length,
    additions,
    deletions,
    affectedAreas,
    interpretation: {
      summary,
      focusArea,
      observableFacts
    }
  };
}
