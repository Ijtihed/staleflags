import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StaleflagsConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

const CONFIG_FILENAMES = [
  '.staleflagsrc.json',
  '.staleflagsrc',
  'staleflags.config.json',
];

/**
 * Load configuration from the repo root, merging with defaults.
 */
export function loadConfig(
  repoPath: string,
  overrides?: Partial<StaleflagsConfig>,
): StaleflagsConfig {
  let fileConfig: Partial<StaleflagsConfig> = {};

  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(repoPath, filename);
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        fileConfig = JSON.parse(raw) as Partial<StaleflagsConfig>;
        break;
      } catch {
        // Skip malformed config
      }
    }
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...overrides,
    // Array fields: overrides replace entirely (don't merge arrays)
    envPrefixes: overrides?.envPrefixes ?? fileConfig.envPrefixes ?? DEFAULT_CONFIG.envPrefixes,
    exclude: overrides?.exclude ?? fileConfig.exclude ?? DEFAULT_CONFIG.exclude,
    ignoreFlags: overrides?.ignoreFlags ?? fileConfig.ignoreFlags ?? DEFAULT_CONFIG.ignoreFlags,
  };
}
