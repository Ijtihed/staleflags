import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import YAML from 'yaml';
import type { EnvironmentMap, StaleflagsConfig } from '../types.js';

/**
 * Parse environment-specific YAML config files.
 */
export async function parseYamlConfigs(
  repoPath: string,
  config: StaleflagsConfig,
): Promise<EnvironmentMap> {
  const envMap: EnvironmentMap = new Map();

  const yamlGlobs = config.configFiles.filter(
    (g) => g.endsWith('.yaml') || g.endsWith('.yml') || g.includes('*.yaml') || g.includes('*.yml'),
  );
  if (yamlGlobs.length === 0) return envMap;

  const files = await fg(yamlGlobs, {
    cwd: repoPath,
    absolute: true,
    ignore: config.exclude.map((e) => `**/${e}/**`),
  });

  for (const file of files) {
    const envName = path.basename(file);

    try {
      const content = fs.readFileSync(file, 'utf-8');
      const parsed = YAML.parse(content) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        extractBooleanFlags(parsed, envName, config.envPrefixes, envMap);
      }
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
      extractBooleanFlags(value as Record<string, unknown>, envName, prefixes, envMap);
    }
  }
}
