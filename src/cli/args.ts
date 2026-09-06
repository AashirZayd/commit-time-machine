import type { CliOptions } from '../types/index.js';

export class ArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgumentError';
  }
}

export function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    limit: 10,
    verbose: false,
    json: false,
    help: false,
    version: false,
    firstParent: false,
    interactive: false
  };

  const specifiedModes: string[] = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      options.version = true;
      continue;
    }

    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--interactive' || arg === '-i') {
      options.interactive = true;
      continue;
    }

    if (arg === '--first-parent') {
      options.firstParent = true;
      continue;
    }

    if (arg === '--limit' || arg.startsWith('--limit=')) {
      let valStr: string | undefined;
      if (arg.startsWith('--limit=')) {
        valStr = arg.split('=')[1];
      } else {
        i++;
        valStr = rawArgs[i];
      }

      if (!valStr) {
        throw new ArgumentError('Option --limit requires a positive integer value.');
      }

      const parsed = Number(valStr);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ArgumentError(`Invalid --limit value "${valStr}". Must be a positive integer.`);
      }

      options.limit = parsed;
      continue;
    }

    if (arg === '--commit' || arg.startsWith('--commit=')) {
      let valStr: string | undefined;
      if (arg.startsWith('--commit=')) {
        valStr = arg.split('=')[1];
      } else {
        i++;
        valStr = rawArgs[i];
      }

      if (!valStr || valStr.startsWith('-')) {
        throw new ArgumentError('Option --commit requires a commit hash or reference.');
      }

      options.commit = valStr.trim();
      specifiedModes.push('commit');
      continue;
    }

    if (arg === '--at' || arg.startsWith('--at=')) {
      let valStr: string | undefined;
      if (arg.startsWith('--at=')) {
        valStr = arg.split('=')[1];
      } else {
        i++;
        valStr = rawArgs[i];
      }

      if (!valStr || valStr.startsWith('-')) {
        throw new ArgumentError('Option --at requires a commit hash or reference.');
      }

      options.at = valStr.trim();
      specifiedModes.push('at');
      continue;
    }

    if (arg === '--compare' || arg.startsWith('--compare=')) {
      let c1: string | undefined;
      let c2: string | undefined;

      if (arg.startsWith('--compare=')) {
        const val = arg.split('=')[1];
        if (val.includes('..')) {
          const parts = val.split('..');
          c1 = parts[0];
          c2 = parts[1];
        } else {
          c1 = val;
          i++;
          c2 = rawArgs[i];
        }
      } else {
        i++;
        const next = rawArgs[i];
        if (next && next.includes('..')) {
          const parts = next.split('..');
          c1 = parts[0];
          c2 = parts[1];
        } else {
          c1 = next;
          i++;
          c2 = rawArgs[i];
        }
      }

      if (!c1 || !c2 || c1.startsWith('-') || c2.startsWith('-')) {
        throw new ArgumentError('Option --compare requires two commit hashes (e.g. --compare <commit1> <commit2>).');
      }

      options.compare = [c1.trim(), c2.trim()];
      specifiedModes.push('compare');
      continue;
    }

    if (arg === '--file' || arg.startsWith('--file=')) {
      let valStr: string | undefined;
      if (arg.startsWith('--file=')) {
        valStr = arg.split('=')[1];
      } else {
        i++;
        valStr = rawArgs[i];
      }

      if (!valStr || valStr.startsWith('-')) {
        throw new ArgumentError('Option --file requires a file path.');
      }

      options.file = valStr.trim();
      specifiedModes.push('file');
      continue;
    }

    if (arg === '--search' || arg.startsWith('--search=')) {
      let valStr: string | undefined;
      if (arg.startsWith('--search=')) {
        valStr = arg.split('=')[1];
      } else {
        i++;
        valStr = rawArgs[i];
      }

      if (!valStr || valStr.startsWith('-')) {
        throw new ArgumentError('Option --search requires a search query term.');
      }

      options.search = valStr.trim();
      specifiedModes.push('search');
      continue;
    }

    if (arg === '--author' || arg.startsWith('--author=')) {
      let valStr: string | undefined;
      if (arg.startsWith('--author=')) {
        valStr = arg.split('=')[1];
      } else {
        i++;
        valStr = rawArgs[i];
      }

      if (!valStr || valStr.startsWith('-')) {
        throw new ArgumentError('Option --author requires an author name or email pattern.');
      }

      options.author = valStr.trim();
      specifiedModes.push('author');
      continue;
    }

    if (arg === '--branch' || arg.startsWith('--branch=')) {
      let valStr: string | undefined;
      if (arg.startsWith('--branch=')) {
        valStr = arg.split('=')[1];
      } else {
        i++;
        valStr = rawArgs[i];
      }

      if (!valStr || valStr.startsWith('-')) {
        throw new ArgumentError('Option --branch requires a branch name.');
      }

      options.branch = valStr.trim();
      continue;
    }

    if (arg === '--since' || arg.startsWith('--since=')) {
      let valStr: string | undefined;
      if (arg.startsWith('--since=')) {
        valStr = arg.split('=')[1];
      } else {
        i++;
        valStr = rawArgs[i];
      }

      if (!valStr || valStr.startsWith('-')) {
        throw new ArgumentError('Option --since requires a date expression (e.g. "30 days ago" or "2026-09-01").');
      }

      options.since = valStr.trim();
      continue;
    }

    if (arg === '--cwd' || arg.startsWith('--cwd=')) {
      let valStr: string | undefined;
      if (arg.startsWith('--cwd=')) {
        valStr = arg.split('=')[1];
      } else {
        i++;
        valStr = rawArgs[i];
      }
      options.cwd = valStr;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new ArgumentError(`Unknown option "${arg}". Run commit-time-machine --help for usage.`);
    }
  }

  // Enforce JSON & interactive conflict
  if (options.json && options.interactive) {
    throw new ArgumentError('Cannot combine --json with --interactive mode.');
  }

  // Enforce mutual exclusivity among primary query modes
  if (specifiedModes.length > 1) {
    throw new ArgumentError(
      `Cannot combine options --${specifiedModes[0]} and --${specifiedModes[1]}. Please specify a single query mode.`
    );
  }

  if (options.interactive && (options.commit || options.at || options.compare || options.file)) {
    const conflicting = options.commit ? 'commit' : options.at ? 'at' : options.compare ? 'compare' : 'file';
    throw new ArgumentError(`Cannot combine option --${conflicting} with --interactive mode.`);
  }

  return options;
}

