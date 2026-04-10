import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { discoverEnvFlags } from '../../src/discovery/env-flags.js';
import { DEFAULT_CONFIG } from '../../src/types.js';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');

describe('discoverEnvFlags', () => {
  it('finds process.env.ENABLE_X in TS files', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    expect(flags.has('ENABLE_NEW_CHECKOUT')).toBe(true);
    const flag = flags.get('ENABLE_NEW_CHECKOUT')!;
    expect(flag.locations.some((l) => l.file === 'src/checkout.ts')).toBe(true);
  });

  it('finds process.env.FEATURE_X in TS files', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    expect(flags.has('FEATURE_DARK_MODE')).toBe(true);
  });

  it('finds process.env.FF_X in TS files', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    expect(flags.has('FF_GRADUAL_ROLLOUT')).toBe(true);
  });

  it('finds os.environ.get("ENABLE_X") in Python', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-python'), DEFAULT_CONFIG);
    expect(flags.has('ENABLE_NEW_AUTH')).toBe(true);
    const flag = flags.get('ENABLE_NEW_AUTH')!;
    expect(flag.locations[0].language).toBe('python');
  });

  it('finds os.environ.get("FEATURE_X") in Python', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-python'), DEFAULT_CONFIG);
    expect(flags.has('FEATURE_SEARCH_V2')).toBe(true);
  });

  it('finds os.Getenv("ENABLE_X") in Go', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-go'), DEFAULT_CONFIG);
    expect(flags.has('ENABLE_NEW_ROUTER')).toBe(true);
    const flag = flags.get('ENABLE_NEW_ROUTER')!;
    expect(flag.locations[0].language).toBe('go');
  });

  it('finds ENV["FEATURE_X"] in Ruby', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-ruby'), DEFAULT_CONFIG);
    expect(flags.has('FEATURE_NEW_BILLING')).toBe(true);
    const flag = flags.get('FEATURE_NEW_BILLING')!;
    expect(flag.locations[0].language).toBe('ruby');
  });

  it('ignores process.env.DATABASE_URL (not a flag pattern)', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    expect(flags.has('DATABASE_URL')).toBe(false);
  });

  it('ignores process.env.PORT (not a flag pattern)', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    expect(flags.has('PORT')).toBe(false);
  });

  it('deduplicates same flag found in multiple locations', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    const flag = flags.get('ENABLE_NEW_CHECKOUT');
    expect(flag).toBeDefined();
    // Should have location entries but no line-level duplicates
    const uniqueLocations = new Set(
      flag!.locations.map((l) => `${l.file}:${l.line}`),
    );
    expect(uniqueLocations.size).toBe(flag!.locations.length);
  });

  it('finds flags in repo with no env files', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-no-envs'), DEFAULT_CONFIG);
    expect(flags.has('ENABLE_SOMETHING')).toBe(true);
  });

  it('records correct line numbers', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    const flag = flags.get('ENABLE_NEW_CHECKOUT')!;
    const loc = flag.locations.find((l) => l.file === 'src/checkout.ts');
    expect(loc).toBeDefined();
    expect(loc!.line).toBeGreaterThan(0);
  });

  it('returns empty map for empty repo', async () => {
    const flags = await discoverEnvFlags(path.join(FIXTURES, 'repo-empty'), DEFAULT_CONFIG);
    expect(flags.size).toBe(0);
  });
});
