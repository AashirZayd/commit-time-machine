import { runGit, GitError } from './runner.js';
import type { RawCommit, FileChange, FileStatus, FileHistoryEntry } from '../types/index.js';

const COMMIT_DELIMITER = '\x1e';
const FIELD_DELIMITER = '\x1f';

export interface GetCommitsOptions {
  limit?: number;
  since?: string;
  revision?: string;
  cwd?: string;
  firstParent?: boolean;
  search?: string;
  author?: string;
  branch?: string;
}

export function parseDiffTokens(rawTokensStr: string): { files: FileChange[]; additions: number; deletions: number } {
  const tokens = rawTokensStr.split('\0');
  const fileMap = new Map<string, FileChange>();

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i].trim();
    if (!token) {
      i++;
      continue;
    }

    // Check for raw status line, e.g. ":100644 100644 ce01362 ce01362 R100" or ":000000 100644 0000000 5f5521f A"
    const rawMatch = token.match(/^:([0-9]{6})\s+([0-9]{6})\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([A-Z][0-9]*)/);
    if (rawMatch) {
      const rawStatusCode = rawMatch[5];
      const statusLetter = (rawStatusCode[0] || 'M') as FileStatus;
      i++;
      if (statusLetter === 'R' || statusLetter === 'C') {
        const oldPath = tokens[i] || '';
        i++;
        const newPath = tokens[i] || '';
        i++;
        const existing = fileMap.get(newPath);
        if (existing) {
          existing.status = statusLetter;
          existing.oldPath = oldPath;
        } else {
          fileMap.set(newPath, {
            path: newPath,
            oldPath,
            status: statusLetter,
            additions: 0,
            deletions: 0,
            isBinary: false
          });
        }
      } else {
        const filePath = tokens[i] || '';
        i++;
        const existing = fileMap.get(filePath);
        if (existing) {
          existing.status = statusLetter;
        } else {
          fileMap.set(filePath, {
            path: filePath,
            status: statusLetter,
            additions: 0,
            deletions: 0,
            isBinary: false
          });
        }
      }
      continue;
    }

    // Check for numstat line: "<additions>\t<deletions>\t<file>" or "-\t-\t<file>" or "0\t0\t" (rename)
    const numstatMatch = token.match(/^([0-9]+|-)\t([0-9]+|-)\t(.*)$/);
    if (numstatMatch) {
      const addStr = numstatMatch[1];
      const delStr = numstatMatch[2];
      const pathSuffix = numstatMatch[3];
      const isBinary = addStr === '-' && delStr === '-';
      const additions = isBinary ? 0 : parseInt(addStr, 10) || 0;
      const deletions = isBinary ? 0 : parseInt(delStr, 10) || 0;

      if (pathSuffix === '') {
        // In -z mode, a rename in numstat is "0\t0\t\0<oldPath>\0<newPath>\0"
        i++;
        const oldPath = tokens[i] || '';
        i++;
        const newPath = tokens[i] || '';
        i++;
        const existing = fileMap.get(newPath);
        if (existing) {
          existing.oldPath = oldPath;
          existing.additions = additions;
          existing.deletions = deletions;
          existing.isBinary = isBinary;
          if (existing.status === 'M') existing.status = 'R';
        } else {
          fileMap.set(newPath, {
            path: newPath,
            oldPath,
            status: 'R',
            additions,
            deletions,
            isBinary
          });
        }
      } else {
        const filePath = pathSuffix;
        i++;
        const existing = fileMap.get(filePath);
        if (existing) {
          existing.additions = additions;
          existing.deletions = deletions;
          existing.isBinary = isBinary;
        } else {
          fileMap.set(filePath, {
            path: filePath,
            status: 'M',
            additions,
            deletions,
            isBinary
          });
        }
      }
      continue;
    }

    i++;
  }

  const files = Array.from(fileMap.values());
  let totalAdd = 0;
  let totalDel = 0;
  for (const f of files) {
    totalAdd += f.additions;
    totalDel += f.deletions;
  }

  return { files, additions: totalAdd, deletions: totalDel };
}

export function parseCommitRecord(chunk: string): RawCommit | null {
  const trimmed = chunk.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(FIELD_DELIMITER);
  if (parts.length < 8) return null;

  const hash = parts[0];
  const shortHash = parts[1];
  const author = parts[2];
  const email = parts[3];
  const dateIso = parts[4];
  const timestamp = parseInt(parts[5], 10) || 0;
  const subject = parts[6];
  const parentsStr = parts[7];
  const parents = parentsStr.trim() ? parentsStr.trim().split(/\s+/) : [];
  const body = parts[8] || '';

  // The 10th item (index 9) contains diff tokens
  const diffPart = parts.length > 9 ? parts.slice(9).join(FIELD_DELIMITER) : '';
  const { files, additions, deletions } = parseDiffTokens(diffPart);

  return {
    hash,
    shortHash,
    author,
    email,
    date: dateIso.substring(0, 10), // YYYY-MM-DD
    timestamp,
    subject,
    body: body.trim(),
    parents,
    isMerge: parents.length > 1,
    files,
    additions,
    deletions
  };
}

