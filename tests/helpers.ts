import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BIN_PATH = path.resolve(__dirname, '../bin/commit-time-machine.js');

export interface TestRepo {
  dir: string;
  git: (args: string[]) => string;
  writeFile: (relPath: string, content: string | Buffer) => void;
  commitFile: (relPath: string, content: string | Buffer, message: string) => string;
  cleanup: () => void;
}

export function createTempRepo(): TestRepo {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctm-test-repo-'));

  const git = (args: string[]) => {
    return execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        LC_ALL: 'C',
        LANG: 'C',
        GIT_PAGER: 'cat'
      }
    });
  };

  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Test Author']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'commit.gpgsign', 'false']);

  const writeFile = (relPath: string, content: string | Buffer) => {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  };

  const commitFile = (relPath: string, content: string | Buffer, message: string): string => {
    writeFile(relPath, content);
    git(['add', relPath]);
    git(['commit', '-m', message]);
    return git(['rev-parse', 'HEAD']).trim();
  };

  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  };

  return { dir, git, writeFile, commitFile, cleanup };
}

export function runCliProcess(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [BIN_PATH, ...args],
      {
        cwd,
        env: {
          ...process.env,
          ...env
        },
        encoding: 'utf8'
      },
      (error, stdout, stderr) => {
        const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode
        });
      }
    );
  });
}

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}
