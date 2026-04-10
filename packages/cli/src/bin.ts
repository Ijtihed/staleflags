#!/usr/bin/env node

import { runScan, type ScanOptions } from './commands/scan.js';
import { runExplain } from './commands/explain.js';

const args = process.argv.slice(2);

function printHelp(): void {
  process.stdout.write(`
  staleflags v0.1.0 — find stale feature flags and dead code

  USAGE
    staleflags [options]              Scan current directory
    staleflags explain <FLAG_NAME>    Deep-dive a single flag

  OPTIONS
    --path <dir>             Directory to scan (default: cwd)
    --json                   Output JSON
    --markdown               Output Markdown
    --fail-on <level>        Exit non-zero if flags found: dead | aging | all | none
    --env-prefixes <list>    Comma-separated flag prefixes (default: ENABLE_,FEATURE_,FF_,USE_,DISABLE_,TOGGLE_)
    --help, -h               Show this help
    --version, -v            Show version

`);
}

async function main(): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write('staleflags v0.1.0\n');
    process.exit(0);
  }

  // explain subcommand
  if (args[0] === 'explain') {
    const flagName = args[1];
    if (!flagName) {
      process.stderr.write('  Error: explain requires a flag name\n');
      process.exit(1);
    }
    const pathArg = getArg('--path') ?? process.cwd();
    const code = await runExplain({ path: pathArg, flagName });
    process.exit(code);
  }

  // Default: scan
  const options: ScanOptions = {
    path: getArg('--path') ?? process.cwd(),
    format: args.includes('--json')
      ? 'json'
      : args.includes('--markdown')
        ? 'markdown'
        : 'console',
    failOn: (getArg('--fail-on') as ScanOptions['failOn']) ?? 'none',
    envPrefixes: getArg('--env-prefixes')?.split(','),
  };

  const code = await runScan(options);
  process.exit(code);
}

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

main().catch((err: unknown) => {
  process.stderr.write(`\n  Error: ${err instanceof Error ? err.message : String(err)}\n\n`);
  process.exit(2);
});
