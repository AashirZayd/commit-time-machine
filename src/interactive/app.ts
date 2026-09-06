import readline from 'node:readline';
import type { RepoInfo, RawCommit } from '../types/index.js';
import type { InteractiveState } from './types.js';
import { createInitialState, transition } from './state.js';
import { mapKeyToAction } from './input.js';
import { renderInteractiveScreen } from './renderer.js';
import { getBoundedCommitDiff } from '../git/diff.js';

export function isTTYAvailable(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function startInteractiveSession(
  repo: RepoInfo,
  commits: RawCommit[],
  cwd: string = process.cwd()
): Promise<number> {
  if (!isTTYAvailable()) {
    process.stderr.write('Interactive mode requires a TTY.\nUse the normal CLI output or --json instead.\n');
    return 1;
  }

  if (commits.length === 0) {
    process.stdout.write('No commits matched the current filters.\n');
    return 0;
  }

  let state: InteractiveState = createInitialState(
    repo,
    commits,
    process.stdout.columns || 80,
    process.stdout.rows || 24
  );

  let isCleanedUp = false;

  return new Promise<number>((resolve) => {
    let onKeypress: ((str: string, key: readline.Key) => Promise<void>) | null = null;
    let onResize: (() => void) | null = null;
    let onSigint: (() => void) | null = null;
    let onSigterm: (() => void) | null = null;
    let onUncaught: ((err: Error) => void) | null = null;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      // Unregister all listeners cleanly
      if (onKeypress) {
        process.stdin.removeListener('keypress', onKeypress);
      }
      if (onResize) {
        process.stdout.removeListener('resize', onResize);
      }
      if (onSigint) {
        process.removeListener('SIGINT', onSigint);
      }
      if (onSigterm) {
        process.removeListener('SIGTERM', onSigterm);
      }
      if (onUncaught) {
        process.removeListener('uncaughtException', onUncaught);
      }

      try {
        if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
      } catch {
        // Ignore stdin restore errors on process shutdown
      }

      try {
        // Restore cursor and main screen buffer
        process.stdout.write('\x1b[?25h'); // Show cursor
        process.stdout.write('\x1b[?1049l'); // Exit alternate screen buffer
      } catch {
        // Ignore stdout errors on process shutdown
      }
    };

    const draw = () => {
      if (isCleanedUp) return;
      const output = renderInteractiveScreen(state);
      // Move cursor to home and clear screen before rendering
      process.stdout.write('\x1b[H\x1b[2J' + output);
    };

    onSigint = () => {
      cleanup();
      resolve(0);
    };

    onSigterm = () => {
      cleanup();
      resolve(0);
    };

    onUncaught = (err: Error) => {
      cleanup();
      process.stderr.write(`Interactive session error: ${err.message}\n`);
      resolve(1);
    };

    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
    process.once('uncaughtException', onUncaught);

    onResize = () => {
      state.terminalWidth = process.stdout.columns || 80;
      state.terminalHeight = process.stdout.rows || 24;
      state = transition(state, 'RESIZE');
      draw();
    };

    process.stdout.on('resize', onResize);

    try {
      // Enter alternate screen buffer & hide cursor
      process.stdout.write('\x1b[?1049h'); // Enter alternate screen buffer
      process.stdout.write('\x1b[?25l'); // Hide cursor

      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      onKeypress = async (str: string, key: readline.Key) => {
        if (isCleanedUp) return;
        const action = mapKeyToAction(str, key);

        if (action === 'DIFF' && state.view === 'detail') {
          const selectedCommit = state.commits[state.selectedIndex];
          if (selectedCommit) {
            state.diffCache = state.diffCache || {};
            const cached = state.diffCache[selectedCommit.hash];
            if (cached) {
              state.diffOutput = cached;
              state.diffCommitHash = selectedCommit.hash;
            } else {
              state.diffOutput = 'Loading diff...';
              state.diffCommitHash = selectedCommit.hash;
              draw();
              const diffText = await getBoundedCommitDiff(selectedCommit.hash, 80, cwd);
              state.diffCache[selectedCommit.hash] = diffText;
              state.diffOutput = diffText;
            }
          }
        }

        state = transition(state, action);

        if (state.isExited) {
          cleanup();
          resolve(0);
          return;
        }

        draw();
      };

      process.stdin.on('keypress', onKeypress);

      // Initial draw
      draw();
    } catch (err: unknown) {
      cleanup();
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Failed to start interactive mode: ${message}\n`);
      resolve(1);
    }
  });
}
