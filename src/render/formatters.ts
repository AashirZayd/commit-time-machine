import pc from 'picocolors';
import type { FileStatus } from '../types/index.js';

export function formatStatus(status: FileStatus): string {
  switch (status) {
    case 'A':
      return pc.green('A');
    case 'M':
      return pc.yellow('M');
    case 'D':
      return pc.red('D');
    case 'R':
      return pc.cyan('R');
    case 'C':
      return pc.blue('C');
    default:
      return pc.dim('?');
  }
}

export function formatAdditions(n: number): string {
  if (n <= 0) return pc.dim('0');
  return pc.green(`+${n}`);
}

export function formatDeletions(n: number): string {
  if (n <= 0) return pc.dim('0');
  return pc.red(`-${n}`);
}

export function indent(text: string, spaces: number = 2): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `${pad}${line}` : line))
    .join('\n');
}
