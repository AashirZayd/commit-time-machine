import { describe, it, expect } from 'vitest';
import {
  renderTimelineScreen,
  renderDetailScreen,
  renderDiffScreen,
  renderInteractiveScreen,
  truncate
} from '../src/interactive/renderer.js';
import { createInitialState } from '../src/interactive/state.js';
import { stripAnsi } from './helpers.js';
import type { RawCommit, RepoInfo } from '../src/types/index.js';

const mockRepo: RepoInfo = {
  isGitRepo: true,
  rootPath: '/fake/repo',
  repoName: 'my-project',
  branch: 'main',
  isDetached: false,
  hasCommits: true
};

function makeMockCommit(id: string, subject: string, isMerge: boolean = false): RawCommit {
  return {
    hash: `${id}00000000000000000000000000000000000`,
    shortHash: id,
    author: 'Aashir Zayd',
    email: 'aashir@example.com',
    date: '2026-09-07',
    timestamp: 1788720000,
    subject,
    body: subject,
    parents: isMerge ? ['p1', 'p2'] : ['p1'],
    isMerge,
    files: [
      {
        path: 'src/index.ts',
        status: 'M',
        additions: 12,
        deletions: 4,
        isBinary: false
      }
    ],
    additions: 12,
    deletions: 4
  };
}

describe('Interactive Renderer', () => {
  it('truncates strings deterministically with ellipsis', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('1234567890', 7)).toBe('1234...');
    expect(truncate('abc', 2)).toBe('ab');
  });

  it('renders timeline screen with selection cursor and branch information', () => {
    const commits = [
      makeMockCommit('c1', 'feat: initial release'),
      makeMockCommit('c2', 'docs: update documentation'),
      makeMockCommit('c3', 'Merge branch feature', true)
    ];
    const state = createInitialState(mockRepo, commits, 80, 24);
    const output = stripAnsi(renderTimelineScreen(state));

    expect(output).toContain('COMMIT TIME MACHINE');
    expect(output).toContain('main • 3 commits');
    expect(output).toContain('> 2026-09-07  c1  feat: initial release');
    expect(output).toContain('  2026-09-07  c2  docs: update documentation');
    expect(output).toContain('[merge]');
    expect(output).toContain('↑↓ / kj navigate   Enter inspect   q quit');
  });

  it('handles narrow terminals (60 cols) without wrapping', () => {
    const longCommit = makeMockCommit('c1', 'feat(very-long-scope): this is a very long commit message that definitely exceeds short width');
    const state = createInitialState(mockRepo, [longCommit], 60, 24);
    const output = stripAnsi(renderTimelineScreen(state));

    const lines = output.split('\n');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(65);
    }
  });

  it('renders commit detail screen with changes and summary', () => {
    const commit = makeMockCommit('3047f9d', 'docs: set npm as primary installation method');
    const state = {
      ...createInitialState(mockRepo, [commit], 80, 24),
      view: 'detail' as const
    };
    const output = stripAnsi(renderDetailScreen(state));

    expect(output).toContain('COMMIT TIME MACHINE — DETAIL');
    expect(output).toContain('3047f9d');
    expect(output).toContain('docs: set npm as primary installation method');
    expect(output).toContain('Author: Aashir Zayd <aashir@example.com>');
    expect(output).toContain('Changes');
    expect(output).toContain('src/index.ts');
    expect(output).toContain('+12');
    expect(output).toContain('-4');
    expect(output).toContain('Summary');
    expect(output).toContain('Enter / Backspace / Esc back');
  });

  it('renders bounded diff preview screen', () => {
    const commit = makeMockCommit('3047f9d', 'feat: test diff');
    const state = {
      ...createInitialState(mockRepo, [commit], 80, 24),
      view: 'diff' as const,
      diffOutput: 'diff --git a/file b/file\n+ added line\n- removed line'
    };
    const output = stripAnsi(renderDiffScreen(state));

    expect(output).toContain('DIFF PREVIEW — 3047f9d');
    expect(output).toContain('+ added line');
    expect(output).toContain('- removed line');
    expect(output).toContain('Backspace / Esc back to detail');
  });

  it('renderInteractiveScreen dispatches to correct view', () => {
    const commit = makeMockCommit('3047f9d', 'feat: test');
    const state = createInitialState(mockRepo, [commit], 80, 24);

    expect(renderInteractiveScreen({ ...state, view: 'timeline' })).toContain('COMMIT TIME MACHINE');
    expect(renderInteractiveScreen({ ...state, view: 'detail' })).toContain('DETAIL');
    expect(renderInteractiveScreen({ ...state, view: 'diff', diffOutput: 'test' })).toContain('DIFF PREVIEW');
  });

  it('renders narrow terminal fallback screen when width < 40 or height < 10', () => {
    const commit = makeMockCommit('c1', 'feat: initial');
    const stateNarrow = createInitialState(mockRepo, [commit], 38, 20);
    const outputNarrow = stripAnsi(renderInteractiveScreen(stateNarrow));

    expect(outputNarrow).toContain('Terminal too small:');
    expect(outputNarrow).toContain('Current:  38 cols × 20 rows');
    expect(outputNarrow).toContain('Required: 40 cols × 10 rows');
    expect(outputNarrow).toContain('Please resize terminal or press q to quit');

    const stateShort = createInitialState(mockRepo, [commit], 80, 8);
    const outputShort = stripAnsi(renderInteractiveScreen(stateShort));
    expect(outputShort).toContain('Terminal too small:');
    expect(outputShort).toContain('Current:  80 cols × 8 rows');
  });

  it('renders root commit detail with initial commit parent note', () => {
    const rootCommit: RawCommit = {
      ...makeMockCommit('r1', 'Initial repository commit'),
      parents: []
    };
    const state = {
      ...createInitialState(mockRepo, [rootCommit], 80, 24),
      view: 'detail' as const
    };
    const output = stripAnsi(renderDetailScreen(state));

    expect(output).toContain('Parents');
    expect(output).toContain('None (initial repository commit)');
  });

  it('renders merge commit detail with merge commit badge and multiple parents', () => {
    const mergeCommit: RawCommit = {
      ...makeMockCommit('m1', 'Merge branch feature into main', true),
      parents: ['p1hash1234567890', 'p2hash1234567890']
    };
    const state = {
      ...createInitialState(mockRepo, [mergeCommit], 80, 24),
      view: 'detail' as const
    };
    const output = stripAnsi(renderDetailScreen(state));

    expect(output).toContain('COMMIT TIME MACHINE — MERGE');
    expect(output).toContain('p1hash1, p2hash1 (merge commit)');
  });

  it('renders diff preview with truncated count indicator when diff is tall', () => {
    const commit = makeMockCommit('c1', 'feat: large diff');
    const diffLines = Array.from({ length: 40 }, (_, i) => `+ line ${i + 1}`).join('\n');
    const state = {
      ...createInitialState(mockRepo, [commit], 80, 20),
      view: 'diff' as const,
      diffOutput: diffLines
    };
    const output = stripAnsi(renderDiffScreen(state));

    expect(output).toContain('DIFF PREVIEW — c1');
    expect(output).toMatch(/\.\.\. \(\d+ more lines\)/);
  });
});
