#!/usr/bin/env node

import { runCli } from '../dist/cli/index.js';

runCli(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    process.stderr.write(`Fatal error: ${err?.message || err}\n`);
    process.exit(1);
  });
