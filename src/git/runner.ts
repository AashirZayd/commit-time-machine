import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class GitError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
    public readonly stdout: string,
    public readonly command: string[]
  ) {
    super(message);
    this.name = 'GitError';
  }
}

export interface GitRunResult {
  stdout: string;
  stderr: string;
}

export async function runGit(args: string[], cwd: string = process.cwd()): Promise<GitRunResult> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 20 * 1024 * 1024, // 20 MB buffer
      encoding: 'utf8',
      env: {
        ...process.env,
        // Ensure consistent git output format across languages and platforms
        LC_ALL: 'C',
        LANG: 'C',
        GIT_PAGER: 'cat'
      }
    });

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString()
    };
  } catch (err: unknown) {
    const nodeErr = err as {
      code?: string | number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };

    if (nodeErr.code === 'ENOENT') {
      throw new GitError(
        'Git is not installed or not found in PATH.',
        -1,
        'git: command not found',
        '',
        args
      );
    }

    const exitCode = typeof nodeErr.code === 'number' ? nodeErr.code : 1;
    const stderrStr = nodeErr.stderr ? nodeErr.stderr.toString() : '';
    const stdoutStr = nodeErr.stdout ? nodeErr.stdout.toString() : '';

    throw new GitError(
      stderrStr.trim() || nodeErr.message || 'Git command failed',
      exitCode,
      stderrStr,
      stdoutStr,
      args
    );
  }
}
