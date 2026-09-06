import { runGit } from './runner.js';

export async function getBoundedCommitDiff(
  commitHash: string,
  maxLines: number = 80,
  cwd: string = process.cwd()
): Promise<string> {
  try {
    const res = await runGit(['show', '--format=', '--patch', commitHash], cwd);
    const raw = res.stdout.trim();
    if (!raw) {
      try {
        const parentsRes = await runGit(['rev-parse', `${commitHash}^@`], cwd);
        const parentHashes = parentsRes.stdout.trim().split(/\s+/).filter(Boolean);
        if (parentHashes.length > 1) {
          return [
            'No conflict changes in merge commit (clean branch integration).',
            `Use "commit-time-machine --compare ${parentHashes[0].substring(0, 7)} ${commitHash.substring(0, 7)}" or "git show ${commitHash.substring(0, 7)}" to inspect parent diffs.`
          ].join('\n');
        }
      } catch {
        // ignore parent lookup failure and proceed with general message
      }
      return [
        'No textual diff changes recorded for this commit (e.g. binary files or empty commit).',
        `Use "git show ${commitHash.substring(0, 7)}" to inspect the commit object.`
      ].join('\n');
    }

    const lines = raw.split('\n');
    if (lines.length <= maxLines) {
      return lines.join('\n');
    }

    const visibleLines = lines.slice(0, maxLines);
    const omitted = lines.length - maxLines;
    visibleLines.push('');
    visibleLines.push(`--- Diff truncated (${omitted} more lines) ---`);
    visibleLines.push(`Use "git show ${commitHash.substring(0, 7)}" to inspect the full diff.`);

    return visibleLines.join('\n');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `Could not load diff for commit ${commitHash.substring(0, 7)}: ${message}`;
  }
}
