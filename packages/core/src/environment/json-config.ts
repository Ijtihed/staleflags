import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import type { EnvironmentMap, StaleflagsConfig } from '../types.js';

/**
 * Parse environment-specific JSON config files.
 * Expects files like config/dev.json, config/staging.json, config/prod.json
 * containing flat or nested objects with boolean flag values.
 */
export async function parseJsonConfigs(
  repoPath: string,
  config: StaleflagsConfig,
): Promise<EnvironmentMap> {
  const envMap: EnvironmentMap = new Map();

  const jsonGlobs = config.configFiles.filter(
    (g) => g.endsWith('.json') || g.includes('*.json'),
  );
  if (jsonGlobs.length === 0) return envMap;

  const files = await fg(jsonGlobs, {
    cwd: repoPath,
    absolute: true,
    ignore: config.exclude.map((e) => `**/${e}/**`),
  });

  for (const file of files) {
    const envName = deriveEnvName(file);

    try {
      const content = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      extractBooleanFlags(parsed, envName, config.envPrefixes, envMap);
    } catch {
      // Skip unparseable files
    }
  }

  return envMap;
}

function extractBooleanFlags(
  obj: Record<string, unknown>,
  envName: string,
  prefixes: string[],
  envMap: EnvironmentMap,
  keyPath: string[] = [],
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'boolean' && prefixes.some((p) => key.startsWith(p))) {
      let flagEnvs = envMap.get(key);
      if (!flagEnvs) {
        flagEnvs = new Map();
        envMap.set(key, flagEnvs);
      }
      flagEnvs.set(envName, String(value));
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      extractBooleanFlags(
        value as Record<string, unknown>,
        envName,
        prefixes,
        envMap,
        [...keyPath, key],
      );
    }
  }
}

/**
 * Derive a human-readable environment name from a config file path.
 * e.g. "config/production.json" → "production.json"
 */
function deriveEnvName(filePath: string): string {
  return path.basename(filePath);
}
