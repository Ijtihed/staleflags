import { describe, it, expect } from 'vitest';
import { classifyFlag, mergeEnvironmentMaps, injectConstValues } from '../../src/environment/consistency.js';
import type { DiscoveredFlag, EnvironmentMap } from '../../src/types.js';

function makeFlag(name: string, source: 'env' | 'const' = 'env', snippet?: string): DiscoveredFlag {
  return {
    name,
    source,
    locations: [
      {
        file: 'src/test.ts',
        line: 1,
        column: 1,
        snippet: snippet ?? `process.env.${name}`,
        language: 'typescript',
        kind: source === 'const' ? 'const-assignment' : 'env-read',
      },
    ],
  };
}

function makeEnvMap(entries: Record<string, Record<string, string>>): EnvironmentMap {
  const map: EnvironmentMap = new Map();
  for (const [flagName, envs] of Object.entries(entries)) {
    map.set(flagName, new Map(Object.entries(envs)));
  }
  return map;
}

describe('classifyFlag', () => {
  it('flag true in all 3 envs → DEAD', () => {
    const flag = makeFlag('ENABLE_X');
    const envMap = makeEnvMap({
      ENABLE_X: { '.env.dev': 'true', '.env.staging': 'true', '.env.prod': 'true' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
    expect(result.value).toBe(true);
    expect(result.deadBranch).toBe('else');
  });

  it('flag false in all 3 envs → DEAD', () => {
    const flag = makeFlag('DISABLE_X');
    const envMap = makeEnvMap({
      DISABLE_X: { '.env.dev': 'false', '.env.staging': 'false', '.env.prod': 'false' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
    expect(result.value).toBe(false);
    expect(result.deadBranch).toBe('if');
  });

  it('flag true in dev, false in prod → ACTIVE', () => {
    const flag = makeFlag('FEATURE_X');
    const envMap = makeEnvMap({
      FEATURE_X: { '.env.dev': 'true', '.env.prod': 'false' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('active');
  });

  it('flag with value "1" in all envs → DEAD (treats 1 as truthy)', () => {
    const flag = makeFlag('ENABLE_X');
    const envMap = makeEnvMap({
      ENABLE_X: { '.env.dev': '1', '.env.staging': '1', '.env.prod': '1' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
    expect(result.value).toBe(true);
  });

  it('mixed "true" and "1" are normalized to the same value → DEAD', () => {
    const flag = makeFlag('ENABLE_X');
    const envMap = makeEnvMap({
      ENABLE_X: { '.env.dev': 'true', '.env.staging': '1', '.env.prod': 'yes' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
    expect(result.value).toBe(true);
  });

  it('flag in code but zero env files define it → PHANTOM', () => {
    const flag = makeFlag('ENABLE_MYSTERY');
    const envMap: EnvironmentMap = new Map();
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('phantom');
    expect(result.note).toContain('never defined');
  });

  it('const ENABLE_X = true with no env override → DEAD (hardcoded)', () => {
    const flag = makeFlag('ENABLE_X', 'const', 'const ENABLE_X = true');
    const envMap: EnvironmentMap = new Map();
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
    expect(result.value).toBe(true);
    expect(result.deadBranch).toBe('else');
    expect(result.note).toContain('Hardcoded');
  });

  it('const ENABLE_X = false with no env override → DEAD (hardcoded false)', () => {
    const flag = makeFlag('ENABLE_X', 'const', 'const ENABLE_X = false');
    const envMap: EnvironmentMap = new Map();
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
    expect(result.value).toBe(false);
    expect(result.deadBranch).toBe('if');
  });

  it('flag with "0" in all envs → DEAD (falsy)', () => {
    const flag = makeFlag('ENABLE_X');
    const envMap = makeEnvMap({
      ENABLE_X: { '.env.dev': '0', '.env.prod': '0' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
    expect(result.value).toBe(false);
  });

  it('flag with mixed truthy/falsy values → ACTIVE', () => {
    const flag = makeFlag('FEATURE_X');
    const envMap = makeEnvMap({
      FEATURE_X: { '.env.dev': '1', '.env.prod': '0' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('active');
  });

  it('flag "yes" everywhere → DEAD', () => {
    const flag = makeFlag('ENABLE_X');
    const envMap = makeEnvMap({
      ENABLE_X: { '.env.dev': 'yes', '.env.prod': 'yes' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
    expect(result.value).toBe(true);
  });

  it('flag with empty string in all envs → DEAD (falsy)', () => {
    const flag = makeFlag('ENABLE_X');
    const envMap = makeEnvMap({
      ENABLE_X: { '.env.dev': '', '.env.prod': '' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
    expect(result.value).toBe(false);
  });

  it('returns correct environments object', () => {
    const flag = makeFlag('FEATURE_X');
    const envMap = makeEnvMap({
      FEATURE_X: { '.env.dev': 'true', '.env.prod': 'false' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.environments).toEqual({ '.env.dev': 'true', '.env.prod': 'false' });
  });

  // Minimum env count for dead classification
  it('flag in only 1 real env → NOT dead (insufficient data)', () => {
    const flag = makeFlag('ENABLE_X');
    const envMap = makeEnvMap({
      ENABLE_X: { '.env': 'true' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('active');
    expect(result.note).toContain('1 environment file');
  });

  it('flag in 2 real envs with same value → DEAD', () => {
    const flag = makeFlag('ENABLE_X');
    const envMap = makeEnvMap({
      ENABLE_X: { '.env.dev': 'true', '.env.prod': 'true' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
  });

  it('hardcoded const → still dead regardless of env file count', () => {
    const flag = makeFlag('ENABLE_X', 'const', 'const ENABLE_X = true');
    const envMap: EnvironmentMap = new Map();
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
  });

  it('hardcoded const with matching env value → dead', () => {
    const flag = makeFlag('ENABLE_X', 'const', 'const ENABLE_X = true');
    const envMap = makeEnvMap({
      ENABLE_X: { 'hardcoded (src/index.ts:1)': 'true' },
    });
    const result = classifyFlag(flag, envMap);
    expect(result.status).toBe('dead');
  });
});

describe('mergeEnvironmentMaps', () => {
  it('merges two disjoint maps', () => {
    const a = makeEnvMap({ ENABLE_A: { '.env': 'true' } });
    const b = makeEnvMap({ ENABLE_B: { '.env': 'false' } });
    const merged = mergeEnvironmentMaps(a, b);
    expect(merged.size).toBe(2);
    expect(merged.get('ENABLE_A')?.get('.env')).toBe('true');
    expect(merged.get('ENABLE_B')?.get('.env')).toBe('false');
  });

  it('later map overwrites earlier for same env', () => {
    const a = makeEnvMap({ ENABLE_A: { '.env': 'true' } });
    const b = makeEnvMap({ ENABLE_A: { '.env': 'false' } });
    const merged = mergeEnvironmentMaps(a, b);
    expect(merged.get('ENABLE_A')?.get('.env')).toBe('false');
  });

  it('merges different envs for same flag', () => {
    const a = makeEnvMap({ ENABLE_A: { '.env.dev': 'true' } });
    const b = makeEnvMap({ ENABLE_A: { '.env.prod': 'false' } });
    const merged = mergeEnvironmentMaps(a, b);
    expect(merged.get('ENABLE_A')?.size).toBe(2);
  });
});

describe('injectConstValues', () => {
  it('adds hardcoded const to env map', () => {
    const flags = new Map<string, DiscoveredFlag>();
    flags.set('USE_V2', {
      name: 'USE_V2',
      source: 'const',
      locations: [
        {
          file: 'src/index.ts',
          line: 5,
          column: 1,
          snippet: 'const USE_V2 = true',
          language: 'typescript',
          kind: 'const-assignment',
        },
      ],
    });

    const envMap: EnvironmentMap = new Map();
    injectConstValues(flags, envMap);

    expect(envMap.has('USE_V2')).toBe(true);
    const vals = envMap.get('USE_V2')!;
    expect(vals.size).toBe(1);
    const key = [...vals.keys()][0];
    expect(key).toContain('hardcoded');
    expect(vals.get(key)).toBe('true');
  });
});
