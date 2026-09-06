import type { RepoInfo, RawCommit } from '../types/index.js';
import type { InteractiveState, KeyAction } from './types.js';

export function getVisibleCommitRowsCount(terminalHeight: number): number {
  // Header: 4 lines, Footer: 3 lines, Margins: 2 lines
  return Math.max(3, terminalHeight - 9);
}

export function adjustScrollOffset(
  selectedIndex: number,
  currentScrollOffset: number,
  visibleRows: number
): number {
  if (selectedIndex < currentScrollOffset) {
    return selectedIndex;
  }
  if (selectedIndex >= currentScrollOffset + visibleRows) {
    return selectedIndex - visibleRows + 1;
  }
  return currentScrollOffset;
}

export function createInitialState(
  repo: RepoInfo,
  commits: RawCommit[],
  terminalWidth: number = 80,
  terminalHeight: number = 24
): InteractiveState {
  return {
    repo,
    commits,
    selectedIndex: 0,
    scrollOffset: 0,
    view: 'timeline',
    terminalWidth: Math.max(1, terminalWidth),
    terminalHeight: Math.max(1, terminalHeight),
    diffCache: {},
    isExited: false
  };
}

export function transition(state: InteractiveState, action: KeyAction): InteractiveState {
  if (state.isExited) {
    return state;
  }

  const totalCommits = state.commits.length;
  const visibleRows = getVisibleCommitRowsCount(state.terminalHeight);

  if (action === 'QUIT') {
    return { ...state, isExited: true };
  }

  if (action === 'RESIZE') {
    const nextScroll = adjustScrollOffset(state.selectedIndex, state.scrollOffset, visibleRows);
    return { ...state, scrollOffset: nextScroll };
  }

  if (state.view === 'timeline') {
    switch (action) {
      case 'UP': {
        const nextIndex = Math.max(0, state.selectedIndex - 1);
        const nextScroll = adjustScrollOffset(nextIndex, state.scrollOffset, visibleRows);
        return { ...state, selectedIndex: nextIndex, scrollOffset: nextScroll };
      }
      case 'DOWN': {
        const nextIndex = Math.min(Math.max(0, totalCommits - 1), state.selectedIndex + 1);
        const nextScroll = adjustScrollOffset(nextIndex, state.scrollOffset, visibleRows);
        return { ...state, selectedIndex: nextIndex, scrollOffset: nextScroll };
      }
      case 'PAGE_UP': {
        const nextIndex = Math.max(0, state.selectedIndex - visibleRows);
        const nextScroll = adjustScrollOffset(nextIndex, state.scrollOffset, visibleRows);
        return { ...state, selectedIndex: nextIndex, scrollOffset: nextScroll };
      }
      case 'PAGE_DOWN': {
        const nextIndex = Math.min(Math.max(0, totalCommits - 1), state.selectedIndex + visibleRows);
        const nextScroll = adjustScrollOffset(nextIndex, state.scrollOffset, visibleRows);
        return { ...state, selectedIndex: nextIndex, scrollOffset: nextScroll };
      }
      case 'HOME': {
        const nextIndex = 0;
        const nextScroll = adjustScrollOffset(nextIndex, state.scrollOffset, visibleRows);
        return { ...state, selectedIndex: nextIndex, scrollOffset: nextScroll };
      }
      case 'END': {
        const nextIndex = Math.max(0, totalCommits - 1);
        const nextScroll = adjustScrollOffset(nextIndex, state.scrollOffset, visibleRows);
        return { ...state, selectedIndex: nextIndex, scrollOffset: nextScroll };
      }
      case 'ENTER': {
        if (totalCommits > 0) {
          return { ...state, view: 'detail' };
        }
        return state;
      }
      case 'BACK': {
        return { ...state, isExited: true };
      }
      default:
        return state;
    }
  }

  if (state.view === 'detail') {
    switch (action) {
      case 'BACK':
      case 'ENTER': {
        return { ...state, view: 'timeline' };
      }
      case 'DIFF': {
        return { ...state, view: 'diff' };
      }
      case 'UP': {
        const nextIndex = Math.max(0, state.selectedIndex - 1);
        const nextScroll = adjustScrollOffset(nextIndex, state.scrollOffset, visibleRows);
        return { ...state, selectedIndex: nextIndex, scrollOffset: nextScroll };
      }
      case 'DOWN': {
        const nextIndex = Math.min(Math.max(0, totalCommits - 1), state.selectedIndex + 1);
        const nextScroll = adjustScrollOffset(nextIndex, state.scrollOffset, visibleRows);
        return { ...state, selectedIndex: nextIndex, scrollOffset: nextScroll };
      }
      default:
        return state;
    }
  }

  if (state.view === 'diff') {
    switch (action) {
      case 'BACK':
      case 'ENTER':
      case 'DIFF': {
        return { ...state, view: 'detail' };
      }
      default:
        return state;
    }
  }

  return state;
}
