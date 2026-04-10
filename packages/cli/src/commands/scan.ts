import { analyzeFlags } from '@staleflags/core';
import type { StaleflagsConfig } from '@staleflags/core';
import { formatConsole } from '../reporter/console.js';
import { formatJson } from '../reporter/json.js';
import { formatMarkdown } from '../reporter/markdown.js';

export interface ScanOptions {
  path: string;
  format: 'console' | 'json' | 'markdown';
  failOn?: 'dead' | 'aging' | 'all' | 'none';
  envPrefixes?: string[];
}

export async function runScan(options: ScanOptions): Promise<number> {
  const overrides: Partial<StaleflagsConfig> = {};
  if (options.envPrefixes) {
    overrides.envPrefixes = options.envPrefixes;
  }

  const result = await analyzeFlags(options.path, overrides);

  switch (options.format) {
    case 'json':
      process.stdout.write(formatJson(result) + '\n');
      break;
    case 'markdown':
      process.stdout.write(formatMarkdown(result) + '\n');
      break;
    default:
      process.stdout.write(formatConsole(result));
      break;
  }

  if (options.failOn && options.failOn !== 'none') {
    const { summary } = result;

    switch (options.failOn) {
      case 'dead':
        return summary.deadFlags > 0 ? 1 : 0;
      case 'aging':
        return summary.agingFlags > 0 ? 1 : 0;
      case 'all':
        return summary.deadFlags > 0 || summary.agingFlags > 0 ? 1 : 0;
    }
  }

  return 0;
}
