import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { discoverConstFlags } from '../../src/discovery/const-flags.js';
import { DEFAULT_CONFIG } from '../../src/types.js';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');

describe('discoverConstFlags', () => {
  it('finds const USE_V2_PARSER = true in TS', async () => {
    const flags = await discoverConstFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    expect(flags.has('USE_V2_PARSER')).toBe(true);
    const flag = flags.get('USE_V2_PARSER')!;
    expect(flag.source).toBe('const');
    expect(flag.locations[0].kind).toBe('const-assignment');
    expect(flag.locations[0].snippet).toContain('true');
  });

  it('finds const ENABLE_LEGACY_COMPAT = false in TS', async () => {
    const flags = await discoverConstFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    expect(flags.has('ENABLE_LEGACY_COMPAT')).toBe(true);
    const flag = flags.get('ENABLE_LEGACY_COMPAT')!;
    expect(flag.locations[0].snippet).toContain('false');
  });

  it('returns empty for repos with no const flags', async () => {
    const flags = await discoverConstFlags(path.join(FIXTURES, 'repo-python'), DEFAULT_CONFIG);
    expect(flags.size).toBe(0);
  });

  it('records correct file and line', async () => {
    const flags = await discoverConstFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    const flag = flags.get('USE_V2_PARSER')!;
    expect(flag.locations[0].file).toBe('src/constants.ts');
    expect(flag.locations[0].line).toBeGreaterThan(0);
  });
});