export function getHelpText(): string {
  return `
COMMIT TIME MACHINE
A human-friendly Git history explorer.

Usage:
  commit-time-machine [options]

Primary Modes:
  commit-time-machine                  Show recent repository timeline
  -i, --interactive                    Browse repository history in an interactive terminal timeline
  --at <commit>                        Inspect repository snapshot structure at a point in time
  --compare <commit1> <commit2>        Compare changes between two commits
  --commit <hash>                      Inspect details of a specific commit
  --file <path>                        Show evolutionary history of a specific file
  --search "<term>"                    Search commit messages for matching terms
  --author "<name>"                    Show commits by a specific author

Filters & Modifiers:
  --branch <branch>                    Inspect history reachable from specified local branch
  --first-parent                       Show only mainline / integration commits
  --limit <n>                          Number of commits to display (default: 10)
  --since <expr>                       Filter commits since date expression (e.g. "30 days ago")
  --verbose                            Show detailed changes and files for each commit
  --json                               Output pure JSON data to stdout

Help & Info:
  -h, --help                           Show help and usage instructions
  -v, --version                        Show version number

Examples:
  commit-time-machine
  commit-time-machine -i
  commit-time-machine --interactive --branch main
  commit-time-machine --first-parent
  commit-time-machine --at 3853e59
  commit-time-machine --compare 2a8cc2f 3853e59
  commit-time-machine --search "landing page"
  commit-time-machine --author "Aashir Zayd"
  commit-time-machine --branch feature --limit 20
  commit-time-machine --file README.md
  commit-time-machine --json
`.trim();
}
