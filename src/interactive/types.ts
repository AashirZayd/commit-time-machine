import type { RepoInfo, RawCommit } from '../types/index.js';

export type InteractiveView = 'timeline' | 'detail' | 'diff';

export type KeyAction =
  | 'UP'
  | 'DOWN'
  | 'PAGE_UP'
  | 'PAGE_DOWN'
  | 'HOME'
  | 'END'
  | 'ENTER'
  | 'BACK'
  | 'DIFF'
  | 'QUIT'
  | 'RESIZE'
  | 'NONE';

export interface InteractiveState {
  repo: RepoInfo;
  commits: RawCommit[];
  selectedIndex: number;
  scrollOffset: number;
  view: InteractiveView;
  terminalWidth: number;
  terminalHeight: number;
  diffOutput?: string;
  diffCommitHash?: string;
  diffCache?: Record<string, string>;
  isExited: boolean;
}
