import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import YAML from 'yaml';
import type { DiscoveredFlag, FlagLocation, StaleflagsConfig } from '../types.js';

/**
 * Scan JSON/YAML config files for boolean keys that match flag prefixes.
 */
export async function discoverConfigFlags(
  repoPath: string,
  config: StaleflagsConfig,
): Promise<Map<string, DiscoveredFlag>> {
  const flags = new Map<string, DiscoveredFlag>();

  const files = await fg(config.configFiles, {
    cwd: repoPath,
    absolute: true,
    ignore: config.exclude.map((e) => `**/${e}/**`),
    dot: false,
  });

  for (const file of files) {
    const relPath = path.relative(repoPath, file);
    const ext = path.extname(file).toLowerCase();

    try {
      const content = fs.readFileSync(file, 'utf-8');
      let parsed: Record<string, unknown>;

      if (ext === '.json') {
        parsed = JSON.parse(content);
      } else if (ext === '.yaml' || ext === '.yml') {
        parsed = YAML.parse(content) as Record<string, unknown>;
      } else {
        continue;
      }

      extractFlagKeys(parsed, relPath, config.envPrefixes, flags);
    } catch {
      // Skip files that fail to parse
    }
  }

  return flags;
}

function extractFlagKeys(
  obj: Record<string, unknown>,
  file: string,
  prefixes: string[],
  flags: Map<string, DiscoveredFlag>,
  keyPath: string[] = [],
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = [...keyPath, key].join('.');

    if (typeof value === 'boolean' && matchesPrefix(key, prefixes)) {
      const flagName = key;
      const location: FlagLocation = {
        file,
        line: 0, // JSON/YAML don't give us line numbers cheaply
        column: 0,
        snippet: `${fullKey}: ${value}`,
        language: 'config',
        kind: 'config-key',
      };

      const existing = flags.get(flagName);
      if (existing) {
        existing.locations.push(location);
      } else {
        flags.set(flagName, {
          name: flagName,
          source: 'config',
          locations: [location],
        });
      }
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      extractFlagKeys(
        value as Record<string, unknown>,
        file,
        prefixes,
        flags,
        [...keyPath, key],
      );
    }
  }
}

function matchesPrefix(key: string, prefixes: string[]): boolean {
  return prefixes.some((p) => key.startsWith(p));
}
