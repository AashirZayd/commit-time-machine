import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTempRepo, runCliProcess, stripAnsi, type TestRepo } from './helpers.js';
import { getBoundedCommitDiff } from '../src/git/diff.js';

describe('commit-time-machine Phase 2 E2E Test Suite', () => {
  let repo: TestRepo;

  beforeEach(() => {
    repo = createTempRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  // 1. default full history includes merged branch commits
  it('1. default full history includes merged branch commits (does not hide secondary branch commits)', async () => {
    repo.commitFile('a.txt', 'A\n', 'feat: commit A on main');
    repo.commitFile('b.txt', 'B\n', 'feat: commit B on main');

    repo.git(['checkout', '-b', 'feature-branch']);
    repo.commitFile('c.txt', 'C\n', 'feat: commit C on feature');
    repo.commitFile('d.txt', 'D\n', 'feat: commit D on feature');

    repo.git(['checkout', 'main']);
    repo.git(['merge', '--no-ff', 'feature-branch', '-m', 'Merge branch feature-branch']);

    const res = await runCliProcess([], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    // All commits A, B, C, D, and Merge must be present in default history
    expect(text).toContain('commit A on main');
    expect(text).toContain('commit B on main');
    expect(text).toContain('commit C on feature');
    expect(text).toContain('commit D on feature');
    expect(text).toContain('Merge branch feature-branch');
    expect(text).toContain('This repository has 5 recent commits.');
  });

  // 2. --first-parent excludes secondary branch commits intentionally
  it('2. --first-parent excludes secondary branch commits intentionally', async () => {
    repo.commitFile('a.txt', 'A\n', 'feat: commit A on main');
    repo.commitFile('b.txt', 'B\n', 'feat: commit B on main');

    repo.git(['checkout', '-b', 'feature-branch']);
    repo.commitFile('c.txt', 'C\n', 'feat: commit C on feature');
    repo.commitFile('d.txt', 'D\n', 'feat: commit D on feature');

    repo.git(['checkout', 'main']);
    repo.git(['merge', '--no-ff', 'feature-branch', '-m', 'Merge branch feature-branch']);

    const res = await runCliProcess(['--first-parent'], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    // Only mainline commits (Merge, B, A) must be present
    expect(text).toContain('Merge branch feature-branch');
    expect(text).toContain('commit B on main');
    expect(text).toContain('commit A on main');
    expect(text).not.toContain('commit C on feature');
    expect(text).not.toContain('commit D on feature');
    expect(text).toContain('First-parent / Mainline only');
    expect(text).toContain('This repository has 3 recent commits.');
  });

  // 3. --at valid commit
  it('3. inspects historical snapshot structure with --at <commit>', async () => {
    repo.commitFile('README.md', '# Initial\n', 'docs: initial readme');
    repo.commitFile('src/app.ts', 'console.log(1);\n', 'feat(core): add app');
    const targetHash = repo.commitFile('site/index.html', '<h1>Site</h1>\n', 'feat(site): add landing page');
    repo.commitFile('extra.txt', 'extra\n', 'chore: extra file');

    const res = await runCliProcess(['--at', targetHash], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    expect(text).toContain('COMMIT TIME MACHINE');
    expect(text).toContain('Time');
    expect(text).toContain(targetHash.substring(0, 7));
    expect(text).toContain('feat(site): add landing page');
    expect(text).toContain('Repository at this point');
    expect(text).toContain('Snapshot structure');
    expect(text).toContain('src/');
    expect(text).toContain('site/');
    expect(text).toContain('README.md');
    // extra.txt did not exist at targetHash
    expect(text).not.toContain('extra.txt');
    expect(text).toContain("What's going on");
  });

  // 4. --at invalid commit
  it('4. reports actionable error for --at with non-existent commit', async () => {
    repo.commitFile('f.txt', 'content\n', 'initial');
    const res = await runCliProcess(['--at', 'deadbeef000011112222'], repo.dir);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('deadbeef000011112222');
    expect(res.stderr).toContain('was not found in this repository');
    expect(res.stderr).not.toContain('at Module.');
  });

  // 5. --at does not modify working tree or HEAD
  it('5. --at operates 100% read-only and leaves working tree and HEAD untouched', async () => {
    const hash1 = repo.commitFile('f1.txt', 'content 1\n', 'feat: first');
    repo.commitFile('f2.txt', 'content 2\n', 'feat: second');

    const headBefore = repo.git(['rev-parse', 'HEAD']).trim();
    const statusBefore = repo.git(['status', '--porcelain']).trim();

    // Inspect earlier commit
    const res = await runCliProcess(['--at', hash1], repo.dir);
    expect(res.exitCode).toBe(0);

    const headAfter = repo.git(['rev-parse', 'HEAD']).trim();
    const statusAfter = repo.git(['status', '--porcelain']).trim();

    expect(headAfter).toBe(headBefore);
    expect(statusAfter).toBe(statusBefore);
    expect(fs.existsSync(path.join(repo.dir, 'f2.txt'))).toBe(true);
  });

  // 6. --compare valid commits
  it('6. compares two points in history with --compare <commit1> <commit2>', async () => {
    const c1 = repo.commitFile('README.md', '# Title\n', 'docs: initial release');
    repo.commitFile('site/index.html', '<h1>Hello</h1>\n', 'feat(site): initial site');
    const c2 = repo.commitFile('site/styles.css', 'body { color: blue; }\n', 'fix(site): polish styles');

    const res = await runCliProcess(['--compare', c1, c2], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    expect(text).toContain('COMPARISON');
    expect(text).toContain(c1.substring(0, 7));
    expect(text).toContain(c2.substring(0, 7));
    expect(text).toContain('Changes');
    expect(text).toContain('2 files changed');
    expect(text).toContain('Areas');
    expect(text).toContain('site/');
    expect(text).toContain("What's going on");
    expect(text).toContain('Files');
    expect(text).toContain('site/index.html');
    expect(text).toContain('site/styles.css');
  });

  // 7. --compare invalid commit
  it('7. reports clear error when a commit in --compare does not exist', async () => {
    const valid = repo.commitFile('f.txt', '1\n', 'init');
    const res = await runCliProcess(['--compare', valid, 'badc0ffee12345'], repo.dir);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('badc0ffee12345');
    expect(res.stderr).toContain('was not found in this repository');
  });

  // 8. --search matching messages
  it('8. searches commit history by commit message with --search', async () => {
    repo.commitFile('f1.txt', '1\n', 'feat(site): redesign landing page');
    repo.commitFile('f2.txt', '2\n', 'docs: update readme');
    repo.commitFile('f3.txt', '3\n', 'fix(site): polish Landing page mobile');

    const res = await runCliProcess(['--search', 'landing page'], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    expect(text).toContain('SEARCH RESULTS');
    expect(text).toContain('2 commits found');
    expect(text).toContain('feat(site): redesign landing page');
    expect(text).toContain('fix(site): polish Landing page mobile');
    expect(text).not.toContain('docs: update readme');
  });

  // 9. --search no results
  it('9. handles --search with no matching results gracefully', async () => {
    repo.commitFile('f1.txt', '1\n', 'feat: initial');
    const res = await runCliProcess(['--search', 'nonexistent-pattern'], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);
    expect(text).toContain('0 commits found');
    expect(text).toContain('No commits found matching "nonexistent-pattern"');
  });

  // 10. --author matching commits
  it('10. filters commits by author with --author', async () => {
    repo.commitFile('f1.txt', '1\n', 'feat: commit by default author');

    repo.git(['config', 'user.name', 'Alice Contributor']);
    repo.git(['config', 'user.email', 'alice@example.com']);
    repo.commitFile('f2.txt', '2\n', 'feat(core): commit by alice');
    repo.commitFile('f3.txt', '3\n', 'docs: second commit by alice');

    const res = await runCliProcess(['--author', 'Alice'], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    expect(text).toContain('AUTHOR HISTORY');
    expect(text).toContain('Alice');
    expect(text).toContain('2 commits');
    expect(text).toContain('feat(core): commit by alice');
    expect(text).toContain('docs: second commit by alice');
    expect(text).not.toContain('commit by default author');
  });

  // 11. --author no results
  it('11. handles --author with no results gracefully', async () => {
    repo.commitFile('f1.txt', '1\n', 'feat: init');
    const res = await runCliProcess(['--author', 'Nobody'], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);
    expect(text).toContain('0 commits');
    expect(text).toContain('No commits found for author "Nobody"');
  });

  // 12. --branch valid branch
  it('12. shows history reachable from specified local branch with --branch', async () => {
    repo.commitFile('main.txt', '1\n', 'feat: on main');
    repo.git(['checkout', '-b', 'feature-auth']);
    repo.commitFile('auth.txt', 'auth\n', 'feat(auth): add oauth login');

    // Switch back to main
    repo.git(['checkout', 'main']);

    // Inspect feature-auth while still on main branch
    const res = await runCliProcess(['--branch', 'feature-auth'], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    expect(text).toContain('Branch (Filter)');
    expect(text).toContain('feature-auth');
    expect(text).toContain('feat(auth): add oauth login');
  });

  // 13. --branch invalid branch
  it('13. reports actionable error when specified branch does not exist', async () => {
    repo.commitFile('f.txt', '1\n', 'feat: init');
    const res = await runCliProcess(['--branch', 'nonexistent-branch'], repo.dir);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('Branch "nonexistent-branch" was not found');
  });

  // 14. --branch does not switch HEAD
  it('14. --branch does not switch HEAD or checkout files', async () => {
    repo.commitFile('main.txt', '1\n', 'feat: on main');
    repo.git(['checkout', '-b', 'feature-auth']);
    repo.commitFile('auth.txt', 'auth\n', 'feat(auth): auth file');
    repo.git(['checkout', 'main']);

    const branchBefore = repo.git(['symbolic-ref', '--short', 'HEAD']).trim();
    expect(branchBefore).toBe('main');

    const res = await runCliProcess(['--branch', 'feature-auth'], repo.dir);
    expect(res.exitCode).toBe(0);

    const branchAfter = repo.git(['symbolic-ref', '--short', 'HEAD']).trim();
    expect(branchAfter).toBe('main');
  });

  // 15. merge commit
  it('15. correctly displays merge commit status in timeline and commit view', async () => {
    repo.commitFile('main.txt', '1\n', 'feat: on main');
    repo.git(['checkout', '-b', 'topic']);
    repo.commitFile('topic.txt', 'topic\n', 'feat: on topic');
    repo.git(['checkout', 'main']);
    repo.git(['merge', '--no-ff', 'topic', '-m', 'Merge topic into main']);

    const res = await runCliProcess([], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);
    expect(text).toContain('[merge]');
    expect(text).toContain('(merge commit)');
  });

  // 16. merge parents
  it('16. displays multiple parents explicitly for merge commits in commit view', async () => {
    repo.commitFile('main.txt', '1\n', 'feat: on main');
    repo.git(['checkout', '-b', 'topic']);
    repo.commitFile('topic.txt', 'topic\n', 'feat: on topic');
    repo.git(['checkout', 'main']);
    repo.git(['merge', '--no-ff', 'topic', '-m', 'Merge topic branch']);

    const mergeHash = repo.git(['rev-parse', 'HEAD']).trim();
    const res = await runCliProcess(['--commit', mergeHash], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    expect(text).toContain('MERGE');
    expect(text).toContain('merge commit');
    expect(text).toContain('Parents');
    expect(text).toContain('Merge commit combining 2 parents');
  });

  // 17. renamed file history
  it('17. traces file history across renames', async () => {
    repo.commitFile('src/old-module.ts', 'export const v = 1;\n', 'feat: add original module');
    repo.git(['mv', 'src/old-module.ts', 'src/new-module.ts']);
    repo.git(['commit', '-m', 'refactor: rename module']);

    const res = await runCliProcess(['--file', 'src/new-module.ts'], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    expect(text).toContain('FILE HISTORY');
    expect(text).toContain('src/new-module.ts');
    expect(text).toContain('refactor: rename module');
    expect(text).toContain('feat: add original module');
  });

  // 18. deleted file history
  it('18. displays history of a file even when the file was deleted later', async () => {
    repo.commitFile('src/deleted.ts', 'export const dead = true;\n', 'feat: add temporary file');
    repo.commitFile('src/deleted.ts', 'export const dead = false;\n', 'fix: tweak temporary file');
    repo.git(['rm', 'src/deleted.ts']);
    repo.git(['commit', '-m', 'chore: remove temporary file']);

    // deleted.ts does not exist in working directory
    expect(fs.existsSync(path.join(repo.dir, 'src/deleted.ts'))).toBe(false);

    const res = await runCliProcess(['--file', 'src/deleted.ts'], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    expect(text).toContain('FILE HISTORY');
    expect(text).toContain('src/deleted.ts');
    expect(text).toContain('chore: remove temporary file');
    expect(text).toContain('fix: tweak temporary file');
    expect(text).toContain('feat: add temporary file');
  });

  // 19. unicode filename
  it('19. handles unicode filenames in snapshots, comparisons, and timelines', async () => {
    repo.commitFile('docs/🚀_launch.md', '# Launch\n', 'docs: launch guide');
    const c1 = repo.git(['rev-parse', 'HEAD']).trim();
    repo.commitFile('docs/✨_features.md', '# Features\n', 'docs: features guide');
    const c2 = repo.git(['rev-parse', 'HEAD']).trim();

    const snapshotRes = await runCliProcess(['--at', c2], repo.dir);
    expect(snapshotRes.exitCode).toBe(0);
    expect(stripAnsi(snapshotRes.stdout)).toContain('docs/');

    const compRes = await runCliProcess(['--compare', c1, c2], repo.dir);
    expect(compRes.exitCode).toBe(0);
    expect(stripAnsi(compRes.stdout)).toContain('✨_features.md');
  });

  // 20. filename with spaces
  it('20. handles filenames with spaces in comparisons and file history', async () => {
    repo.commitFile('docs/User Guide Document.md', '# Guide\n', 'docs: user guide');
    const res = await runCliProcess(['--file', 'docs/User Guide Document.md'], repo.dir);
    expect(res.exitCode).toBe(0);
    expect(stripAnsi(res.stdout)).toContain('docs: user guide');
  });

  // 21. large/high-churn commit classification
  it('21. classifies high-churn commits as Large deterministically', async () => {
    // Add a normal small commit
    repo.commitFile('small.txt', 'line 1\n', 'feat: small tweak');

    // Add a large commit (>100 lines)
    const largeContent = Array.from({ length: 150 }, (_, i) => `line ${i}`).join('\n') + '\n';
    const largeHash = repo.commitFile('large.txt', largeContent, 'feat: big migration');

    const res = await runCliProcess(['--commit', largeHash], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);

    expect(text).toContain('Change volume: Large');
  });

  // 22. activity focus detection
  it('22. detects activity focus in website and documentation', async () => {
    repo.commitFile('site/a.html', 'A', 'feat(site): add a');
    repo.commitFile('site/b.html', 'B', 'feat(site): add b');
    repo.commitFile('site/c.html', 'C', 'feat(site): add c');

    const res = await runCliProcess([], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);
    expect(text).toContain('Most recent activity is focused on the website.');
  });

  // 23. JSON timeline mode
  it('23. outputs structured JSON with mode: timeline', async () => {
    repo.commitFile('README.md', '# Readme\n', 'docs: init');
    const res = await runCliProcess(['--json'], repo.dir);
    expect(res.exitCode).toBe(0);

    const json = JSON.parse(res.stdout);
    expect(json.mode).toBe('timeline');
    expect(json).toHaveProperty('repository');
    expect(json).toHaveProperty('commits');
    expect(json.commits).toBeInstanceOf(Array);
  });

  // 24. JSON snapshot mode
  it('24. outputs structured JSON with mode: snapshot for --at', async () => {
    const hash = repo.commitFile('app.ts', '1;\n', 'feat: init app');
    const res = await runCliProcess(['--at', hash, '--json'], repo.dir);
    expect(res.exitCode).toBe(0);

    const json = JSON.parse(res.stdout);
    expect(json.mode).toBe('snapshot');
    expect(json.time.hash).toBe(hash);
    expect(json).toHaveProperty('totalFiles', 1);
    expect(json).toHaveProperty('topLevelEntries');
  });

  // 25. JSON comparison mode
  it('25. outputs structured JSON with mode: compare for --compare', async () => {
    const c1 = repo.commitFile('f1.txt', '1\n', 'feat: c1');
    const c2 = repo.commitFile('f2.txt', '2\n', 'feat: c2');

    const res = await runCliProcess(['--compare', c1, c2, '--json'], repo.dir);
    expect(res.exitCode).toBe(0);

    const json = JSON.parse(res.stdout);
    expect(json.mode).toBe('compare');
    expect(json.base.hash).toBe(c1);
    expect(json.target.hash).toBe(c2);
    expect(json.totalFilesChanged).toBe(1);
  });

  // 26. JSON purity
  it('26. guarantees JSON purity on stdout (no ANSI codes or banners)', async () => {
    repo.commitFile('f.txt', 'test\n', 'feat: test');
    const res = await runCliProcess(['--json'], repo.dir);
    expect(res.exitCode).toBe(0);

    expect(res.stdout.trim().startsWith('{')).toBe(true);
    expect(res.stdout.trim().endsWith('}')).toBe(true);
    expect(res.stdout).not.toContain('\u001b');
    expect(res.stdout).not.toContain('COMMIT TIME MACHINE');
    expect(() => JSON.parse(res.stdout)).not.toThrow();
  });

  // 27. invalid flag combinations
  it('27. rejects ambiguous flag combinations with clear error', async () => {
    repo.commitFile('f.txt', '1\n', 'init');
    const res = await runCliProcess(['--commit', 'a1b2c3d', '--compare', 'c1', 'c2'], repo.dir);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('Cannot combine options --commit and --compare');
  });

  // 28. --limit combinations
  it('28. supports --limit combination with --branch and --search', async () => {
    for (let i = 1; i <= 5; i++) {
      repo.commitFile(`f${i}.txt`, `${i}\n`, `feat: add feature ${i}`);
    }

    const res = await runCliProcess(['--search', 'feature', '--limit', '2'], repo.dir);
    expect(res.exitCode).toBe(0);
    const text = stripAnsi(res.stdout);
    expect(text).toContain('2 commits found');
  });

  // 29. empty repository
  it('29. handles empty repository across various options gracefully', async () => {
    const res = await runCliProcess([], repo.dir);
    expect(res.exitCode).toBe(0);
    expect(stripAnsi(res.stdout)).toContain('No commits yet.');

    const resJson = await runCliProcess(['--json'], repo.dir);
    expect(resJson.exitCode).toBe(0);
    const json = JSON.parse(resJson.stdout);
    expect(json.totalCommits).toBe(0);
  });

  // 30. outside repository
  it('30. reports clean error when executed outside a Git repository', async () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctm-nongit-'));
    try {
      const res = await runCliProcess([], nonGitDir);
      expect(res.exitCode).toBe(1);
      const text = stripAnsi(res.stderr);
      expect(text).toContain('COMMIT TIME MACHINE');
      expect(text).toContain('✗ Not inside a Git repository.');
      expect(text).toContain('Run this command from a Git repository.');
    } finally {
      fs.rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  // 31. interactive mode non-TTY rejection
  it('31. rejects --interactive in non-TTY environment gracefully', async () => {
    repo.commitFile('f.txt', '1\n', 'feat: init');
    const res = await runCliProcess(['--interactive'], repo.dir);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('Interactive mode requires a TTY.');
    expect(res.stderr).toContain('Use the normal CLI output or --json instead.');
  });

  // 32. interactive mode conflict with --json
  it('32. rejects --json --interactive conflict without contaminating stdout', async () => {
    repo.commitFile('f.txt', '1\n', 'feat: init');
    const res = await runCliProcess(['--json', '--interactive'], repo.dir);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe('');
    expect(res.stderr).toContain('Cannot combine --json with --interactive mode.');
  });

  // 33. interactive mode on empty repository
  it('33. reports clean message when interactive mode is invoked on empty repository in non-TTY', async () => {
    const res = await runCliProcess(['-i'], repo.dir);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('Interactive mode requires a TTY.');
  });

  // 34. read-only guarantee verification
  it('34. strictly verifies that working tree and HEAD remain untouched after commands', async () => {
    repo.commitFile('f1.txt', '1\n', 'feat: c1');
    repo.commitFile('f2.txt', '2\n', 'feat: c2');

    const headBefore = repo.git(['rev-parse', 'HEAD']).trim();
    const statusBefore = repo.git(['status', '--porcelain']).trim();

    await runCliProcess(['--limit', '1'], repo.dir);
    await runCliProcess(['--search', 'feat'], repo.dir);
    await runCliProcess(['--interactive'], repo.dir);

    const headAfter = repo.git(['rev-parse', 'HEAD']).trim();
    const statusAfter = repo.git(['status', '--porcelain']).trim();

    expect(headAfter).toBe(headBefore);
    expect(statusAfter).toBe(statusBefore);
  });

  // 35. getBoundedCommitDiff on root and merge commits
  it('35. produces valid diff for root commit and informative message for clean merge commit', async () => {
    repo.commitFile('init.txt', 'hello\n', 'feat: initial root commit');
    const rootHash = repo.git(['rev-parse', 'HEAD']).trim();

    const rootDiff = await getBoundedCommitDiff(rootHash, 80, repo.dir);
    expect(rootDiff).toContain('diff --git');
    expect(rootDiff).toContain('+hello');

    repo.git(['checkout', '-b', 'feat-branch']);
    repo.commitFile('branch.txt', 'branch content\n', 'feat: branch commit');

    repo.git(['checkout', 'main']);
    repo.commitFile('main.txt', 'main content\n', 'feat: main commit');

    repo.git(['merge', '--no-ff', 'feat-branch', '-m', 'Merge branch feat-branch']);
    const mergeHash = repo.git(['rev-parse', 'HEAD']).trim();

    const mergeDiff = await getBoundedCommitDiff(mergeHash, 80, repo.dir);
    expect(mergeDiff).toContain('No conflict changes in merge commit (clean branch integration).');
  });

  // 36. rejects incompatible --interactive flag combinations
  it('36. rejects incompatible --interactive flag combinations', async () => {
    repo.commitFile('f.txt', '1\n', 'feat: init');
    const resAt = await runCliProcess(['-i', '--at', 'HEAD'], repo.dir);
    expect(resAt.exitCode).toBe(1);
    expect(resAt.stderr).toContain('Cannot combine option --at with --interactive mode.');

    const resCompare = await runCliProcess(['-i', '--compare', 'HEAD', 'HEAD'], repo.dir);
    expect(resCompare.exitCode).toBe(1);
    expect(resCompare.stderr).toContain('Cannot combine option --compare with --interactive mode.');

    const resFile = await runCliProcess(['-i', '--file', 'f.txt'], repo.dir);
    expect(resFile.exitCode).toBe(1);
    expect(resFile.stderr).toContain('Cannot combine option --file with --interactive mode.');
  });
});
