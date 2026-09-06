export type FileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?';

export type ChurnMagnitude = 'Small' | 'Medium' | 'Large';

export interface FileChange {
  path: string;
  oldPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  isBinary: boolean;
}

export interface RawCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string; // YYYY-MM-DD
  timestamp: number; // Unix epoch in seconds
  subject: string;
  body: string;
  parents: string[];
  isMerge: boolean;
  files: FileChange[];
  additions: number;
  deletions: number;
  churnMagnitude?: ChurnMagnitude;
}

export interface RepoInfo {
  isGitRepo: boolean;
  rootPath: string;
  repoName: string;
  branch?: string;
  isDetached: boolean;
  headHash?: string;
  shortHeadHash?: string;
  hasCommits: boolean;
}

export interface FileHistoryEntry {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  subject: string;
  status: FileStatus;
  path: string;
  oldPath?: string;
}

export interface CliOptions {
  limit: number;
  commit?: string;
  file?: string;
  since?: string;
  verbose: boolean;
  json: boolean;
  help: boolean;
  version: boolean;
  cwd?: string;
  // Phase 2 additions
  firstParent: boolean;
  at?: string;
  compare?: [string, string];
  search?: string;
  author?: string;
  branch?: string;
  // Phase 3 additions
  interactive: boolean;
}

export interface TimelineInterpretation {
  summary: string;
  focusArea?: string;
  observableFacts: string[];
  bursts?: string[];
}

export interface CommitInterpretation {
  summary: string;
  focusArea?: string;
  observableFacts: string[];
  conventionalType?: string;
  conventionalScope?: string;
  churnMagnitude: ChurnMagnitude;
}

export interface RepositoryTimeline {
  repo: RepoInfo;
  commits: RawCommit[];
  totalCommitsInspected: number;
  isFirstParentOnly: boolean;
  branchFilter?: string;
  interpretation: TimelineInterpretation;
}

export interface CommitDetail {
  repo: RepoInfo;
  commit: RawCommit;
  interpretation: CommitInterpretation;
}

export interface FileTimeline {
  repo: RepoInfo;
  filePath: string;
  entries: FileHistoryEntry[];
  interpretation: {
    summary: string;
    totalModifications: number;
  };
}

export interface SnapshotStructureItem {
  name: string;
  type: 'tree' | 'blob';
}

export interface SnapshotDetail {
  repo: RepoInfo;
  commit: RawCommit;
  totalFiles: number;
  topLevelEntries: SnapshotStructureItem[];
  branchContext?: string;
  interpretation: {
    summary: string;
    observableFacts: string[];
  };
}

export interface ComparisonDetail {
  repo: RepoInfo;
  baseCommit: RawCommit;
  targetCommit: RawCommit;
  files: FileChange[];
  totalFilesChanged: number;
  additions: number;
  deletions: number;
  affectedAreas: string[];
  interpretation: {
    summary: string;
    focusArea?: string;
    observableFacts: string[];
  };
}

export interface SearchResult {
  repo: RepoInfo;
  searchTerm: string;
  matches: RawCommit[];
  interpretation: {
    summary: string;
    observableFacts: string[];
  };
}

export interface AuthorHistory {
  repo: RepoInfo;
  authorName: string;
  totalCommits: number;
  commits: RawCommit[];
  latestCommit?: RawCommit;
  interpretation: {
    summary: string;
    observableFacts: string[];
  };
}
