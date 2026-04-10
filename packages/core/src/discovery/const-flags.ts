import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import type { DiscoveredFlag, FlagLocation, StaleflagsConfig } from '../types.js';
import { buildConstPatterns } from './patterns.js';
import { detectLanguage } from './env-flags.js';

/**
 * Scan source files for hardcoded boolean constants that look like feature flags.
 * e.g. `const ENABLE_NEW_CHECKOUT = true`
 */
export async function discoverConstFlags(
  repoPath: string,
  config: StaleflagsConfig,
): Promise<Map<string, DiscoveredFlag>> {
  const patterns = buildConstPatterns(config.envPrefixes);
  const flags = new Map<string, DiscoveredFlag>();

  for (const pattern of patterns) {
    const files = await fg(pattern.fileGlobs, {
      cwd: repoPath,
      absolute: true,
      ignore: config.exclude.map((e) => `**/${e}/**`),
      dot: false,
    });

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(repoPath, file);
      const lang = detectLanguage(file);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
          const flagName = match.groups?.flagName ?? match[1];
          if (!flagName) continue;

          const location: FlagLocation = {
            file: relPath,
            line: i + 1,
            column: match.index + 1,
            snippet: line.trim(),
            language: lang,
            kind: 'const-assignment',
          };

          const existing = flags.get(flagName);
          if (existing) {
            existing.locations.push(location);
          } else {
            flags.set(flagName, {
              name: flagName,
              source: 'const',
              locations: [location],
            });
          }
        }
      }
    }
  }

  return flags;
}
