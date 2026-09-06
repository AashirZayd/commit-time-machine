import { describe, it, expect } from 'vitest';
import { parseArgs, ArgumentError, getHelpText } from '../src/cli/args.js';

describe('parseArgs', () => {
  it('parses default options', () => {
    const opts = parseArgs([]);
    expect(opts.limit).toBe(10);
    expect(opts.verbose).toBe(false);
    expect(opts.json).toBe(false);
    expect(opts.help).toBe(false);
    expect(opts.firstParent).toBe(false);
  });

  it('parses --limit correctly', () => {
    const opts = parseArgs(['--limit', '5']);
    expect(opts.limit).toBe(5);

    const optsEq = parseArgs(['--limit=25']);
    expect(optsEq.limit).toBe(25);
  });

  it('throws ArgumentError on invalid --limit', () => {
    expect(() => parseArgs(['--limit'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--limit', '-5'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--limit', '0'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--limit', 'abc'])).toThrow(ArgumentError);
  });

  it('parses --commit and --file', () => {
    const opts = parseArgs(['--commit', 'a1b2c3d']);
    expect(opts.commit).toBe('a1b2c3d');

    const optsFile = parseArgs(['--file', 'src/index.ts']);
    expect(optsFile.file).toBe('src/index.ts');
  });

  it('parses Phase 2 flags: --first-parent, --at, --compare, --search, --author, --branch', () => {
    expect(parseArgs(['--first-parent']).firstParent).toBe(true);

    const atOpts = parseArgs(['--at', '3853e59']);
    expect(atOpts.at).toBe('3853e59');

    const compOpts1 = parseArgs(['--compare', 'a1b2c3d', 'e4f5g6h']);
    expect(compOpts1.compare).toEqual(['a1b2c3d', 'e4f5g6h']);

    const compOpts2 = parseArgs(['--compare', 'a1b2c3d..e4f5g6h']);
    expect(compOpts2.compare).toEqual(['a1b2c3d', 'e4f5g6h']);

    const searchOpts = parseArgs(['--search', 'landing page']);
    expect(searchOpts.search).toBe('landing page');

    const authorOpts = parseArgs(['--author', 'Aashir Zayd']);
    expect(authorOpts.author).toBe('Aashir Zayd');

    const branchOpts = parseArgs(['--branch', 'feature/login']);
    expect(branchOpts.branch).toBe('feature/login');
  });

  it('allows valid flag combinations with modifiers', () => {
    const opts1 = parseArgs(['--branch', 'feature', '--limit', '20']);
    expect(opts1.branch).toBe('feature');
    expect(opts1.limit).toBe(20);

    const opts2 = parseArgs(['--author', 'Aashir Zayd', '--limit', '10']);
    expect(opts2.author).toBe('Aashir Zayd');
    expect(opts2.limit).toBe(10);

    const opts3 = parseArgs(['--search', 'fix', '--limit', '5']);
    expect(opts3.search).toBe('fix');
    expect(opts3.limit).toBe(5);

    const opts4 = parseArgs(['--branch', 'main', '--first-parent']);
    expect(opts4.branch).toBe('main');
    expect(opts4.firstParent).toBe(true);
  });

  it('parses -i and --interactive correctly', () => {
    expect(parseArgs(['-i']).interactive).toBe(true);
    expect(parseArgs(['--interactive']).interactive).toBe(true);
    const combined = parseArgs(['-i', '--branch', 'main', '--limit', '15']);
    expect(combined.interactive).toBe(true);
    expect(combined.branch).toBe('main');
    expect(combined.limit).toBe(15);
  });

  it('rejects ambiguous or mutually exclusive primary modes', () => {
    expect(() => parseArgs(['--commit', 'a1b2c3d', '--compare', 'c1', 'c2'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--at', 'a1b2c3d', '--search', 'term'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--file', 'README.md', '--author', 'Tester'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--interactive', '--json'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--interactive', '--commit', 'a1b2c3d'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--interactive', '--at', '3853e59'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--interactive', '--compare', 'c1', 'c2'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--interactive', '--file', 'README.md'])).toThrow(ArgumentError);
  });

  it('accepts --interactive with all valid timeline filters', () => {
    const opts = parseArgs([
      '--interactive',
      '--branch', 'feature',
      '--first-parent',
      '--since', '14 days ago',
      '--limit', '25'
    ]);
    expect(opts.interactive).toBe(true);
    expect(opts.branch).toBe('feature');
    expect(opts.firstParent).toBe(true);
    expect(opts.since).toBe('14 days ago');
    expect(opts.limit).toBe(25);

    const optsSearch = parseArgs(['-i', '--search', 'refactor']);
    expect(optsSearch.interactive).toBe(true);
    expect(optsSearch.search).toBe('refactor');

    const optsAuthor = parseArgs(['-i', '--author', 'Alice']);
    expect(optsAuthor.interactive).toBe(true);
    expect(optsAuthor.author).toBe('Alice');
  });

  it('throws on missing required parameters', () => {
    expect(() => parseArgs(['--commit'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--at'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--compare'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--compare', 'onlyone'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--search'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--author'])).toThrow(ArgumentError);
    expect(() => parseArgs(['--branch'])).toThrow(ArgumentError);
  });

  it('generates non-empty help text with all commands', () => {
    const help = getHelpText();
    expect(help).toContain('COMMIT TIME MACHINE');
    expect(help).toContain('--first-parent');
    expect(help).toContain('--at');
    expect(help).toContain('--compare');
    expect(help).toContain('--search');
    expect(help).toContain('--author');
    expect(help).toContain('--branch');
  });
});
