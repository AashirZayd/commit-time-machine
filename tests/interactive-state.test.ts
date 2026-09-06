import { describe, it, expect } from 'vitest';
import { createInitialState, transition, adjustScrollOffset, getVisibleCommitRowsCount } from '../src/interactive/state.js';
import type { RawCommit, RepoInfo } from '../src/types/index.js';

const mockRepo: RepoInfo = {
  isGitRepo: true,
  rootPath: '/fake/repo',
  repoName: 'my-project',
  branch: 'main',
  isDetached: false,
  hasCommits: true
};

function makeMockCommit(id: string, subject: string): RawCommit {
  return {
    hash: `${id}00000000000000000000000000000000000`,
    shortHash: id,
    author: 'Tester',
    email: 'tester@example.com',
    date: '2026-09-07',
    timestamp: 1788720000,
    subject,
    body: subject,
    parents: [],
    isMerge: false,
    files: [
      {
        path: 'src/index.ts',
        status: 'M',
        additions: 2,
        deletions: 1,
        isBinary: false
      }
    ],
    additions: 2,
    deletions: 1
  };
}

const mockCommits: RawCommit[] = [
  makeMockCommit('c1', 'feat: commit 1'),
  makeMockCommit('c2', 'feat: commit 2'),
  makeMockCommit('c3', 'feat: commit 3'),
  makeMockCommit('c4', 'feat: commit 4'),
  makeMockCommit('c5', 'feat: commit 5')
];

describe('Interactive State Machine', () => {
  it('initializes in timeline view at index 0', () => {
    const state = createInitialState(mockRepo, mockCommits, 80, 24);
    expect(state.view).toBe('timeline');
    expect(state.selectedIndex).toBe(0);
    expect(state.scrollOffset).toBe(0);
    expect(state.isExited).toBe(false);
  });

  it('moves down with DOWN action', () => {
    let state = createInitialState(mockRepo, mockCommits, 80, 24);
    state = transition(state, 'DOWN');
    expect(state.selectedIndex).toBe(1);
    state = transition(state, 'DOWN');
    expect(state.selectedIndex).toBe(2);
  });

  it('moves up with UP action', () => {
    let state = createInitialState(mockRepo, mockCommits, 80, 24);
    state = transition(state, 'DOWN');
    state = transition(state, 'DOWN');
    expect(state.selectedIndex).toBe(2);

    state = transition(state, 'UP');
    expect(state.selectedIndex).toBe(1);
  });

  it('clamps at top boundary (index 0)', () => {
    let state = createInitialState(mockRepo, mockCommits, 80, 24);
    expect(state.selectedIndex).toBe(0);
    state = transition(state, 'UP');
    expect(state.selectedIndex).toBe(0);
  });

  it('clamps at bottom boundary (last index)', () => {
    let state = createInitialState(mockRepo, mockCommits, 80, 24);
    for (let i = 0; i < 10; i++) {
      state = transition(state, 'DOWN');
    }
    expect(state.selectedIndex).toBe(mockCommits.length - 1);
  });

  it('jumps to top with HOME and bottom with END', () => {
    let state = createInitialState(mockRepo, mockCommits, 80, 24);
    state = transition(state, 'END');
    expect(state.selectedIndex).toBe(mockCommits.length - 1);

    state = transition(state, 'HOME');
    expect(state.selectedIndex).toBe(0);
  });

  it('pages down and pages up', () => {
    const manyCommits = Array.from({ length: 30 }, (_, i) => makeMockCommit(`c${i}`, `commit ${i}`));
    let state = createInitialState(mockRepo, manyCommits, 80, 24);
    const visible = getVisibleCommitRowsCount(24);

    state = transition(state, 'PAGE_DOWN');
    expect(state.selectedIndex).toBe(visible);

    state = transition(state, 'PAGE_UP');
    expect(state.selectedIndex).toBe(0);
  });

  it('transitions from timeline to detail on ENTER, and back on BACK or ENTER', () => {
    let state = createInitialState(mockRepo, mockCommits, 80, 24);
    expect(state.view).toBe('timeline');

    state = transition(state, 'ENTER');
    expect(state.view).toBe('detail');

    state = transition(state, 'BACK');
    expect(state.view).toBe('timeline');

    state = transition(state, 'ENTER');
    expect(state.view).toBe('detail');

    state = transition(state, 'ENTER');
    expect(state.view).toBe('timeline');
  });

  it('transitions from detail to diff on DIFF, and back on BACK', () => {
    let state = createInitialState(mockRepo, mockCommits, 80, 24);
    state = transition(state, 'ENTER');
    expect(state.view).toBe('detail');

    state = transition(state, 'DIFF');
    expect(state.view).toBe('diff');

    state = transition(state, 'BACK');
    expect(state.view).toBe('detail');
  });

  it('quits cleanly on QUIT or BACK on timeline', () => {
    let state1 = createInitialState(mockRepo, mockCommits, 80, 24);
    state1 = transition(state1, 'QUIT');
    expect(state1.isExited).toBe(true);

    let state2 = createInitialState(mockRepo, mockCommits, 80, 24);
    state2 = transition(state2, 'BACK');
    expect(state2.isExited).toBe(true);
  });

  it('adjusts scroll offset properly to keep selected item in view', () => {
    expect(adjustScrollOffset(0, 0, 5)).toBe(0);
    expect(adjustScrollOffset(4, 0, 5)).toBe(0);
    // When selected index moves to 5, offset advances to 1
    expect(adjustScrollOffset(5, 0, 5)).toBe(1);
    expect(adjustScrollOffset(7, 0, 5)).toBe(3);
    // When moving back up to 2, offset moves back to 2
    expect(adjustScrollOffset(2, 3, 5)).toBe(2);
  });

  it('adjusts scroll offset and preserves diffCache on RESIZE action', () => {
    let state = createInitialState(mockRepo, mockCommits, 80, 24);
    state.diffCache = { c1: 'diff content' };
    state.selectedIndex = 4;
    state.terminalHeight = 12; // visibleRows = 12 - 9 = 3

    state = transition(state, 'RESIZE');
    expect(state.scrollOffset).toBe(2); // selectedIndex 4 in window of 3 visible rows
    expect(state.diffCache.c1).toBe('diff content');
  });
});