export async function getCommits(options: GetCommitsOptions = {}): Promise<RawCommit[]> {
  const cwd = options.cwd || process.cwd();
  const args = [
    'log',
    '--root',
    '-z',
    '--numstat',
    '--raw'
  ];

  if (options.firstParent) {
    args.push('--first-parent');
  }

  if (options.search) {
    args.push('-i', `--grep=${options.search}`);
  }

  if (options.author) {
    args.push(`--author=${options.author}`);
  }

  if (options.limit !== undefined && options.limit > 0) {
    args.push('-n', String(options.limit));
  }

  if (options.since) {
    args.push(`--since=${options.since}`);
  }

  args.push(`--format=${COMMIT_DELIMITER}%H${FIELD_DELIMITER}%h${FIELD_DELIMITER}%an${FIELD_DELIMITER}%ae${FIELD_DELIMITER}%aI${FIELD_DELIMITER}%at${FIELD_DELIMITER}%s${FIELD_DELIMITER}%P${FIELD_DELIMITER}%B${FIELD_DELIMITER}`);

  if (options.branch) {
    args.push(options.branch);
  } else if (options.revision) {
    args.push(options.revision);
  }

  try {
    const res = await runGit(args, cwd);
    const chunks = res.stdout.split(COMMIT_DELIMITER);
    const commits: RawCommit[] = [];

    for (const chunk of chunks) {
      const commit = parseCommitRecord(chunk);
      if (commit) {
        commits.push(commit);
      }
    }

    return commits;
  } catch (err: unknown) {
    if (err instanceof GitError) {
      if (err.stderr.includes('does not have any commits yet') || err.stderr.includes('unknown revision')) {
        return [];
      }
    }
    throw err;
  }
}

export async function getSingleCommit(commitHash: string, cwd: string = process.cwd()): Promise<RawCommit> {
  // First verify the commit exists
  try {
    await runGit(['rev-parse', '--verify', `${commitHash}^{commit}`], cwd);
  } catch {
    throw new Error(`Commit "${commitHash}" was not found in this repository.`);
  }

  const args = [
    'show',
    '--root',
    '-m',
    '--first-parent',
    '-z',
    '--numstat',
    '--raw',
    `--format=${COMMIT_DELIMITER}%H${FIELD_DELIMITER}%h${FIELD_DELIMITER}%an${FIELD_DELIMITER}%ae${FIELD_DELIMITER}%aI${FIELD_DELIMITER}%at${FIELD_DELIMITER}%s${FIELD_DELIMITER}%P${FIELD_DELIMITER}%B${FIELD_DELIMITER}`,
    commitHash
  ];

  const res = await runGit(args, cwd);
  const chunks = res.stdout.split(COMMIT_DELIMITER);

  for (const chunk of chunks) {
    const commit = parseCommitRecord(chunk);
    if (commit) {
      return commit;
    }
  }

  throw new Error(`Could not parse commit "${commitHash}".`);
}

export async function getFileHistory(filePath: string, cwd: string = process.cwd(), limit?: number): Promise<FileHistoryEntry[]> {
  const args = [
    'log',
    '--follow',
    '--name-status',
    '-z',
    `--format=${COMMIT_DELIMITER}%H${FIELD_DELIMITER}%h${FIELD_DELIMITER}%an${FIELD_DELIMITER}%ae${FIELD_DELIMITER}%aI${FIELD_DELIMITER}%at${FIELD_DELIMITER}%s${FIELD_DELIMITER}%P${FIELD_DELIMITER}`
  ];

  if (limit !== undefined && limit > 0) {
    args.push('-n', String(limit));
  }

  args.push('--', filePath);

  const res = await runGit(args, cwd);
  const chunks = res.stdout.split(COMMIT_DELIMITER);
  const entries: FileHistoryEntry[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(FIELD_DELIMITER);
    if (parts.length < 7) continue;

    const hash = parts[0];
    const shortHash = parts[1];
    const author = parts[2];
    const dateIso = parts[4];
    const subject = parts[6];

    // Status is in the remaining token part
    let status: FileStatus = 'M';
    let oldPath: string | undefined;
    let resolvedPath = filePath;

    if (parts.length > 8) {
      const remainingTokens = parts.slice(8).join(FIELD_DELIMITER).split('\0').filter(Boolean);
      for (let j = 0; j < remainingTokens.length; j++) {
        const tok = remainingTokens[j].trim();
        if (tok.startsWith('R') || tok.startsWith('C')) {
          status = tok[0] as FileStatus;
          oldPath = remainingTokens[j + 1];
          resolvedPath = remainingTokens[j + 2] || filePath;
          break;
        } else if (tok === 'A' || tok === 'M' || tok === 'D') {
          status = tok as FileStatus;
          resolvedPath = remainingTokens[j + 1] || filePath;
          break;
        }
      }
    }

    entries.push({
      hash,
      shortHash,
      date: dateIso.substring(0, 10),
      author,
      subject,
      status,
      path: resolvedPath,
      oldPath
    });
  }

  return entries;
}
