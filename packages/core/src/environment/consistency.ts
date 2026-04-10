import type {
  DiscoveredFlag,
  EnvironmentMap,
  EnvironmentValues,
  FlagClassification,
} from '../types.js';

const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY = new Set(['false', '0', 'no', 'off', '']);

/**
 * THE CORE ALGORITHM.
 *
 * For each discovered flag, compare its value across all environments.
 * - Same value everywhere (≥2 real envs) → dead
 * - Different values → active
 * - Referenced in code but never defined → phantom
 *
 * Hardcoded const flags are always eligible for dead classification
 * regardless of env file count. For env-var flags, we require ≥2
 * real environment files with the same value — a single .env with
 * one value doesn't prove the flag is stuck.
 */
export function classifyFlag(
  flag: DiscoveredFlag,
  envMap: EnvironmentMap,
): FlagClassification {
  const values = envMap.get(flag.name);

  // Code reads it, but no environment/config ever defines it
  if (!values || values.size === 0) {
    const constLocation = flag.locations.find((l) => l.kind === 'const-assignment');
    if (constLocation) {
      return classifyHardcodedConst(constLocation.snippet);
    }

    return {
      status: 'phantom',
      environments: {},
      note: 'Referenced in code but never defined in any environment file',
    };
  }

  // Separate hardcoded entries from real env file entries
  const realEnvCount = countRealEnvs(values);
  const hasHardcoded = [...values.keys()].some((k) => k.startsWith('hardcoded ('));

  const uniqueValues = normalizeAndDedup(values);
  const envRecord = Object.fromEntries(values);

  if (uniqueValues.size === 1) {
    // All values are the same — but do we have enough evidence?
    // Hardcoded consts are inherently dead (value is in source code).
    // For env-var flags, require ≥2 real env files.
    if (!hasHardcoded && realEnvCount < 2) {
      return {
        status: 'active',
        environments: envRecord,
        note: realEnvCount === 0
          ? 'Only defined in template files'
          : 'Only found in 1 environment file — insufficient data to classify as dead',
      };
    }

    const rawValue = [...values.values()][0];
    const boolValue = TRUTHY.has(rawValue.toLowerCase());

    return {
      status: 'dead',
      value: boolValue,
      deadBranch: boolValue ? 'else' : 'if',
      environments: envRecord,
    };
  }

  return {
    status: 'active',
    environments: envRecord,
  };
}

function countRealEnvs(values: EnvironmentValues): number {
  let count = 0;
  for (const key of values.keys()) {
    if (!key.startsWith('hardcoded (')) count++;
  }
  return count;
}

/**
 * Classify a flag that only exists as a hardcoded constant.
 * e.g. `const ENABLE_NEW_CHECKOUT = true`
 */
function classifyHardcodedConst(snippet: string): FlagClassification {
  const isTrue = /=\s*true\b/.test(snippet);
  const isFalse = /=\s*false\b/.test(snippet);

  if (isTrue) {
    return {
      status: 'dead',
      value: true,
      deadBranch: 'else',
      environments: { hardcoded: 'true' },
      note: 'Hardcoded constant, always true',
    };
  }

  if (isFalse) {
    return {
      status: 'dead',
      value: false,
      deadBranch: 'if',
      environments: { hardcoded: 'false' },
      note: 'Hardcoded constant, always false',
    };
  }

  return {
    status: 'active',
    environments: { hardcoded: snippet },
    note: 'Hardcoded constant with non-boolean value',
  };
}

/**
 * Merge environment values from multiple sources (dotenv, JSON, YAML, consts).
 * Later sources overwrite earlier ones for the same env name.
 */
export function mergeEnvironmentMaps(...maps: EnvironmentMap[]): EnvironmentMap {
  const merged: EnvironmentMap = new Map();

  for (const map of maps) {
    for (const [flagName, envValues] of map) {
      let existing = merged.get(flagName);
      if (!existing) {
        existing = new Map();
        merged.set(flagName, existing);
      }
      for (const [envName, value] of envValues) {
        existing.set(envName, value);
      }
    }
  }

  return merged;
}

/**
 * Inject hardcoded const values into the environment map.
 * A `const ENABLE_X = true` is treated as the flag being "true" in
 * a pseudo-environment called "hardcoded".
 */
export function injectConstValues(
  flags: Map<string, DiscoveredFlag>,
  envMap: EnvironmentMap,
): void {
  for (const [name, flag] of flags) {
    if (flag.source !== 'const') continue;

    const constLoc = flag.locations.find((l) => l.kind === 'const-assignment');
    if (!constLoc) continue;

    const valueMatch = constLoc.snippet.match(/=\s*(true|false)\b/);
    if (!valueMatch) continue;

    let flagEnvs = envMap.get(name);
    if (!flagEnvs) {
      flagEnvs = new Map();
      envMap.set(name, flagEnvs);
    }
    flagEnvs.set(`hardcoded (${constLoc.file}:${constLoc.line})`, valueMatch[1]);
  }
}

/**
 * Normalize values (lowercase, trim) and return the set of unique values.
 */
function normalizeAndDedup(values: EnvironmentValues): Set<string> {
  const normalized = new Set<string>();
  for (const v of values.values()) {
    const n = v.toLowerCase().trim();
    // Normalize truthy/falsy to canonical form
    if (TRUTHY.has(n)) {
      normalized.add('true');
    } else if (FALSY.has(n)) {
      normalized.add('false');
    } else {
      normalized.add(n);
    }
  }
  return normalized;
}
